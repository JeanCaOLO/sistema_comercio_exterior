import { diasHabilesEntre, parseFechaSegura, sumarDiasHabiles } from './fechas';
import { consultarPorIds } from './consultas';
import { cargarFechasLiberacion } from './kpisCreacion';

// ── Metas de los KPIs de facturación / notificación (Dropship) ──
export const META_FACTURACION_DIAS = 5;
export const DIAS_ANTES_ETA = 15;
// Máximo de días hábiles después del ETD para que la PO esté en Liberado.
export const META_ETD_LIBERACION_DIAS = 3;

const redondear = (valor: number): number => Math.round(valor * 10) / 10;

const aFechaISO = (fecha: Date): string => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

// ════════════════════════════════════════════════════════════
// KPI 1 · Tiempo de facturación: Liberado → Notificado País
// ════════════════════════════════════════════════════════════
export interface FilaFacturacion {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  estado_expediente: string;
  fechaLiberacion: string;
  fechaNotificado: string;
  dias: number;
  cumpleMeta: boolean;
}

export interface ResultadoFacturacion {
  filas: FilaFacturacion[];
  total: number;
  cumplen: number;
  noCumplen: number;
  porcentaje: number;
  promedio: number;
  // Qué porcentaje representa el promedio respecto de la meta de días.
  porcentajeMeta: number;
  // POs liberadas que todavía no tienen fecha de notificación (no se evalúan).
  pendientes: number;
}

const RESULTADO_FACTURACION_VACIO: ResultadoFacturacion = {
  filas: [],
  total: 0,
  cumplen: 0,
  noCumplen: 0,
  porcentaje: 0,
  promedio: 0,
  porcentajeMeta: 0,
  pendientes: 0
};

/**
 * Calcula los días hábiles entre la liberación del expediente y su notificación
 * (Notificado País) y el cumplimiento de la meta de 5 días hábiles.
 */
export async function calcularKpiFacturacion(expDropship: any[]): Promise<ResultadoFacturacion> {
  if (!expDropship || expDropship.length === 0) return RESULTADO_FACTURACION_VACIO;

  const liberadas = expDropship.filter((exp) => Boolean(exp.fecha_liberacion));
  if (liberadas.length === 0) return RESULTADO_FACTURACION_VACIO;

  const ids = liberadas.map((exp) => exp.id);
  const fechaNotificado: Record<string, string> = {};

  liberadas.forEach((exp) => {
    if (exp.fecha_notificado) fechaNotificado[exp.id] = exp.fecha_notificado;
  });

  // Respaldo 1: registros de tiempos por estado
  const faltantesTiempos = ids.filter((id) => !fechaNotificado[id]);
  if (faltantesTiempos.length > 0) {
    const data = await consultarPorIds(
      'expedientes_tiempos_estados',
      'expediente_id, fecha_inicio',
      'expediente_id',
      faltantesTiempos,
      (consulta) => consulta.eq('estado_nuevo', 'Notificado')
    );

    data.forEach((t: any) => {
      if (!t.fecha_inicio) return;
      if (!fechaNotificado[t.expediente_id] || t.fecha_inicio < fechaNotificado[t.expediente_id]) {
        fechaNotificado[t.expediente_id] = t.fecha_inicio;
      }
    });
  }

  // Respaldo 2: historial de cambios de estado
  const faltantesHistorial = ids.filter((id) => !fechaNotificado[id]);
  if (faltantesHistorial.length > 0) {
    const data = await consultarPorIds(
      'expedientes_historial',
      'expediente_id, fecha_cambio',
      'expediente_id',
      faltantesHistorial,
      (consulta) => consulta.eq('campo_modificado', 'Estado').eq('valor_nuevo', 'Notificado')
    );

    data.forEach((h: any) => {
      if (!h.fecha_cambio) return;
      if (!fechaNotificado[h.expediente_id] || h.fecha_cambio < fechaNotificado[h.expediente_id]) {
        fechaNotificado[h.expediente_id] = h.fecha_cambio;
      }
    });
  }

  const filas: FilaFacturacion[] = [];

  liberadas.forEach((exp) => {
    const fechaNotif = fechaNotificado[exp.id];
    if (!fechaNotif) return;

    const dias = diasHabilesEntre(exp.fecha_liberacion, fechaNotif);
    filas.push({
      id: exp.id,
      po_tiquetera: exp.po_tiquetera,
      exp_id: exp.exp_id || '',
      solicitante: exp.solicitante || '',
      estado_expediente: exp.estado_expediente || '—',
      fechaLiberacion: exp.fecha_liberacion,
      fechaNotificado: fechaNotif,
      dias: redondear(dias),
      cumpleMeta: dias <= META_FACTURACION_DIAS
    });
  });

  const total = filas.length;
  if (total === 0) {
    return { ...RESULTADO_FACTURACION_VACIO, pendientes: liberadas.length };
  }

  const cumplen = filas.filter((f) => f.cumpleMeta).length;
  const noCumplen = total - cumplen;
  const promedio = redondear(filas.reduce((suma, f) => suma + f.dias, 0) / total);
  const porcentajeMeta = promedio > 0
    ? Math.min(100, Math.round((META_FACTURACION_DIAS / promedio) * 100))
    : 100;

  return {
    filas: filas.sort((a, b) => b.dias - a.dias),
    total,
    cumplen,
    noCumplen,
    porcentaje: Math.round((cumplen / total) * 100),
    promedio,
    porcentajeMeta,
    pendientes: liberadas.length - total
  };
}

