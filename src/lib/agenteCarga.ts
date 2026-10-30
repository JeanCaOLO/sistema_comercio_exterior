import * as XLSX from 'xlsx';
import { supabase } from './supabase';

// ============================================================
// ANÁLISIS DE AGENTE DE CARGA
// Lee el Excel de "POs Activas" y lo convierte en la matriz
// de asignación de carga: N° de PO por Proveedor de Servicio
// y País Destino. La data se guarda en la tabla
// agente_carga_pos y se REEMPLAZA completa en cada carga.
// ============================================================

export const PAISES_ORDEN = ['VE', 'GT', 'SV', 'CR', 'ZF', 'OTROS'] as const;
export type PaisCodigo = (typeof PAISES_ORDEN)[number];

export const PAISES_INFO: Record<string, { abbr: string; nombre: string }> = {
  VE: { abbr: 'VE', nombre: 'Venezuela' },
  GT: { abbr: 'GT', nombre: 'Guatemala' },
  SV: { abbr: 'SV', nombre: 'El Salvador' },
  CR: { abbr: 'CR', nombre: 'Costa Rica' },
  ZF: { abbr: 'ZF', nombre: 'Zona Franca (Overseas Logistics Operations)' },
  OTROS: { abbr: 'OTROS', nombre: 'Otros destinos' },
};

export const SIN_PROVEEDOR = 'SIN PROVEEDOR DE SERVICIO';

export interface PoCarga {
  po: string;
  etapa: string;
  proveedor: string;
  proveedorServicio: string;
  agenteCarga: string;
  rutaLogistica: string;
  puertoArribo: string;
  paisDestino: string;
  montoTotal: number | null;
  etdInicial: string | null;
  etaInicial: string | null;
  /** Fecha de asignación del agente de carga (columna del Excel). */
  fechaAsignacion: string | null;
}

export interface MetaCarga {
  archivo: string;
  cargadoPor: string;
  cargadoAt: string;
}

export interface FilaAsignacion {
  proveedorServicio: string;
  porPais: Record<string, number>;
  total: number;
  montoTotal: number;
}

export interface AnalisisAsignacion {
  columnas: string[];
  filas: FilaAsignacion[];
  totalPorPais: Record<string, number>;
  pctPorPais: Record<string, number>;
  total: number;
  proveedores: number;
  paisesActivos: number;
  posZf: number;
  montoTotal: number;
  topProveedor: string;
  topProveedorTotal: number;
  agenteMasUsado: string;
  agenteMasUsadoTotal: number;
}

export interface ResultadoParseo {
  pos: PoCarga[];
  filasLeidas: number;
  duplicadas: number;
  advertencias: string[];
}

// ------------------- comparación con la carga anterior -------------------

export interface FilaComparativo {
  proveedorServicio: string;
  porPais: Record<string, number>;
  total: number;
}

export interface MetaComparativo {
  archivo: string;
  cargadoPor: string;
  cargadoAt: string;
}

export interface MovimientoProveedor {
  proveedorServicio: string;
  actualPorPais: Record<string, number>;
  anteriorPorPais: Record<string, number>;
  deltaPorPais: Record<string, number>;
  actualTotal: number;
  anteriorTotal: number;
  deltaTotal: number;
  esNuevo: boolean;
  esRemovido: boolean;
  cambioAbsoluto: number;
}

export interface AnalisisComparativo {
  columnas: string[];
  filas: MovimientoProveedor[];
  metaAnterior: MetaComparativo | null;
  tieneAnterior: boolean;
  totalActual: number;
  totalAnterior: number;
  deltaTotal: number;
  proveedoresConCambio: number;
  proveedoresNuevos: number;
  proveedoresRemovidos: number;
  paisesConCambio: number;
}

// ------------------------- utilidades -------------------------

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function clave(valor: unknown): string {
  return normalizar(valor).replace(/[^a-z0-9]+/g, ' ').trim();
}

function aTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor).trim();
  if (texto === '-- N/A --') return '';
  return texto;
}

function aNumero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  const texto = aTexto(valor).replace(/[^\d,.-]/g, '');
  if (!texto) return null;
  const limpio = texto.includes(',') && texto.lastIndexOf(',') > texto.lastIndexOf('.')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto.replace(/,/g, '');
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

function aFechaIso(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }
  if (typeof valor === 'number' && valor > 0) {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (fecha && fecha.y) {
      const mm = String(fecha.m).padStart(2, '0');
      const dd = String(fecha.d).padStart(2, '0');
      return `${fecha.y}-${mm}-${dd}`;
    }
    return null;
  }
  const texto = aTexto(valor);
  if (!texto) return null;
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const anio = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${anio}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parseada = new Date(texto);
  if (!Number.isNaN(parseada.getTime())) return parseada.toISOString().slice(0, 10);
  return null;
}

