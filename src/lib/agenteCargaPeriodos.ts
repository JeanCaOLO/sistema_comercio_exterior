import { supabase } from './supabase';
import {
  NOMBRES_MES,
  SIN_PROVEEDOR,
  type FilaComparativo,
  type MetaCarga,
  type MetaComparativo,
  type PoCarga,
} from './agenteCarga';

// ============================================================
// DETALLE POR PERIODO — ASIGNACIÓN AGENTE DE CARGA
// El Excel de POs Activas trae el histórico completo, pero la
// base guarda el DETALLE de cada PO clasificado por el mes de su
// Fecha Asignación Agente de Carga. Así se puede consultar
// cualquier periodo sin ver el acumulado.
// ============================================================

/** Marcador de las POs que no tienen Fecha Asignación Agente de Carga. */
export const PERIODO_SIN_FECHA = 'sin-fecha';

const TAMANO_PAGINA = 1000;
const TAMANO_LOTE = 300;
const TAMANO_LIBERACION = 150;

export interface PeriodoCarga {
  periodo: string;
  archivo: string;
  cargadoPor: string;
  cargadoAt: string;
  totalPos: number;
}

export interface DetallePeriodo {
  pos: PoCarga[];
  meta: MetaCarga | null;
}

interface FilaSupabase {
  po: string;
  etapa: string | null;
  proveedor: string | null;
  proveedor_servicio: string;
  agente_carga: string | null;
  ruta_logistica: string | null;
  puerto_arribo: string | null;
  pais_destino: string;
  monto_total: number | null;
  etd_inicial: string | null;
  eta_inicial: string | null;
  fecha_asignacion: string | null;
  archivo_origen: string | null;
  cargado_por: string | null;
  cargado_at: string;
  periodo: string;
}

/** "2026-10" → "Octubre 2026". Las POs sin fecha van a su propio grupo. */
export function etiquetaPeriodoCarga(periodo: string): string {
  if (!periodo) return 'Sin periodo';
  if (periodo === PERIODO_SIN_FECHA) return 'Sin fecha de asignación';
  const [anio, mes] = periodo.split('-').map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return periodo;
  return `${NOMBRES_MES[mes - 1]} ${anio}`;
}

/** Periodo (YYYY-MM) al que pertenece una PO según su Fecha Asignación. */
export function periodoDeAsignacion(fecha: string | null): string {
  if (!fecha) return PERIODO_SIN_FECHA;
  const dia = String(fecha).slice(0, 10);
  if (!/^\d{4}-\d{2}/.test(dia)) return PERIODO_SIN_FECHA;
  return dia.slice(0, 7);
}

