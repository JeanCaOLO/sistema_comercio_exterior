// ============================================================
// ESTRUCTURA DE NAVEGACIÓN DEL SISTEMA
// Solo presentación: agrupa las vistas existentes en dos grandes
// módulos (Expedientes y Orders) + Configuración al mismo nivel.
// IMPORTANTE: los `id` son exactamente los mismos que ya usa la
// Matriz de Permisos y el ruteo interno de vistas. No renombrar.
// ============================================================

export interface ItemNavegacion {
  id: string;
  label: string;
  icon: string;
}

export interface SeccionNavegacion {
  /** Título interno del subgrupo. Vacío = sección principal del módulo. */
  titulo: string;
  items: ItemNavegacion[];
}

export type GrupoId = 'expedientes' | 'orders' | 'sistema';

export interface GrupoNavegacion {
  id: GrupoId;
  nombre: string;
  descripcion: string;
  icon: string;
  secciones: SeccionNavegacion[];
}

export const NOMBRE_SISTEMA = 'Gestión de Comercio Exterior';

export const GRUPOS_NAVEGACION: GrupoNavegacion[] = [
  {
    id: 'expedientes',
    nombre: 'Expedientes',
    descripcion: 'Operación y seguimiento de expedientes',
    icon: 'ri-file-list-3-line',
    secciones: [
      {
        titulo: '',
        items: [
          { id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' },
          { id: 'gestion-dropship', label: 'Gestión Dropship', icon: 'ri-ship-line' },
          { id: 'gestion-zf', label: 'Gestión ZF', icon: 'ri-building-line' },
          { id: 'lista-expedientes', label: 'Lista de Expedientes', icon: 'ri-file-list-3-line' },
          { id: 'reportes', label: 'Reporte de Expedientes', icon: 'ri-bar-chart-box-line' },
          { id: 'carga-caa', label: 'Carga CAA', icon: 'ri-file-upload-line' },
          { id: 'documentacion', label: 'Bandeja', icon: 'ri-inbox-archive-line' },
          { id: 'repositorio', label: 'Repositorio Docs', icon: 'ri-archive-line' },
          { id: 'facturas', label: 'Facturas', icon: 'ri-bill-line' },
        ],
      },
    ],
  },
  {
    id: 'orders',
    nombre: 'Orders',
    descripcion: 'Órdenes y sus cambios',
    icon: 'ri-shopping-bag-3-line',
    secciones: [
      {
        titulo: 'Cambios ETD Inicial',
        items: [
          { id: 'etd-dashboard', label: 'Dashboard ETD Inicial', icon: 'ri-dashboard-3-line' },
          { id: 'etd-solicitar', label: 'Solicitar Cambio ETD Inicial', icon: 'ri-calendar-2-line' },
          { id: 'etd-aprobaciones', label: 'Aprobaciones Pendientes', icon: 'ri-checkbox-multiple-line' },
          { id: 'etd-historial', label: 'Historial de Solicitudes', icon: 'ri-history-line' },
        ],
      },
      {
        titulo: 'Análisis de Carga',
        items: [
          { id: 'agente-carga', label: 'Análisis de Agente de Carga', icon: 'ri-ship-2-line' },
          { id: 'control-fechas', label: 'Control de Fechas NEXT', icon: 'ri-calendar-check-line' },
        ],
      },
    ],
  },
];

// Configuración vive al mismo nivel que los dos grandes módulos.
export const ITEM_CONFIGURACION: ItemNavegacion = {
  id: 'configuracion',
  label: 'Configuración',
  icon: 'ri-settings-3-line',
};

/** Devuelve todos los items de un grupo ya aplanados. */
export function itemsDeGrupo(grupo: GrupoNavegacion): ItemNavegacion[] {
  return grupo.secciones.flatMap((seccion) => seccion.items);
}

/** Todos los items navegables del sistema (sin Configuración). */
export const ITEMS_NAVEGACION: ItemNavegacion[] = GRUPOS_NAVEGACION.flatMap(itemsDeGrupo);

/** Busca el grupo al que pertenece una vista. */
export function grupoDeVista(id: string): GrupoNavegacion | undefined {
  return GRUPOS_NAVEGACION.find((grupo) =>
    itemsDeGrupo(grupo).some((item) => item.id === id)
  );
}