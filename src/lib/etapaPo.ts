import { supabase } from './supabase';
import {
  buscarPurchaseOrder,
  extraerPo,
  actualizarEtapaRaga,
  textoValorPo,
  type RagaEnv,
} from './ragaApi';
import { notificarNuevaSolicitudEtapa, notificarResultadoEtapa } from './notificaciones';
import type { EstadoEtd } from './etdMotivos';

// ============================================================
// CAMBIO DE ETAPA (ESTADO DE KANBAN) DE UNA PO
// La etapa se lee de la propia PO que devuelve Raga: no hay una lista
// fija en el código. Si Raga no expone el catálogo en la PO, el módulo
// permite ingresar el identificador de la etapa manualmente.
//
// Flujo: se crea una solicitud PENDING → solo un Administrador la
// aprueba → recién ahí se ejecuta el PUT en Raga (QA o Producción).
// ============================================================

export interface OpcionEtapa {
  /** Valor que se envía a Raga (slug/clave cuando existe). */
  id: string;
  nombre: string;
  /** Identificador interno (numérico) del catálogo, si Raga lo expone. */
  idInterno?: string | null;
}

export interface DeteccionEtapa {
  /** Columna de la PO que guarda la etapa (ej. kanban_status_id). */
  campoEtapa: string | null;
  /** Identificador de la etapa vigente. */
  valorActualId: string | null;
  /** Nombre legible de la etapa vigente. */
  nombreActual: string | null;
  /** Columna (si existe) que trae el catálogo de etapas disponibles. */
  campoLista: string | null;
  opciones: OpcionEtapa[];
  /** Objeto crudo de la etapa, útil para mostrarlo en pantalla. */
  datosCrudos: Record<string, unknown> | null;
}

// Motivos sugeridos para justificar el movimiento de etapa.
export const MOTIVOS_CAMBIO_ETAPA: string[] = [
  'Error en la etapa registrada',
  'Corrección operativa',
  'PO adelantada por el proveedor',
  'PO retrasada por el proveedor',
  'Reasignación de proceso',
  'Otro',
];

// Columnas conocidas que representan la etapa actual.
const CAMPOS_ETAPA_ACTUAL = [
  'kanban_status_id',
  'kanban_status',
  'kanban_status_name',
  'kanban_state_id',
  'kanban_state',
  'estado_kanban_id',
  'estado_kanban',
  'status_id',
  'status',
  'etapa_id',
  'etapa',
];

// Columnas conocidas que pueden traer el catálogo de etapas.
const CAMPOS_LISTA_ETAPA = [
  'kanban_statuses',
  'kanban_status_list',
  'kanban_states',
  'kanban_status_options',
  'kanban_status_catalog',
  'estados_kanban',
  'etapas',
  'statuses',
];

// Raga identifica los estados de kanban con valores legibles tipo
// "po-produccion-1" o "de-ingresada-1" (así aparecen en su comparación de
// cambios), no con el id numérico. Por eso el valor que se envía prioriza el
// slug/clave y deja el id interno solo como respaldo.
const CLAVES_VALOR_ENVIO = ['slug', 'key', 'clave', 'code', 'codigo', 'value', 'id', 'uuid'];
const CLAVES_ID_INTERNO = ['id', 'uuid', 'kanban_status_id', 'status_id'];
const CLAVES_NOMBRE = ['name', 'nombre', 'label', 'titulo', 'title', 'text', 'descripcion', 'description'];

function primerTexto(obj: Record<string, unknown>, claves: string[]): string | null {
  for (const clave of claves) {
    const valor = obj[clave];
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
    if (typeof valor === 'number') return String(valor);
  }
  return null;
}

// Convierte cualquier elemento del catálogo en una opción { id, nombre }.
function normalizarOpcion(item: unknown): OpcionEtapa | null {
  if (item === null || item === undefined) return null;
  if (typeof item === 'string' || typeof item === 'number') {
    const texto = String(item).trim();
    return texto ? { id: texto, nombre: texto } : null;
  }
  if (typeof item !== 'object') return null;

  const obj = item as Record<string, unknown>;
  const idInterno = primerTexto(obj, CLAVES_ID_INTERNO);
  const valor = primerTexto(obj, CLAVES_VALOR_ENVIO);
  const nombre = primerTexto(obj, CLAVES_NOMBRE);
  if (!valor && !idInterno && !nombre) return null;
  const id = valor || idInterno || nombre || '';
  return { id, nombre: nombre || valor || idInterno || id, idInterno };
}