// ════════════════════════════════════════════════════════════
// KPI 2 · Liberado después de ETA − 15 días
// ════════════════════════════════════════════════════════════
export interface FilaEta15 {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  estado_expediente: string;
  etaReal: string;
  etaLimite: string;
  fechaLiberacion: string;
  diasAtraso: number;
  cumpleMeta: boolean;
}

export interface ResultadoEta15 {
  filas: FilaEta15[];
  total: number;
  enTiempo: number;
  tarde: number;
  porcentajeTarde: number;
  atrasoPromedio: number;
  sinEta: number;
}

const RESULTADO_ETA15_VACIO: ResultadoEta15 = {
  filas: [],
  total: 0,
  enTiempo: 0,
  tarde: 0,
  porcentajeTarde: 0,
  atrasoPromedio: 0,
  sinEta: 0
};

/**
 * Marca las POs Dropship que llegaron a "Liberado" DESPUÉS de su fecha
 * ETA Real menos 15 días. Requiere ETA Real y fecha de liberación.
 *
 * El cierre del reloj es la llegada REAL al estado "Liberación": la columna
 * `fecha_liberacion` se sobrescribe cuando el ticket pasa a su estado final
 * (Notificado / Visto Listo), así que se resuelve desde el histórico de
 * tiempos por estado, con respaldo en el historial de cambios.
 */
export async function calcularKpiEta15(expDropship: any[]): Promise<ResultadoEta15> {
  if (!expDropship || expDropship.length === 0) return RESULTADO_ETA15_VACIO;

  const ids = expDropship.map((exp) => exp.id);
  const fechaLiberacionReal: Record<string, string> = {};

  const tiempos = await consultarPorIds(
    'expedientes_tiempos_estados',
    'expediente_id, fecha_inicio',
    'expediente_id',
    ids,
    (consulta) => consulta.eq('estado_nuevo', 'Liberación')
  );

  tiempos.forEach((t: any) => {
    if (!t.fecha_inicio) return;
    if (
      !fechaLiberacionReal[t.expediente_id] ||
      t.fecha_inicio < fechaLiberacionReal[t.expediente_id]
    ) {
      fechaLiberacionReal[t.expediente_id] = t.fecha_inicio;
    }
  });

  const faltantes = ids.filter((id: string) => !fechaLiberacionReal[id]);
  if (faltantes.length > 0) {
    const historial = await consultarPorIds(
      'expedientes_historial',
      'expediente_id, fecha_cambio',
      'expediente_id',
      faltantes,
      (consulta) => consulta.eq('campo_modificado', 'Estado').eq('valor_nuevo', 'Liberación')
    );

    historial.forEach((h: any) => {
      if (!h.fecha_cambio) return;
      if (
        !fechaLiberacionReal[h.expediente_id] ||
        h.fecha_cambio < fechaLiberacionReal[h.expediente_id]
      ) {
        fechaLiberacionReal[h.expediente_id] = h.fecha_cambio;
      }
    });
  }

  const filas: FilaEta15[] = [];
  const sinEta = expDropship.filter((exp) => !exp.eta_real).length;

  expDropship.forEach((exp) => {
    if (!exp.eta_real) return;

    const fechaLib = fechaLiberacionReal[exp.id] || exp.fecha_liberacion;
    if (!fechaLib) return;

    const eta = parseFechaSegura(String(exp.eta_real).substring(0, 10));
    if (Number.isNaN(eta.getTime())) return;

    const limite = new Date(eta);
    limite.setDate(limite.getDate() - DIAS_ANTES_ETA);

    const liberacion = parseFechaSegura(fechaLib);
    if (Number.isNaN(liberacion.getTime())) return;

    const liberacionDia = new Date(
      liberacion.getFullYear(),
      liberacion.getMonth(),
      liberacion.getDate()
    );

    const cumpleMeta = liberacionDia <= limite;
    const diasAtraso = cumpleMeta
      ? 0
      : Math.round((liberacionDia.getTime() - limite.getTime()) / (1000 * 60 * 60 * 24));

    filas.push({
      id: exp.id,
      po_tiquetera: exp.po_tiquetera,
      exp_id: exp.exp_id || '',
      solicitante: exp.solicitante || '',
      estado_expediente: exp.estado_expediente || '—',
      etaReal: String(exp.eta_real).substring(0, 10),
      etaLimite: aFechaISO(limite),
      fechaLiberacion: fechaLib,
      diasAtraso,
      cumpleMeta
    });
  });

  const total = filas.length;
  if (total === 0) return { ...RESULTADO_ETA15_VACIO, sinEta };

  const enTiempo = filas.filter((f) => f.cumpleMeta).length;
  const tarde = total - enTiempo;
  const atrasadas = filas.filter((f) => !f.cumpleMeta);

  return {
    filas: filas.sort((a, b) => b.diasAtraso - a.diasAtraso),
    total,
    enTiempo,
    tarde,
    porcentajeTarde: Math.round((tarde / total) * 100),
    atrasoPromedio: atrasadas.length > 0
      ? redondear(atrasadas.reduce((suma, f) => suma + f.diasAtraso, 0) / atrasadas.length)
      : 0,
    sinEta
  };
}

