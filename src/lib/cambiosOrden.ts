import { supabase } from './supabase';
import {
  buscarPurchaseOrder,
  extraerPo,
  normalizarFecha,
  obtenerValorCampo,
  textoValorPo,
  actualizarCamposCompraRaga,
  esClaveCargaListaValidada,
  type RagaEnv,
  type CampoOrdenEditable,
} from './ragaApi';
import {
  aprobarSolicitudEtd,
  rechazarSolicitudEtd,
  listarEventosEtd,
  obtenerSolicitudEtdPorId,
  type SolicitudEtd,
  type EventoEtd,
} from './etdCambios';
import { notificarNuevaSolicitudCambio, notificarResultadoCambio } from './notificaciones';
import type { EstadoEtd } from './etdMotivos';

export type TipoCambioOrden = 'etd_inicial' | 'carga_lista' | 'incoterm';

export interface ConfigTipoCambio {
  label: string;
  labelCorto: string;
  icono: string;
  clase: string;
}

export const TIPOS_CAMBIO: Record<TipoCambioOrden, ConfigTipoCambio> = {
  etd_inicial: {
    label: 'Cambio de ETD Inicial',
    labelCorto: 'ETD Inicial',
    icono: 'ri-calendar-2-line',
    clase: 'bg-teal-100 text-teal-800',
  },
  carga_lista: {
    label: 'Cambio de Carga Lista',
    labelCorto: 'Carga Lista',
    icono: 'ri-file-list-2-line',
    clase: 'bg-indigo-100 text-indigo-800',
  },
  incoterm: {
    label: 'Cambio de Incoterm',
    labelCorto: 'Incoterm',
    icono: 'ri-exchange-dollar-line',
    clase: 'bg-amber-100 text-amber-800',
  },
};

// Motivos sugeridos según el tipo de cambio.
export const MOTIVOS_CAMBIO_CARGA_LISTA: string[] = [
  'Retraso del proveedor',
  'Adelanto de la producción',
  'Reprogramación logística',
  'Cambio de booking',
  'Error en la fecha registrada',
  'Otro',
];

export const MOTIVOS_CAMBIO_INCOTERM: string[] = [
  'Renegociación con el proveedor',
  'Ajuste de condiciones de compra',
  'Cambio en la responsabilidad del flete',
  'Error en el registro de la compra',
  'Otro',
];

// Lista de incoterms disponible en la orden de compra (misma que usa Next/Raga).
export const INCOTERMS: string[] = [
  'CFR', 'CIF', 'CIP', 'CPT', 'DAP', 'DAT', 'DDP',
  'DEQ', 'DES', 'EXD', 'EXQ', 'EXW', 'FCA', 'FOB',
];

// Descripción corta para ayudar a elegir el incoterm correcto.
export const INCOTERM_DESCRIPCIONES: Record<string, string> = {
  CFR: 'Costo y flete: el vendedor paga el flete hasta el puerto de destino.',
  CIF: 'Costo, seguro y flete: como CFR, pero el vendedor además asegura la carga.',
  CIP: 'Transporte y seguro pagados: como CPT, con seguro a cargo del vendedor.',
  CPT: 'Transporte pagado hasta: el vendedor paga el flete hasta el destino acordado.',
  DAP: 'Entregado en lugar: el vendedor entrega en el destino, sin descargar ni importar.',
  DAT: 'Entregado en terminal: el vendedor entrega la carga descargada en la terminal.',
  DDP: 'Entregado con derechos pagados: el vendedor asume flete, seguro e importación.',
  DEQ: 'Entregado en muelle: el vendedor entrega la carga descargada en el muelle de destino.',
  DES: 'Entregado sobre buque: el vendedor entrega la carga a bordo en el puerto de destino.',
  EXD: 'Entregado con derechos: el vendedor entrega en destino asumiendo los derechos.',
  EXQ: 'Entregado en muelle con derechos pagados: el vendedor asume la descarga y los derechos.',
  EXW: 'En fábrica: el comprador retira la mercancía en las instalaciones del vendedor.',
  FCA: 'Libre transportista: el vendedor entrega la carga al transportista designado.',
  FOB: 'Libre a bordo: el vendedor entrega la carga a bordo del buque en el puerto de origen.',
};

