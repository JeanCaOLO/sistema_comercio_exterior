// Utilidades puras del tablero de Gestión (sin acceso a red ni a estado React).

import { diasHabilesEntre } from '@/lib/fechas';
import { DIEZ_DIAS_MS, ESTADOS_DROPSHIP, type Expediente } from './types';

// Valida una transición de estado en Dropship.
// Reglas:
//   1. Avance: solo se permite pasar al estado inmediatamente siguiente (no brincar estados).
//   2. Retroceso: no permitido, salvo estas excepciones:
//      - Hacia "Espera de Respuesta" (desde cualquier estado posterior).
//      - De "Espera de Respuesta" a "En Proceso".
// Devuelve null si la transición es válida, o un mensaje de error si no lo es.
export const validarTransicionDropship = (
  estadoAnterior: string,
  estadoNuevo: string
): string | null => {
  const idxAnterior = ESTADOS_DROPSHIP.indexOf(estadoAnterior);
  const idxNuevo = ESTADOS_DROPSHIP.indexOf(estadoNuevo);

  // Estados desconocidos o sin cambio: no validar
  if (idxAnterior === -1 || idxNuevo === -1 || idxAnterior === idxNuevo) return null;

  // Avance: solo un estado a la vez, sin brincar
  if (idxNuevo > idxAnterior) {
    if (idxNuevo === idxAnterior + 1) return null;
    return `No se puede brincar estados. De "${estadoAnterior}" debes pasar primero por "${
      ESTADOS_DROPSHIP[idxAnterior + 1]
    }".`;
  }

  // Retroceso: solo excepciones permitidas
  const excepcionHaciaEspera = estadoNuevo === 'Espera de Respuesta';
  const excepcionDeEsperaAProceso =
    estadoAnterior === 'Espera de Respuesta' && estadoNuevo === 'En Proceso';
  if (excepcionHaciaEspera || excepcionDeEsperaAProceso) return null;

  return 'No se puede mover el ticket a una columna anterior. Solo se permite retroceder a "Espera de Respuesta" o de "Espera de Respuesta" a "En Proceso".';
};

// Oculta los tickets terminados (Dropship: Visto Listo / ZF: Completado) con más
// de 10 días desde su liberación, para no saturar el kanban.
export const filtrarTerminadosAntiguos = (lista: Expediente[]): Expediente[] => {
  const ahora = new Date();
  return lista.filter((exp) => {
    const esTerminalDropship =
      exp.tipo_modulo === 'dropship' && exp.estado_expediente === 'Visto Listo';
    const esTerminalZF = exp.tipo_modulo === 'zf' && exp.estado_expediente === 'Completado';
    if (esTerminalDropship || esTerminalZF) {
      const refDate = exp.fecha_liberacion
        ? new Date(exp.fecha_liberacion)
        : new Date(exp.updated_at || exp.created_at);
      return ahora.getTime() - refDate.getTime() < DIEZ_DIAS_MS;
    }
    return true;
  });
};

// Se usa la misma función que los KPIs del dashboard para que los días del
// kanban y los del dashboard siempre coincidan (mismo calendario de feriados).
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
    case 'No Asignado':
      return 'bg-gray-400';
    case 'Nuevo':
      return 'bg-blue-500';
    case 'Asignado':
      return 'bg-purple-500';
    case 'Creado':
      return 'bg-teal-500';
    case 'En Proceso':
      return 'bg-orange-500';
    case 'En Revisión':
      return 'bg-yellow-500';
    case 'Recepción de Carga':
      return 'bg-indigo-500';
    case 'Facturación':
      return 'bg-pink-500';
    case 'Liberado':
      return 'bg-green-500';
    case 'Completado':
      return 'bg-emerald-500';
    case 'Arribo de Carga':
      return 'bg-cyan-500';
    case 'Pendiente Proforma':
      return 'bg-violet-500';
    case 'Espera de Respuesta':
      return 'bg-amber-400';
    case 'Liberación':
      return 'bg-green-500';
    case 'Notificado':
      return 'bg-lime-500';
    case 'Visto Listo':
      return 'bg-rose-500';
    default:
      return 'bg-gray-500';
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

// Cuenta cuántos documentos tiene un grupo (doc puede ser string o array)
export const contarDocs = (doc: any): number => {
  if (!doc) return 0;
  if (Array.isArray(doc)) return doc.length;
  if (typeof doc === 'string') {
    const trimmed = doc.trim();
    if (trimmed === '') return 0;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.length;
      return 1;
    } catch {
      return 1;
    }
  }
  return 0;
};