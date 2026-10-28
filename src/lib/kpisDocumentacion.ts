import { supabase } from './supabase';
import { parseDocEntries, parsePOs, esFactura, esPackingList } from './documentos';

// ════════════════════════════════════════════════════════════
// KPI · POs con SOLO factura cargada
//
// Universo evaluado: POs que están en la ETAPA DE DOCUMENTACIÓN
//  - tickets ya creados que siguen en "No Asignado" / "Documentación"
//  - filas que siguen en la bandeja del módulo Documentación (documentos_caa)
//
// Pero el indicador SOLO toma en cuenta las POs que tienen la factura
// cargada y NINGÚN otro documento (sin BL, sin packing list y sin número
// de contenedor). Es decir: factura sola, con el resto pendiente.
//
// Además se marca aparte a las POs que tienen la factura cargada pero que
// TODAVÍA NO generaron su expediente (siguen en la bandeja con "Por Asignar"):
// antes quedaban mezcladas y no se veían como grupo propio.
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
  cantidadDocumentos: number;
  tieneFactura: boolean;
  tieneBl: boolean;
  tienePackingList: boolean;
  tieneContenedor: boolean;
  soloFactura: boolean;
  /** La PO tiene factura cargada pero todavía no generó expediente. */
  sinExpediente: boolean;
  faltantes: string[];
}

export interface ResultadoDocumentacionCompleta {
  /** POs con factura cargada y ningún otro documento. */
  filas: FilaDocumentacionPo[];
  /** Cantidad de POs con solo factura (universo del indicador). */
  total: number;
  /** POs que están en etapa de documentación (contexto). */
  totalEtapa: number;
  /** Qué porcentaje de la etapa está con factura sola. */
  porcentajeEtapa: number;
  /** Documentos por completar: cada PO debe sumar BL + packing list + contenedor. */
  documentosPendientes: number;
  /** POs en etapa que ya tienen la factura cargada (con o sin otros documentos). */
  conFactura: number;
  /** POs con factura cargada que todavía no generaron expediente. */
  sinExpediente: number;
  /** De las POs con solo factura, cuántas aún no tienen expediente creado. */
  soloFacturaSinExpediente: number;
  porModulo: { dropship: number; zf: number; sinModulo: number };
  porOrigen: { ticket: number; bandeja: number };
}

export const RESULTADO_DOCUMENTACION_VACIO: ResultadoDocumentacionCompleta = {
  filas: [],
  total: 0,
  totalEtapa: 0,
  porcentajeEtapa: 0,
  documentosPendientes: 0,
  conFactura: 0,
  sinExpediente: 0,
  soloFacturaSinExpediente: 0,
  porModulo: { dropship: 0, zf: 0, sinModulo: 0 },
  porOrigen: { ticket: 0, bandeja: 0 }
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
 * Se separan las POs individuales para que el indicador cuente POs, no filas.
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

  // "Solo factura" = hay factura y no se cargó ningún otro documento.
  const soloFactura =
    tieneFactura && !tieneBl && !tienePackingList && !tieneContenedor;

  const faltantes: string[] = [];
  if (!tieneFactura) faltantes.push('Factura');
  if (!tieneBl) faltantes.push('BL');
  if (!tienePackingList) faltantes.push('Packing List');
  if (!tieneContenedor) faltantes.push('Contenedor');

  const cantidadDocumentos = entradas.length;

  // Sin expediente: la PO viene de la bandeja y todavía no fue consolidada
  // en un expediente (el EXP ID queda vacío o como "Por Asignar").
  const expIdTexto = texto(registro.exp_id);
  const sinExpediente = expIdTexto === '' || /^por\s*asignar$/i.test(expIdTexto);

  const pos = parsePOs(registro.po_tiquetera);
  const posFinales = pos.length > 0 ? pos : ['—'];

  return posFinales.map((po, index) => ({
    id: `${registro.id}-${index}`,
    po_tiquetera: po,
    exp_id: expIdTexto,
    solicitante: texto(registro.solicitante),
    estado: texto(registro.estado_expediente) || estadoPorDefecto,
    tipo_modulo: registro.tipo_modulo || '',
    origen,
    numeroBl,
    numeroContenedor,
    cantidadDocumentos,
    tieneFactura,
    tieneBl,
    tienePackingList,
    tieneContenedor,
    soloFactura,
    sinExpediente,
    faltantes
  }));
}

/**
 * Calcula los totales del indicador.
 * Recibe TODAS las filas de la etapa y devuelve únicamente las de factura sola.
 */
export function calcularDocumentacionCompleta(
  todasLasFilas: FilaDocumentacionPo[]
): ResultadoDocumentacionCompleta {
  const totalEtapa = todasLasFilas.length;
  const filas = todasLasFilas.filter((f) => f.soloFactura);
  const total = filas.length;

  if (totalEtapa === 0) return RESULTADO_DOCUMENTACION_VACIO;

  const porModulo = filas.reduce(
    (acc, fila) => {
      const mod = (fila.tipo_modulo || '').toLowerCase();
      if (mod === 'dropship') acc.dropship += 1;
      else if (mod === 'zf') acc.zf += 1;
      else acc.sinModulo += 1;
      return acc;
    },
    { dropship: 0, zf: 0, sinModulo: 0 }
  );

  const porOrigen = filas.reduce(
    (acc, fila) => {
      if (fila.origen === 'ticket') acc.ticket += 1;
      else acc.bandeja += 1;
      return acc;
    },
    { ticket: 0, bandeja: 0 }
  );

  return {
    filas,
    total,
    totalEtapa,
    porcentajeEtapa: Math.round((total / totalEtapa) * 100),
    documentosPendientes: total * 3,
    conFactura: todasLasFilas.filter((f) => f.tieneFactura).length,
    sinExpediente: todasLasFilas.filter((f) => f.tieneFactura && f.sinExpediente).length,
    soloFacturaSinExpediente: filas.filter((f) => f.sinExpediente).length,
    porModulo,
    porOrigen
  };
}

const COLUMNAS_DOCUMENTACION =
  'id, po_tiquetera, exp_id, solicitante, estado_expediente, tipo_modulo, doc, bl_cargado, numero_bl, numero_contenedor, packing_list_cargado';

/**
 * Trae las POs en etapa de documentación (tickets no asignados + bandeja)
 * y devuelve el resultado del indicador de factura sola.
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