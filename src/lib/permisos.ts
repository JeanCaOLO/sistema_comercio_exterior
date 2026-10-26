import { supabase } from './supabase';
import {
  GRUPOS_NAVEGACION,
  ITEM_CONFIGURACION,
  type GrupoId,
} from './navegacion';

export interface Modulo {
  id: string;
  nombre: string;
  icon: string;
  /** Módulo grande al que pertenece (solo agrupación visual) */
  grupo: GrupoId;
  /** Nombre visible del módulo grande */
  grupoNombre: string;
}

export interface Rol {
  nombre: string;
  descripcion: string;
  color: string;
}

// Matriz de permisos: rol -> lista de IDs de módulos a los que puede acceder
export type MatrizPermisos = Record<string, string[]>;

// Los módulos se derivan de la estructura de navegación para que el menú y la
// Matriz de Permisos siempre hablen del mismo catálogo (mismos ids internos).
export const MODULOS: Modulo[] = [
  ...GRUPOS_NAVEGACION.flatMap((grupo) =>
    grupo.secciones.flatMap((seccion) =>
      seccion.items.map((item) => ({
        id: item.id,
        nombre: item.label,
        icon: item.icon,
        grupo: grupo.id,
        grupoNombre: grupo.nombre,
      }))
    )
  ),
  {
    id: ITEM_CONFIGURACION.id,
    nombre: ITEM_CONFIGURACION.label,
    icon: ITEM_CONFIGURACION.icon,
    grupo: 'sistema',
    grupoNombre: 'Sistema',
  },
];

// Agrupa los módulos por módulo grande, respetando el orden del menú.
export function gruposDeModulos(): { id: string; nombre: string; modulos: Modulo[] }[] {
  const orden = [
    ...GRUPOS_NAVEGACION.map((grupo) => ({ id: grupo.id as string, nombre: grupo.nombre })),
    { id: 'sistema', nombre: 'Sistema' },
  ];
  return orden
    .map((entrada) => ({
      ...entrada,
      modulos: MODULOS.filter((modulo) => modulo.grupo === entrada.id),
    }))
    .filter((entrada) => entrada.modulos.length > 0);
}

export const ROLES: Rol[] = [
  { nombre: 'Administrador', descripcion: 'Acceso completo al sistema', color: 'bg-purple-100 text-purple-800' },
  { nombre: 'Gestor Dropship', descripcion: 'Gestión de expedientes Dropship', color: 'bg-blue-100 text-blue-800' },
  { nombre: 'Gestor ZF', descripcion: 'Gestión de expedientes ZF', color: 'bg-green-100 text-green-800' },
  { nombre: 'Bodega', descripcion: 'Gestión de recepción y almacenamiento', color: 'bg-orange-100 text-orange-800' },
  { nombre: 'Documentos', descripcion: 'Visualización de CCA, Repositorio Docs y Lista de Expedientes', color: 'bg-teal-100 text-teal-800' },
  { nombre: 'Expedientes', descripcion: 'Gestión de Dropship, ZF, Lista de Expedientes y Repositorio Docs', color: 'bg-indigo-100 text-indigo-800' },
  { nombre: 'Solicitante', descripcion: 'Solicitudes y carga de documentos', color: 'bg-rose-100 text-rose-800' },
];

export const PERMISOS_DEFAULT: MatrizPermisos = {
  'Administrador': [
    'dashboard', 'gestion-dropship', 'gestion-zf', 'lista-expedientes',
    'reportes', 'carga-caa', 'documentacion', 'repositorio', 'facturas', 'configuracion',
    'etd-solicitar', 'etd-aprobaciones', 'etd-historial', 'etd-dashboard'
  ],
  'Gestor Dropship': ['dashboard', 'gestion-dropship', 'lista-expedientes', 'documentacion', 'repositorio', 'facturas'],
  'Gestor ZF': ['dashboard', 'gestion-zf', 'lista-expedientes', 'documentacion', 'repositorio', 'facturas'],
  'Bodega': ['dashboard', 'gestion-zf', 'lista-expedientes', 'documentacion', 'repositorio'],
  'Documentos': ['lista-expedientes', 'carga-caa', 'repositorio', 'facturas', 'etd-dashboard', 'etd-solicitar', 'etd-historial'],
  'Expedientes': ['gestion-dropship', 'gestion-zf', 'lista-expedientes', 'documentacion', 'repositorio', 'facturas'],
  'Solicitante': ['carga-caa', 'documentacion', 'repositorio', 'facturas'],
};

const CLAVE_PERMISOS = 'matriz_permisos';
const CLAVE_APROBACION_ETD = 'roles_aprobacion_etd';