/**
 * Deduce el país destino combinando la Ruta Logística con el Puerto de Arribo.
 * ZF tiene prioridad porque la ruta de Zona Franca también trae país de destino.
 */
function paisEnTexto(texto: string): PaisCodigo | null {
  if (texto.includes('venezuela') || /\bve\b/.test(texto)) return 'VE';
  if (texto.includes('guatemala') || /\bgt\b/.test(texto)) return 'GT';
  if (texto.includes('salvador') || /\bsv\b/.test(texto)) return 'SV';
  if (texto.includes('costa rica') || /\bcr\b/.test(texto)) return 'CR';
  return null;
}

/**
 * Deduce el país destino combinando la Ruta Logística con el Puerto de Arribo.
 * ZF tiene prioridad y la ruta manda sobre el puerto cuando hay diferencias.
 */
export function inferirPaisDestino(ruta: string, puerto: string): PaisCodigo {
  const r = clave(ruta);
  const p = clave(puerto);

  if (r.startsWith('zf') || r.includes('zona franca') || r.includes('oversees') || p.includes('zona franca')) {
    return 'ZF';
  }

  return paisEnTexto(r) || paisEnTexto(p) || 'OTROS';
}

export const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function formatearEntero(valor: number): string {
  return new Intl.NumberFormat('es-CR').format(valor);
}

export function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(valor);
}

export function formatearPct(valor: number): string {
  return `${valor.toFixed(1).replace('.', ',')}%`;
}

/** "Asignación de carga – Octubre 2026" a partir de la fecha de carga. */
export function etiquetaPeriodo(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return 'Asignación de carga';
  return `${NOMBRES_MES[d.getMonth()]} ${d.getFullYear()}`;
}

// ------------------------- lectura del Excel -------------------------

const COLUMNAS_BUSCADAS: Record<string, string[]> = {
  po: ['n orden de compra po', 'orden de compra po', 'n po', 'po', 'numero de orden de compra'],
  etapa: ['etapa'],
  proveedor: ['proveedor'],
  proveedorServicio: ['proveedor de servicio'],
  agenteCarga: ['agente de carga'],
  rutaLogistica: ['ruta logistica'],
  puertoArribo: ['puerto de arribo'],
  montoTotal: ['monto total'],
  etdInicial: ['etd inicial'],
  etaInicial: ['eta inicial'],
  fechaAsignacion: [
    'fecha asignacion agente de carga',
    'fecha de asignacion agente de carga',
    'fecha asignacion carga',
    'fecha asignacion agente',
    'fecha asignacion',
  ],
};

function indiceColumna(encabezados: string[], candidatos: string[]): number {
  const claves = encabezados.map(clave);
  for (const candidato of candidatos) {
    const exacto = claves.indexOf(candidato);
    if (exacto >= 0) return exacto;
  }
  for (const candidato of candidatos) {
    const parcial = claves.findIndex((k) => k.startsWith(candidato) || k.includes(candidato));
    if (parcial >= 0) return parcial;
  }
  return -1;
}

interface HojaConEncabezado {
  nombre: string;
  encabezados: string[];
  filas: unknown[][];
}

function buscarEncabezado(filas: unknown[][]): { indice: number; encabezados: string[] } | null {
  const limite = Math.min(filas.length, 15);
  for (let i = 0; i < limite; i += 1) {
    const fila = filas[i] || [];
    const claves = fila.map(clave);
    const tieneProveedor = claves.some((c) => c.includes('proveedor de servicio'));
    const tienePo = claves.some((c) => c.includes('orden de compra'));
    if (tieneProveedor && tienePo) {
      return { indice: i, encabezados: fila.map((c) => String(c ?? '')) };
    }
  }
  return null;
}

