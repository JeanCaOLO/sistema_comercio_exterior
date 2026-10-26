export interface RegistroRepositorio {
  id: string;
  po_tiquetera: string;
  tipo_po: string;
  solicitante: string;
  tipo_modulo: string;
  estado_expediente: string;
  bl_cargado: boolean;
  tc_cargado?: boolean;
  packing_list_cargado?: boolean;
  numero_bl?: string | null;
  numero_contenedor?: string | null;
  aplica_tlc?: boolean;
  doc: string | string[] | null;
  exp_id: string;
  created_at: string;
  responsable_creacion: string;
  cargador_documentos?: string;
  prioridad: string;
  prioridad_urgente: boolean;
  origen?: 'cca' | 'expediente';
}

export interface FiltrosRepositorio {
  busqueda: string;
  estado: string;
  modulo: string;
}

export interface PaginaRepositorio {
  registros: RegistroRepositorio[];
  total: number;
}

export const ESTADOS_TODOS = [
  'Documentación',
  'No Asignado',
  'Asignado',
  'En Proceso',
  'Espera de Respuesta',
  'Liberación',
  'Recepción de Carga',
  'Facturación',
  'Notificado',
  'Visto Listo',
  'Completado',
];

export const REGISTROS_POR_PAGINA = 25;