// Roles que, de forma predeterminada, pueden aprobar/rechazar cambios de ETD Inicial.
export const ROLES_APROBACION_ETD_DEFAULT: string[] = ['Administrador'];

// Carga desde la base de datos los roles autorizados a aprobar cambios de ETD Inicial.
export async function cargarRolesAprobacionEtd(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('valor')
      .eq('clave', CLAVE_APROBACION_ETD)
      .maybeSingle();
    if (error || !data || !Array.isArray(data.valor)) {
      return [...ROLES_APROBACION_ETD_DEFAULT];
    }
    return data.valor as string[];
  } catch (error) {
    console.error('Error cargando roles de aprobación ETD:', error);
    return [...ROLES_APROBACION_ETD_DEFAULT];
  }
}

// Guarda en la base de datos los roles autorizados a aprobar cambios de ETD Inicial.
export async function guardarRolesAprobacionEtd(roles: string[]): Promise<void> {
  const { data: existente, error: errorSelect } = await supabase
    .from('configuracion_sistema')
    .select('id')
    .eq('clave', CLAVE_APROBACION_ETD)
    .maybeSingle();
  if (errorSelect) throw errorSelect;

  if (existente) {
    const { error } = await supabase
      .from('configuracion_sistema')
      .update({ valor: roles, updated_at: new Date().toISOString() })
      .eq('clave', CLAVE_APROBACION_ETD);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('configuracion_sistema')
      .insert([{
        clave: CLAVE_APROBACION_ETD,
        valor: roles,
        descripcion: 'Roles autorizados a aprobar o rechazar cambios de ETD Inicial'
      }]);
    if (error) throw error;
  }
}

// Normaliza un nombre de rol para comparar sin depender de mayúsculas, espacios o separadores
function normalizarRol(valor: string): string {
  return valor.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

// Devuelve los módulos a los que un usuario puede acceder según sus roles
export function obtenerModulosPermitidos(roles: string[], matriz: MatrizPermisos): string[] {
  if (!roles || roles.length === 0) return [];
  const rolesNorm = roles.map(normalizarRol);
  if (rolesNorm.includes('administrador')) {
    return MODULOS.map((m) => m.id);
  }
  // Construir un mapa de la matriz con claves normalizadas para tolerar diferencias de formato
  const mapa: Record<string, string[]> = {};
  Object.keys(matriz).forEach((clave) => {
    mapa[normalizarRol(clave)] = matriz[clave] || [];
  });
  const permitidos = new Set<string>();
  rolesNorm.forEach((rol) => {
    (mapa[rol] || []).forEach((id) => permitidos.add(id));
  });
  return Array.from(permitidos);
}

// Carga la matriz de permisos desde la base de datos, con valores por defecto como respaldo
export async function cargarMatrizPermisos(): Promise<MatrizPermisos> {
  try {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('valor')
      .eq('clave', CLAVE_PERMISOS)
      .maybeSingle();

    if (error || !data || !data.valor || typeof data.valor !== 'object') {
      return { ...PERMISOS_DEFAULT };
    }

    const guardado = data.valor as MatrizPermisos;
    // Construir un mapa de lo guardado con claves normalizadas para alinear con los roles actuales
    const mapaGuardado: Record<string, string[]> = {};
    Object.keys(guardado).forEach((clave) => {
      mapaGuardado[normalizarRol(clave)] = guardado[clave] || [];
    });
    // Fusionar con los defaults para no perder roles/módulos que se agreguen después
    const fusionado: MatrizPermisos = {};
    ROLES.forEach((rol) => {
      fusionado[rol.nombre] = mapaGuardado[normalizarRol(rol.nombre)] || PERMISOS_DEFAULT[rol.nombre] || [];
    });
    return fusionado;
  } catch (error) {
    console.error('Error cargando matriz de permisos:', error);
    return { ...PERMISOS_DEFAULT };
  }
}

// Guarda la matriz de permisos en la base de datos
export async function guardarMatrizPermisos(matriz: MatrizPermisos): Promise<void> {
  const { data: existente, error: errorSelect } = await supabase
    .from('configuracion_sistema')
    .select('id')
    .eq('clave', CLAVE_PERMISOS)
    .maybeSingle();

  if (errorSelect) throw errorSelect;

  if (existente) {
    const { error } = await supabase
      .from('configuracion_sistema')
      .update({ valor: matriz, updated_at: new Date().toISOString() })
      .eq('clave', CLAVE_PERMISOS);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('configuracion_sistema')
      .insert([{
        clave: CLAVE_PERMISOS,
        valor: matriz,
        descripcion: 'Matriz de permisos de módulos por rol'
      }]);
    if (error) throw error;
  }
}