/** Lee el archivo y devuelve las POs listas para analizar (sin tocar la base). */
export async function parsearArchivoExcel(archivo: File): Promise<ResultadoParseo> {
  const buffer = await archivo.arrayBuffer();
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true });

  const advertencias: string[] = [];
  let hojaElegida: HojaConEncabezado | null = null;

  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    if (!hoja) continue;
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: '' });
    const encabezado = buscarEncabezado(filas);
    if (encabezado) {
      hojaElegida = {
        nombre,
        encabezados: encabezado.encabezados,
        filas: filas.slice(encabezado.indice + 1),
      };
      break;
    }
  }

  if (!hojaElegida) {
    throw new Error('No encontré la estructura esperada. El archivo debe tener las columnas "N° Orden de Compra (PO)" y "Proveedor de Servicio".');
  }

  const { encabezados, filas } = hojaElegida;
  const indices: Record<string, number> = {};
  Object.entries(COLUMNAS_BUSCADAS).forEach(([campo, candidatos]) => {
    indices[campo] = indiceColumna(encabezados, candidatos);
  });

  const valor = (fila: unknown[], campo: string): unknown => {
    const indice = indices[campo];
    if (indice === undefined || indice < 0) return '';
    return fila[indice];
  };

  if (indices.po < 0) advertencias.push('No se detectó la columna de N° de PO.');
  if (indices.proveedorServicio < 0) advertencias.push('No se detectó la columna "Proveedor de Servicio".');
  if (indices.rutaLogistica < 0 && indices.puertoArribo < 0) {
    advertencias.push('No se detectaron columnas de destino; todas las POs quedaron en "OTROS".');
  }
  if (indices.fechaAsignacion < 0) {
    advertencias.push(
      'No se detectó la columna "Fecha Asignación Agente de Carga", así que el filtro por periodo de asignación va a quedar sin fechas.'
    );
  }
  if (hojaElegida.nombre !== 'POs Activas') {
    advertencias.push(`La hoja usada fue "${hojaElegida.nombre}".`);
  }

  const vistos = new Set<string>();
  const pos: PoCarga[] = [];
  let duplicadas = 0;
  let filasLeidas = 0;

  filas.forEach((fila) => {
    if (!Array.isArray(fila)) return;
    const poTexto = aTexto(valor(fila, 'po'));
    if (!poTexto || clave(poTexto) === 'total' || clave(poTexto).startsWith('total')) return;
    filasLeidas += 1;

    const proveedorServicio = aTexto(valor(fila, 'proveedorServicio')).toUpperCase() || SIN_PROVEEDOR;
    const ruta = aTexto(valor(fila, 'rutaLogistica'));
    const puerto = aTexto(valor(fila, 'puertoArribo'));

    // Una misma PO puede repetirse en varias filas: se cuenta una sola vez.
    if (vistos.has(poTexto)) {
      duplicadas += 1;
      return;
    }
    vistos.add(poTexto);

    pos.push({
      po: poTexto,
      etapa: aTexto(valor(fila, 'etapa')),
      proveedor: aTexto(valor(fila, 'proveedor')),
      proveedorServicio,
      agenteCarga: aTexto(valor(fila, 'agenteCarga')),
      rutaLogistica: ruta,
      puertoArribo: puerto,
      paisDestino: inferirPaisDestino(ruta, puerto),
      montoTotal: aNumero(valor(fila, 'montoTotal')),
      etdInicial: aFechaIso(valor(fila, 'etdInicial')),
      etaInicial: aFechaIso(valor(fila, 'etaInicial')),
      fechaAsignacion: aFechaIso(valor(fila, 'fechaAsignacion')),
    });
  });

  if (pos.length === 0) {
    throw new Error('El archivo se leyó pero no contiene POs válidas para analizar.');
  }

  return { pos, filasLeidas, duplicadas, advertencias };
}

// ------------------------- análisis -------------------------

export interface RangoAsignacion {
  desde: string;
  hasta: string;
}

export interface ResultadoFiltroAsignacion {
  pos: PoCarga[];
  sinFecha: number;
  fueraRango: number;
  activo: boolean;
}

/**
 * Filtra las POs por la Fecha Asignación Agente de Carga.
 * Las POs sin esa fecha solo se conservan cuando no hay filtro activo.
 */
export function filtrarPorAsignacion(pos: PoCarga[], rango: RangoAsignacion): ResultadoFiltroAsignacion {
  const desde = rango.desde || '';
  const hasta = rango.hasta || '';
  const activo = Boolean(desde || hasta);

  if (!activo) return { pos, sinFecha: 0, fueraRango: 0, activo: false };

  const dentro: PoCarga[] = [];
  let sinFecha = 0;
  let fueraRango = 0;

  pos.forEach((p) => {
    if (!p.fechaAsignacion) {
      sinFecha += 1;
      return;
    }
    const dia = p.fechaAsignacion.slice(0, 10);
    if (desde && dia < desde) {
      fueraRango += 1;
      return;
    }
    if (hasta && dia > hasta) {
      fueraRango += 1;
      return;
    }
    dentro.push(p);
  });

  return { pos: dentro, sinFecha, fueraRango, activo: true };
}

