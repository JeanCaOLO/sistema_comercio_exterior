import { supabase } from './supabase';
import { diasHabilesEntre, parseFechaSegura } from './fechas';

// ── Metas de los KPIs de Zona Franca (ZF) ──
export const META_ZF_TRANSITO_DIAS = 2;

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

export interface ResultadoKpisZf {
  eta: FilaZfEta[];
  transito: FilaZfTransito[];
  // Cantidad de expedientes ZF que NO tienen ETA Real cargada y, por lo tanto,
  // no se evalúan en el KPI de ETA estimada (solo se informa, no afecta el cálculo).
  sinEtaReal: number;
}

// Estados que cuentan como cierre del expediente ZF
const ESTADOS_TERMINALES_ZF = ['completado', 'liberación', 'liberacion', 'liberado'];

const redondear = (valor: number): number => Math.round(valor * 10) / 10;

/**
 * Calcula los dos KPIs de ZF:
 *  1. ETA estimada → cumple si el expediente se completó (asignación → cierre) EN O ANTES de su ETA Real.
 *     Solo se evalúan los expedientes que tienen ETA Real y ya están completados.
 *  2. Tránsito corto < 2 días hábiles → solo los expedientes ZF MARCADOS como tránsito corto;
 *     días entre la asignación (o creación) y el completado/liberación.
 * Devuelve el detalle por PO de cada KPI (incluyendo la fecha de asignación).
 */
export async function calcularKpisZf(expZF: any[]): Promise<ResultadoKpisZf> {
  if (!expZF || expZF.length === 0) {
    return { eta: [], transito: [], sinEtaReal: 0 };
  }

  const ids = expZF.map((e) => e.id);

  // Fechas clave por expediente: asignación y cierre (completado/liberación)
  const fechaAsignado: Record<string, string> = {};
  const fechaTerminal: Record<string, string> = {};

  const { data: tiempos } = await supabase
    .from('expedientes_tiempos_estados')
    .select('expediente_id, estado_nuevo, fecha_inicio')
    .in('expediente_id', ids);

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
    const { data: historial } = await supabase
      .from('expedientes_historial')
      .select('expediente_id, campo_modificado, valor_nuevo, fecha_cambio')
      .in('expediente_id', faltanTerminal)
      .eq('campo_modificado', 'Estado');

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

  expZF.forEach((exp) => {
    const fechaAsig = fechaAsignado[exp.id] || exp.created_at;

    // ── KPI 1: ETA estimada ──
    // Cumple si el expediente se completó (asignación → cierre) en o antes de su ETA Real.
    // Solo se evalúan los expedientes que tienen ETA Real registrada Y ya están completados.
    if (exp.eta_real) {
      const esTerminalEta = ESTADOS_TERMINALES_ZF.includes((exp.estado_expediente || '').trim().toLowerCase());
      const finEta = fechaTerminal[exp.id] || exp.fecha_liberacion || (esTerminalEta ? exp.updated_at : null);
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
    // Solo se evalúan los expedientes ZF MARCADOS con el check "Tránsito Corto".
    // Días entre la asignación (o creación) y el cierre (completado/liberación).
    // Respaldo: si no hay registro en el historial de tiempos, se usa la fecha de liberación
    // que guarda la app al pasar a Completado (cuando el estado del expediente ya es terminal).
    if (exp.transito_corto === true) {
      const esTerminal = ESTADOS_TERMINALES_ZF.includes((exp.estado_expediente || '').trim().toLowerCase());
      const fin = fechaTerminal[exp.id] || exp.fecha_liberacion || (esTerminal ? exp.updated_at : null);
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
  });

  return {
    eta: eta.sort((a, b) => b.dias - a.dias),
    transito: transito.sort((a, b) => b.dias - a.dias),
    sinEtaReal: expZF.filter((exp) => !exp.eta_real).length,
  };
}