// ════════════════════════════════════════════════════════════
// KPI 3 · Liberado dentro de ETD + 3 días hábiles
//
// Regla: la PO debe llegar al estado "Liberación" a más tardar
// 3 días hábiles después de su ETD. Si se libera el mismo día del
// ETD o antes, la duración es 0 y cumple.
// ════════════════════════════════════════════════════════════
export interface FilaEtdLiberacion {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  estado_expediente: string;
  etd: string;
  fechaLimite: string;
  fechaLiberacion: string;
  /** Días hábiles transcurridos entre el ETD y la liberación. */
  dias: number;
  /** Días hábiles que se pasó del límite (0 si cumple). */
  diasExcedidos: number;
  cumpleMeta: boolean;
}

export interface ResultadoEtdLiberacion {
  filas: FilaEtdLiberacion[];
  total: number;
  cumplen: number;
  noCumplen: number;
  porcentaje: number;
  promedio: number;
  porcentajeMeta: number;
  /** POs con ETD que todavía no llegaron a Liberación. */
  pendientes: number;
  /** POs Dropship sin ETD cargado: no se pueden evaluar. */
  sinEtd: number;
}

const RESULTADO_ETD_LIBERACION_VACIO: ResultadoEtdLiberacion = {
  filas: [],
  total: 0,
  cumplen: 0,
  noCumplen: 0,
  porcentaje: 0,
  promedio: 0,
  porcentajeMeta: 0,
  pendientes: 0,
  sinEtd: 0
};

/**
 * Calcula si cada PO Dropship llegó a Liberación dentro de los 3 días
 * hábiles siguientes a su ETD.
 */
export async function calcularKpiEtdLiberacion(
  expDropship: any[],
  metaDias: number = META_ETD_LIBERACION_DIAS
): Promise<ResultadoEtdLiberacion> {
  if (!expDropship || expDropship.length === 0) return RESULTADO_ETD_LIBERACION_VACIO;

  const conEtd = expDropship.filter((exp) => Boolean(exp.etd));
  const sinEtd = expDropship.length - conEtd.length;
  if (conEtd.length === 0) return { ...RESULTADO_ETD_LIBERACION_VACIO, sinEtd };

  const fechasLiberacion = await cargarFechasLiberacion(conEtd.map((exp) => exp.id));

  const filas: FilaEtdLiberacion[] = [];
  let pendientes = 0;

  conEtd.forEach((exp) => {
    const fechaLiberacion = fechasLiberacion[exp.id] || exp.fecha_liberacion;
    if (!fechaLiberacion) {
      pendientes += 1;
      return;
    }

    const etd = String(exp.etd).substring(0, 10);
    if (Number.isNaN(parseFechaSegura(etd).getTime())) return;

    const dias = diasHabilesEntre(etd, fechaLiberacion);
    const fechaLimite = sumarDiasHabiles(etd, metaDias);

    filas.push({
      id: exp.id,
      po_tiquetera: exp.po_tiquetera,
      exp_id: exp.exp_id || '',
      solicitante: exp.solicitante || '',
      estado_expediente: exp.estado_expediente || '—',
      etd,
      fechaLimite,
      fechaLiberacion,
      dias: redondear(dias),
      diasExcedidos: redondear(Math.max(0, dias - metaDias)),
      cumpleMeta: dias <= metaDias
    });
  });

  const total = filas.length;
  if (total === 0) return { ...RESULTADO_ETD_LIBERACION_VACIO, pendientes, sinEtd };

  const cumplen = filas.filter((f) => f.cumpleMeta).length;
  const noCumplen = total - cumplen;
  const promedio = redondear(filas.reduce((suma, f) => suma + f.dias, 0) / total);
  const porcentajeMeta =
    promedio > 0 ? Math.min(100, Math.round((metaDias / promedio) * 100)) : 100;

  return {
    filas: filas.sort((a, b) => b.diasExcedidos - a.diasExcedidos || b.dias - a.dias),
    total,
    cumplen,
    noCumplen,
    porcentaje: Math.round((cumplen / total) * 100),
    promedio,
    porcentajeMeta,
    pendientes,
    sinEtd
  };
}