/** "2026-10-14" → "14/10/2026" */
export function formatearFechaCorta(fecha: string | null): string {
  if (!fecha) return '—';
  const dia = String(fecha).slice(0, 10);
  const partes = dia.split('-');
  if (partes.length !== 3) return dia;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function ordenarPeriodos(lista: PeriodoCarga[]): PeriodoCarga[] {
  return [...lista].sort((a, b) => {
    if (a.periodo === PERIODO_SIN_FECHA) return 1;
    if (b.periodo === PERIODO_SIN_FECHA) return -1;
    return b.periodo.localeCompare(a.periodo);
  });
}

/** Periodos con detalle guardado (más reciente primero, sin fecha al final). */
export async function listarPeriodos(): Promise<PeriodoCarga[]> {
  const { data, error } = await supabase
    .from('agente_carga_cargas')
    .select('periodo, archivo_origen, cargado_por, cargado_at, total_pos');

  if (error) throw error;

  const filas = (data || []) as unknown as {
    periodo: string;
    archivo_origen: string | null;
    cargado_por: string | null;
    cargado_at: string;
    total_pos: number | null;
  }[];

  return ordenarPeriodos(
    filas.map((f) => ({
      periodo: f.periodo,
      archivo: f.archivo_origen || 'archivo.xlsx',
      cargadoPor: f.cargado_por || '',
      cargadoAt: f.cargado_at,
      totalPos: Number(f.total_pos) || 0,
    }))
  );
}

/** Trae el detalle de POs de un periodo concreto. */
export async function cargarCargaPorPeriodo(periodo: string): Promise<DetallePeriodo> {
  if (!periodo) return { pos: [], meta: null };

  const filas: FilaSupabase[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from('agente_carga_pos')
      .select('po, etapa, proveedor, proveedor_servicio, agente_carga, ruta_logistica, puerto_arribo, pais_destino, monto_total, etd_inicial, eta_inicial, fecha_asignacion, archivo_origen, cargado_por, cargado_at, periodo')
      .eq('periodo', periodo)
      .order('proveedor_servicio', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) throw error;
    const lote = (data || []) as unknown as FilaSupabase[];
    filas.push(...lote);
    if (lote.length < TAMANO_PAGINA) break;
  }

  if (filas.length === 0) return { pos: [], meta: null };

  const pos: PoCarga[] = filas.map((f) => ({
    po: f.po,
    etapa: f.etapa || '',
    proveedor: f.proveedor || '',
    proveedorServicio: f.proveedor_servicio,
    agenteCarga: f.agente_carga || '',
    rutaLogistica: f.ruta_logistica || '',
    puertoArribo: f.puerto_arribo || '',
    paisDestino: f.pais_destino,
    montoTotal: f.monto_total,
    etdInicial: f.etd_inicial,
    etaInicial: f.eta_inicial,
    fechaAsignacion: f.fecha_asignacion,
  }));

  const primero = filas[0];
  const meta: MetaCarga = {
    archivo: primero.archivo_origen || 'archivo.xlsx',
    cargadoPor: primero.cargado_por || '',
    cargadoAt: primero.cargado_at,
  };

  return { pos, meta };
}

/**
 * Cantidad real de POs guardadas para un periodo.
 */
export async function contarPosPeriodo(periodo: string): Promise<number> {
  const { count, error } = await supabase
    .from('agente_carga_pos')
    .select('po', { count: 'exact', head: true })
    .eq('periodo', periodo);
  if (error) throw error;
  return count || 0;
}

/**
 * Quita del detalle guardado las POs que vienen en el archivo nuevo,
 * sin importar en qué periodo estaban. Así una PO reasignada no queda
 * duplicada en su mes anterior.
 */
async function liberarPosExistentes(clavesPo: string[]): Promise<void> {
  const unicas = Array.from(new Set(clavesPo));
  for (let i = 0; i < unicas.length; i += TAMANO_LIBERACION) {
    const lote = unicas.slice(i, i + TAMANO_LIBERACION);
    const { error } = await supabase.from('agente_carga_pos').delete().in('po', lote);
    if (error) throw new Error(`No se pudo actualizar el detalle de las POs: ${error.message}`);
  }
}

/**
 * Sincroniza la cantidad de POs de cada periodo con el detalle real guardado.
 */
export async function refrescarTotalesPeriodos(): Promise<void> {
  const { data, error } = await supabase.from('agente_carga_cargas').select('periodo');
  if (error) throw error;

  const claves = (data || []).map((f) => (f as unknown as { periodo: string }).periodo);
  for (const clave of claves) {
    const total = await contarPosPeriodo(clave);
    const { error: errorMeta } = await supabase
      .from('agente_carga_cargas')
      .update({ total_pos: total })
      .eq('periodo', clave);
    if (errorMeta) {
      console.warn(`No se pudo actualizar el total de ${clave}:`, errorMeta.message);
    }
  }
}

/**
 * Guarda el detalle de todas las POs clasificándolas por el periodo
 * de su Fecha Asignación. No borra meses completos: actualiza las POs
 * que vienen en el archivo y conserva el detalle histórico de las demás.
 */
export async function guardarDetalleCarga(
  pos: PoCarga[],
  archivo: string,
  usuario: string,
  onProgreso?: (avance: number) => void
): Promise<{ periodos: string[]; total: number }> {
  if (pos.length === 0) throw new Error('El archivo no contiene POs para guardar.');

  const cargadoAt = new Date().toISOString();
  const grupos = new Map<string, PoCarga[]>();

  pos.forEach((p) => {
    const periodo = periodoDeAsignacion(p.fechaAsignacion);
    if (!grupos.has(periodo)) grupos.set(periodo, []);
    grupos.get(periodo)!.push(p);
  });

  const claves = Array.from(grupos.keys()).sort();
  let procesadas = 0;

  // 1. Se liberan las POs que vienen en el archivo (de cualquier periodo),
  //    para no duplicarlas si cambiaron de mes. El resto se conserva.
  await liberarPosExistentes(pos.map((p) => p.po));

  for (const periodo of claves) {
    const filasGrupo = grupos.get(periodo)!;
    const cargaId = crypto.randomUUID();

    const filas: (FilaSupabase & { carga_id: string })[] = filasGrupo.map((p) => ({
      carga_id: cargaId,
      po: p.po,
      etapa: p.etapa || null,
      proveedor: p.proveedor || null,
      proveedor_servicio: p.proveedorServicio,
      agente_carga: p.agenteCarga || null,
      ruta_logistica: p.rutaLogistica || null,
      puerto_arribo: p.puertoArribo || null,
      pais_destino: p.paisDestino,
      monto_total: p.montoTotal,
      etd_inicial: p.etdInicial,
      eta_inicial: p.etaInicial,
      fecha_asignacion: p.fechaAsignacion,
      archivo_origen: archivo || null,
      cargado_por: usuario || null,
      cargado_at: cargadoAt,
      periodo,
    }));

    for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
      const lote = filas.slice(i, i + TAMANO_LOTE);
      const { error } = await supabase.from('agente_carga_pos').insert(lote);
      if (error) throw new Error(`No se pudo guardar el periodo ${etiquetaPeriodoCarga(periodo)}: ${error.message}`);
      procesadas += lote.length;
      onProgreso?.(Math.min(90, Math.round((procesadas / pos.length) * 90)));
    }

    // Se actualiza solo la cantidad real del periodo; el detalle anterior se conserva.
    const totalPeriodo = await contarPosPeriodo(periodo);

    const { error: errorMeta } = await supabase
      .from('agente_carga_cargas')
      .upsert(
        {
          periodo,
          carga_id: cargaId,
          archivo_origen: archivo || null,
          cargado_por: usuario || null,
          cargado_at: cargadoAt,
          total_pos: totalPeriodo,
        },
        { onConflict: 'periodo' }
      );
    if (errorMeta) {
      console.warn('No se pudo registrar el periodo de la carga:', errorMeta.message);
    }
  }

  await refrescarTotalesPeriodos();

  onProgreso?.(100);
  return { periodos: claves, total: pos.length };
}

