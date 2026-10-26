import { supabase } from './supabase';
import { parseDocEntries, parsePOs, esFactura, esPackingList } from './documentos';

// ════════════════════════════════════════════════════════════
// KPI · Documentación completa (Factura + BL + Packing List + Contenedor)
// Se evalúa sobre las POs que están en la ETAPA DE DOCUMENTACIÓN:
//  - tickets ya creados que siguen en "No Asignado" / "Documentación"
//  - filas que siguen en la bandeja del módulo Documentación (documentos_caa)
// ════════════════════════════════════════════════════════════

export const ESTADOS_ETAPA_DOCUMENTACION = ['No Asignado', 'Documentación'];

export type OrigenDocumentacion = 'ticket' | 'bandeja';

export interface FilaDocumentacionPo {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  estado: string;
  tipo_modulo: string;
  origen: OrigenDocumentacion;
  numeroBl: string;
  numeroContenedor: string;
  tieneFactura: boolean;
  tieneBl: boolean;
  tienePackingList: boolean;
  tieneContenedor: boolean;
  completa: boolean;
  faltantes: string[];
}

export interface ResultadoDocumentacionCompleta {
  filas: FilaDocumentacionPo[];
  total: number;
  completas: number;
  incompletas: number;
  porcentaje: number;
  conFactura: number;
  conBl: number;
  conPackingList: number;
  conContenedor: number;
}

export const RESULTADO_DOCUMENTACION_VACIO: ResultadoDocumentacionCompleta = {
  filas: [],
  total: 0,
  completas: 0,
  incompletas: 0,
  porcentaje: 0,
  conFactura: 0,
  conBl: 0,
  conPackingList: 0,
  conContenedor: 0
};

const texto = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim() : '';

const tieneTexto = (valor: unknown): boolean => texto(valor) !== '';

/** Etiqueta legible del módulo del registro. */
export const etiquetaModulo = (tipoModulo: string): string => {
  const valor = (tipoModulo || '').toLowerCase();
  if (valor === 'dropship') return 'Dropship';
  if (valor === 'zf') return 'ZF';
  return '—';
};

interface DocumentoOrigen {
  id: string;
  po_tiquetera?: string | null;
  exp_id?: string | null;
  solicitante?: string | null;
  estado_expediente?: string | null;
  tipo_modulo?: string | null;
  doc?: unknown;
  bl_cargado?: boolean | null;
  numero_bl?: string | null;
  numero_contenedor?: string | null;
  packing_list_cargado?: boolean | null;
}

/**
 * Convierte un registro (ticket o fila de la bandeja) en filas por PO.
 * Se separan las POs individuales para que el KPI cuente POs, no filas.
 */
function filasDesdeRegistro(
  registro: DocumentoOrigen,
  origen: OrigenDocumentacion,
  estadoPorDefecto: string
): FilaDocumentacionPo[] {
  const entradas = parseDocEntries(registro.doc);

  const tieneFactura = entradas.some(esFactura);
  const tienePackingList = Boolean(registro.packing_list_cargado) || entradas.some(esPackingList);
  const numeroBl = texto(registro.numero_bl);
  const numeroContenedor = texto(registro.numero_contenedor);
  const tieneBl = Boolean(registro.bl_cargado) || tieneTexto(numeroBl);
  const tieneContenedor = tieneTexto(numeroContenedor);

  const faltantes: string[] = [];
  if (!tieneFactura) faltantes.push('Factura');
  if (!tieneBl) faltantes.push('BL');
  if (!tienePackingList) faltantes.push('Packing List');
  if (!tieneContenedor) faltantes.push('Contenedor');

  const completa = faltantes.length === 0;

  const pos = parsePOs(registro.po_tiquetera);
  const posFinales = pos.length > 0 ? pos : ['—'];

  return posFinales.map((po, index) => ({
    id: `${registro.id}-${index}`,
    po_tiquetera: po,
    exp_id: texto(registro.exp_id),
    solicitante: texto(registro.solicitante),
    estado: texto(registro.estado_expediente) || estadoPorDefecto,
    tipo_modulo: registro.tipo_modulo || '',
    origen,
    numeroBl,
    numeroContenedor,
    tieneFactura,
    tieneBl,
    tienePackingList,
    tieneContenedor,
    completa,
    faltantes
  }));
}

/** Calcula totales y porcentajes a partir de las filas por PO. */
export function calcularDocumentacionCompleta(
  filas: FilaDocumentacionPo[]
): ResultadoDocumentacionCompleta {
  const total = filas.length;
  if (total === 0) return RESULTADO_DOCUMENTACION_VACIO;

  const completas = filas.filter((f) => f.completa).length;

  return {
    filas,
    total,
    completas,
    incompletas: total - completas,
    porcentaje: Math.round((completas / total) * 100),
    conFactura: filas.filter((f) => f.tieneFactura).length,
    conBl: filas.filter((f) => f.tieneBl).length,
    conPackingList: filas.filter((f) => f.tienePackingList).length,
    conContenedor: filas.filter((f) => f.tieneContenedor).length
  };
}

const COLUMNAS_DOCUMENTACION =
  'id, po_tiquetera, exp_id, solicitante, estado_expediente, tipo_modulo, doc, bl_cargado, numero_bl, numero_contenedor, packing_list_cargado';

/**
 * Trae las POs en etapa de documentación (tickets no asignados + bandeja)
 * y devuelve el resultado del KPI.
 */
export async function cargarKpiDocumentacionCompleta(): Promise<ResultadoDocumentacionCompleta> {
  const [resTickets, resBandeja] = await Promise.all([
    supabase
      .from('expedientes')
      .select(COLUMNAS_DOCUMENTACION)
      .in('estado_expediente', ESTADOS_ETAPA_DOCUMENTACION),
    supabase
      .from('documentos_caa')
      .select(COLUMNAS_DOCUMENTACION)
  ]);

  if (resTickets.error) throw resTickets.error;
  if (resBandeja.error) throw resBandeja.error;

  const filasTickets = (resTickets.data || []).flatMap((registro) =>
    filasDesdeRegistro(registro as DocumentoOrigen, 'ticket', 'No Asignado')
  );

  const filasBandeja = (resBandeja.data || []).flatMap((registro) =>
    filasDesdeRegistro(registro as DocumentoOrigen, 'bandeja', 'Documentación')
  );

  return calcularDocumentacionCompleta([...filasTickets, ...filasBandeja]);
}