export function analizarCarga(pos: PoCarga[], incluirSinAsignar = false): AnalisisAsignacion {
  const base = incluirSinAsignar ? pos : pos.filter((p) => p.proveedorServicio !== SIN_PROVEEDOR);
  const mapa = new Map<string, FilaAsignacion>();
  const totalPorPais: Record<string, number> = {};
  let montoTotal = 0;

  base.forEach((p) => {
    const pais = p.paisDestino || 'OTROS';
    if (!mapa.has(p.proveedorServicio)) {
      mapa.set(p.proveedorServicio, { proveedorServicio: p.proveedorServicio, porPais: {}, total: 0, montoTotal: 0 });
    }
    const fila = mapa.get(p.proveedorServicio)!;
    fila.porPais[pais] = (fila.porPais[pais] || 0) + 1;
    fila.total += 1;
    if (p.montoTotal) {
      fila.montoTotal += p.montoTotal;
      montoTotal += p.montoTotal;
    }
    totalPorPais[pais] = (totalPorPais[pais] || 0) + 1;
  });

  const filas = Array.from(mapa.values()).sort((a, b) => b.total - a.total || a.proveedorServicio.localeCompare(b.proveedorServicio));
  const total = base.length;
  const columnas = PAISES_ORDEN.filter((pais) => (totalPorPais[pais] || 0) > 0);

  const pctPorPais: Record<string, number> = {};
  columnas.forEach((pais) => {
    pctPorPais[pais] = total > 0 ? ((totalPorPais[pais] || 0) / total) * 100 : 0;
  });

  const agentes = new Map<string, number>();
  base.forEach((p) => {
    const agente = p.agenteCarga || 'Sin agente asignado';
    agentes.set(agente, (agentes.get(agente) || 0) + 1);
  });
  const agenteTop = Array.from(agentes.entries()).sort((a, b) => b[1] - a[1])[0] || ['—', 0];

  return {
    columnas,
    filas,
    totalPorPais,
    pctPorPais,
    total,
    proveedores: filas.length,
    paisesActivos: columnas.filter((c) => c !== 'OTROS').length,
    posZf: totalPorPais.ZF || 0,
    montoTotal,
    topProveedor: filas[0]?.proveedorServicio || '—',
    topProveedorTotal: filas[0]?.total || 0,
    agenteMasUsado: agenteTop[0],
    agenteMasUsadoTotal: agentes.size <= 1 && agenteTop[0] === 'Sin agente asignado' ? 0 : agenteTop[1],
  };
}

// ------------------------- persistencia -------------------------

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
  archivo_origen: string;
  cargado_por: string;
  cargado_at: string;
}

export interface PeriodoCarga {
  periodo: string;
  archivo: string;
  cargadoPor: string;
  cargadoAt: string;
  totalPos: number;
}

/** Devuelve el periodo en formato YYYY-MM a partir de una fecha. */
export function periodoDesdeFecha(fecha: string | Date = new Date()): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-10" → "Octubre 2026" */
export function etiquetaPeriodoClave(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return periodo || 'Sin periodo';
  return `${NOMBRES_MES[mes - 1]} ${anio}`;
}

const TAMANO_PAGINA = 1000;

/** Lista los meses con carga guardada (más reciente primero). */
export async function listarPeriodos(): Promise<PeriodoCarga[]> {
  const { data, error } = await supabase
    .from('agente_carga_cargas')
    .select('periodo, archivo_origen, cargado_por, cargado_at, total_pos')
    .order('periodo', { ascending: false });

  if (error) throw error;

  const filas = (data || []) as unknown as {
    periodo: string;
    archivo_origen: string | null;
    cargado_por: string | null;
    cargado_at: string;
    total_pos: number | null;
  }[];

  return filas.map((f) => ({
    periodo: f.periodo,
    archivo: f.archivo_origen || 'archivo.xlsx',
    cargadoPor: f.cargado_por || '',
    cargadoAt: f.cargado_at,
    totalPos: Number(f.total_pos) || 0,
  }));
}

/**
 * Guarda el agregado (proveedor × país) de un periodo concreto.
 * Permite comparar meses sin tener que leer todas las POs.
 */
async function guardarComparativoPeriodo(
  pos: PoCarga[],
  periodo: string,
  archivo: string,
  usuario: string,
  cargadoAt: string
): Promise<void> {
  try {
    const agregado = new Map<string, Map<string, number>>();
    pos.forEach((p) => {
      if (p.proveedorServicio === SIN_PROVEEDOR) return;
      if (!agregado.has(p.proveedorServicio)) agregado.set(p.proveedorServicio, new Map());
      const porPais = agregado.get(p.proveedorServicio)!;
      porPais.set(p.paisDestino, (porPais.get(p.paisDestino) || 0) + 1);
    });

    const registros: Record<string, unknown>[] = [];
    agregado.forEach((porPais, proveedorServicio) => {
      porPais.forEach((cantidad, pais) => {
        registros.push({
          periodo,
          proveedor_servicio: proveedorServicio,
          pais_destino: pais,
          cantidad,
          archivo_origen: archivo || null,
          cargado_por: usuario || null,
          carga_original_at: cargadoAt,
        });
      });
    });

    const { error: errorLimpieza } = await supabase
      .from('agente_carga_comparativo')
      .delete()
      .eq('periodo', periodo);
    if (errorLimpieza) {
      console.warn('No se pudo limpiar el comparativo del periodo:', errorLimpieza.message);
      return;
    }

    const tamano = 500;
    for (let i = 0; i < registros.length; i += tamano) {
      const { error: errorInsert } = await supabase
        .from('agente_carga_comparativo')
        .insert(registros.slice(i, i + tamano));
      if (errorInsert) {
        console.warn('No se pudo guardar el comparativo del periodo:', errorInsert.message);
        return;
      }
    }
  } catch (err) {
    console.warn('Error guardando el comparativo del periodo:', err);
  }
}

