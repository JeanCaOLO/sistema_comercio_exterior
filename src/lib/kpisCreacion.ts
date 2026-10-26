import { diasHabilesEntre } from './fechas';
import { consultarPorIds } from './consultas';

// ════════════════════════════════════════════════════════════
// KPIs relacionados a la CREACIÓN del expediente
//
// Regla vigente: el reloj YA NO arranca en el estado "Asignado".
// Arranca cuando se cargan los documentos del ticket (la factura).
//
// Fuente de esa fecha: `expedientes.created_at`. En los tickets que
// nacen de la bandeja de Documentación, la consolidación guarda ahí la
// fecha del documento MÁS ANTIGUO cargado, así que es el registro más
// fiel de la carga real. Respaldo: fecha_creacion_expediente.
// ════════════════════════════════════════════════════════════

export const META_DURACION_DIAS = 3;
export const META_MCG_CREACION_DIAS = 2;

const redondear = (valor: number): number => Math.round(valor * 10) / 10;

/** Fecha en que se cargaron los documentos (factura) del ticket. */
export const fechaCargaDocumentos = (exp: any): string =>
  exp?.created_at || exp?.fecha_creacion_expediente || '';

// ────────────────────────────────────────────────────────────
// KPI · Duración mínima (< 3 días hábiles) — solo Dropship
// Carga de documentos → liberación (o ahora si sigue en curso)
// ────────────────────────────────────────────────────────────
export interface FilaDuracionMinima {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  tipo_modulo: string;
  estado_expediente: string;
  solicitante: string;
  responsable_creacion: string;
  diasDuracion: number;
  cumpleMeta: boolean;
  fechaCargaDocumentos: string;
  fechaFin: string | null;
}

export interface ResultadoDuracionMinima {
  totalEvaluados: number;
  cumplen: number;
  noCumplen: number;
  porcentajeCumplimiento: number;
  diasPromedioTotal: number;
  filas: FilaDuracionMinima[];
}

const RESULTADO_DURACION_VACIO: ResultadoDuracionMinima = {
  totalEvaluados: 0,
  cumplen: 0,
  noCumplen: 0,
  porcentajeCumplimiento: 0,
  diasPromedioTotal: 0,
  filas: []
};

/**
 * Calcula la duración de los expedientes Dropship desde la carga de sus
 * documentos (factura) hasta su liberación.
 */
export function calcularKpiDuracionMinima(
  listaExpedientes: any[],
  metaDias: number = META_DURACION_DIAS
): ResultadoDuracionMinima {
  const expDropship = (listaExpedientes || []).filter(
    (exp) => (exp.tipo_modulo || '').toLowerCase() === 'dropship'
  );

  if (expDropship.length === 0) return { ...RESULTADO_DURACION_VACIO };

  const ahora = new Date();
  const filas: FilaDuracionMinima[] = [];

  expDropship.forEach((exp) => {
    const inicio = fechaCargaDocumentos(exp);
    if (!inicio) return;

    const fin: string | Date = exp.fecha_liberacion ? exp.fecha_liberacion : ahora;
    const dias = diasHabilesEntre(inicio, fin);

    filas.push({
      id: exp.id,
      po_tiquetera: exp.po_tiquetera,
      exp_id: exp.exp_id || '',
      tipo_modulo: 'dropship',
      estado_expediente: exp.estado_expediente,
      solicitante: exp.solicitante,
      responsable_creacion: exp.responsable_creacion,
      diasDuracion: redondear(dias),
      cumpleMeta: dias < metaDias,
      fechaCargaDocumentos: inicio,
      fechaFin: exp.fecha_liberacion || null
    });
  });

  const total = filas.length;
  if (total === 0) return { ...RESULTADO_DURACION_VACIO };

  const cumplen = filas.filter((f) => f.cumpleMeta).length;
  const sumaDias = filas.reduce((suma, f) => suma + f.diasDuracion, 0);

  return {
    totalEvaluados: total,
    cumplen,
    noCumplen: total - cumplen,
    porcentajeCumplimiento: Math.round((cumplen / total) * 100),
    diasPromedioTotal: redondear(sumaDias / total),
    filas: filas.sort((a, b) => a.diasDuracion - b.diasDuracion)
  };
}

// ────────────────────────────────────────────────────────────
// KPI · Creación de expediente MCG (≤ 2 días hábiles)
// Carga de documentos → liberación
// ────────────────────────────────────────────────────────────
export interface FilaCreacionExpediente {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  fechaCargaDocumentos: string;
  fechaLiberacion: string;
  dias: number;
  cumpleMeta: boolean;
}

export interface ResultadoCreacionExpediente {
  totalEvaluados: number;
  cumplen: number;
  noCumplen: number;
  porcentajeCumplimiento: number;
  diasPromedio: number;
  filas: FilaCreacionExpediente[];
}

const RESULTADO_CREACION_VACIO: ResultadoCreacionExpediente = {
  totalEvaluados: 0,
  cumplen: 0,
  noCumplen: 0,
  porcentajeCumplimiento: 0,
  diasPromedio: 0,
  filas: []
};

/**
 * Calcula los días hábiles entre la carga de documentos (factura) y la
 * llegada al estado de liberación de las POs marcadas como MCG.
 */
export async function calcularKpiCreacionExpediente(
  expMcg: any[],
  metaDias: number = META_MCG_CREACION_DIAS
): Promise<ResultadoCreacionExpediente> {
  if (!expMcg || expMcg.length === 0) return { ...RESULTADO_CREACION_VACIO };

  const ids = expMcg.map((e) => e.id);

  // Fecha real de llegada a liberación (registro de tiempos por estado)
  const tiemposLiberacion = await consultarPorIds(
    'expedientes_tiempos_estados',
    'expediente_id, fecha_inicio',
    'expediente_id',
    ids,
    (consulta) => consulta.in('estado_nuevo', ['Liberación', 'Liberacion', 'Liberado', 'LIBERADO'])
  );

  const fechaLiberacionPorExp: Record<string, string> = {};
  tiemposLiberacion.forEach((t: any) => {
    if (!t.fecha_inicio) return;
    if (
      !fechaLiberacionPorExp[t.expediente_id] ||
      t.fecha_inicio < fechaLiberacionPorExp[t.expediente_id]
    ) {
      fechaLiberacionPorExp[t.expediente_id] = t.fecha_inicio;
    }
  });

  const filas: FilaCreacionExpediente[] = [];

  expMcg.forEach((exp) => {
    const fechaLiberacion = fechaLiberacionPorExp[exp.id] || exp.fecha_liberacion;
    if (!fechaLiberacion) return;

    const inicio = fechaCargaDocumentos(exp);
    if (!inicio) return;

    const dias = diasHabilesEntre(inicio, fechaLiberacion);

    filas.push({
      id: exp.id,
      po_tiquetera: exp.po_tiquetera,
      exp_id: exp.exp_id || '',
      solicitante: exp.solicitante || '',
      fechaCargaDocumentos: inicio,
      fechaLiberacion,
      dias: redondear(dias),
      cumpleMeta: dias <= metaDias
    });
  });

  const total = filas.length;
  if (total === 0) return { ...RESULTADO_CREACION_VACIO };

  const cumplen = filas.filter((f) => f.cumpleMeta).length;
  const sumaDias = filas.reduce((suma, f) => suma + f.dias, 0);

  return {
    totalEvaluados: total,
    cumplen,
    noCumplen: total - cumplen,
    porcentajeCumplimiento: Math.round((cumplen / total) * 100),
    diasPromedio: redondear(sumaDias / total),
    filas: filas.sort((a, b) => b.dias - a.dias)
  };
}