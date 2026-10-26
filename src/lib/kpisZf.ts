import { diasHabilesEntre, parseFechaSegura, sumarDias } from './fechas';
import { consultarPorIds } from './consultas';

// ── Metas de los KPIs de Zona Franca (ZF) ──
export const META_ZF_TRANSITO_DIAS = 2;

// Días de holgura antes de la ETA Variable (meta del KPI "ETA Variable − 7")
export const DIAS_ANTES_ETA_VARIABLE = 7;

// ── Fila del detalle: ETA estimada (completado en o antes de la ETA Real) ──
export interface FilaZfEta {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  fechaAsignacion: string;
  fechaCompletado: string;
  fechaEta: string;
  dias: number;
  cumpleMeta: boolean;
}

// ── Fila del detalle: Tránsito corto < 2 días hábiles (solo POs marcadas; asignación → cierre) ──
export interface FilaZfTransito {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  fechaAsignacion: string;
  fechaFin: string;
  dias: number;
  cumpleMeta: boolean;
}

// ── Fila del detalle: ETA Variable − 7 días (referencia: Recibo de Delzof) ──
export interface FilaZfEtaVariable {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  fechaRecibo: string;
  fechaEta: string;
  fechaMeta: string;
  fechaCompletado: string;
  dias: number;
  cumpleMeta: boolean;
}

// ── Fila del detalle: ticket ZF activo sin ETA Real ──
export interface FilaZfSinEta {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  responsable: string;
  estado: string;
  fechaRecibo: string | null;
  fechaAsignacion: string;
  dias: number;
}

export interface ResultadoKpisZf {
  eta: FilaZfEta[];
  transito: FilaZfTransito[];
  etaVariable: FilaZfEtaVariable[];
  sinEta: FilaZfSinEta[];
  sinEtaActivos: number;
  totalActivosZf: number;
  // Compatibilidad con vistas anteriores: ZF sin ETA Real (todos los estados)
  sinEtaReal: number;
}

// Estados que cuentan como cierre del expediente ZF
const ESTADOS_TERMINALES_ZF = ['completado', 'liberación', 'liberacion', 'liberado'];

const redondear = (valor: number): number => Math.round(valor * 10) / 10;

/**
 * Calcula los KPIs de ZF:
 *  1. ETA estimada → cumple si el expediente se completó (asignación → cierre) EN O ANTES de su ETA Real.
 *  2. Tránsito corto < 2 días hábiles → solo POs marcadas como tránsito corto.
 *  3. ETA Variable − 7 → cumple si se completó al menos 7 días antes de la ETA Real,
 *     tomando como referencia el Recibo de Delzof (solo tickets con recibo + ETA Real).
 *  4. Sin ETA → tickets ZF activos (no completados) que todavía no tienen ETA Real.
 *
 * La fecha de inicio de los conteos es siempre la ASIGNACIÓN real del ticket
 * (registro de estado "Asignado"), con respaldo en fecha_apertura y, al final,
 * created_at. Antes se usaba created_at, que en tickets consolidados es la fecha
 * en que se subieron los documentos (mucho más antigua) y por eso los días no
 * cuadraban con la ETA Real.
 */