export interface CambioCampo {
  campo: string;
  etiqueta: string;
  valorAnterior: string | null;
  valorNuevo: string;
}

// Estructura común que consumen dashboard, aprobaciones e historial.
// Los campos propios del ETD quedan nulos en los otros tipos.
export interface SolicitudCambio {
  id: string;
  tipo: TipoCambioOrden;
  order_number: string;
  trading_company: string;
  previous_etd_initial: string | null;
  proposed_etd_initial: string | null;
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
  // Solo para carga lista e incoterm
  campo_clave: string | null;
  campos: CambioCampo[];
  // Texto corto para listas: "ETD Inicial: 12 oct → 20 oct"
  detalle: string;
}

interface FilaCampo {
  id: string;
  change_type: 'carga_lista' | 'incoterm';
  order_number: string;
  trading_company: string;
  field_key: string;
  field_label: string;
  previous_value: string | null;
  proposed_value: string;
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
  field_changes: unknown;
  created_at: string;
  updated_at: string;
}

// Cada solicitud puede llevar uno o varios campos en el mismo pedido.
function normalizarCamposFila(fila: FilaCampo): CambioCampo[] {
  const desdeJson = Array.isArray(fila.field_changes) ? (fila.field_changes as unknown[]) : [];
  const lista = desdeJson
    .map((item) => {
      const c = (item || {}) as Record<string, unknown>;
      return {
        campo: String(c.campo ?? '').trim(),
        etiqueta: String(c.etiqueta ?? c.campo ?? '').trim(),
        valorAnterior: c.valorAnterior === null || c.valorAnterior === undefined
          ? null
          : String(c.valorAnterior),
        valorNuevo: String(c.valorNuevo ?? '').trim(),
      };
    })
    .filter((c) => c.campo && c.valorNuevo);

  if (lista.length > 0) return lista;

  return [{
    campo: fila.field_key,
    etiqueta: fila.field_label,
    valorAnterior: fila.previous_value,
    valorNuevo: fila.proposed_value,
  }];
}

export type EventoCambio = EventoEtd;

function normalizarComparable(valor: string | null | undefined): string {
  const texto = (valor || '').trim().toLowerCase();
  if (!texto) return '';
  const fecha = normalizarFecha(texto);
  if (fecha) return fecha;
  return texto.replace(/\s+/g, ' ');
}

function mapearEtd(fila: SolicitudEtd): SolicitudCambio {
  const anterior = fila.previous_etd_initial ? normalizarFecha(fila.previous_etd_initial) : '';
  const nuevo = normalizarFecha(fila.proposed_etd_initial);
  return {
    id: fila.id,
    tipo: 'etd_inicial',
    order_number: fila.order_number,
    trading_company: fila.trading_company,
    previous_etd_initial: anterior || null,
    proposed_etd_initial: nuevo || null,
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
    campo_clave: null,
    campos: [],
    detalle: `ETD Inicial: ${anterior || 'sin fecha'} → ${nuevo}`,
  };
}

function textoDetalleCampo(valor: string | null | undefined): string {
  const texto = (valor || '').trim();
  if (!texto) return 'sin valor';
  if (/^true$/i.test(texto)) return 'Sí';
  if (/^false$/i.test(texto)) return 'No';
  return texto;
}

function mapearCampo(fila: FilaCampo): SolicitudCambio {
  const campos = normalizarCamposFila(fila);
  return {
    id: fila.id,
    tipo: fila.change_type,
    order_number: fila.order_number,
    trading_company: fila.trading_company,
    previous_etd_initial: null,
    proposed_etd_initial: null,
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
    campo_clave: campos[0]?.campo || fila.field_key,
    campos,
    detalle: campos
      .map((c) => `${c.etiqueta}: ${textoDetalleCampo(c.valorAnterior)} → ${textoDetalleCampo(c.valorNuevo)}`)
      .join(' · '),
  };
}

function ordenar(lista: SolicitudCambio[]): SolicitudCambio[] {
  return lista.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
}

// ─────────────────────────────────────────────────────────────
// LECTURA
// ─────────────────────────────────────────────────────────────

