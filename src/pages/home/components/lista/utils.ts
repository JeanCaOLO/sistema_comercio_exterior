// Utilidades puras de la Lista de Expedientes (sin red ni estado React).

import { diasHabilesEntre } from '@/lib/fechas';
import { fechaCargaDocumentos } from '@/lib/kpisCreacion';
import { nombresFacturas } from '@/lib/documentos';
import type { Expediente, FiltrosLista } from './types';

// Estados combinados de ambos módulos
export const ESTADOS_DROPSHIP = [
  'Asignado',
  'En Proceso',
  'Espera de Respuesta',
  'Liberación',
  'Recepción de Carga',
  'Facturación',
  'Notificado',
  'Visto Listo',
];

export const ESTADOS_ZF = ['Asignado', 'En Proceso', 'Espera de Respuesta', 'Completado'];

export const TODOS_ESTADOS = Array.from(new Set([...ESTADOS_DROPSHIP, ...ESTADOS_ZF])).sort();

export const ITEMS_PER_PAGE = 25;

// Filtrado completo en memoria sobre el dataset ya cargado.
export const filtrarExpedientes = (expedientes: Expediente[], filtros: FiltrosLista): Expediente[] => {
  const { searchTerm, filterPersona, filterPrioridad, filterEstado, filterTipoModulo } = filtros;
  let filtered = [...expedientes];

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (exp) =>
        (exp.po_tiquetera || '').toLowerCase().includes(term) ||
        (exp.exp_id || '').toLowerCase().includes(term) ||
        (exp.solicitante || '').toLowerCase().includes(term) ||
        (exp.responsable_creacion || '').toLowerCase().includes(term) ||
        (exp.tipo_po || '').toLowerCase().includes(term) ||
        nombresFacturas(exp.doc).some((nombre) => nombre.includes(term))
    );
  }

  if (filterPersona !== 'Todos') {
    filtered = filtered.filter((exp) => exp.responsable_creacion === filterPersona);
  }

  if (filterPrioridad !== 'Todos') {
    if (filterPrioridad === 'Urgente') {
      filtered = filtered.filter((exp) => exp.prioridad_urgente === true);
    } else {
      filtered = filtered.filter(
        (exp) => exp.prioridad === filterPrioridad && exp.prioridad_urgente !== true
      );
    }
  }

  if (filterEstado !== 'Todos') {
    filtered = filtered.filter((exp) => exp.estado_expediente === filterEstado);
  }

  if (filterTipoModulo !== 'Todos') {
    filtered = filtered.filter((exp) => exp.tipo_modulo === filterTipoModulo);
  }

  return filtered;
};

export const hayFiltrosActivos = (filtros: FiltrosLista): boolean =>
  filtros.searchTerm !== '' ||
  filtros.filterPersona !== 'Todos' ||
  filtros.filterPrioridad !== 'Todos' ||
  filtros.filterEstado !== 'Todos' ||
  filtros.filterTipoModulo !== 'Todos';

// Mismo cálculo que el dashboard para que los días coincidan siempre
export const calcularDiasHabilesReales = (fechaInicio: string, fechaFin: string): number =>
  diasHabilesEntre(fechaInicio, fechaFin);

export const calcularTiempoReal = (fechaInicio: string, fechaFin: string): number => {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const diffMs = fin.getTime() - inicio.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60)));
};

export const formatearTiempo = (minutos: number): string => {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas < 24) return `${horas}h ${mins}m`;
  const dias = Math.floor(horas / 24);
  const hrs = horas % 24;
  return `${dias}d ${hrs}h`;
};

// Dropship: Notificado y Visto Listo son estados finales (reloj congelado)
export const esEstadoFinal = (expediente: Expediente): boolean =>
  expediente.tipo_modulo === 'dropship'
    ? expediente.estado_expediente === 'Notificado' ||
      expediente.estado_expediente === 'Visto Listo'
    : expediente.estado_expediente === 'Completado';

export const calcularTiempoTranscurrido = (
  expediente: Expediente,
  ahora: Date
): { minutos: number; dias: number } => {
  const esFinal = esEstadoFinal(expediente);

  // Si está en un estado final, usar el tiempo ya calculado (congelado al cerrar)
  if (esFinal && expediente.tiempo_real_minutos && expediente.dias_entrega_real) {
    return {
      minutos: expediente.tiempo_real_minutos,
      dias: expediente.dias_entrega_real,
    };
  }

  const inicioTicket =
    expediente.fecha_apertura || expediente.fecha_creacion_expediente || expediente.created_at;
  const fechaInicio = new Date(inicioTicket);
  const diffMs = ahora.getTime() - fechaInicio.getTime();
  const minutos = Math.max(0, Math.round(diffMs / (1000 * 60)));
  const dias = calcularDiasHabilesReales(inicioTicket, ahora.toISOString());

  return { minutos, dias };
};

// ── Días desde la carga de la factura (misma regla que los KPIs de creación) ──
// Si el expediente ya cerró, el reloj se detiene en la liberación; si sigue
// abierto, cuenta contra hoy. Se calculan días hábiles.
export interface DiasDesdeFactura {
  dias: number;
  enCurso: boolean;
  fechaCarga: string;
}

export const calcularDiasDesdeCargaFactura = (
  expediente: Expediente,
  ahora: Date
): DiasDesdeFactura | null => {
  const fechaCarga = fechaCargaDocumentos(expediente);
  if (!fechaCarga) return null;

  const cerrado = esEstadoFinal(expediente) && !!expediente.fecha_liberacion;
  const fechaFin = cerrado ? (expediente.fecha_liberacion as string) : ahora.toISOString();

  return {
    dias: calcularDiasHabilesReales(fechaCarga, fechaFin),
    enCurso: !cerrado,
    fechaCarga,
  };
};

export const getPrioridadColor = (prioridad: string, urgente: boolean): string => {
  if (urgente) return 'bg-red-100 text-red-800 border-red-200';
  switch (prioridad) {
    case 'Alta':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Media':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Baja':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getEstadoColor = (estado: string): string => {
  switch (estado) {
    case 'Asignado':
      return 'bg-purple-500 text-white';
    case 'En Proceso':
      return 'bg-orange-500 text-white';
    case 'Espera de Respuesta':
      return 'bg-yellow-500 text-white';
    case 'Liberación':
      return 'bg-green-500 text-white';
    case 'Recepción de Carga':
      return 'bg-indigo-500 text-white';
    case 'Facturación':
      return 'bg-pink-500 text-white';
    case 'Notificado':
      return 'bg-teal-500 text-white';
    case 'Completado':
      return 'bg-blue-500 text-white';
    case 'Visto Listo':
      return 'bg-rose-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

export const getDificultadColor = (dificultad: string): string => {
  switch (dificultad) {
    case 'Alta':
      return 'bg-red-100 text-red-800';
    case 'Media':
      return 'bg-yellow-100 text-yellow-800';
    case 'Baja':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getTipoColor = (tipo?: string): string =>
  tipo === 'dropship' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';

export const nombreTipo = (tipo?: string): string => (tipo === 'dropship' ? 'Dropship' : 'ZF');