function normalizarLista(valor: unknown): OpcionEtapa[] {
  if (!Array.isArray(valor)) return [];
  const opciones = valor
    .map((item) => normalizarOpcion(item))
    .filter((o): o is OpcionEtapa => Boolean(o && o.id));
  return deduplicar(opciones);
}

function deduplicar(opciones: OpcionEtapa[]): OpcionEtapa[] {
  const mapa = new Map<string, OpcionEtapa>();
  opciones.forEach((o) => {
    const clave = `${o.id}::${o.nombre}`.toLowerCase();
    if (!mapa.has(clave)) mapa.set(clave, o);
  });
  return Array.from(mapa.values());
}

// Busca un catálogo de etapas dentro de la PO, incluso si viene anidado
// dentro de otro objeto (por ejemplo { kanban_status: { id, name, estados: [...] } }).
function buscarListaEtapas(po: Record<string, unknown>): { campo: string | null; opciones: OpcionEtapa[] } {
  for (const clave of CAMPOS_LISTA_ETAPA) {
    const opciones = normalizarLista(po[clave]);
    if (opciones.length > 0) return { campo: clave, opciones };
  }

  // Segundo intento: cualquier arreglo de objetos con id + nombre.
  for (const clave of Object.keys(po)) {
    const opciones = normalizarLista(po[clave]);
    if (opciones.length > 0 && /kanban|etapa|estado|status|stage/i.test(clave)) {
      return { campo: clave, opciones };
    }
  }

  // Tercer intento: revisar un nivel hacia adentro.
  for (const clave of Object.keys(po)) {
    const valor = po[clave];
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) continue;
    const anidado = valor as Record<string, unknown>;
    for (const interna of Object.keys(anidado)) {
      const opciones = normalizarLista(anidado[interna]);
      if (opciones.length > 0) return { campo: `${clave}.${interna}`, opciones };
    }
  }

  return { campo: null, opciones: [] };
}

// Lee la etapa vigente desde la PO devuelta por Raga.
export function detectarEtapa(po: Record<string, any> | null | undefined): DeteccionEtapa {
  const vacio: DeteccionEtapa = {
    campoEtapa: null,
    valorActualId: null,
    nombreActual: null,
    campoLista: null,
    opciones: [],
    datosCrudos: null,
  };
  if (!po || typeof po !== 'object') return vacio;

  const claves = Object.keys(po);
  const lista = buscarListaEtapas(po);

  let campoEtapa: string | null = null;
  let valorActualId: string | null = null;
  let nombreActual: string | null = null;
  let datosCrudos: Record<string, unknown> | null = null;

  for (const candidato of CAMPOS_ETAPA_ACTUAL) {
    const encontrada = claves.find((k) => k.trim().toLowerCase() === candidato);
    if (!encontrada) continue;

    const valor = po[encontrada];
    if (Array.isArray(valor)) continue;

    campoEtapa = encontrada;

    if (valor && typeof valor === 'object') {
      const obj = valor as Record<string, unknown>;
      datosCrudos = obj;
      valorActualId = primerTexto(obj, CLAVES_VALOR_ENVIO);
      nombreActual = primerTexto(obj, CLAVES_NOMBRE);
      if (!nombreActual && valorActualId) {
        const coincidencia = lista.opciones.find(
          (o) => o.id === valorActualId
            || (o.idInterno && o.idInterno === valorActualId)
            || o.nombre.toLowerCase() === valorActualId.toLowerCase()
        );
        if (coincidencia) nombreActual = coincidencia.nombre;
      }
    } else {
      const texto = textoValorPo(valor);
      if (texto) {
        valorActualId = texto;
        const coincidencia = lista.opciones.find(
          (o) => o.id.toLowerCase() === texto.toLowerCase()
            || (o.idInterno && o.idInterno.toLowerCase() === texto.toLowerCase())
            || o.nombre.toLowerCase() === texto.toLowerCase()
        );
        nombreActual = coincidencia ? coincidencia.nombre : texto;
      }
    }
    break;
  }

  // Si no se reconoció por nombre exacto, se busca por patrón.
  if (!campoEtapa) {
    const porPatron = claves.find((k) => {
      const normalizada = k.trim().toLowerCase();
      if (Array.isArray(po[k])) return false;
      return /kanban.*status|status.*kanban|etapa/i.test(normalizada);
    });
    if (porPatron) {
      const valor = po[porPatron];
      campoEtapa = porPatron;
      if (valor && typeof valor === 'object') {
        datosCrudos = valor as Record<string, unknown>;
        valorActualId = primerTexto(datosCrudos, CLAVES_VALOR_ENVIO);
        nombreActual = primerTexto(datosCrudos, CLAVES_NOMBRE);
      } else {
        valorActualId = textoValorPo(valor) || null;
        nombreActual = valorActualId;
      }
    }
  }

  // Completa el nombre si solo se tiene el id.
  if (valorActualId && !nombreActual) {
    const coincidencia = lista.opciones.find((o) => o.id === valorActualId);
    if (coincidencia) nombreActual = coincidencia.nombre;
  }

  return {
    campoEtapa,
    valorActualId,
    nombreActual,
    campoLista: lista.campo,
    opciones: lista.opciones,
    datosCrudos,
  };
}

