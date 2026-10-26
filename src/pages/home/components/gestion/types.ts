// Tipos y constantes compartidas del tablero de Gestión de Expedientes.

export type TipoModulo = 'dropship' | 'zf';

export interface Expediente {
  id: string;
  po_tiquetera: string;
  tipo_po: string;
  solicitante: string;
  cargador_documentos: string;
  fecha_solicitud: string;
  prioridad: string;
  prioridad_urgente: boolean;
  motivo_urgencia: string | null;
  dificultad: string;
  tiempo_minutos: number;
  dias_entrega: number;
  fecha_requerimiento: string;
  exp_id: string;
  doc: string | string[] | null;
  lineas_oc: number;
  fecha_creacion_expediente: string;
  estado_expediente: string;
  motivo_revision: string | null;
  responsable_creacion: string;
  instrucciones_adicionales: string | null;
  created_at: string;
  updated_at?: string;
  fecha_apertura?: string;
  fecha_liberacion?: string;
  tiempo_real_minutos?: number;
  dias_entrega_real?: number;
  transito_corto?: boolean;
  ok_pais?: boolean;
  bl_cargado?: boolean;
  numero_bl?: string | null;
  numero_contenedor?: string | null;
  packing_list_cargado?: boolean;
  etd?: string;
  eta_real?: string;
  recibo_delzof_fecha?: string | null;
  recibo_delzof_numero?: string | null;
  aplica_tlc?: boolean;
  tipo_modulo?: TipoModulo;
  incidente?: boolean;
  comentario_incidente?: string | null;
  finiquito?: boolean;
  mcg?: boolean;
  fecha_notificado?: string;
  fecha_ok_pais?: string;
  fecha_visto_listo?: string;
}

// Estados según el tipo de módulo
export const ESTADOS_DROPSHIP: string[] = [
  'No Asignado',
  'Asignado',
  'En Proceso',
  'Espera de Respuesta',
  'Liberación',
  'Recepción de Carga',
  'Facturación',
  'Notificado',
  'Visto Listo',
];

export const ESTADOS_ZF: string[] = [
  'No Asignado',
  'Asignado',
  'En Proceso',
  'Espera de Respuesta',
  'Completado',
];

// Tiempo para ocultar tickets terminados del kanban (10 días en ms)
export const DIEZ_DIAS_MS = 10 * 24 * 60 * 60 * 1000;

// Máximo de tarjetas pintadas por columna del kanban (rendimiento)
export const LIMITE_TARJETAS_POR_COLUMNA = 10;

// Columnas que se traen en la carga inicial del kanban. Se excluye `doc` porque
// puede ser un campo grande (array de URLs) y se carga bajo demanda al abrir el
// detalle, los documentos o al validar la asignación.
export const COLUMNAS_EXPEDIENTE =
  'id, po_tiquetera, tipo_po, solicitante, cargador_documentos, fecha_solicitud, prioridad, prioridad_urgente, motivo_urgencia, dificultad, tiempo_minutos, dias_entrega, fecha_requerimiento, exp_id, lineas_oc, fecha_creacion_expediente, estado_expediente, motivo_revision, responsable_creacion, instrucciones_adicionales, created_at, fecha_apertura, fecha_liberacion, tiempo_real_minutos, dias_entrega_real, transito_corto, ok_pais, bl_cargado, numero_bl, numero_contenedor, packing_list_cargado, etd, eta_real, recibo_delzof_fecha, recibo_delzof_numero, aplica_tlc, tipo_modulo, incidente, comentario_incidente, finiquito, mcg, fecha_notificado, fecha_ok_pais, fecha_visto_listo, updated_at';