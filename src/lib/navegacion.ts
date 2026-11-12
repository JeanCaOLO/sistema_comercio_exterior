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

export type GrupoId = 'expedientes' | 'orders' | 'herramientas' | 'sistema';

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
        titulo: 'Cambios de Órdenes',
        items: [
          { id: 'etd-dashboard', label: 'Dashboard de Cambios', icon: 'ri-dashboard-3-line' },
          { id: 'etd-solicitar', label: 'Solicitar Cambio ETD Inicial', icon: 'ri-calendar-2-line' },
          { id: 'carga-lista-solicitar', label: 'Solicitar Cambios Carga Lista', icon: 'ri-file-list-2-line' },
          { id: 'incoterm-solicitar', label: 'Solicitar Cambio Incoterm', icon: 'ri-exchange-dollar-line' },
          { id: 'etd-aprobaciones', label: 'Aprobaciones Pendientes', icon: 'ri-checkbox-multiple-line' },
          { id: 'etd-historial', label: 'Historial de Solicitudes', icon: 'ri-history-line' },
        ],
      },
      {
        titulo: 'Cambios de Etapa PO',
        items: [
          { id: 'etapa-solicitar', label: 'Mover de Etapa PO', icon: 'ri-kanban-view' },
          { id: 'etapa-aprobaciones', label: 'Aprobaciones de Etapa', icon: 'ri-checkbox-multiple-line' },
          { id: 'etapa-historial', label: 'Historial de Etapas', icon: 'ri-history-line' },
        ],
      },
      {
        titulo: 'PO sin Tracking',
        items: [
          { id: 'po-sin-tracking-dashboard', label: 'Dashboard PO sin Tracking', icon: 'ri-dashboard-3-line' },
          { id: 'po-sin-tracking-solicitar', label: 'Cargar Fechas PO sin Tracking', icon: 'ri-calendar-schedule-line' },
          { id: 'po-sin-tracking-aprobaciones', label: 'Aprobaciones PO sin Tracking', icon: 'ri-checkbox-multiple-line' },
          { id: 'po-sin-tracking-historial', label: 'Historial PO sin Tracking', icon: 'ri-history-line' },
        ],
      },
      {
        titulo: 'Agentes de Carga',
        items: [
          { id: 'carga-bl-dashboard', label: 'Dashboard BL y Contenedor', icon: 'ri-dashboard-3-line' },
          { id: 'carga-bl-actualizar', label: 'Cargar BL y Contenedor', icon: 'ri-ship-2-line' },
          { id: 'carga-bl-historial', label: 'Historial BL y Contenedor', icon: 'ri-history-line' },
        ],
      },
      {
        titulo: 'Análisis de Carga',
        items: [
          { id: 'agente-carga', label: 'Asignación Agentes de Carga', icon: 'ri-ship-2-line' },
          { id: 'control-fechas', label: 'Control de Fechas NEXT', icon: 'ri-calendar-check-line' },
        ],
      },
    ],
  },
  {
    id: 'herramientas',
    nombre: 'Herramientas',
    descripcion: 'Utilidades de apoyo a la operación',
    icon: 'ri-tools-line',
    secciones: [
      {
        titulo: '',
        items: [
          { id: 'comparador-documentos', label: 'Comparador de Documentos', icon: 'ri-file-search-line' },
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