function normalizarComparable(valor: string | null | undefined): string {
  return (valor || '').trim().toLowerCase();
}

// ¿La etapa vigente en Raga coincide con la registrada al crear la solicitud?
function etapaSinCambios(deteccion: DeteccionEtapa, solicitud: SolicitudEtapa): boolean {
  const idGuardado = normalizarComparable(solicitud.etapa_actual_id);
  const nombreGuardado = normalizarComparable(solicitud.etapa_actual_nombre);
  const idActual = normalizarComparable(deteccion.valorActualId);
  const nombreActual = normalizarComparable(deteccion.nombreActual);

  if (idGuardado && idActual) return idGuardado === idActual;
  if (nombreGuardado && nombreActual) return nombreGuardado === nombreActual;
  return true;
}

// ─────────────────────────────────────────────────────────────
// TIPOS DE LA SOLICITUD
// ─────────────────────────────────────────────────────────────

export interface SolicitudEtapa {
  id: string;
  order_number: string;
  trading_company: string;
  campo_etapa: string;
  etapa_actual_id: string | null;
  etapa_actual_nombre: string | null;
  etapa_nueva_id: string;
  etapa_nueva_nombre: string;
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

export interface EventoEtapa {
  id: string;
  request_id: string;
  event_type: string;
  detail: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// LECTURA
// ─────────────────────────────────────────────────────────────

export async function listarSolicitudesEtapa(opts?: {
  incluirQa?: boolean;
  status?: EstadoEtd;
}): Promise<SolicitudEtapa[]> {
  let query = supabase.from('po_etapa_change_requests').select('*');
  if (!opts?.incluirQa) query = query.eq('api_env', 'production');
  if (opts?.status) query = query.eq('status', opts.status);
  const { data, error } = await query.order('requested_at', { ascending: false });
  if (error) throw error;
  return (data || []) as SolicitudEtapa[];
}

export async function contarPendientesEtapa(incluirQa = false): Promise<number> {
  let query = supabase
    .from('po_etapa_change_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');
  if (!incluirQa) query = query.eq('api_env', 'production');
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function obtenerSolicitudEtapaPorId(id: string): Promise<SolicitudEtapa | null> {
  const { data, error } = await supabase
    .from('po_etapa_change_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as SolicitudEtapa) || null;
}

export async function listarEventosEtapa(requestId: string): Promise<EventoEtapa[]> {
  const { data, error } = await supabase
    .from('po_etapa_change_events')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as EventoEtapa[];
}

export async function obtenerPendienteEtapa(
  orderNumber: string,
  tradingCompany: string,
  apiEnv: RagaEnv = 'production'
): Promise<SolicitudEtapa | null> {
  const { data, error } = await supabase
    .from('po_etapa_change_requests')
    .select('*')
    .eq('order_number', orderNumber)
    .eq('trading_company', tradingCompany)
    .eq('status', 'PENDING')
    .eq('api_env', apiEnv)
    .maybeSingle();
  if (error) throw error;
  return (data as SolicitudEtapa) || null;
}

// ─────────────────────────────────────────────────────────────
// ESCRITURA
// ─────────────────────────────────────────────────────────────

async function registrarEventoEtapa(params: {
  request_id: string;
  event_type: string;
  detail?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('po_etapa_change_events').insert([{
    request_id: params.request_id,
    event_type: params.event_type,
    detail: params.detail ?? null,
    actor_id: params.actor_id ?? null,
    actor_name: params.actor_name ?? null,
  }]);
  if (error) console.error('[Etapa PO] Error registrando evento:', error.message);
}

export interface CrearSolicitudEtapaParams {
  order_number: string;
  trading_company: string;
  campo_etapa: string;
  etapa_actual_id: string | null;
  etapa_actual_nombre: string | null;
  etapa_nueva_id: string;
  etapa_nueva_nombre: string;
  change_reason: string;
  other_reason_detail?: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  api_env?: RagaEnv;
}

// Crea la solicitud PENDING. NO modifica nada en Raga.
export async function crearSolicitudEtapa(params: CrearSolicitudEtapaParams): Promise<SolicitudEtapa> {
  const { data, error } = await supabase
    .from('po_etapa_change_requests')
    .insert([{
      order_number: params.order_number,
      trading_company: params.trading_company,
      campo_etapa: params.campo_etapa || 'kanban_status_id',
      etapa_actual_id: params.etapa_actual_id,
      etapa_actual_nombre: params.etapa_actual_nombre,
      etapa_nueva_id: params.etapa_nueva_id,
      etapa_nueva_nombre: params.etapa_nueva_nombre,
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

  const fila = data as SolicitudEtapa;

  await registrarEventoEtapa({
    request_id: fila.id,
    event_type: 'CREATED',
    detail: `Solicitud creada. Etapa: ${params.etapa_actual_nombre || params.etapa_actual_id || 'sin etapa'} → ${params.etapa_nueva_nombre} (entorno ${params.api_env || 'production'})`,
    actor_id: params.requested_by,
    actor_name: params.requested_by_name,
  });

  await notificarNuevaSolicitudEtapa({
    orderNumber: params.order_number,
    tradingCompany: params.trading_company,
    solicitanteNombre: params.requested_by_name || '',
    solicitanteId: params.requested_by,
    etapaAnterior: params.etapa_actual_nombre || params.etapa_actual_id || 'sin etapa',
    etapaNueva: params.etapa_nueva_nombre,
    apiEnv: params.api_env === 'qa' ? 'qa' : 'production',
    solicitudId: fila.id,
  });

  return fila;
}

export interface ResultadoResolucionEtapa {
  ok: boolean;
  error?: string;
}

// Aprueba: revalida la etapa vigente, ejecuta el PUT y solo entonces marca APROBADA.
export async function aprobarSolicitudEtapa(params: {
  solicitud: SolicitudEtapa;
  aprobadorId: string;
  aprobadorNombre: string;
}): Promise<ResultadoResolucionEtapa> {
  const { solicitud, aprobadorId, aprobadorNombre } = params;

  // 1) Sigue pendiente.
  const { data: actual, error: errorActual } = await supabase
    .from('po_etapa_change_requests')
    .select('status')
    .eq('id', solicitud.id)
    .maybeSingle();
  if (errorActual) return { ok: false, error: errorActual.message };
  if (!actual || actual.status !== 'PENDING') {
    return { ok: false, error: 'La solicitud ya fue procesada por otro usuario.' };
  }

  const entornoRaga: RagaEnv = solicitud.api_env === 'production' ? 'production' : 'qa';

  // 2) Revalidar la PO y su etapa vigente.
  const consulta = await buscarPurchaseOrder(solicitud.order_number, entornoRaga);
  if (!consulta.ok) {
    return { ok: false, error: consulta.error || 'No se pudo consultar la PO en Raga para revalidar la etapa.' };
  }
  const po = extraerPo(consulta.data, solicitud.order_number, solicitud.trading_company);
  if (!po) return { ok: false, error: 'No se encontró la PO en Raga para revalidar la etapa.' };

  const deteccion = detectarEtapa(po);

  if (!etapaSinCambios(deteccion, solicitud)) {
    return {
      ok: false,
      error: `La etapa en Raga cambió (${deteccion.nombreActual || deteccion.valorActualId || 'sin etapa'}) desde que se creó la solicitud (${solicitud.etapa_actual_nombre || solicitud.etapa_actual_id || 'sin etapa'}). Revisá antes de aprobar.`,
    };
  }

  // Si Raga ya está en la etapa destino, se marca aprobada sin enviar de nuevo.
  const yaEnDestino =
    normalizarComparable(deteccion.valorActualId) === normalizarComparable(solicitud.etapa_nueva_id)
    || (Boolean(deteccion.nombreActual) && normalizarComparable(deteccion.nombreActual) === normalizarComparable(solicitud.etapa_nueva_nombre));

  if (!yaEnDestino) {
    const campo = solicitud.campo_etapa || deteccion.campoEtapa || 'kanban_status_id';
    const put = await actualizarEtapaRaga({
      orderNumber: solicitud.order_number,
      tradingCompany: solicitud.trading_company,
      fieldKey: campo,
      statusValue: solicitud.etapa_nueva_id,
      statusName: solicitud.etapa_nueva_nombre,
      apiEnv: entornoRaga,
      requestId: solicitud.id,
    });

    // El backend solo responde ok cuando releyó la PO y la etapa cambió de
    // verdad. Si Raga aceptó el PUT pero no movió el kanban, la solicitud
    // queda PENDIENTE con el detalle de los intentos.
    if (!put.ok) {
      const detalle = put.error || 'La API de Raga rechazó el cambio de etapa.';
      await supabase
        .from('po_etapa_change_requests')
        .update({ api_sync_status: 'ERROR', api_sync_error: detalle, updated_at: new Date().toISOString() })
        .eq('id', solicitud.id);
      await registrarEventoEtapa({
        request_id: solicitud.id,
        event_type: 'API_SYNC_ERROR',
        detail: detalle,
        actor_id: aprobadorId,
        actor_name: aprobadorNombre,
      });
      return { ok: false, error: detalle };
    }
  }

  // 3) Marcar APROBADA solo si sigue pendiente.
  const { data: filas, error: errorUpdate } = await supabase
    .from('po_etapa_change_requests')
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

  await registrarEventoEtapa({
    request_id: solicitud.id,
    event_type: 'APPROVED',
    detail: yaEnDestino
      ? `Raga ya tenía la etapa ${solicitud.etapa_nueva_nombre} (${entornoRaga}); no se envió un nuevo cambio.`
      : `Etapa actualizada en Raga (${entornoRaga}) a ${solicitud.etapa_nueva_nombre}`,
    actor_id: aprobadorId,
    actor_name: aprobadorNombre,
  });

  await notificarResultadoEtapa({
    usuarioId: solicitud.requested_by,
    poTiquetera: solicitud.order_number,
    tipo: 'etapa_aprobada',
    mensaje: `Tu solicitud de cambio de etapa para la PO ${solicitud.order_number} fue aprobada. Nueva etapa: ${solicitud.etapa_nueva_nombre}. Aprobado por: ${aprobadorNombre}.`,
  });

  return { ok: true };
}

// Rechaza con comentario obligatorio. NUNCA ejecuta el PUT en Raga.
export async function rechazarSolicitudEtapa(params: {
  solicitud: SolicitudEtapa;
  revisorId: string;
  revisorNombre: string;
  comentario: string;
}): Promise<ResultadoResolucionEtapa> {
  const { solicitud, revisorId, revisorNombre, comentario } = params;
  const detalle = (comentario || '').trim();
  if (!detalle) return { ok: false, error: 'El comentario de rechazo es obligatorio.' };

  const { data: filas, error } = await supabase
    .from('po_etapa_change_requests')
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

  await registrarEventoEtapa({
    request_id: solicitud.id,
    event_type: 'REJECTED',
    detail: detalle,
    actor_id: revisorId,
    actor_name: revisorNombre,
  });

  await notificarResultadoEtapa({
    usuarioId: solicitud.requested_by,
    poTiquetera: solicitud.order_number,
    tipo: 'etapa_rechazada',
    mensaje: `Tu solicitud de cambio de etapa para la PO ${solicitud.order_number} fue rechazada. Motivo: ${detalle}. Revisado por: ${revisorNombre}.`,
  });

  return { ok: true };
}