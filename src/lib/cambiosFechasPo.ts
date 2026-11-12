import { supabase } from './supabase';
import {
  buscarPurchaseOrder,
  extraerPo,
  normalizarFecha,
  clavesDePoCompletas,
  actualizarCamposCompraRaga,
  type RagaEnv,
} from './ragaApi';
import { notificarNuevaSolicitudFechas, notificarResultadoFechas } from './notificaciones';
import type { EstadoEtd } from './etdMotivos';

// ============================================================
// CAMBIOS DE FECHAS DE PO — MÓDULO "PO SIN TRACKING"
// Permite solicitar la modificación de cualquier fecha de la
// orden de compra (una o varias a la vez). Sigue el mismo
// circuito de aprobación, dashboard e historial que los demás
// cambios de órdenes: nada se escribe en Raga hasta la aprobación.
// ============================================================

export interface CampoFechaPo {
  id: string;
  // Clave técnica de Raga. Es null cuando la PO no trae esa columna.
  clave: string | null;
  etiqueta: string;
  valor: string;
  // Siempre se puede enviar: si la PO no trae el dato, se envía igual.
  disponible: boolean;
  // true cuando la PO no trae esta fecha y se completa por primera vez.
  columnaNueva?: boolean;
  // Tipo de dato: define el control de edición (fecha o texto libre).
  tipoDato?: 'fecha' | 'texto';
}

export interface CambioFecha {
  campo: string;
  etiqueta: string;
  valorAnterior: string | null;
  valorNuevo: string;
}

export interface SolicitudCambioFechas {
  id: string;
  order_number: string;
  trading_company: string;
  cambios: CambioFecha[];
  change_reason: string;
  other_reason_detail: string | null;
  status: EstadoEtd;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  rejection_comment: string | null;
  api_sync_status: string | null;
  api_sync_error: string | null;
  api_env: RagaEnv | null;
  created_at: string;
  updated_at: string;
  detalle: string;
}