export async function calcularKpisZf(expZF: any[]): Promise<ResultadoKpisZf> {
  if (!expZF || expZF.length === 0) {
    return {
      eta: [],
      transito: [],
      etaVariable: [],
      sinEta: [],
      sinEtaActivos: 0,
      totalActivosZf: 0,
      sinEtaReal: 0,
    };
  }

  const ids = expZF.map((e) => e.id);

  // Fechas clave por expediente: asignación y cierre (completado/liberación)
  const fechaAsignado: Record<string, string> = {};
  const fechaTerminal: Record<string, string> = {};

  const tiempos = await consultarPorIds(
    'expedientes_tiempos_estados',
    'expediente_id, estado_nuevo, fecha_inicio',
    'expediente_id',
    ids
  );

  if (tiempos) {
    tiempos.forEach((t: any) => {
      const estado = (t.estado_nuevo || '').trim().toLowerCase();
      if (!t.fecha_inicio) return;

      if (estado === 'asignado') {
        if (!fechaAsignado[t.expediente_id] || t.fecha_inicio < fechaAsignado[t.expediente_id]) {
          fechaAsignado[t.expediente_id] = t.fecha_inicio;
        }
      }

      if (ESTADOS_TERMINALES_ZF.includes(estado)) {
        if (!fechaTerminal[t.expediente_id] || t.fecha_inicio < fechaTerminal[t.expediente_id]) {
          fechaTerminal[t.expediente_id] = t.fecha_inicio;
        }
      }
    });
  }

  // Fallback de la fecha de cierre: historial de cambios de estado
  const faltanTerminal = ids.filter((id: string) => !fechaTerminal[id]);
  if (faltanTerminal.length > 0) {
    const historial = await consultarPorIds(
      'expedientes_historial',
      'expediente_id, campo_modificado, valor_nuevo, fecha_cambio',
      'expediente_id',
      faltanTerminal,
      (consulta) => consulta.eq('campo_modificado', 'Estado')
    );

    if (historial) {
      historial
        .filter((h: any) => ESTADOS_TERMINALES_ZF.includes((h.valor_nuevo || '').trim().toLowerCase()))
        .forEach((h: any) => {
          if (!fechaTerminal[h.expediente_id] || h.fecha_cambio < fechaTerminal[h.expediente_id]) {
            fechaTerminal[h.expediente_id] = h.fecha_cambio;
          }
        });
    }
  }

  const eta: FilaZfEta[] = [];
  const transito: FilaZfTransito[] = [];
  const etaVariable: FilaZfEtaVariable[] = [];
  const sinEta: FilaZfSinEta[] = [];

  const ahora = new Date();

  expZF.forEach((exp) => {
    const esTerminal = ESTADOS_TERMINALES_ZF.includes((exp.estado_expediente || '').trim().toLowerCase());

    // Inicio real del reloj: asignación → apertura → creación
    const fechaAsig =
      fechaAsignado[exp.id] || exp.fecha_apertura || exp.fecha_creacion_expediente || exp.created_at;

    const finReal = fechaTerminal[exp.id] || exp.fecha_liberacion || (esTerminal ? exp.updated_at : null);

    // ── KPI 1: ETA estimada ──
    if (exp.eta_real) {
      const finEta = finReal;
      if (finEta) {
        const dias = diasHabilesEntre(fechaAsig, finEta);
        const cumplioAntesDeEta = parseFechaSegura(finEta) <= parseFechaSegura(exp.eta_real);
        eta.push({
          id: exp.id,
          po_tiquetera: exp.po_tiquetera,
          exp_id: exp.exp_id || '',
          solicitante: exp.solicitante || '',
          fechaAsignacion: fechaAsig,
          fechaCompletado: finEta,
          fechaEta: exp.eta_real,
          dias: redondear(dias),
          cumpleMeta: cumplioAntesDeEta,
        });
      }
    }

    // ── KPI 2: Tránsito corto < 2 días hábiles ──
    if (exp.transito_corto === true) {
      const fin = finReal;
      if (fin) {
        const dias = diasHabilesEntre(fechaAsig, fin);
        transito.push({
          id: exp.id,
          po_tiquetera: exp.po_tiquetera,
          exp_id: exp.exp_id || '',
          solicitante: exp.solicitante || '',
          fechaAsignacion: fechaAsig,
          fechaFin: fin,
          dias: redondear(dias),
          cumpleMeta: dias < META_ZF_TRANSITO_DIAS,
        });
      }
    }

    // ── KPI 3: ETA Variable − 7 días ──
    // Solo tickets con Recibo de Delzof, ETA Real y cierre registrado.
    if (exp.recibo_delzof_fecha && exp.eta_real && finReal) {
      const fechaMeta = sumarDias(exp.eta_real, -DIAS_ANTES_ETA_VARIABLE);
      const cumplio = parseFechaSegura(finReal) <= parseFechaSegura(fechaMeta);
      etaVariable.push({
        id: exp.id,
        po_tiquetera: exp.po_tiquetera,
        exp_id: exp.exp_id || '',
        solicitante: exp.solicitante || '',
        fechaRecibo: exp.recibo_delzof_fecha,
        fechaEta: exp.eta_real,
        fechaMeta,
        fechaCompletado: finReal,
        dias: redondear(diasHabilesEntre(exp.recibo_delzof_fecha, finReal)),
        cumpleMeta: cumplio,
      });
    }

    // ── KPI 4: Sin ETA (solo tickets ZF activos) ──
    if (!esTerminal && !exp.eta_real) {
      sinEta.push({
        id: exp.id,
        po_tiquetera: exp.po_tiquetera,
        exp_id: exp.exp_id || '',
        solicitante: exp.solicitante || '',
        responsable: exp.responsable_creacion || '',
        estado: exp.estado_expediente || '',
        fechaRecibo: exp.recibo_delzof_fecha || null,
        fechaAsignacion: fechaAsig,
        dias: redondear(diasHabilesEntre(fechaAsig, ahora)),
      });
    }
  });

  const totalActivosZf = expZF.filter(
    (exp) => !ESTADOS_TERMINALES_ZF.includes((exp.estado_expediente || '').trim().toLowerCase())
  ).length;

  return {
    eta: eta.sort((a, b) => b.dias - a.dias),
    transito: transito.sort((a, b) => b.dias - a.dias),
    etaVariable: etaVariable.sort((a, b) => Number(a.cumpleMeta) - Number(b.cumpleMeta)),
    sinEta: sinEta.sort((a, b) => b.dias - a.dias),
    sinEtaActivos: sinEta.length,
    totalActivosZf,
    sinEtaReal: expZF.filter((exp) => !exp.eta_real).length,
  };
}