import { supabase } from './supabase';
import { CAMPOS_FECHA, hoyIso, type PoControl } from './controlFechas';

// ============================================================
// Persistencia del Control de Fechas NEXT
// Una sola carga vigente: cada archivo reemplaza al anterior.
// ============================================================

const TAMANO_PAGINA = 1000;

export interface MetaControl {
  cargaId: string;
  archivo: string;
  cargadoPor: string;
  cargadoAt: string;
  fechaCorte: string;
  etapasExcluidas: string[];
  proveedoresExcluidos: string[];
  excluirReales: boolean;
  totalPos: number;
}

function aLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.filter((v): v is string => typeof v === 'string');
  if (typeof valor === 'string') {
    try {
      const parseado = JSON.parse(valor);
      if (Array.isArray(parseado)) return parseado.filter((v): v is string => typeof v === 'string');
    } catch {
      return [];
    }
  }
  return [];
}

interface FilaControlSupabase {
  po: string;
  etapa: string | null;
  proveedor: string | null;
  naviera: string | null;
  contenedor: string | null;
  booking: string | null;
  etd_inicial: string | null;
  etd_variable: string | null;
  atd: string | null;
  eta_inicial: string | null;
  eta_variable: string | null;
  ata: string | null;
}

/** Trae la última carga guardada del control de fechas. */
export async function cargarControlFechas(): Promise<{ filas: PoControl[]; meta: MetaControl | null }> {
  const { data, error } = await supabase
    .from('control_fechas_cargas')
    .select('carga_id, archivo_origen, cargado_por, cargado_at, fecha_corte, etapas_excluidas, proveedores_excluidos, excluir_reales, total_pos')
    .order('cargado_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { filas: [], meta: null };

  const metaFila = data as unknown as {
    carga_id: string;
    archivo_origen: string | null;
    cargado_por: string | null;
    cargado_at: string;
    fecha_corte: string | null;
    etapas_excluidas: unknown;
    proveedores_excluidos: unknown;
    excluir_reales: boolean | null;
    total_pos: number | null;
  };

  const filas: FilaControlSupabase[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data: lote, error: errorFilas } = await supabase
      .from('control_fechas_pos')
      .select('po, etapa, proveedor, naviera, contenedor, booking, etd_inicial, etd_variable, atd, eta_inicial, eta_variable, ata')
      .eq('carga_id', metaFila.carga_id)
      .order('id', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (errorFilas) throw errorFilas;
    const registros = (lote || []) as unknown as FilaControlSupabase[];
    filas.push(...registros);
    if (registros.length < TAMANO_PAGINA) break;
  }

  const pos: PoControl[] = filas.map((f) => ({
    po: f.po,
    etapa: f.etapa || '',
    proveedor: f.proveedor || '',
    naviera: f.naviera || '',
    contenedor: f.contenedor || '',
    booking: f.booking || '',
    fechas: {
      'ETD Inicial': f.etd_inicial,
      'ETD Variable': f.etd_variable,
      ATD: f.atd,
      'ETA Inicial': f.eta_inicial,
      'ETA Variable': f.eta_variable,
      ATA: f.ata,
    },
  }));

  return {
    filas: pos,
    meta: {
      cargaId: metaFila.carga_id,
      archivo: metaFila.archivo_origen || 'archivo.xlsx',
      cargadoPor: metaFila.cargado_por || '',
      cargadoAt: metaFila.cargado_at,
      fechaCorte: metaFila.fecha_corte || hoyIso(),
      etapasExcluidas: aLista(metaFila.etapas_excluidas),
      proveedoresExcluidos: aLista(metaFila.proveedores_excluidos),
      excluirReales: metaFila.excluir_reales !== false,
      totalPos: Number(metaFila.total_pos) || pos.length,
    },
  };
}

/** Reemplaza por completo la carga guardada. */
export async function guardarControlFechas(
  filas: PoControl[],
  archivo: string,
  usuario: string,
  opciones: {
    fechaCorte: string;
    etapasExcluidas: string[];
    proveedoresExcluidos: string[];
    excluirReales: boolean;
  },
  onProgreso?: (avance: number) => void
): Promise<MetaControl> {
  const cargaId = crypto.randomUUID();
  const cargadoAt = new Date().toISOString();

  const registros = filas.map((fila) => ({
    carga_id: cargaId,
    po: fila.po,
    etapa: fila.etapa || null,
    proveedor: fila.proveedor || null,
    naviera: fila.naviera || null,
    contenedor: fila.contenedor || null,
    booking: fila.booking || null,
    etd_inicial: fila.fechas['ETD Inicial'],
    etd_variable: fila.fechas['ETD Variable'],
    atd: fila.fechas.ATD,
    eta_inicial: fila.fechas['ETA Inicial'],
    eta_variable: fila.fechas['ETA Variable'],
    ata: fila.fechas.ATA,
    archivo_origen: archivo,
    cargado_por: usuario,
    fecha_corte: opciones.fechaCorte,
    cargado_at: cargadoAt,
  }));

  const tamano = 400;
  for (let i = 0; i < registros.length; i += tamano) {
    const lote = registros.slice(i, i + tamano);
    const { error } = await supabase.from('control_fechas_pos').insert(lote);
    if (error) throw new Error(`No se pudo guardar la data: ${error.message}`);
    onProgreso?.(Math.min(85, Math.round(((i + lote.length) / registros.length) * 85)));
  }

  const { error: errorLimpieza } = await supabase
    .from('control_fechas_pos')
    .delete()
    .neq('carga_id', cargaId);
  if (errorLimpieza) {
    console.warn('No se pudo limpiar la carga anterior del control de fechas:', errorLimpieza.message);
  }

  await supabase
    .from('control_fechas_cargas')
    .delete()
    .gte('created_at', new Date(0).toISOString());

  const { error: errorMeta } = await supabase.from('control_fechas_cargas').insert({
    carga_id: cargaId,
    archivo_origen: archivo,
    cargado_por: usuario,
    fecha_corte: opciones.fechaCorte,
    etapas_excluidas: opciones.etapasExcluidas,
    proveedores_excluidos: opciones.proveedoresExcluidos,
    excluir_reales: opciones.excluirReales,
    total_pos: filas.length,
    cargado_at: cargadoAt,
  });
  if (errorMeta) {
    console.warn('No se pudo registrar la carga del control de fechas:', errorMeta.message);
  }

  onProgreso?.(100);

  return {
    cargaId,
    archivo,
    cargadoPor: usuario,
    cargadoAt,
    fechaCorte: opciones.fechaCorte,
    etapasExcluidas: opciones.etapasExcluidas,
    proveedoresExcluidos: opciones.proveedoresExcluidos,
    excluirReales: opciones.excluirReales,
    totalPos: filas.length,
  };
}

/** Guarda los parámetros del análisis sin volver a subir el archivo. */
export async function actualizarParametrosControl(
  cargaId: string,
  opciones: {
    fechaCorte: string;
    etapasExcluidas: string[];
    proveedoresExcluidos: string[];
    excluirReales: boolean;
  }
): Promise<void> {
  const { error } = await supabase
    .from('control_fechas_cargas')
    .update({
      fecha_corte: opciones.fechaCorte,
      etapas_excluidas: opciones.etapasExcluidas,
      proveedores_excluidos: opciones.proveedoresExcluidos,
      excluir_reales: opciones.excluirReales,
    })
    .eq('carga_id', cargaId);

  if (error) throw error;
}

export { CAMPOS_FECHA };