/** Trae el comparativo del mes inmediatamente anterior al periodo indicado. */
export async function cargarComparativoDePeriodo(
  periodo: string | null
): Promise<{ filas: FilaComparativo[]; meta: MetaComparativo | null }> {
  let consulta = supabase
    .from('agente_carga_cargas')
    .select('periodo, archivo_origen, cargado_por, cargado_at');

  if (periodo) consulta = consulta.lt('periodo', periodo);

  const { data: anterior, error } = await consulta
    .order('periodo', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!anterior) return { filas: [], meta: null };

  const anteriorPeriodo = (anterior as unknown as { periodo: string }).periodo;
  const registros: {
    proveedor_servicio: string;
    pais_destino: string;
    cantidad: number;
  }[] = [];

  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error: errorFilas } = await supabase
      .from('agente_carga_comparativo')
      .select('proveedor_servicio, pais_destino, cantidad')
      .eq('periodo', anteriorPeriodo)
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (errorFilas) throw errorFilas;
    const lote = (data || []) as unknown as typeof registros;
    registros.push(...lote);
    if (lote.length < TAMANO_PAGINA) break;
  }

  if (registros.length === 0) return { filas: [], meta: null };

  const mapa = new Map<string, FilaComparativo>();
  registros.forEach((r) => {
    if (!mapa.has(r.proveedor_servicio)) {
      mapa.set(r.proveedor_servicio, { proveedorServicio: r.proveedor_servicio, porPais: {}, total: 0 });
    }
    const fila = mapa.get(r.proveedor_servicio)!;
    const cantidad = Number(r.cantidad) || 0;
    fila.porPais[r.pais_destino] = (fila.porPais[r.pais_destino] || 0) + cantidad;
    fila.total += cantidad;
  });

  const metaAnterior = anterior as unknown as {
    periodo: string;
    archivo_origen: string | null;
    cargado_por: string | null;
    cargado_at: string;
  };

  return {
    filas: Array.from(mapa.values()),
    meta: {
      archivo: metaAnterior.archivo_origen || `Carga de ${etiquetaPeriodoClave(anteriorPeriodo)}`,
      cargadoPor: metaAnterior.cargado_por || '',
      cargadoAt: metaAnterior.cargado_at,
    },
  };
}

/** Compara la carga actual contra el snapshot de la carga anterior. */
export function compararCargas(
  actual: PoCarga[],
  anterior: FilaComparativo[],
  metaAnterior: MetaComparativo | null
): AnalisisComparativo {
  const mapaActual = new Map<string, Record<string, number>>();
  actual.forEach((p) => {
    if (p.proveedorServicio === SIN_PROVEEDOR) return;
    if (!mapaActual.has(p.proveedorServicio)) mapaActual.set(p.proveedorServicio, {});
    const porPais = mapaActual.get(p.proveedorServicio)!;
    const pais = p.paisDestino || 'OTROS';
    porPais[pais] = (porPais[pais] || 0) + 1;
  });

  const mapaAnterior = new Map<string, Record<string, number>>();
  anterior.forEach((f) => {
    mapaAnterior.set(f.proveedorServicio, { ...f.porPais });
  });

  const proveedores = new Set<string>([...mapaActual.keys(), ...mapaAnterior.keys()]);
  const paises = new Set<string>();
  const filas: MovimientoProveedor[] = [];

  let totalActual = 0;
  let totalAnterior = 0;
  let proveedoresNuevos = 0;
  let proveedoresRemovidos = 0;
  let proveedoresConCambio = 0;

  proveedores.forEach((proveedorServicio) => {
    const actualPorPais = mapaActual.get(proveedorServicio) || {};
    const anteriorPorPais = mapaAnterior.get(proveedorServicio) || {};
    const deltaPorPais: Record<string, number> = {};

    const paisesFila = new Set<string>([...Object.keys(actualPorPais), ...Object.keys(anteriorPorPais)]);
    let actualTotal = 0;
    let anteriorTotal = 0;
    let cambioAbsoluto = 0;

    paisesFila.forEach((pais) => {
      const a = actualPorPais[pais] || 0;
      const b = anteriorPorPais[pais] || 0;
      const delta = a - b;
      deltaPorPais[pais] = delta;
      actualTotal += a;
      anteriorTotal += b;
      cambioAbsoluto += Math.abs(delta);
      if (a > 0 || b > 0) paises.add(pais);
    });

    const esNuevo = anteriorTotal === 0 && actualTotal > 0;
    const esRemovido = actualTotal === 0 && anteriorTotal > 0;

    if (esNuevo) proveedoresNuevos += 1;
    if (esRemovido) proveedoresRemovidos += 1;
    if (cambioAbsoluto > 0) proveedoresConCambio += 1;

    totalActual += actualTotal;
    totalAnterior += anteriorTotal;

    filas.push({
      proveedorServicio,
      actualPorPais,
      anteriorPorPais,
      deltaPorPais,
      actualTotal,
      anteriorTotal,
      deltaTotal: actualTotal - anteriorTotal,
      esNuevo,
      esRemovido,
      cambioAbsoluto,
    });
  });

  const columnas = PAISES_ORDEN.filter((pais) => paises.has(pais));
  const paisesConCambio = columnas.filter((pais) =>
    filas.some((f) => (f.deltaPorPais[pais] || 0) !== 0)
  ).length;

  filas.sort((a, b) => {
    const aCambio = a.cambioAbsoluto > 0 ? 1 : 0;
    const bCambio = b.cambioAbsoluto > 0 ? 1 : 0;
    if (aCambio !== bCambio) return bCambio - aCambio;
    if (a.cambioAbsoluto !== b.cambioAbsoluto) return b.cambioAbsoluto - a.cambioAbsoluto;
    return b.actualTotal - a.actualTotal || a.proveedorServicio.localeCompare(b.proveedorServicio);
  });

  return {
    columnas,
    filas,
    metaAnterior,
    tieneAnterior: anterior.length > 0,
    totalActual,
    totalAnterior,
    deltaTotal: totalActual - totalAnterior,
    proveedoresConCambio,
    proveedoresNuevos,
    proveedoresRemovidos,
    paisesConCambio,
  };
}