export async function listarCambios(opts?: {
  incluirQa?: boolean;
  tipo?: TipoCambioOrden;
}): Promise<SolicitudCambio[]> {
  const incluirQa = opts?.incluirQa === true;
  const tipo = opts?.tipo;

  if (tipo === 'etd_inicial') {
    let query = supabase.from('etd_initial_change_requests').select('*');
    if (!incluirQa) query = query.eq('api_env', 'production');
    const { data, error } = await query;
    if (error) throw error;
    return ordenar(((data || []) as SolicitudEtd[]).map(mapearEtd));
  }

  if (tipo === 'carga_lista' || tipo === 'incoterm') {
    let query = supabase.from('order_field_change_requests').select('*').eq('change_type', tipo);
    if (!incluirQa) query = query.eq('api_env', 'production');
    const { data, error } = await query;
    if (error) throw error;
    return ordenar(((data || []) as FilaCampo[]).map(mapearCampo));
  }

  let queryEtd = supabase.from('etd_initial_change_requests').select('*');
  if (!incluirQa) queryEtd = queryEtd.eq('api_env', 'production');

  let queryCampo = supabase.from('order_field_change_requests').select('*');
  if (!incluirQa) queryCampo = queryCampo.eq('api_env', 'production');

  const [etd, campos] = await Promise.all([queryEtd, queryCampo]);
  if (etd.error) throw etd.error;
  if (campos.error) throw campos.error;

  const lista = [
    ...((etd.data || []) as SolicitudEtd[]).map(mapearEtd),
    ...((campos.data || []) as FilaCampo[]).map(mapearCampo),
  ];
  return ordenar(lista);
}

export async function listarPendientesCambios(opts?: {
  incluirQa?: boolean;
}): Promise<SolicitudCambio[]> {
  const lista = await listarCambios(opts);
  return lista.filter((s) => s.status === 'PENDING');
}

export async function contarPendientesCambios(opts?: { incluirQa?: boolean }): Promise<number> {
  const incluirQa = opts?.incluirQa === true;
  let queryEtd = supabase
    .from('etd_initial_change_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');
  if (!incluirQa) queryEtd = queryEtd.eq('api_env', 'production');

  let queryCampo = supabase
    .from('order_field_change_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');
  if (!incluirQa) queryCampo = queryCampo.eq('api_env', 'production');

  const [etd, campos] = await Promise.all([queryEtd, queryCampo]);
  if (etd.error) throw etd.error;
  if (campos.error) throw campos.error;
  return (etd.count || 0) + (campos.count || 0);
}

