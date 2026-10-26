// Servicios de datos del Dashboard de Control.
// Toda la conversación con Supabase y los cálculos pesados viven acá.

import { supabase } from '@/lib/supabase';
import { consultarPorIds } from '@/lib/consultas';
import { diasHabilesEntre } from '@/lib/fechas';
import { calcularKpisZf, type ResultadoKpisZf } from '@/lib/kpisZf';
import { calcularKpiCreacionExpediente } from '@/lib/kpisCreacion';
import type { FilaCreacionMcg, FilaEtdMcg } from '@/pages/home/components/ModalDetalleMcg';
import type { FilaEtdNotificado } from '@/pages/home/components/dashboard/ModalDetalleEtdNotificado';
import type { FilaAsignadoNotificado } from '@/pages/home/components/dashboard/ModalDetalleAsignadoNotificado';
import type {
  FiltroModuloTiempos,
  KpiAsignadoNotificado,
  KpiEtdNotificado,
  KpiMcgResumen,
  TiempoEntreEstados,
} from './types';

const redondear = (valor: number): number => Math.round(valor * 10) / 10;

const estaNotificado = (exp: any): boolean =>
  exp.estado_expediente === 'Notificado' || exp.estado_expediente === 'Visto Listo';

// ════════════════════════════════════════════════════════════
// CARGA DE EXPEDIENTES POR PERÍODO
// ════════════════════════════════════════════════════════════

// Devuelve la fecha en que cada PO pasó al estado "Asignado",
// considerando solo las que caen dentro del rango indicado.
export const obtenerFechasAsignadoEnRango = async (
  inicioISO: string,
  finISO: string
): Promise<{ ids: string[]; fechas: Record<string, string> }> => {
  const { data, error } = await supabase
    .from('expedientes_tiempos_estados')
    .select('expediente_id, fecha_inicio')
    .eq('estado_nuevo', 'Asignado')
    .gte('fecha_inicio', `${inicioISO}T00:00:00`)
    .lte('fecha_inicio', `${finISO}T23:59:59`);

  if (error) throw error;

  const fechas: Record<string, string> = {};
  (data || []).forEach((t: any) => {
    if (!fechas[t.expediente_id] || t.fecha_inicio < fechas[t.expediente_id]) {
      fechas[t.expediente_id] = t.fecha_inicio;
    }
  });

  return { ids: Object.keys(fechas), fechas };
};

// Trae los expedientes cuya FECHA DE ASIGNADO está dentro del rango.
// Las POs que todavía no fueron asignadas quedan fuera por diseño.
export const cargarExpedientesPorFechaAsignado = async (
  inicioISO: string,
  finISO: string
): Promise<any[]> => {
  const { ids } = await obtenerFechasAsignadoEnRango(inicioISO, finISO);
  if (ids.length === 0) return [];

  // En lotes: la lista de IDs puede superar el largo máximo de URL de Supabase
  // y la petición falla con "Bad Request".
  return consultarPorIds('expedientes', '*', 'id', ids);
};

// Carga los expedientes ZF que tuvieron ACTIVIDAD dentro del período:
//  - fueron creados en el rango, o
//  - tuvieron algún cambio de estado dentro del rango.
export const cargarZfDelPeriodo = async (inicioISO: string, finISO: string): Promise<any[]> => {
  const { data: zfTodos, error } = await supabase
    .from('expedientes')
    .select('*')
    .eq('tipo_modulo', 'zf');

  if (error || !zfTodos || zfTodos.length === 0) return [];

  const ids = zfTodos.map((e: any) => e.id);
  const tiempos = await consultarPorIds(
    'expedientes_tiempos_estados',
    'expediente_id, fecha_inicio',
    'expediente_id',
    ids
  );

  const conActividad = new Set<string>();
  tiempos.forEach((t: any) => {
    if (
      t.fecha_inicio &&
      t.fecha_inicio >= `${inicioISO}T00:00:00` &&
      t.fecha_inicio <= `${finISO}T23:59:59`
    ) {
      conActividad.add(t.expediente_id);
    }
  });

  return zfTodos.filter((exp: any) => {
    if (conActividad.has(exp.id)) return true;
    const creado = exp.created_at || exp.fecha_creacion_expediente;
    if (!creado) return false;
    // Compara solo la parte de fecha (YYYY-MM-DD)
    const soloFecha = String(creado).substring(0, 10);
    return soloFecha >= inicioISO && soloFecha <= finISO;
  });
};