/** Trae las POs guardadas de un periodo concreto. */
export async function cargarCargaPorPeriodo(
  periodo: string
): Promise<{ pos: PoCarga[]; meta: MetaCarga | null }> {
  const { data: metaData, error: errorMeta } = await supabase
    .from('agente_carga_cargas')
    .select('carga_id, archivo_origen, cargado_por, cargado_at')
    .eq('periodo', periodo)
    .maybeSingle();

  if (errorMeta) throw errorMeta;

  let cargaId = (metaData as unknown as { carga_id: string | null } | null)?.carga_id || null;

  if (!cargaId) {
    const { data: ultima, error } = await supabase
      .from('agente_carga_pos')
      .select('carga_id')
      .eq('periodo', periodo)
      .order('cargado_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    cargaId = (ultima as unknown as { carga_id: string | null } | null)?.carga_id || null;
  }

  if (!cargaId) return { pos: [], meta: null };

  const filas: FilaSupabase[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error: errorFilas } = await supabase
      .from('agente_carga_pos')
      .select('po, etapa, proveedor, proveedor_servicio, agente_carga, ruta_logistica, puerto_arribo, pais_destino, monto_total, etd_inicial, eta_inicial, fecha_asignacion, archivo_origen, cargado_por, cargado_at, periodo')
      .eq('carga_id', cargaId)
      .order('proveedor_servicio', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (errorFilas) throw errorFilas;
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
  const meta: MetaCarga | null = primero
    ? {
        archivo: primero.archivo_origen || (metaData?.archivo_origen ?? 'archivo.xlsx'),
        cargadoPor: primero.cargado_por || (metaData?.cargado_por ?? ''),
        cargadoAt: primero.cargado_at || (metaData?.cargado_at ?? ''),
      }
    : null;

  return { pos, meta };
}

/**
 * Guarda la carga de un periodo concreto.
 * Solo reemplaza la data de ese mes; los demás meses se conservan.
 */
export async function guardarCargaPeriodo(
  pos: PoCarga[],
  archivo: string,
  usuario: string,
  periodo: string,
  onProgreso?: (avance: number) => void
): Promise<MetaCarga> {
  const cargaId = crypto.randomUUID();
  const cargadoAt = new Date().toISOString();

  const filas: (FilaSupabase & { carga_id: string })[] = pos.map((p) => ({
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
    archivo_origen: archivo,
    cargado_por: usuario,
    cargado_at: cargadoAt,
    periodo,
  }));

  const tamano = 300;
  for (let i = 0; i < filas.length; i += tamano) {
    const lote = filas.slice(i, i + tamano);
    const { error } = await supabase.from('agente_carga_pos').insert(lote);
    if (error) throw new Error(`No se pudo guardar la carga: ${error.message}`);
    onProgreso?.(Math.min(85, Math.round(((i + lote.length) / filas.length) * 85)));
  }

  // El mes seleccionado queda con una sola carga vigente (se descarta la versión previa).
  const { error: errorLimpieza } = await supabase
    .from('agente_carga_pos')
    .delete()
    .eq('periodo', periodo)
    .neq('carga_id', cargaId);
  if (errorLimpieza) {
    console.warn('No se pudo limpiar la carga previa del periodo:', errorLimpieza.message);
  }

  await guardarComparativoPeriodo(pos, periodo, archivo, usuario, cargadoAt);
  onProgreso?.(95);

  const { error: errorMeta } = await supabase
    .from('agente_carga_cargas')
    .upsert(
      {
        periodo,
        carga_id: cargaId,
        archivo_origen: archivo,
        cargado_por: usuario,
        cargado_at: cargadoAt,
        total_pos: pos.length,
      },
      { onConflict: 'periodo' }
    );
  if (errorMeta) {
    console.warn('No se pudo registrar el periodo de la carga:', errorMeta.message);
  }

  onProgreso?.(100);

  return { archivo, cargadoPor: usuario, cargadoAt };
}

// ============================================================
// PERSISTENCIA — UNA SOLA CARGA VIGENTE
// El Excel de POs Activas ya trae el histórico completo de todos
// los meses, así que cada carga REEMPLAZA por completo la data
// anterior. Antes de reemplazar se guarda un agregado
// (proveedor × país) para poder comparar contra la carga previa.
// ============================================================

interface MetaVigente {
  cargaId: string;
  archivo: string;
  cargadoPor: string;
  cargadoAt: string;
  totalPos: number;
}

async function leerMetaVigente(): Promise<MetaVigente | null> {
  const { data, error } = await supabase
    .from('agente_carga_cargas')
    .select('carga_id, archivo_origen, cargado_por, cargado_at, total_pos')
    .order('cargado_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const fila = data as unknown as {
    carga_id: string | null;
    archivo_origen: string | null;
    cargado_por: string | null;
    cargado_at: string;
    total_pos: number | null;
  } | null;

  if (!fila?.carga_id) return null;

  return {
    cargaId: fila.carga_id,
    archivo: fila.archivo_origen || 'archivo.xlsx',
    cargadoPor: fila.cargado_por || '',
    cargadoAt: fila.cargado_at,
    totalPos: Number(fila.total_pos) || 0,
  };
}

/** Trae la carga vigente (la última que se subió) con todas sus POs. */
export async function cargarCargaVigente(): Promise<{ pos: PoCarga[]; meta: MetaCarga | null }> {
  const metaVigente = await leerMetaVigente();
  if (!metaVigente) return { pos: [], meta: null };

  const filas: FilaSupabase[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from('agente_carga_pos')
      .select('po, etapa, proveedor, proveedor_servicio, agente_carga, ruta_logistica, puerto_arribo, pais_destino, monto_total, etd_inicial, eta_inicial, fecha_asignacion, archivo_origen, cargado_por, cargado_at')
      .eq('carga_id', metaVigente.cargaId)
      .order('proveedor_servicio', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) throw error;
    const lote = (data || []) as unknown as FilaSupabase[];
    filas.push(...lote);
    if (lote.length < TAMANO_PAGINA) break;
  }

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

  return {
    pos,
    meta: {
      archivo: metaVigente.archivo,
      cargadoPor: metaVigente.cargadoPor,
      cargadoAt: metaVigente.cargadoAt,
    },
  };
}

/** Agregado (proveedor × país) de la carga previa, para comparar. */
export async function cargarComparativoVigente(): Promise<{
  filas: FilaComparativo[];
  meta: MetaComparativo | null;
}> {
  const registros: {
    proveedor_servicio: string;
    pais_destino: string;
    cantidad: number;
    archivo_origen: string | null;
    cargado_por: string | null;
    carga_original_at: string;
  }[] = [];

  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from('agente_carga_comparativo')
      .select('proveedor_servicio, pais_destino, cantidad, archivo_origen, cargado_por, carga_original_at')
      .order('proveedor_servicio', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) throw error;
    const lote = (data || []) as unknown as typeof registros;
    registros.push(...lote);
    if (lote.length < TAMANO_PAGINA) break;
  }

  if (registros.length === 0) return { filas: [], meta: null };

  const mapa = new Map<string, FilaComparativo>();
  registros.forEach((r) => {
    if (!mapa.has(r.proveedor_servicio)) {
      mapa.set(r.proveedor_servicio, { proveedorServicio: r.proveedor_servicio, porPais: {}, total: 0 });
    }
    const fila = mapa.get(r.proveedor_servicio)!;
    const cantidad = Number(r.cantidad) || 0;
    fila.porPais[r.pais_destino] = (fila.porPais[r.pais_destino] || 0) + cantidad;
    fila.total += cantidad;
  });

  const primero = registros[0];

  return {
    filas: Array.from(mapa.values()),
    meta: {
      archivo: primero.archivo_origen || 'Carga anterior',
      cargadoPor: primero.cargado_por || '',
      cargadoAt: primero.carga_original_at,
    },
  };
}

/** Guarda la carga vigente y descarta por completo la anterior. */
export async function guardarCargaVigente(
  pos: PoCarga[],
  archivo: string,
  usuario: string,
  onProgreso?: (avance: number) => void
): Promise<MetaCarga> {
  const cargaId = crypto.randomUUID();
  const cargadoAt = new Date().toISOString();
  const periodo = periodoDesdeFecha(cargadoAt);

  // 1. Foto agregada de la carga previa (para poder comparar después).
  const previa = await leerMetaVigente();
  if (previa) {
    try {
      const agregado: { proveedor_servicio: string; pais_destino: string; cantidad: number }[] = [];
      for (let desde = 0; ; desde += TAMANO_PAGINA) {
        const { data, error } = await supabase
          .from('agente_carga_pos')
          .select('proveedor_servicio, pais_destino')
          .eq('carga_id', previa.cargaId)
          .range(desde, desde + TAMANO_PAGINA - 1);
        if (error) throw error;
        const lote = (data || []) as unknown as { proveedor_servicio: string; pais_destino: string }[];
        lote.forEach((f) => {
          if (f.proveedor_servicio === SIN_PROVEEDOR) return;
          agregado.push({ proveedor_servicio: f.proveedor_servicio, pais_destino: f.pais_destino, cantidad: 1 });
        });
        if (lote.length < TAMANO_PAGINA) break;
      }

      const consolidado = new Map<string, { proveedor_servicio: string; pais_destino: string; cantidad: number }>();
      agregado.forEach((f) => {
        const k = `${f.proveedor_servicio}||${f.pais_destino}`;
        const actual = consolidado.get(k);
        if (actual) actual.cantidad += 1;
        else consolidado.set(k, { ...f });
      });

      const registros = Array.from(consolidado.values()).map((f) => ({
        periodo: periodoDesdeFecha(previa.cargadoAt),
        proveedor_servicio: f.proveedor_servicio,
        pais_destino: f.pais_destino,
        cantidad: f.cantidad,
        archivo_origen: previa.archivo,
        cargado_por: previa.cargadoPor || null,
        carga_original_at: previa.cargadoAt,
      }));

      await supabase
        .from('agente_carga_comparativo')
        .delete()
        .neq('pais_destino', '');

      const tamanoSnapshot = 500;
      for (let i = 0; i < registros.length; i += tamanoSnapshot) {
        const { error: errorSnapshot } = await supabase
          .from('agente_carga_comparativo')
          .insert(registros.slice(i, i + tamanoSnapshot));
        if (errorSnapshot) {
          console.warn('No se pudo guardar el comparativo:', errorSnapshot.message);
          break;
        }
      }
    } catch (err) {
      console.warn('Error guardando el comparativo de la carga previa:', err);
    }
  }

  // 2. Data nueva.
  const filas: (FilaSupabase & { carga_id: string; periodo: string })[] = pos.map((p) => ({
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
    archivo_origen: archivo,
    cargado_por: usuario,
    cargado_at: cargadoAt,
    periodo,
  }));

  const tamano = 300;
  for (let i = 0; i < filas.length; i += tamano) {
    const lote = filas.slice(i, i + tamano);
    const { error } = await supabase.from('agente_carga_pos').insert(lote);
    if (error) throw new Error(`No se pudo guardar la carga: ${error.message}`);
    onProgreso?.(Math.min(85, Math.round(((i + lote.length) / filas.length) * 85)));
  }

  // 3. Se descarta todo lo anterior: solo queda esta carga vigente.
  const { error: errorLimpieza } = await supabase
    .from('agente_carga_pos')
    .delete()
    .neq('carga_id', cargaId);
  if (errorLimpieza) {
    console.warn('No se pudo limpiar la carga anterior:', errorLimpieza.message);
  }

  // 4. Meta de la carga vigente (una sola fila).
  await supabase
    .from('agente_carga_cargas')
    .delete()
    .gte('created_at', new Date(0).toISOString());

  const { error: errorMeta } = await supabase.from('agente_carga_cargas').insert({
    periodo,
    carga_id: cargaId,
    archivo_origen: archivo,
    cargado_por: usuario,
    cargado_at: cargadoAt,
    total_pos: pos.length,
  });
  if (errorMeta) {
    console.warn('No se pudo registrar la carga vigente:', errorMeta.message);
  }

  onProgreso?.(100);

  return { archivo, cargadoPor: usuario, cargadoAt };
}