/** Claves de periodo reales dentro de un rango (ascendente, sin "sin fecha"). */
export function clavesEnRango(
  periodos: PeriodoCarga[],
  desde: string,
  hasta: string
): string[] {
  if (!desde || !hasta) return [];
  const [ini, fin] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  return periodos
    .map((p) => p.periodo)
    .filter((p) => p !== PERIODO_SIN_FECHA && p >= ini && p <= fin)
    .sort();
}

/** Etiqueta legible del rango: "Octubre 2026 – Noviembre 2026". */
export function etiquetaRangoCarga(claves: string[]): string {
  if (claves.length === 0) return 'Sin periodo';
  const primero = claves[0];
  const ultimo = claves[claves.length - 1];
  if (primero === ultimo) return etiquetaPeriodoCarga(primero);
  return `${etiquetaPeriodoCarga(primero)} – ${etiquetaPeriodoCarga(ultimo)}`;
}

/**
 * Detalle unificado de varios periodos. Una misma PO se cuenta una sola
 * vez, quedándose con el mes de asignación más reciente.
 */
export async function cargarDetalleRango(claves: string[]): Promise<DetallePeriodo> {
  if (claves.length === 0) return { pos: [], meta: null };

  const mapa = new Map<string, { po: PoCarga; periodo: string }>();
  let meta: MetaCarga | null = null;

  const ordenadas = [...claves].sort();
  for (const clave of ordenadas) {
    const detalle = await cargarCargaPorPeriodo(clave);
    if (!meta && detalle.meta) meta = detalle.meta;
    detalle.pos.forEach((p) => {
      const previo = mapa.get(p.po);
      if (!previo || previo.periodo <= clave) {
        mapa.set(p.po, { po: p, periodo: clave });
      }
    });
  }

  return { pos: Array.from(mapa.values()).map((v) => v.po), meta };
}

/** Agrupa POs en filas Proveedor de Servicio × País (sin las POs sin proveedor). */
export function agregarPorProveedorPais(pos: PoCarga[]): FilaComparativo[] {
  const mapa = new Map<string, FilaComparativo>();
  pos.forEach((p) => {
    if (p.proveedorServicio === SIN_PROVEEDOR) return;
    if (!mapa.has(p.proveedorServicio)) {
      mapa.set(p.proveedorServicio, { proveedorServicio: p.proveedorServicio, porPais: {}, total: 0 });
    }
    const fila = mapa.get(p.proveedorServicio)!;
    const pais = p.paisDestino || 'OTROS';
    fila.porPais[pais] = (fila.porPais[pais] || 0) + 1;
    fila.total += 1;
  });
  return Array.from(mapa.values());
}

/** Periodo inmediatamente anterior con detalle guardado. */
export function periodoAnteriorDe(periodo: string, periodos: PeriodoCarga[]): PeriodoCarga | null {
  const reales = periodos
    .filter((p) => p.periodo !== PERIODO_SIN_FECHA && p.periodo < periodo)
    .sort((a, b) => b.periodo.localeCompare(a.periodo));
  return reales[0] || null;
}

/** Detalle agregado del periodo anterior, para la comparación. */
export async function cargarPeriodoAnterior(
  periodo: string,
  periodos: PeriodoCarga[]
): Promise<{ filas: FilaComparativo[]; meta: MetaComparativo | null }> {
  const anterior = periodoAnteriorDe(periodo, periodos);
  if (!anterior) return { filas: [], meta: null };

  const { pos, meta } = await cargarCargaPorPeriodo(anterior.periodo);
  const filas = agregarPorProveedorPais(pos);
  if (filas.length === 0) return { filas: [], meta: null };

  return {
    filas,
    meta: {
      archivo: meta?.archivo || `Carga de ${etiquetaPeriodoCarga(anterior.periodo)}`,
      cargadoPor: meta?.cargadoPor || anterior.cargadoPor,
      cargadoAt: meta?.cargadoAt || anterior.cargadoAt,
    },
  };
}