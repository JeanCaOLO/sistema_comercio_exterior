// Utilidades puras del Dashboard de Control (sin estado ni red).

import { parseFechaSegura } from '@/lib/fechas';
import type { EstadoData, RangoFechas } from './types';

export const PERIODOS = [
  { clave: 'mes-actual', etiqueta: 'Mes Actual' },
  { clave: 'mes-anterior', etiqueta: 'Mes Anterior' },
  { clave: 'semana-anterior', etiqueta: 'Semana Anterior' },
  { clave: 'trimestre', etiqueta: 'Trimestre' },
  { clave: 'ano-actual', etiqueta: 'Año Actual' },
] as const;

export const aFechaISO = (fecha: Date): string => {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

// Devuelve el rango de fechas del período elegido (o del rango personalizado).
export const obtenerRangoFechas = (
  periodo: string,
  rangoPersonalizado: RangoFechas | null
): { inicio: Date; fin: Date } => {
  const hoy = new Date();
  let inicio: Date;
  let fin: Date;

  if (periodo === 'personalizado' && rangoPersonalizado) {
    return {
      inicio: parseFechaSegura(rangoPersonalizado.inicio),
      fin: parseFechaSegura(rangoPersonalizado.fin),
    };
  }

  switch (periodo) {
    case 'mes-actual':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      break;
    case 'semana-anterior': {
      // Semana anterior (lunes a domingo) respecto a la semana actual
      const diaSemana = (hoy.getDay() + 6) % 7; // 0 = lunes
      const lunesEstaSemana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diaSemana);
      inicio = new Date(lunesEstaSemana);
      inicio.setDate(inicio.getDate() - 7);
      fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);
      break;
    }
    case 'mes-anterior':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      break;
    case 'trimestre': {
      const mesInicio = Math.floor(hoy.getMonth() / 3) * 3;
      inicio = new Date(hoy.getFullYear(), mesInicio, 1);
      fin = new Date(hoy.getFullYear(), mesInicio + 3, 0);
      break;
    }
    case 'ano-actual':
      inicio = new Date(hoy.getFullYear(), 0, 1);
      fin = new Date(hoy.getFullYear(), 11, 31);
      break;
    default:
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  }

  return { inicio, fin };
};

// Conteo de expedientes por estado (tolerante a variantes de escritura).
export const contarEstados = (lista: any[]): EstadoData => ({
  creado: lista.filter((e) => ['Creado', 'Nuevo'].includes(e.estado_expediente)).length,
  asignado: lista.filter((e) => e.estado_expediente === 'Asignado').length,
  enProceso: lista.filter((e) => e.estado_expediente === 'En Proceso').length,
  enRevision: lista.filter((e) => ['En Revisión', 'En Revision'].includes(e.estado_expediente))
    .length,
  liberado: lista.filter((e) =>
    ['Liberado', 'LIBERADO', 'Liberación', 'Liberacion'].includes(e.estado_expediente)
  ).length,
  notificado: lista.filter((e) => e.estado_expediente === 'Notificado').length,
  completado: lista.filter((e) => e.estado_expediente === 'Completado').length,
  facturacion: lista.filter((e) => ['Facturación', 'Facturacion'].includes(e.estado_expediente))
    .length,
  recepcionCarga: lista.filter((e) =>
    ['Recepción de Carga', 'Recepcion de Carga'].includes(e.estado_expediente)
  ).length,
  esperaRespuesta: lista.filter((e) =>
    ['Espera de Respuesta', 'Espera de respuesta'].includes(e.estado_expediente)
  ).length,
  arriboCarga: lista.filter((e) => ['Arribo de Carga', 'Arribo de carga'].includes(e.estado_expediente))
    .length,
  pendienteProforma: lista.filter((e) =>
    ['Pendiente Proforma', 'Pendiente proforma'].includes(e.estado_expediente)
  ).length,
  total: lista.length,
});

export const calcularPorcentajeCambio = (actual: number, anterior: number): string => {
  if (anterior === 0) return actual > 0 ? '+100%' : '0%';
  const cambio = ((actual - anterior) / anterior) * 100;
  return cambio > 0 ? `+${cambio.toFixed(1)}%` : `${cambio.toFixed(1)}%`;
};

// Convierte minutos a un texto corto legible (d/h/m).
export const formatearTiempo = (minutos: number | null): string => {
  if (!minutos) return 'En curso';

  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;

  if (horas > 24) {
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;
    return `${dias}d ${horasRestantes}h ${mins}m`;
  }

  return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
};

export const esDropship = (exp: any): boolean =>
  (exp?.tipo_modulo || '').toLowerCase() === 'dropship';