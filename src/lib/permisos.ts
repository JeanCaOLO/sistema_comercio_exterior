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
  { nombre: 'Documentos', descripcion: 'Dashboard, Lista de Expedientes, CCA, Repositorio Docs y Facturas', color: 'bg-teal-100 text-teal-800' },
  { nombre: 'Expedientes', descripcion: 'Gestión de Dropship, ZF, Lista de Expedientes y Repositorio Docs', color: 'bg-indigo-100 text-indigo-800' },
  { nombre: 'Solicitante', descripcion: 'Solicitudes y carga de documentos', color: 'bg-rose-100 text-rose-800' },
  { nombre: 'Cliente', descripcion: 'Solo el módulo BL y Contenedor (Agentes de Carga)', color: 'bg-amber-100 text-amber-800' },
  { nombre: 'Cliente Consulta', descripcion: 'Solo lectura de Expedientes (no puede editar)', color: 'bg-slate-200 text-slate-800' },
];

// ─────────────────────────────────────────────────────────────
// Rol "Cliente Consulta"
// Decisión de negocio: ve todos los módulos de Expedientes, pero en modo
// consulta. No puede crear, editar, eliminar, aprobar ni subir archivos, y
// no tiene acceso a Orders, Herramientas ni Configuración.
// ─────────────────────────────────────────────────────────────
export const ROL_CLIENTE_CONSULTA = 'Cliente Consulta';

export const MODULOS_EXPEDIENTES: string[] = [
  'dashboard',
  'gestion-dropship',
  'gestion-zf',
  'lista-expedientes',
  'reportes',
  'carga-caa',
  'documentacion',
  'repositorio',
  'facturas',
];

// El usuario tiene el rol Cliente Consulta (aunque además tenga otros roles).
export function esRolClienteConsulta(roles: string[]): boolean {
  return (roles || []).some((rol) => normalizarRol(rol) === 'cliente consulta');
}

// Modo consulta: puede navegar los módulos de Expedientes, pero las acciones
// de escritura quedan ocultas en toda la interfaz.
export function esSoloLectura(roles: string[]): boolean {
  if (!roles || roles.length === 0) return false;
  const rolesNorm = roles.map(normalizarRol);
  // Un administrador conserva su acceso completo aunque tenga otros roles.
  if (rolesNorm.includes('administrador')) return false;
  return rolesNorm.includes('cliente consulta');
}

// ─────────────────────────────────────────────────────────────
// Módulo "Agentes de Carga · BL y Contenedor"
// Decisión de negocio: solo lo pueden ver el Administrador y el rol Cliente.
// El rol Cliente, además, no ve ningún otro módulo del sistema.
// ─────────────────────────────────────────────────────────────
export const MODULOS_AGENTES_CARGA: string[] = [
  'carga-bl-dashboard',
  'carga-bl-actualizar',
  'carga-bl-historial',
];

// ─────────────────────────────────────────────────────────────
// Módulo "Cambios de Etapa PO"
// Decisión de negocio: el módulo NO se asigna por rol. Solo lo puede ver
// un usuario puntual, sin importar el rol que tenga.
// ─────────────────────────────────────────────────────────────
export const MODULOS_ETAPA_PO: string[] = [
  'etapa-solicitar',
  'etapa-aprobaciones',
  'etapa-historial',
];

// Usuarios autorizados a ver el módulo de Cambios de Etapa PO.
const USUARIOS_ETAPA_PO = {
  emails: ['jalvarez@ologistics.com'],
  ids: ['53ca3f42-a033-4ea1-8b0d-e9b5f91e2b4f'],
};

export interface IdentidadUsuario {
  email?: string | null;
  nombre?: string | null;
  id?: string | null;
}

export function esModuloEtapaPo(moduloId: string): boolean {
  return MODULOS_ETAPA_PO.includes(moduloId);
}

// Indica si la identidad corresponde a un usuario autorizado del módulo de Etapa PO.
export function puedeVerEtapaPo(identidad?: IdentidadUsuario | null): boolean {
  if (!identidad) return false;
  const email = (identidad.email || '').trim().toLowerCase();
  const id = (identidad.id || '').trim().toLowerCase();
  if (email && USUARIOS_ETAPA_PO.emails.includes(email)) return true;
  if (id && USUARIOS_ETAPA_PO.ids.includes(id)) return true;
  return false;
}