// Cantidad de registros en la bandeja de Documentación.
export const contarDocumentosPendientes = async (): Promise<number> => {
  const { data, error } = await supabase.from('documentos_caa').select('id');
  if (error) throw error;
  return (data || []).length;
};

// ════════════════════════════════════════════════════════════
// TIEMPOS PROMEDIO ENTRE ESTADOS
// ════════════════════════════════════════════════════════════

export const cargarTiemposEntreEstados = async (
  expedientesDelRango: any[],
  moduloFiltro: FiltroModuloTiempos = 'todos'
): Promise<TiempoEntreEstados[]> => {
  const expedientesPeriodo =
    moduloFiltro === 'todos'
      ? expedientesDelRango
      : expedientesDelRango.filter((exp) => (exp.tipo_modulo || '').toLowerCase() === moduloFiltro);

  if (expedientesPeriodo.length === 0) return [];

  const expedienteIds = expedientesPeriodo.map((exp) => exp.id);

  // Intentar cargar datos reales de la tabla de tiempos
  const tiempos = await consultarPorIds(
    'expedientes_tiempos_estados',
    '*',
    'expediente_id',
    expedienteIds,
    (consulta) => consulta.not('minutos_transcurridos', 'is', null)
  );

  if (tiempos.length > 0) {
    // Datos reales: agrupar por transición (estado_anterior → estado_nuevo)
    const transiciones: { [key: string]: { minutos: number[]; desde: string; hasta: string } } = {};

    tiempos.forEach((t: any) => {
      const desde = t.estado_anterior || 'Inicio';
      const hasta = t.estado_nuevo || 'Desconocido';
      const key = `${desde}|${hasta}`;
      if (!transiciones[key]) transiciones[key] = { minutos: [], desde, hasta };
      if ((t.minutos_transcurridos || 0) > 0) {
        transiciones[key].minutos.push(t.minutos_transcurridos);
      }
    });

    const ordenEstados = [
      'Asignado',
      'En Proceso',
      'Espera de Respuesta',
      'Completado',
      'Recepción de Carga',
      'Facturación',
      'Liberación',
      'Notificado',
    ];

    return Object.values(transiciones)
      .filter((t) => t.minutos.length > 0)
      .map((t) => ({
        desde: t.desde,
        hasta: t.hasta,
        minutosPromedio: Math.round(t.minutos.reduce((a, b) => a + b, 0) / t.minutos.length),
        cantidad: t.minutos.length,
        fuente: 'real' as const,
      }))
      .sort((a, b) => {
        const idxA = ordenEstados.indexOf(a.hasta);
        const idxB = ordenEstados.indexOf(b.hasta);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
  }

  // Fallback: estimar tiempos desde los datos de expedientes
  const estadosOrden = [
    'Asignado',
    'En Proceso',
    'Espera de Respuesta',
    'Completado',
    'Recepción de Carga',
    'Facturación',
    'Liberación',
    'Notificado',
  ];
  const estadosPrevios: { [key: string]: string } = {
    'En Proceso': 'Asignado',
    'Espera de Respuesta': 'En Proceso',
    Completado: 'Espera de Respuesta',
    'Recepción de Carga': 'Espera de Respuesta',
    Facturación: 'Recepción de Carga',
    Liberación: 'Facturación',
    Notificado: 'Liberación',
  };

  const ahora = new Date();
  const porEstado: { [key: string]: number[] } = {};

  expedientesPeriodo.forEach((exp) => {
    const estado = exp.estado_expediente;
    if (!estado || !estadosOrden.includes(estado)) return;
    const created = new Date(exp.created_at);
    let minutos = 0;
    if (exp.tiempo_real_minutos) {
      // Para finalizados, distribuir el tiempo total entre los estados del flujo
      const estadoIdx = estadosOrden.indexOf(estado);
      minutos = Math.round(exp.tiempo_real_minutos / Math.max(1, estadoIdx + 1));
    } else {
      // Para en curso, tiempo desde creación al momento actual
      minutos = Math.round((ahora.getTime() - created.getTime()) / (1000 * 60));
    }
    if (minutos > 0) {
      if (!porEstado[estado]) porEstado[estado] = [];
      porEstado[estado].push(minutos);
    }
  });

  return Object.entries(porEstado)
    .filter(([, mins]) => mins.length > 0)
    .map(([estado, mins]) => ({
      desde: estadosPrevios[estado] || 'Inicio',
      hasta: estado,
      minutosPromedio: Math.round(mins.reduce((a, b) => a + b, 0) / mins.length),
      cantidad: mins.length,
      fuente: 'estimado' as const,
    }))
    .sort((a, b) => estadosOrden.indexOf(a.hasta) - estadosOrden.indexOf(b.hasta));
};

// ════════════════════════════════════════════════════════════
// KPIs DROPSHIP
// ════════════════════════════════════════════════════════════

const KPI_ETD_VACIO: KpiEtdNotificado = {
  totalEvaluados: 0,
  dentroRango: 0,
  fueraRango: 0,
  porcentajeOk: 0,
  promedioDias: 0,
};

// KPI ETD vs Notificado: compara fecha ETD con fecha de llegada a Notificado.
export const calcularKpiEtdNotificado = async (
  expDropshipNormal: any[],
  metaDias: number
): Promise<{ kpi: KpiEtdNotificado; detalle: FilaEtdNotificado[] }> => {
  const evaluables = expDropshipNormal.filter((exp) => estaNotificado(exp) && exp.etd);
  if (evaluables.length === 0) return { kpi: { ...KPI_ETD_VACIO }, detalle: [] };

  const ids = evaluables.map((e) => e.id);
  const tiempos = await consultarPorIds(
    'expedientes_tiempos_estados',
    'expediente_id, fecha_inicio',
    'expediente_id',
    ids,
    (consulta) => consulta.eq('estado_nuevo', 'Notificado')
  );

  const fechaPorExp: Record<string, string> = {};
  tiempos.forEach((t: any) => {
    if (!fechaPorExp[t.expediente_id] || t.fecha_inicio < fechaPorExp[t.expediente_id]) {
      fechaPorExp[t.expediente_id] = t.fecha_inicio;
    }
  });

  let dentroRango = 0;
  let fueraRango = 0;
  let sumaDias = 0;
  let contados = 0;
  const detalle: FilaEtdNotificado[] = [];

  evaluables.forEach((exp) => {
    const fechaNotificado = fechaPorExp[exp.id];
    if (!fechaNotificado) return;
    const dias = diasHabilesEntre(exp.etd, fechaNotificado);
    contados++;
    sumaDias += dias;
    const cumple = dias <= metaDias;
    if (cumple) dentroRango++;
    else fueraRango++;

    detalle.push({
      id: exp.id,
      po_tiquetera: exp.po_tiquetera,
      exp_id: exp.exp_id || '',
      solicitante: exp.solicitante || '',
      etd: exp.etd,
      fechaNotificado,
      diasDiferencia: redondear(dias),
      cumpleMeta: cumple,
    });
  });

  return {
    kpi: {
      totalEvaluados: contados,
      dentroRango,
      fueraRango,
      porcentajeOk: contados > 0 ? Math.round((dentroRango / contados) * 100) : 0,
      promedioDias: contados > 0 ? redondear(sumaDias / contados) : 0,
    },
    detalle: detalle.sort((a, b) => b.diasDiferencia - a.diasDiferencia),
  };
};

// KPI Duración Promedio Asignado → Notificado (con respaldo en historial).
export const calcularKpiAsignadoNotificado = async (
  expDropshipNormal: any[]
): Promise<{ kpi: KpiAsignadoNotificado; detalle: FilaAsignadoNotificado[] }> => {
  const notificados = expDropshipNormal.filter(estaNotificado);
  if (notificados.length === 0) {
    return { kpi: { totalEvaluados: 0, promedioDias: 0 }, detalle: [] };
  }

  const ids = notificados.map((e) => e.id);
  const createdMap: Record<string, string> = {};
  notificados.forEach((exp) => {
    createdMap[exp.id] = exp.created_at;
  });

  const tiemposAsignado = await consultarPorIds(
    'expedientes_tiempos_estados',
    'expediente_id, fecha_inicio',
    'expediente_id',
    ids,
    (consulta) => consulta.eq('estado_nuevo', 'Asignado')
  );

  const fechaAsignado: Record<string, string> = {};
  tiemposAsignado.forEach((t: any) => {
    if (!fechaAsignado[t.expediente_id] || t.fecha_inicio < fechaAsignado[t.expediente_id]) {
      fechaAsignado[t.expediente_id] = t.fecha_inicio;
    }
  });

  const fechaNotif = await cargarFechasNotificado(ids);

  const detalle: FilaAsignadoNotificado[] = [];

  notificados.forEach((exp) => {
    const fAsig = fechaAsignado[exp.id] || createdMap[exp.id];
    const fNotif = fechaNotif[exp.id];
    if (!fNotif) return;
    detalle.push({
      id: exp.id,
      po_tiquetera: exp.po_tiquetera,
      exp_id: exp.exp_id || '',
      solicitante: exp.solicitante || '',
      fechaAsignado: fAsig,
      fechaNotificado: fNotif,
      dias: redondear(diasHabilesEntre(fAsig, fNotif)),
    });
  });

  const total = detalle.length;
  const suma = detalle.reduce((s, d) => s + d.dias, 0);

  return {
    kpi: { totalEvaluados: total, promedioDias: total > 0 ? redondear(suma / total) : 0 },
    detalle: detalle.sort((a, b) => b.dias - a.dias),
  };
};

// Fecha de llegada a "Notificado": tiempos por estado + respaldo en historial.
const cargarFechasNotificado = async (ids: string[]): Promise<Record<string, string>> => {
  const tiempos = await consultarPorIds(
    'expedientes_tiempos_estados',
    'expediente_id, fecha_inicio',
    'expediente_id',
    ids,
    (consulta) => consulta.eq('estado_nuevo', 'Notificado')
  );

  const fecha: Record<string, string> = {};
  tiempos.forEach((t: any) => {
    if (!fecha[t.expediente_id] || t.fecha_inicio < fecha[t.expediente_id]) {
      fecha[t.expediente_id] = t.fecha_inicio;
    }
  });

  const faltantes = ids.filter((id) => !fecha[id]);
  if (faltantes.length > 0) {
    const historial = await consultarPorIds(
      'expedientes_historial',
      'expediente_id, fecha_cambio',
      'expediente_id',
      faltantes,
      (consulta) => consulta.eq('campo_modificado', 'Estado').eq('valor_nuevo', 'Notificado')
    );
    historial.forEach((h: any) => {
      if (!fecha[h.expediente_id] || h.fecha_cambio < fecha[h.expediente_id]) {
        fecha[h.expediente_id] = h.fecha_cambio;
      }
    });
  }

  return fecha;
};

// Promedio de días hábiles desde la creación del expediente hasta Notificado.
export const calcularPromedioCreacionNotificado = async (
  expDropshipNormal: any[]
): Promise<number> => {
  const notificados = expDropshipNormal.filter(estaNotificado);
  if (notificados.length === 0) return 0;

  const ids = notificados.map((e) => e.id);
  const creados: Record<string, string> = {};
  notificados.forEach((exp) => {
    creados[exp.id] = exp.created_at;
  });

  const llegada = await cargarFechasNotificado(ids);

  const dias: number[] = [];
  Object.entries(llegada).forEach(([expId, fecha]) => {
    const created = creados[expId];
    if (!created) return;
    dias.push(diasHabilesEntre(created, fecha));
  });

  if (dias.length === 0) return 0;
  return redondear(dias.reduce((a, b) => a + b, 0) / dias.length);
};

// ════════════════════════════════════════════════════════════
// KPIs MCG
// ════════════════════════════════════════════════════════════

export interface ResultadoMcg {
  creacion: KpiMcgResumen;
  creacionDetalle: FilaCreacionMcg[];
  etd: KpiMcgResumen;
  etdDetalle: FilaEtdMcg[];
}

const MCG_VACIO: KpiMcgResumen = {
  totalEvaluados: 0,
  cumplen: 0,
  noCumplen: 0,
  porcentajeCumplimiento: 0,
  diasPromedio: 0,
};

export const calcularKpisMcg = async (
  expMcg: any[],
  metaCreacion: number,
  metaEtd: number
): Promise<ResultadoMcg> => {
  if (!expMcg || expMcg.length === 0) {
    return {
      creacion: { ...MCG_VACIO },
      creacionDetalle: [],
      etd: { ...MCG_VACIO },
      etdDetalle: [],
    };
  }

  // ── KPI Creación de expediente — desde la carga de la factura ──
  const resultadoCreacion = await calcularKpiCreacionExpediente(expMcg, metaCreacion);

  const creacion: KpiMcgResumen = {
    totalEvaluados: resultadoCreacion.totalEvaluados,
    cumplen: resultadoCreacion.cumplen,
    noCumplen: resultadoCreacion.noCumplen,
    porcentajeCumplimiento: resultadoCreacion.porcentajeCumplimiento,
    diasPromedio: resultadoCreacion.diasPromedio,
  };

  const creacionDetalle: FilaCreacionMcg[] = resultadoCreacion.filas.map((f) => ({
    id: f.id,
    po_tiquetera: f.po_tiquetera,
    exp_id: f.exp_id,
    solicitante: f.solicitante,
    fechaCargaDocumentos: f.fechaCargaDocumentos,
    fechaLiberacion: f.fechaLiberacion,
    dias: f.dias,
    cumpleMeta: f.cumpleMeta,
  }));

  // ── KPI ETD → Notificado ──
  const conEtd = expMcg.filter((exp) => estaNotificado(exp) && exp.etd);
  if (conEtd.length === 0) {
    return { creacion, creacionDetalle, etd: { ...MCG_VACIO }, etdDetalle: [] };
  }

  const ids = conEtd.map((e) => e.id);
  const tiemposNotif = await consultarPorIds(
    'expedientes_tiempos_estados',
    'expediente_id, fecha_inicio',
    'expediente_id',
    ids,
    (consulta) => consulta.eq('estado_nuevo', 'Notificado')
  );

  const fechaNotifPorExp: Record<string, string> = {};
  tiemposNotif.forEach((t: any) => {
    if (!fechaNotifPorExp[t.expediente_id] || t.fecha_inicio < fechaNotifPorExp[t.expediente_id]) {
      fechaNotifPorExp[t.expediente_id] = t.fecha_inicio;
    }
  });

  let dentro = 0;
  let fuera = 0;
  let sumaDias = 0;
  let contados = 0;
  const etdDetalle: FilaEtdMcg[] = [];

  conEtd.forEach((exp) => {
    const fechaNotif = fechaNotifPorExp[exp.id];
    if (!fechaNotif) return;
    const dias = diasHabilesEntre(exp.etd, fechaNotif);
    const cumple = dias < metaEtd;
    contados++;
    sumaDias += dias;
    if (cumple) dentro++;
    else fuera++;

    etdDetalle.push({
      id: exp.id,
      po_tiquetera: exp.po_tiquetera,
      exp_id: exp.exp_id || '',
      solicitante: exp.solicitante || '',
      etd: exp.etd,
      fechaNotificado: fechaNotif,
      dias: redondear(dias),
      cumpleMeta: cumple,
    });
  });

  return {
    creacion,
    creacionDetalle,
    etd: {
      totalEvaluados: contados,
      cumplen: dentro,
      noCumplen: fuera,
      porcentajeCumplimiento: contados > 0 ? Math.round((dentro / contados) * 100) : 0,
      diasPromedio: contados > 0 ? redondear(sumaDias / contados) : 0,
    },
    etdDetalle: etdDetalle.sort((a, b) => b.dias - a.dias),
  };
};

// ════════════════════════════════════════════════════════════
// KPIs ZONA FRANCA
// ════════════════════════════════════════════════════════════

// Promedio de días hábiles desde la creación hasta Completado (ZF).
export const calcularPromedioCreacionCompletado = async (expZf: any[]): Promise<number> => {
  const completados = expZf.filter((exp) => exp.estado_expediente === 'Completado');
  if (completados.length === 0) return 0;

  const ids = completados.map((e) => e.id);
  const creados: Record<string, string> = {};
  completados.forEach((exp) => {
    creados[exp.id] = exp.created_at;
  });

  const tiempos = await consultarPorIds(
    'expedientes_tiempos_estados',
    'expediente_id, fecha_inicio',
    'expediente_id',
    ids,
    (consulta) => consulta.eq('estado_nuevo', 'Completado')
  );

  const llegada: Record<string, string> = {};
  tiempos.forEach((t: any) => {
    if (!llegada[t.expediente_id] || t.fecha_inicio < llegada[t.expediente_id]) {
      llegada[t.expediente_id] = t.fecha_inicio;
    }
  });

  const faltantes = ids.filter((id) => !llegada[id]);
  if (faltantes.length > 0) {
    const historial = await consultarPorIds(
      'expedientes_historial',
      'expediente_id, fecha_cambio',
      'expediente_id',
      faltantes,
      (consulta) => consulta.eq('campo_modificado', 'Estado').eq('valor_nuevo', 'Completado')
    );
    historial.forEach((h: any) => {
      if (!llegada[h.expediente_id] || h.fecha_cambio < llegada[h.expediente_id]) {
        llegada[h.expediente_id] = h.fecha_cambio;
      }
    });
  }

  const dias: number[] = [];
  Object.entries(llegada).forEach(([expId, fecha]) => {
    const created = creados[expId];
    if (!created) return;
    dias.push(diasHabilesEntre(created, fecha));
  });

  if (dias.length === 0) return 0;
  return redondear(dias.reduce((a, b) => a + b, 0) / dias.length);
};

export const cargarKpisZf = async (expZF: any[]): Promise<ResultadoKpisZf> => calcularKpisZf(expZF);