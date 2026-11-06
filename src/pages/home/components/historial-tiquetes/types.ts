export type VistaHistorial = 'tiquete' | 'movimientos';

export type OrdenHistorial = 'actividad' | 'antiguos' | 'movimientos';

export interface ExpedienteLite {
  id: string;
  po_tiquetera: string | null;
  exp_id: string | null;
  tipo_modulo: string | null;
  estado_expediente: string | null;
  solicitante: string | null;
  responsable_creacion: string | null;
  fecha_solicitud: string | null;
  fecha_creacion_expediente: string | null;
  created_at: string | null;
  prioridad: string | null;
  prioridad_urgente: boolean | null;
}

export interface HistorialRaw {
  id: string;
  expediente_id: string;
  campo_modificado: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  usuario: string | null;
  usuario_email: string | null;
  fecha_cambio: string | null;
}

export interface MovimientoHistorial {
  id: string;
  expedienteId: string;
  po: string;
  expId: string;
  modulo: string;
  estadoActual: string;
  solicitante: string;
  responsable: string;
  campoModificado: string;
  valorAnterior: string;
  valorNuevo: string;
  usuario: string;
  usuarioEmail: string;
  fechaCambio: string;
  fechaSolicitud: string;
}

export interface TiqueteHistorial {
  expedienteId: string;
  po: string;
  expId: string;
  modulo: string;
  estadoActual: string;
  solicitante: string;
  responsable: string;
  fechaSolicitud: string;
  prioridad: string;
  urgente: boolean;
  totalMovimientos: number;
  totalMovimientosHistoricos: number;
  ultimoCambio: string | null;
  primerCambio: string | null;
  diasSinMovimiento: number | null;
  usuarios: string[];
  campos: string[];
  movimientos: MovimientoHistorial[];
}

export interface FiltrosHistorial {
  busqueda: string;
  modulo: 'todos' | 'dropship' | 'zf';
  campo: string;
  usuario: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
}