const ROLES_AGENTES_CARGA = ['administrador', 'cliente'];

export function esModuloAgentesCarga(moduloId: string): boolean {
  return MODULOS_AGENTES_CARGA.includes(moduloId);
}

// El usuario tiene rol Cliente (aunque además tenga otros roles).
export function tieneRolCliente(roles: string[]): boolean {
  return (roles || []).some((rol) => normalizarRol(rol) === 'cliente');
}

// Cuenta como "solo Cliente": tiene el rol Cliente y no es Administrador.
// En ese caso únicamente entra al módulo de Agentes de Carga.
export function esSoloCliente(roles: string[]): boolean {
  if (!tieneRolCliente(roles)) return false;
  return !(roles || []).some((rol) => normalizarRol(rol) === 'administrador');
}

// Indica si la celda rol/módulo de la Matriz de Permisos queda bloqueada.
// - El Administrador siempre tiene todo.
// - Los módulos de Agentes de Carga solo se pueden asignar al rol Cliente.
// - El rol Cliente solo puede tener los módulos de Agentes de Carga.
// - Los módulos de Etapa PO no se asignan por rol: son de un usuario puntual.
// - El rol Cliente Consulta solo puede tener módulos de Expedientes.
export function permisoBloqueado(rol: string, moduloId: string): boolean {
  const rolNorm = normalizarRol(rol);
  if (esModuloEtapaPo(moduloId)) return true;
  if (rolNorm === 'administrador') return true;
  // El rol Cliente Consulta solo puede tener módulos de Expedientes.
  if (rolNorm === 'cliente consulta') return !MODULOS_EXPEDIENTES.includes(moduloId);
  if (esModuloAgentesCarga(moduloId)) return rolNorm !== 'cliente';
  return rolNorm === 'cliente';
}

export const PERMISOS_DEFAULT: MatrizPermisos = {
  'Administrador': [
    'dashboard', 'gestion-dropship', 'gestion-zf', 'lista-expedientes',
    'reportes', 'carga-caa', 'documentacion', 'repositorio', 'facturas', 'configuracion',
    'etd-solicitar', 'etd-aprobaciones', 'etd-historial', 'etd-dashboard',
    'carga-lista-solicitar', 'incoterm-solicitar',
    'etapa-solicitar', 'etapa-aprobaciones', 'etapa-historial',
    'po-sin-tracking-dashboard', 'po-sin-tracking-solicitar', 'po-sin-tracking-aprobaciones', 'po-sin-tracking-historial',
    'carga-bl-dashboard', 'carga-bl-actualizar', 'carga-bl-historial',
    'agente-carga', 'control-fechas',
    'comparador-documentos'
  ],
  'Gestor Dropship': ['dashboard', 'gestion-dropship', 'lista-expedientes', 'documentacion', 'repositorio', 'facturas', 'etapa-solicitar', 'etapa-historial'],
  'Gestor ZF': ['dashboard', 'gestion-zf', 'lista-expedientes', 'documentacion', 'repositorio', 'facturas', 'etapa-solicitar', 'etapa-historial'],
  'Bodega': ['dashboard', 'gestion-zf', 'lista-expedientes', 'documentacion', 'repositorio'],
  'Documentos': ['dashboard', 'lista-expedientes', 'carga-caa', 'repositorio', 'facturas', 'etd-dashboard', 'etd-solicitar', 'etd-historial', 'carga-lista-solicitar', 'incoterm-solicitar', 'po-sin-tracking-dashboard', 'po-sin-tracking-solicitar', 'po-sin-tracking-historial', 'agente-carga', 'control-fechas', 'comparador-documentos', 'etapa-solicitar', 'etapa-historial'],
  'Expedientes': ['gestion-dropship', 'gestion-zf', 'lista-expedientes', 'documentacion', 'repositorio', 'facturas', 'comparador-documentos', 'etapa-solicitar', 'etapa-historial'],
  'Solicitante': ['carga-caa', 'documentacion', 'repositorio', 'facturas'],
  'Cliente': ['carga-bl-dashboard', 'carga-bl-actualizar', 'carga-bl-historial'],
  'Cliente Consulta': ['dashboard', 'gestion-dropship', 'gestion-zf', 'lista-expedientes', 'reportes', 'carga-caa', 'documentacion', 'repositorio', 'facturas'],
};