// Trae una solicitud por ID probando ambas tablas (las notificaciones solo guardan el id).
export async function obtenerCambioPorId(id: string): Promise<SolicitudCambio | null> {
  const { data: campo, error: errorCampo } = await supabase
    .from('order_field_change_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (errorCampo) throw errorCampo;
  if (campo) return mapearCampo(campo as FilaCampo);

  const etd = await obtenerSolicitudEtdPorId(id);
  return etd ? mapearEtd(etd) : null;
}

export async function listarEventosCambio(solicitud: SolicitudCambio): Promise<EventoCambio[]> {
  if (solicitud.tipo === 'etd_inicial') return listarEventosEtd(solicitud.id);
  const { data, error } = await supabase
    .from('order_field_change_events')
    .select('*')
    .eq('request_id', solicitud.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as EventoCambio[];
}

// Evita duplicar solicitudes pendientes sobre la misma PO, compañía y tipo.
export async function obtenerPendienteCambio(
  orderNumber: string,
  tradingCompany: string,
  tipo: TipoCambioOrden,
  apiEnv: RagaEnv = 'production'
): Promise<SolicitudCambio | null> {
  const { data, error } = await supabase
    .from('order_field_change_requests')
    .select('*')
    .eq('order_number', orderNumber)
    .eq('trading_company', tradingCompany)
    .eq('change_type', tipo)
    .eq('status', 'PENDING')
    .eq('api_env', apiEnv)
    .maybeSingle();
  if (error) throw error;
  return data ? mapearCampo(data as FilaCampo) : null;
}

// ─────────────────────────────────────────────────────────────
// ESCRITURA
// ─────────────────────────────────────────────────────────────

async function registrarEventoCampo(params: {
  request_id: string;
  event_type: string;
  detail?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('order_field_change_events').insert([{
    request_id: params.request_id,
    event_type: params.event_type,
    detail: params.detail ?? null,
    actor_id: params.actor_id ?? null,
    actor_name: params.actor_name ?? null,
  }]);
  if (error) console.error('[Cambios] Error registrando evento:', error.message);
}

export interface CrearSolicitudCampoParams {
  tipo: 'carga_lista' | 'incoterm';
  order_number: string;
  trading_company: string;
  // Uno o varios campos dentro de la misma solicitud.
  campos: CambioCampo[];
  change_reason: string;
  other_reason_detail?: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  api_env?: RagaEnv;
}

export async function crearSolicitudCampo(params: CrearSolicitudCampoParams): Promise<SolicitudCambio> {
  if (!params.campos || params.campos.length === 0) {
    throw new Error('La solicitud debe incluir al menos un campo a modificar.');
  }

  const principal = params.campos[0];
  const detalleTexto = params.campos
    .map((c) => `${c.etiqueta}: ${textoDetalleCampo(c.valorAnterior)} → ${textoDetalleCampo(c.valorNuevo)}`)
    .join(' | ');

  const { data, error } = await supabase
    .from('order_field_change_requests')
    .insert([{
      change_type: params.tipo,
      order_number: params.order_number,
      trading_company: params.trading_company,
      field_key: principal.campo,
      field_label: params.campos.length > 1
        ? `${params.campos.length} campos de la orden`
        : principal.etiqueta,
      previous_value: principal.valorAnterior,
      proposed_value: principal.valorNuevo,
      field_changes: params.campos,
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

  const fila = data as FilaCampo;

  await registrarEventoCampo({
    request_id: fila.id,
    event_type: 'CREATED',
    detail: `Solicitud creada. ${detalleTexto} (entorno ${params.api_env || 'production'})`,
    actor_id: params.requested_by,
    actor_name: params.requested_by_name,
  });

  await notificarNuevaSolicitudCambio({
    tipo: params.tipo,
    orderNumber: params.order_number,
    tradingCompany: params.trading_company,
    solicitanteNombre: params.requested_by_name || '',
    solicitanteId: params.requested_by,
    detalle: detalleTexto,
    apiEnv: params.api_env === 'qa' ? 'qa' : 'production',
    solicitudId: fila.id,
  });

  return mapearCampo(fila);
}

// ─────────────────────────────────────────────────────────────
// APROBACIÓN / RECHAZO
// ─────────────────────────────────────────────────────────────

export interface ResultadoResolucionCambio {
  ok: boolean;
  error?: string;
  // Aviso opcional para mostrar junto al éxito (por ejemplo, un dato omitido).
  advertencia?: string;
}

function campoEditableDeTipo(tipo: TipoCambioOrden): CampoOrdenEditable {
  return tipo === 'incoterm' ? 'incoterm' : 'carga_lista';
}

// Aprueba una solicitud. Si es de ETD delega en el flujo existente; si es de
// campo, revalida el valor vigente en Raga y envía el PUT parcial.
export async function aprobarCambio(params: {
  solicitud: SolicitudCambio;
  aprobadorId: string;
  aprobadorNombre: string;
}): Promise<ResultadoResolucionCambio> {
  const { solicitud, aprobadorId, aprobadorNombre } = params;

  if (solicitud.tipo === 'etd_inicial') {
    const etd = await obtenerSolicitudEtdPorId(solicitud.id);
    if (!etd) return { ok: false, error: 'No se encontró la solicitud de ETD.' };
    return aprobarSolicitudEtd({ solicitud: etd, aprobadorId, aprobadorNombre });
  }

  // 1) Verificar que siga pendiente.
  const { data: actual, error: errorActual } = await supabase
    .from('order_field_change_requests')
    .select('status')
    .eq('id', solicitud.id)
    .maybeSingle();
  if (errorActual) return { ok: false, error: errorActual.message };
  if (!actual || actual.status !== 'PENDING') {
    return { ok: false, error: 'La solicitud ya fue procesada por otro usuario.' };
  }

  const entornoRaga: RagaEnv = solicitud.api_env === 'production' ? 'production' : 'qa';
  const campo = campoEditableDeTipo(solicitud.tipo);

  // 2) Revalidar el valor vigente en Raga antes de escribir.
  const consulta = await buscarPurchaseOrder(solicitud.order_number, entornoRaga);
  if (!consulta.ok) {
    return { ok: false, error: consulta.error || 'No se pudo consultar la PO en Raga para revalidar.' };
  }
  const po = extraerPo(consulta.data, solicitud.order_number, solicitud.trading_company);
  if (!po) return { ok: false, error: 'No se encontró la PO en Raga para revalidar el cambio.' };

  const camposSolicitud = solicitud.campos.filter((c) => c.campo && c.valorNuevo);
  if (camposSolicitud.length === 0) {
    return { ok: false, error: 'La solicitud no tiene campos para actualizar.' };
  }

  // El flag "Carga Lista Validada" se retiró del módulo hasta confirmar el
  // contrato real de Raga. Si una solicitud antigua todavía lo incluye, se omite
  // del envío (el endpoint lo parsea como fecha y devuelve 400) y se informa.
  const camposEnviables = camposSolicitud.filter((c) => !esClaveCargaListaValidada(c.campo));
  const camposOmitidos = camposSolicitud.filter((c) => esClaveCargaListaValidada(c.campo));

  if (camposEnviables.length === 0) {
    return {
      ok: false,
      error: 'Esta solicitud solo incluye "Carga Lista Validada", un dato que todavía no se puede enviar a Raga porque su contrato está pendiente de confirmación. Rechazá la solicitud y volvé a crearla con las fechas.',
    };
  }

  // 3) Revalidar cada campo y enviar un PUT por campo a Raga
  // (único momento en que se modifica la orden).
  const fieldsAEnviar: Record<string, string | boolean> = {};
  const etiquetasCampos: Record<string, string> = {};
  const yaAplicados: string[] = [];
  for (const c of camposEnviables) {
    const claveCampo = c.campo
      || (solicitud.campo_clave && po[solicitud.campo_clave] !== undefined ? solicitud.campo_clave : null)
      || obtenerValorCampo(po, campo)?.clave
      || null;
    if (!claveCampo) {
      return {
        ok: false,
        error: `No se pudo identificar la columna de "${c.etiqueta}" en Raga. Revisá el mapeo del campo antes de aprobar.`,
      };
    }

    const vigente = po[claveCampo] !== undefined
      ? textoValorPo(po[claveCampo])
      : (obtenerValorCampo(po, campo)?.valor || '');

    const nuevoTexto = c.valorNuevo.trim();

    // Si Raga ya tiene el valor propuesto (por ejemplo tras una aprobación
    // parcial), no se vuelve a enviar ese campo.
    if (vigente && normalizarComparable(vigente) === normalizarComparable(nuevoTexto)) {
      yaAplicados.push(c.etiqueta);
      continue;
    }

    if (c.valorAnterior && vigente && normalizarComparable(vigente) !== normalizarComparable(c.valorAnterior)) {
      return {
        ok: false,
        error: `El valor de "${c.etiqueta}" en Raga cambió (${vigente || 'sin valor'}) desde que se creó la solicitud (${c.valorAnterior}). Se requiere revisión antes de aprobar.`,
      };
    }

    fieldsAEnviar[claveCampo] = /^(true|false)$/i.test(nuevoTexto)
      ? nuevoTexto.toLowerCase() === 'true'
      : nuevoTexto;
    etiquetasCampos[claveCampo] = c.etiqueta;
  }

  const resumenCambios = camposEnviables
    .map((c) => `${c.etiqueta}: ${textoDetalleCampo(c.valorAnterior)} → ${textoDetalleCampo(c.valorNuevo)}`)
    .join(' | ');

  const notaOmitidos = camposOmitidos.length > 0
    ? `No se envió a Raga: ${camposOmitidos.map((c) => c.etiqueta).join(', ')} (dato fuera del módulo hasta confirmar el contrato de Raga).`
    : '';

  // Cada campo se envía en una petición independiente a Raga.
  const put = Object.keys(fieldsAEnviar).length > 0
    ? await actualizarCamposCompraRaga({
      orderNumber: solicitud.order_number,
      tradingCompany: solicitud.trading_company,
      fields: fieldsAEnviar,
      etiquetas: etiquetasCampos,
      apiEnv: entornoRaga,
      requestId: solicitud.id,
    })
    : { ok: true, aplicados: [] as string[], fallidos: [] as string[], error: undefined };

  if (!put.ok) {
    const aplicados = put.aplicados.length > 0
      ? `Se actualizaron correctamente: ${put.aplicados.map((k) => etiquetasCampos[k] || k).join(', ')}. `
      : 'No se actualizó ningún dato. ';
    const detalleError = `${aplicados}${put.error || 'La API de Raga falló al actualizar.'}`;
    await supabase
      .from('order_field_change_requests')
      .update({ api_sync_status: 'ERROR', api_sync_error: detalleError, updated_at: new Date().toISOString() })
      .eq('id', solicitud.id);
    await registrarEventoCampo({
      request_id: solicitud.id,
      event_type: 'API_SYNC_ERROR',
      detail: detalleError,
      actor_id: aprobadorId,
      actor_name: aprobadorNombre,
    });
    return {
      ok: false,
      error: `No se pudo actualizar la orden en Raga. ${detalleError} La solicitud sigue pendiente.`,
    };
  }

  // 4) Marcar aprobada solo si sigue pendiente.
  const { data: filas, error: errorUpdate } = await supabase
    .from('order_field_change_requests')
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

  await registrarEventoCampo({
    request_id: solicitud.id,
    event_type: 'APPROVED',
    detail: `Actualizado en Raga (${entornoRaga}). ${resumenCambios}${yaAplicados.length > 0 ? ` (ya tenían el valor pedido: ${yaAplicados.join(', ')})` : ''}${notaOmitidos ? ` ${notaOmitidos}` : ''}`,
    actor_id: aprobadorId,
    actor_name: aprobadorNombre,
  });

  await notificarResultadoCambio({
    usuarioId: solicitud.requested_by,
    poTiquetera: solicitud.order_number,
    tipo: 'cambio_aprobada',
    mensaje: `Tu solicitud de ${TIPOS_CAMBIO[solicitud.tipo].labelCorto} para la PO ${solicitud.order_number} fue aprobada. ${resumenCambios}.${notaOmitidos ? ` ${notaOmitidos}` : ''} Aprobado por: ${aprobadorNombre}.`,
  });

  return { ok: true, advertencia: notaOmitidos || undefined };
}

export async function rechazarCambio(params: {
  solicitud: SolicitudCambio;
  revisorId: string;
  revisorNombre: string;
  comentario: string;
}): Promise<ResultadoResolucionCambio> {
  const { solicitud, revisorId, revisorNombre, comentario } = params;
  const detalle = (comentario || '').trim();
  if (!detalle) return { ok: false, error: 'El comentario de rechazo es obligatorio.' };

  if (solicitud.tipo === 'etd_inicial') {
    const etd = await obtenerSolicitudEtdPorId(solicitud.id);
    if (!etd) return { ok: false, error: 'No se encontró la solicitud de ETD.' };
    return rechazarSolicitudEtd({ solicitud: etd, revisorId, revisorNombre, comentario: detalle });
  }

  const { data: filas, error } = await supabase
    .from('order_field_change_requests')
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

  await registrarEventoCampo({
    request_id: solicitud.id,
    event_type: 'REJECTED',
    detail: detalle,
    actor_id: revisorId,
    actor_name: revisorNombre,
  });

  await notificarResultadoCambio({
    usuarioId: solicitud.requested_by,
    poTiquetera: solicitud.order_number,
    tipo: 'cambio_rechazada',
    mensaje: `Tu solicitud de ${TIPOS_CAMBIO[solicitud.tipo].labelCorto} para la PO ${solicitud.order_number} fue rechazada. Motivo: ${detalle}. Revisado por: ${revisorNombre}.`,
  });

  return { ok: true };
}