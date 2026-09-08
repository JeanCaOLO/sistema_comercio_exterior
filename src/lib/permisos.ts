import { supabase } from './supabase';

export interface Modulo {
  id: string;
  nombre: string;
  icon: string;
}

export interface Rol {
  nombre: string;
  descripcion: string;
  color: string;
}

// Matriz de permisos: rol -> lista de IDs de módulos a los que puede acceder
export type MatrizPermisos = Record<string, string[]>;

export const MODULOS: Modulo[] = [
  { id: 'dashboard', nombre: 'Dashboard', icon: 'ri-dashboard-line' },
  { id: 'gestion-dropship', nombre: 'Gestión Dropship', icon: 'ri-ship-line' },
  { id: 'gestion-zf', nombre: 'Gestión ZF', icon: 'ri-building-line' },
  { id: 'lista-expedientes', nombre: 'Lista de Expedientes', icon: 'ri-file-list-3-line' },
  { id: 'reportes', nombre: 'Reportes', icon: 'ri-bar-chart-box-line' },
  { id: 'carga-caa', nombre: 'Carga CAA', icon: 'ri-file-upload-line' },
  { id: 'documentacion', nombre: 'Documentación', icon: 'ri-folder-open-line' },
  { id: 'repositorio', nombre: 'Repositorio Docs', icon: 'ri-archive-line' },
  { id: 'configuracion', nombre: 'Configuración', icon: 'ri-settings-3-line' },
];

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
    'reportes', 'carga-caa', 'documentacion', 'repositorio', 'configuracion'
  ],
  'Gestor Dropship': ['dashboard', 'gestion-dropship', 'lista-expedientes', 'documentacion', 'repositorio'],
  'Gestor ZF': ['dashboard', 'gestion-zf', 'lista-expedientes', 'documentacion', 'repositorio'],
  'Bodega': ['dashboard', 'gestion-zf', 'lista-expedientes', 'documentacion', 'repositorio'],
  'Documentos': ['lista-expedientes', 'carga-caa', 'repositorio'],
  'Expedientes': ['gestion-dropship', 'gestion-zf', 'lista-expedientes', 'documentacion', 'repositorio'],
  'Solicitante': ['carga-caa', 'documentacion', 'repositorio'],
};

const CLAVE_PERMISOS = 'matriz_permisos';

// Devuelve los módulos a los que un usuario puede acceder según sus roles
export function obtenerModulosPermitidos(roles: string[], matriz: MatrizPermisos): string[] {
  if (!roles || roles.length === 0) return [];
  if (roles.includes('Administrador')) {
    return MODULOS.map((m) => m.id);
  }
  const permitidos = new Set<string>();
  roles.forEach((rol) => {
    (matriz[rol] || []).forEach((id) => permitidos.add(id));
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
    // Fusionar con los defaults para no perder roles/módulos que se agreguen después
    const fusionado: MatrizPermisos = {};
    ROLES.forEach((rol) => {
      fusionado[rol.nombre] = guardado[rol.nombre] || PERMISOS_DEFAULT[rol.nombre] || [];
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