export interface EventoCambioFecha {
  id: string;
  request_id: string;
  event_type: string;
  detail: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

interface Fila {
  id: string;
  order_number: string;
  trading_company: string;
  changes: CambioFecha[] | string | null;
  change_reason: string;
  other_reason_detail: string | null;
  status: EstadoEtd;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  rejection_comment: string | null;
  api_sync_status: string | null;
  api_sync_error: string | null;
  api_env: RagaEnv | null;
  created_at: string;
  updated_at: string;
}

export const MOTIVOS_CAMBIO_FECHAS: string[] = [
  'Ajuste de planificación logística',
  'Reprogramación del proveedor',
  'Cambio de booking / naviera',
  'Corrección de fecha registrada',
  'Actualización por tracking real',
  'Otro',
];

// ── Detección de las fechas de la PO ─────────────────────────

const CLAVES_RESERVADAS = new Set([
  'id', 'uuid', 'order_number', 'po_number', 'trading_company', 'created_at',
  'updated_at', 'deleted_at', 'order_id', 'status_id',
]);

const ETIQUETAS_CONOCIDAS: Record<string, string> = {
  date_carga_lista_teorica: 'Carga Lista Teórica',
  date_carga_lista: 'Carga Lista Teórica',
  fecha_carga_lista: 'Carga Lista Teórica',
  date_variable_date: 'Carga Lista Variable',
  date_etd_initial: 'ETD inicial',
  etd_initial: 'ETD inicial',
  date_etd: 'ETD',
  fecha_etd: 'ETD',
  date_atd: 'ATD',
  date_eta_initial: 'ETA inicial',
  eta_initial: 'ETA inicial',
  date_eta: 'ETA variable',
  fecha_eta: 'ETA variable',
  date_ata: 'ATA',
  date_booking: 'Fecha de booking',
  date_documents: 'Documentos',
  date_invoice: 'Factura',
  date_pickup: 'Pickup',
  date_delivery: 'Entrega',
  date_departure: 'Salida',
  date_arrival: 'Arribo',
  date_shipment: 'Embarque',
  date_cutoff: 'Cut-off',
};

// Nombre legible para una clave técnica de la PO.
function humanizarClave(clave: string): string {
  const conocida = ETIQUETAS_CONOCIDAS[clave.trim().toLowerCase()];
  if (conocida) return conocida;
  const texto = clave
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return texto.replace(/^\w/, (c) => c.toUpperCase());
}

function textoValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

// ¿El valor tiene forma de fecha completa (ISO o dd/mm/aaaa)?
export function esValorFecha(valor: string): boolean {
  const texto = (valor || '').trim();
  if (!texto) return false;
  if (/^\d{4}-\d{2}-\d{2}([T ][\d:.]+)?/.test(texto)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(texto)) return true;
  return false;
}

// Campos de auditoría: nunca se ofrecen para modificación.
const PATRON_CLAVE_AUDITORIA = /^(date_)?(created|updated|deleted)(_at)?$/i;

// ── Ruta logística ───────────────────────────────────────────
// Datos que no son fechas y describen el trayecto de la orden. El módulo
// trabaja con fechas, así que estos campos solo los puede modificar un
// administrador (ver puedeCambiarRutaLogisticaPo).
const PALABRAS_RUTA_LOGISTICA = [
  'ruta', 'route', 'routing', 'logistic', 'carrier', 'navier', 'puerto',
  'port', 'incoterm', 'transport', 'forwarder', 'vessel', 'buque', 'agencia',
  'agente', 'aerolinea', 'airline', 'shipping_line', 'modalidad', 'polyline',
];

// ¿La columna pertenece a la ruta logística de la PO?
export function esCampoRutaLogistica(clave: string): boolean {
  const normalizada = (clave || '').trim().toLowerCase();
  if (!normalizada) return false;
  const tokens = normalizada.split(/[^a-z0-9]+/).filter(Boolean);
  return PALABRAS_RUTA_LOGISTICA.some((p) => (
    p.length > 3 ? normalizada.includes(p) : tokens.includes(p)
  ));
}

// ¿La columna guarda una fecha?
function esClaveFecha(clave: string): boolean {
  const normalizada = (clave || '').trim().toLowerCase();
  if (!normalizada) return false;
  if (esCampoRutaLogistica(normalizada)) return false;
  if (/(^|_)(date|fecha|fechas)(_|$)/.test(normalizada)) return true;
  return normalizada.endsWith('_at');
}

// ── Catálogo de fechas que se pueden enviar a actualizar ─────
// Estas son las únicas fechas del módulo y se muestran siempre, aunque la PO
// todavía no tenga el dato cargado. Cada una tiene su nombre para el usuario;
// el nombre técnico de Raga queda solo en el código.
interface DefinicionFechaPo {
  id: string;
  etiqueta: string;
  candidatos: string[];
  palabras: string[];
}

const FECHAS_PO: DefinicionFechaPo[] = [
  {
    id: 'carga_lista_teorica',
    etiqueta: 'Carga Lista Teórica',
    candidatos: [
      'date_theorical_load',
      'date_theoretical_load',
      'theoretical_load_date',
      'date_carga_lista_teorica',
      'carga_lista_teorica',
      'fecha_carga_lista_teorica',
      'date_load_ready',
      'load_ready_date',
      'date_ready_to_load',
      'ready_to_load_date',
      'date_cargo_ready',
      'cargo_ready_date',
    ],
    palabras: [
      'theorical_load',
      'theoretical_load',
      'carga_lista_teorica',
      'load_ready',
      'ready_to_load',
      'cargo_ready',
    ],
  },
  {
    id: 'carga_lista_variable',
    etiqueta: 'Carga Lista Variable',
    candidatos: [
      'date_variable_date',
      'date_variable_load',
      'variable_load_date',
      'date_carga_lista_variable',
      'carga_lista_variable',
      'fecha_carga_lista_variable',
      'variable_date',
      'date_load_variable',
      'load_variable_date',
      'variable_load',
      'date_variable',
    ],
    palabras: [
      'date_variable',
      'variable_load',
      'carga_lista_variable',
      'load_variable',
      'variable_date',
    ],
  },
  {
    id: 'etd_inicial',
    etiqueta: 'ETD inicial',
    candidatos: [
      'date_etd_initial',
      'etd_initial',
      'date_etd_inicial',
      'etd_inicial',
      'date_initial_etd',
      'initial_etd',
      'date_etd_ini',
      'etd_ini',
    ],
    palabras: ['etd_initial', 'etd_inicial', 'initial_etd', 'etd_ini'],
  },
  {
    id: 'etd',
    etiqueta: 'ETD',
    candidatos: [
      'date_etd',
      'etd',
      'date_etd_variable',
      'etd_variable',
      'date_variable_etd',
      'variable_etd',
      'date_estimated_departure',
      'estimated_departure_date',
    ],
    palabras: ['etd'],
  },
  {
    id: 'atd',
    etiqueta: 'ATD',
    candidatos: [
      'date_atd',
      'atd',
      'date_actual_departure',
      'actual_departure_date',
      'atd_date',
      'date_atd_real',
      'atd_real',
    ],
    palabras: ['atd', 'actual_departure', 'salida_real', 'departure_actual'],
  },
  {
    id: 'eta_inicial',
    etiqueta: 'ETA inicial',
    candidatos: [
      'date_eta_initial',
      'eta_initial',
      'date_eta_inicial',
      'eta_inicial',
      'date_initial_eta',
      'initial_eta',
      'date_eta_ini',
      'eta_ini',
    ],
    palabras: ['eta_initial', 'eta_inicial', 'initial_eta', 'eta_ini'],
  },
  {
    id: 'eta_variable',
    etiqueta: 'ETA variable',
    candidatos: [
      'date_eta_variable',
      'eta_variable',
      'date_variable_eta',
      'variable_eta',
      'date_eta',
      'eta',
      'date_estimated_arrival',
      'estimated_arrival_date',
    ],
    palabras: ['eta'],
  },
  {
    id: 'ata',
    etiqueta: 'ATA',
    candidatos: [
      'date_ata',
      'ata',
      'date_actual_arrival',
      'actual_arrival_date',
      'ata_date',
      'date_ata_real',
      'ata_real',
    ],
    palabras: ['ata', 'actual_arrival', 'arribo_real', 'arrival_actual'],
  },
];

// Claves que nunca se ofrecen: auditoría, emisión y flags booleanos
// (por ejemplo "carga lista validada", que no es una fecha).
function esClaveExcluida(clave: string): boolean {
  const normalizada = clave.trim().toLowerCase();
  if (CLAVES_RESERVADAS.has(normalizada)) return true;
  if (PATRON_CLAVE_AUDITORIA.test(normalizada)) return true;
  if (normalizada.includes('emision') || normalizada.includes('emission')) return true;
  if (normalizada.includes('valid')) return true;
  return false;
}

// Compara la clave con las palabras del catálogo. Los códigos cortos (etd, atd,
// ata, eta) se comparan por palabra completa para no confundirlos con
// columnas como "date_data".
function coincidePalabra(clave: string, palabras: string[]): boolean {
  const normalizada = clave.trim().toLowerCase();
  const tokens = normalizada.split(/[^a-z0-9]+/).filter(Boolean);
  return palabras.some((p) => (p.length <= 3 ? tokens.includes(p) : normalizada.includes(p)));
}

// Devuelve las fechas del módulo, siempre en el mismo orden y con el nombre
// visible para el usuario. `disponible` indica si la PO trae esa columna.
export function detectarCamposFecha(po: Record<string, any> | null | undefined): CampoFechaPo[] {
  const vacio = (): CampoFechaPo[] => FECHAS_PO.map((def) => ({
    id: def.id,
    clave: def.candidatos[0],
    etiqueta: def.etiqueta,
    valor: '',
    disponible: true,
    columnaNueva: true,
    tipoDato: 'fecha' as const,
  }));

  if (!po || typeof po !== 'object') return vacio();

  // Se incluyen las columnas con valor vacío o nulo: así el campo se reconoce
  // por su nombre aunque todavía no tenga fecha cargada. Una fecha en null no
  // significa que la columna no exista, solo que aún no tiene valor.

  const claves = clavesDePoCompletas(po).filter((k) => {
    if (esClaveExcluida(k)) return false;
    return typeof po[k] !== 'boolean';
  });

  const usadas = new Set<string>();
  const asignadas = new Map<string, string>();
  const tomar = (id: string, clave: string) => {
    asignadas.set(id, clave);
    usadas.add(clave);
  };

  // 1) Coincidencia exacta con los nombres técnicos conocidos.
  FECHAS_PO.forEach((def) => {
    const encontrada = claves.find(
      (k) => !usadas.has(k) && def.candidatos.includes(k.trim().toLowerCase())
    );
    if (encontrada) tomar(def.id, encontrada);
  });

  // 2) Coincidencia por palabra clave sobre las columnas que quedaron libres.
  FECHAS_PO.forEach((def) => {
    if (asignadas.has(def.id)) return;
    const encontrada = claves.find((k) => !usadas.has(k) && coincidePalabra(k, def.palabras));
    if (encontrada) tomar(def.id, encontrada);
  });

  return FECHAS_PO.map((def) => {
    const clave = asignadas.get(def.id) || null;
    if (clave) {
      return {
        id: def.id,
        clave,
        etiqueta: def.etiqueta,
        valor: textoValor(po[clave]),
        disponible: true,
        columnaNueva: false,
        tipoDato: 'fecha' as const,
      };
    }

    // La PO no trae la columna: se permite cargarla igual usando el nombre
    // estándar del campo en Raga. Si Raga rechaza el dato, el envío campo por
    // campo ya lo informa sin bloquear al resto.
    return {
      id: def.id,
      clave: def.candidatos[0],
      etiqueta: def.etiqueta,
      valor: '',
      disponible: true,
      columnaNueva: true,
      tipoDato: 'fecha' as const,
    };
  });
}

// Todas las columnas simples de la PO que el usuario podría mapear a mano.
// La ruta logística solo se incluye cuando el usuario está autorizado.
export function columnasSimplesPo(
  po: Record<string, any> | null | undefined,
  opciones?: { incluirRutaLogistica?: boolean }
): CampoFechaPo[] {
  if (!po || typeof po !== 'object') return [];
  const incluirRuta = opciones?.incluirRutaLogistica === true;
  return clavesDePoCompletas(po)
    .filter((clave) => {
      if (esClaveExcluida(clave) || typeof po[clave] === 'boolean') return false;
      if (!incluirRuta && esCampoRutaLogistica(clave)) return false;
      return true;
    })
    .map((clave) => ({
      id: clave,
      clave,
      etiqueta: humanizarClave(clave),
      valor: textoValor(po[clave]),
      disponible: true,
      tipoDato: (esClaveFecha(clave) ? 'fecha' : 'texto') as 'fecha' | 'texto',
    }));
}

function normalizarComparable(valor: string | null | undefined): string {
  const texto = (valor || '').trim();
  if (!texto) return '';
  const fecha = normalizarFecha(texto);
  if (fecha) return fecha;
  return texto.toLowerCase().replace(/\s+/g, ' ');
}

// ── Mapeo y lectura ──────────────────────────────────────────

function leerCambios(fila: Fila): CambioFecha[] {
  let lista: CambioFecha[] = [];
  if (Array.isArray(fila.changes)) {
    lista = fila.changes;
  } else if (typeof fila.changes === 'string') {
    try {
      const parseado = JSON.parse(fila.changes);
      lista = Array.isArray(parseado) ? parseado : [];
    } catch {
      lista = [];
    }
  }
  return lista.map((c) => ({
    campo: c.campo,
    etiqueta: c.etiqueta || humanizarClave(c.campo),
    valorAnterior: c.valorAnterior ?? null,
    valorNuevo: c.valorNuevo,
  }));
}

function construirDetalle(cambios: CambioFecha[]): string {
  if (cambios.length === 0) return 'Sin fechas';
  if (cambios.length === 1) {
    const c = cambios[0];
    return `${c.etiqueta}: ${c.valorAnterior || 'sin fecha'} → ${c.valorNuevo}`;
  }
  const nombres = cambios.slice(0, 3).map((c) => c.etiqueta).join(', ');
  const resto = cambios.length > 3 ? ` y ${cambios.length - 3} más` : '';
  return `${cambios.length} fechas: ${nombres}${resto}`;
}

function mapear(fila: Fila): SolicitudCambioFechas {
  const cambios = leerCambios(fila);
  return {
    id: fila.id,
    order_number: fila.order_number,
    trading_company: fila.trading_company,
    cambios,
    change_reason: fila.change_reason,
    other_reason_detail: fila.other_reason_detail,
    status: fila.status,
    requested_by: fila.requested_by,
    requested_by_name: fila.requested_by_name,
    requested_at: fila.requested_at,
    reviewed_by: fila.reviewed_by,
    reviewed_by_name: fila.reviewed_by_name,
    reviewed_at: fila.reviewed_at,
    rejection_comment: fila.rejection_comment,
    api_sync_status: fila.api_sync_status,
    api_sync_error: fila.api_sync_error,
    api_env: fila.api_env,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
    detalle: construirDetalle(cambios),
  };
}

function ordenar(lista: SolicitudCambioFechas[]): SolicitudCambioFechas[] {
  return lista.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
}

export async function listarSolicitudesFechas(opts?: { incluirQa?: boolean }): Promise<SolicitudCambioFechas[]> {
  const incluirQa = opts?.incluirQa === true;
  let query = supabase.from('po_date_change_requests').select('*');
  if (!incluirQa) query = query.eq('api_env', 'production');
  const { data, error } = await query;
  if (error) throw error;
  return ordenar(((data || []) as Fila[]).map(mapear));
}

export async function listarPendientesFechas(opts?: { incluirQa?: boolean }): Promise<SolicitudCambioFechas[]> {
  const lista = await listarSolicitudesFechas(opts);
  return lista.filter((s) => s.status === 'PENDING');
}

export async function contarPendientesFechas(opts?: { incluirQa?: boolean }): Promise<number> {
  const incluirQa = opts?.incluirQa === true;
  let query = supabase
    .from('po_date_change_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');
  if (!incluirQa) query = query.eq('api_env', 'production');
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function obtenerSolicitudFechasPorId(id: string): Promise<SolicitudCambioFechas | null> {
  const { data, error } = await supabase
    .from('po_date_change_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapear(data as Fila) : null;
}

export async function listarEventosFechas(requestId: string): Promise<EventoCambioFecha[]> {
  const { data, error } = await supabase
    .from('po_date_change_events')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as EventoCambioFecha[];
}

// Evita dos solicitudes pendientes sobre la misma PO y entorno.
export async function obtenerPendienteFechas(
  orderNumber: string,
  tradingCompany: string,
  apiEnv: RagaEnv = 'production'
): Promise<SolicitudCambioFechas | null> {
  const { data, error } = await supabase
    .from('po_date_change_requests')
    .select('*')
    .eq('order_number', orderNumber)
    .eq('trading_company', tradingCompany)
    .eq('status', 'PENDING')
    .eq('api_env', apiEnv)
    .maybeSingle();
  if (error) throw error;
  return data ? mapear(data as Fila) : null;
}

// ── Escritura ────────────────────────────────────────────────

async function registrarEvento(params: {
  request_id: string;
  event_type: string;
  detail?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('po_date_change_events').insert([{
    request_id: params.request_id,
    event_type: params.event_type,
    detail: params.detail ?? null,
    actor_id: params.actor_id ?? null,
    actor_name: params.actor_name ?? null,
  }]);
  if (error) console.error('[Cambios fechas PO] Error registrando evento:', error.message);
}

export interface CrearSolicitudFechasParams {
  order_number: string;
  trading_company: string;
  cambios: CambioFecha[];
  change_reason: string;
  other_reason_detail?: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  api_env?: RagaEnv;
}

export async function crearSolicitudFechas(params: CrearSolicitudFechasParams): Promise<SolicitudCambioFechas> {
  const { data, error } = await supabase
    .from('po_date_change_requests')
    .insert([{
      order_number: params.order_number,
      trading_company: params.trading_company,
      changes: params.cambios,
      change_reason: params.change_reason,
      other_reason_detail: params.other_reason_detail ?? null,
      status: 'PENDING',
      requested_by: params.requested_by,
      requested_by_name: params.requested_by_name,
      api_env: params.api_env || 'production',
    }])
    .select()
    .single();
  if (error) throw error;

  const fila = data as Fila;

  await registrarEvento({
    request_id: fila.id,
    event_type: 'CREATED',
    detail: `Solicitud creada (${params.cambios.length} fecha/s). ${construirDetalle(params.cambios)} (entorno ${params.api_env || 'production'})`,
    actor_id: params.requested_by,
    actor_name: params.requested_by_name,
  });

  await notificarNuevaSolicitudFechas({
    orderNumber: params.order_number,
    tradingCompany: params.trading_company,
    solicitanteNombre: params.requested_by_name || '',
    solicitanteId: params.requested_by,
    detalle: construirDetalle(params.cambios),
    apiEnv: params.api_env === 'qa' ? 'qa' : 'production',
    solicitudId: fila.id,
  });

  return mapear(fila);
}

export interface ResultadoResolucionFechas {
  ok: boolean;
  error?: string;
}

export async function aprobarSolicitudFechas(params: {
  solicitud: SolicitudCambioFechas;
  aprobadorId: string;
  aprobadorNombre: string;
  // Solo un usuario autorizado puede aplicar cambios de ruta logística.
  puedeCambiarRuta?: boolean;
}): Promise<ResultadoResolucionFechas> {
  const { solicitud, aprobadorId, aprobadorNombre } = params;

  if (solicitud.cambios.length === 0) {
    return { ok: false, error: 'La solicitud no tiene fechas para actualizar.' };
  }

  // La ruta logística (y otros datos que no son fechas) queda reservada a
  // administradores, incluso si la solicitud ya existía.
  const cambiosRuta = solicitud.cambios.filter((c) => esCampoRutaLogistica(c.campo));
  if (cambiosRuta.length > 0 && params.puedeCambiarRuta === false) {
    return {
      ok: false,
      error: `La solicitud incluye datos de la ruta logística (${cambiosRuta.map((c) => c.etiqueta).join(', ')}). Solo un administrador puede aprobar ese cambio.`,
    };
  }

  // 1) Verificar que siga pendiente.
  const { data: actual, error: errorActual } = await supabase
    .from('po_date_change_requests')
    .select('status')
    .eq('id', solicitud.id)
    .maybeSingle();
  if (errorActual) return { ok: false, error: errorActual.message };
  if (!actual || actual.status !== 'PENDING') {
    return { ok: false, error: 'La solicitud ya fue procesada por otro usuario.' };
  }

  const entornoRaga: RagaEnv = solicitud.api_env === 'production' ? 'production' : 'qa';

  // 2) Releer la PO y validar que las fechas no cambiaron desde la solicitud.
  const consulta = await buscarPurchaseOrder(solicitud.order_number, entornoRaga);
  if (!consulta.ok) {
    return { ok: false, error: consulta.error || 'No se pudo consultar la PO en Raga para revalidar.' };
  }
  const po = extraerPo(consulta.data, solicitud.order_number, solicitud.trading_company);
  if (!po) return { ok: false, error: 'No se encontró la PO en Raga para revalidar el cambio.' };

  // Fechas que ya tienen en Raga el valor propuesto (por ejemplo, tras una
  // aprobación parcial anterior). No se revalidan ni se vuelven a enviar.
  const yaAplicadas = solicitud.cambios.filter((c) => {
    const vigente = textoValor(po[c.campo]);
    return Boolean(vigente) && normalizarComparable(vigente) === normalizarComparable(c.valorNuevo);
  });

  const desactualizadas = solicitud.cambios.filter((c) => {
    if (yaAplicadas.some((y) => y.campo === c.campo)) return false;
    if (!c.valorAnterior) return false;
    const vigente = textoValor(po[c.campo]);
    return normalizarComparable(vigente) !== normalizarComparable(c.valorAnterior);
  });
  if (desactualizadas.length > 0) {
    const detalle = desactualizadas
      .map((c) => `${c.etiqueta} (en Raga: ${textoValor(po[c.campo]) || 'sin fecha'})`)
      .join(', ');
    return {
      ok: false,
      error: `Las fechas en Raga cambiaron desde que se creó la solicitud: ${detalle}. Se requiere revisión antes de aprobar.`,
    };
  }

  // 3) Una petición a Raga por cada fecha aprobada: la API hace un parseo de
  // fecha valor por valor, así un dato con problema no bloquea al resto.
  const fields: Record<string, string> = {};
  const etiquetas: Record<string, string> = {};
  solicitud.cambios.forEach((c) => {
    if (yaAplicadas.some((y) => y.campo === c.campo)) return;
    fields[c.campo] = c.valorNuevo;
    etiquetas[c.campo] = c.etiqueta;
  });

  const put = Object.keys(fields).length > 0
    ? await actualizarCamposCompraRaga({
      orderNumber: solicitud.order_number,
      tradingCompany: solicitud.trading_company,
      fields,
      etiquetas,
      apiEnv: entornoRaga,
      requestId: solicitud.id,
    })
    : { ok: true, aplicados: [] as string[], fallidos: [] as string[], error: undefined };

  if (!put.ok) {
    const aplicadas = put.aplicados.length > 0
      ? `Se actualizaron correctamente: ${put.aplicados.map((k) => etiquetas[k] || k).join(', ')}. `
      : 'No se actualizó ninguna fecha. ';
    const detalleError = `${aplicadas}${put.error || 'La API de Raga falló al actualizar.'}`;
    await supabase
      .from('po_date_change_requests')
      .update({ api_sync_status: 'ERROR', api_sync_error: detalleError, updated_at: new Date().toISOString() })
      .eq('id', solicitud.id);
    await registrarEvento({
      request_id: solicitud.id,
      event_type: 'API_SYNC_ERROR',
      detail: detalleError,
      actor_id: aprobadorId,
      actor_name: aprobadorNombre,
    });
    return {
      ok: false,
      error: `No se pudieron actualizar las fechas en Raga. ${detalleError} La solicitud sigue pendiente.`,
    };
  }

  // 4) Marcar aprobada sólo si sigue pendiente.
  const { data: filas, error: errorUpdate } = await supabase
    .from('po_date_change_requests')
    .update({
      status: 'APPROVED',
      reviewed_by: aprobadorId,
      reviewed_by_name: aprobadorNombre,
      reviewed_at: new Date().toISOString(),
      api_sync_status: 'OK',
      api_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', solicitud.id)
    .eq('status', 'PENDING')
    .select();
  if (errorUpdate) return { ok: false, error: errorUpdate.message };
  if (!filas || filas.length === 0) {
    return { ok: false, error: 'La solicitud ya fue procesada por otro usuario.' };
  }

  await registrarEvento({
    request_id: solicitud.id,
    event_type: 'APPROVED',
    detail: `Fechas actualizadas en Raga (${entornoRaga}): ${solicitud.cambios.map((c) => `${c.etiqueta} = ${c.valorNuevo}`).join(', ')}`,
    actor_id: aprobadorId,
    actor_name: aprobadorNombre,
  });

  await notificarResultadoFechas({
    usuarioId: solicitud.requested_by,
    poTiquetera: solicitud.order_number,
    tipo: 'fechas_aprobada',
    mensaje: `Tu solicitud de cambio de fechas para la PO ${solicitud.order_number} fue aprobada. ${solicitud.detalle}. Aprobado por: ${aprobadorNombre}.`,
  });

  return { ok: true };
}

export async function rechazarSolicitudFechas(params: {
  solicitud: SolicitudCambioFechas;
  revisorId: string;
  revisorNombre: string;
  comentario: string;
}): Promise<ResultadoResolucionFechas> {
  const { solicitud, revisorId, revisorNombre, comentario } = params;
  const detalle = (comentario || '').trim();
  if (!detalle) return { ok: false, error: 'El comentario de rechazo es obligatorio.' };

  const { data: filas, error } = await supabase
    .from('po_date_change_requests')
    .update({
      status: 'REJECTED',
      reviewed_by: revisorId,
      reviewed_by_name: revisorNombre,
      reviewed_at: new Date().toISOString(),
      rejection_comment: detalle,
      updated_at: new Date().toISOString(),
    })
    .eq('id', solicitud.id)
    .eq('status', 'PENDING')
    .select();
  if (error) return { ok: false, error: error.message };
  if (!filas || filas.length === 0) {
    return { ok: false, error: 'La solicitud ya fue procesada por otro usuario.' };
  }

  await registrarEvento({
    request_id: solicitud.id,
    event_type: 'REJECTED',
    detail: detalle,
    actor_id: revisorId,
    actor_name: revisorNombre,
  });

  await notificarResultadoFechas({
    usuarioId: solicitud.requested_by,
    poTiquetera: solicitud.order_number,
    tipo: 'fechas_rechazada',
    mensaje: `Tu solicitud de cambio de fechas para la PO ${solicitud.order_number} fue rechazada. Motivo: ${detalle}. Revisado por: ${revisorNombre}.`,
  });

  return { ok: true };
}