const CLAVE_PERMISOS = 'matriz_permisos';
const CLAVE_APROBACION_ETD = 'roles_aprobacion_etd';

// La columna `valor` de configuracion_sistema es de tipo texto, por lo que
// Postgres devuelve el JSON como string. Esta función tolera ambos casos
// (objeto ya parseado o string JSON) y devuelve null si no se puede leer.
function parsearValorConfig(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor ?? null;
  const texto = valor.trim();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

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
    const valor = parsearValorConfig(data?.valor);
    if (error || !data || !Array.isArray(valor)) {
      return [...ROLES_APROBACION_ETD_DEFAULT];
    }
    return valor.filter((r): r is string => typeof r === 'string');
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
      .update({ valor: JSON.stringify(roles), updated_at: new Date().toISOString() })
      .eq('clave', CLAVE_APROBACION_ETD);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('configuracion_sistema')
      .insert([{
        clave: CLAVE_APROBACION_ETD,
        valor: JSON.stringify(roles),
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
export function obtenerModulosPermitidos(
  roles: string[],
  matriz: MatrizPermisos,
  identidad?: IdentidadUsuario | null
): string[] {
  const permitidosBase = calcularModulosPorRol(roles, matriz);
  // El módulo de Cambios de Etapa PO solo lo ve el usuario autorizado,
  // sin importar el rol que tenga (ni siquiera Administrador).
  if (puedeVerEtapaPo(identidad)) return permitidosBase;
  return permitidosBase.filter((id) => !esModuloEtapaPo(id));
}

function calcularModulosPorRol(roles: string[], matriz: MatrizPermisos): string[] {
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

  // Restricción del módulo de Agentes de Carga (BL y Contenedor):
  // solo Administrador y Cliente, sin importar lo que diga la matriz guardada.
  const puedeAgentesCarga = rolesNorm.some((rol) => ROLES_AGENTES_CARGA.includes(rol));
  let resultado = Array.from(permitidos);
  if (!puedeAgentesCarga) {
    resultado = resultado.filter((id) => !esModuloAgentesCarga(id));
  }

  // El rol Cliente solo ve el módulo de Agentes de Carga y nada más.
  if (esSoloCliente(roles)) {
    resultado = [...MODULOS_AGENTES_CARGA];
  }

  // El rol Cliente Consulta solo accede a los módulos de Expedientes,
  // sin importar lo que diga la matriz guardada.
  if (rolesNorm.includes('cliente consulta')) {
    resultado = resultado.filter((id) => MODULOS_EXPEDIENTES.includes(id));
  }

  return resultado;
}

// Carga la matriz de permisos desde la base de datos, con valores por defecto como respaldo
export async function cargarMatrizPermisos(): Promise<MatrizPermisos> {
  try {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('valor')
      .eq('clave', CLAVE_PERMISOS)
      .maybeSingle();

    const valor = parsearValorConfig(data?.valor);
    if (error || !valor || typeof valor !== 'object' || Array.isArray(valor)) {
      return { ...PERMISOS_DEFAULT };
    }

    const guardado = valor as MatrizPermisos;
    // Construir un mapa de lo guardado con claves normalizadas para alinear con los roles actuales
    const mapaGuardado: Record<string, string[]> = {};
    Object.keys(guardado).forEach((clave) => {
      mapaGuardado[normalizarRol(clave)] = guardado[clave] || [];
    });
    // Fusionar con los defaults para no perder roles/módulos que se agreguen después
    const fusionado: MatrizPermisos = {};
    ROLES.forEach((rol) => {
      const lista = mapaGuardado[normalizarRol(rol.nombre)] || PERMISOS_DEFAULT[rol.nombre] || [];
      // Limpiar combinaciones que ya no están permitidas (por ejemplo, módulos de
      // Agentes de Carga asignados a roles distintos del Cliente).
      fusionado[rol.nombre] = normalizarRol(rol.nombre) === 'administrador'
        ? [...lista]
        : lista.filter((id) => !permisoBloqueado(rol.nombre, id));
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
      .update({ valor: JSON.stringify(matriz), updated_at: new Date().toISOString() })
      .eq('clave', CLAVE_PERMISOS);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('configuracion_sistema')
      .insert([{
        clave: CLAVE_PERMISOS,
        valor: JSON.stringify(matriz),
        descripcion: 'Matriz de permisos de módulos por rol'
      }]);
    if (error) throw error;
  }
}