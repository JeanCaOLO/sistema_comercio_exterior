import { supabase } from './supabase';
import { buscarPurchaseOrder, actualizarEtdInicialRaga, extraerPo, normalizarFecha, type RagaEnv } from './ragaApi';
import { notificarResultadoEtd, notificarNuevaSolicitudEtd } from './notificaciones';
import type { EstadoEtd } from './etdMotivos';

export type { EstadoEtd };

// Único perfil autorizado a ver y operar el entorno QA de Raga.
export const EMAIL_VE_QA_ETD = 'jalvarez@ologistics.com';

export function puedeVerQaEtd(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === EMAIL_VE_QA_ETD;
}

export interface SolicitudEtd {
  id: string;
  order_number: string;
  trading_company: string;
  previous_etd_initial: string | null;
  proposed_etd_initial: string;
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

export interface EventoEtd {
  id: string;
  request_id: string;
  event_type: string;
  detail: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface CrearSolicitudEtdParams {
  order_number: string;
  trading_company: string;
  previous_etd_initial: string | null;
  proposed_etd_initial: string;
  change_reason: string;
  other_reason_detail?: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  api_env?: RagaEnv;
}

// Diferencia en días entre dos fechas (b - a), redondeada.
export function diferenciaDias(desde: string | null | undefined, hasta: string | null | undefined): number | null {
  const a = normalizarFecha(desde);
  const b = normalizarFecha(hasta);
  if (!a || !b) return null;
  const fechaA = new Date(`${a}T00:00:00`);
  const fechaB = new Date(`${b}T00:00:00`);
  return Math.round((fechaB.getTime() - fechaA.getTime()) / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────────────────────
// LECTURA
// ─────────────────────────────────────────────────────────────

export async function listarSolicitudesEtd(opts?: { incluirQa?: boolean }): Promise<SolicitudEtd[]> {
  let query = supabase
    .from('etd_initial_change_requests')
    .select('*');
  // El entorno QA solo es visible para el perfil autorizado.
  if (!opts?.incluirQa) query = query.eq('api_env', 'production');
  const { data, error } = await query.order('requested_at', { ascending: false });
  if (error) throw error;
  return (data || []) as SolicitudEtd[];
}

export async function listarSolicitudesPendientesEtd(opts?: { incluirQa?: boolean }): Promise<SolicitudEtd[]> {
  let query = supabase
    .from('etd_initial_change_requests')
    .select('*')
    .eq('status', 'PENDING');
  if (!opts?.incluirQa) query = query.eq('api_env', 'production');
  const { data, error } = await query.order('requested_at', { ascending: false });
  if (error) throw error;
  return (data || []) as SolicitudEtd[];
}

export async function contarSolicitudesPendientesEtd(opts?: { incluirQa?: boolean }): Promise<number> {
  let query = supabase
    .from('etd_initial_change_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');
  if (!opts?.incluirQa) query = query.eq('api_env', 'production');
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

// Trae una solicitud por su ID (se usa al abrir una notificación concreta).
export async function obtenerSolicitudEtdPorId(id: string): Promise<SolicitudEtd | null> {
  const { data, error } = await supabase
    .from('etd_initial_change_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as SolicitudEtd) || null;
}

export async function listarEventosEtd(requestId: string): Promise<EventoEtd[]> {
  const { data, error } = await supabase
    .from('etd_initial_change_events')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as EventoEtd[];
}

// Busca una solicitud pendiente para evitar duplicados sobre la misma PO + compañía.
export async function obtenerSolicitudPendienteEtd(
  orderNumber: string,
  tradingCompany: string,
  apiEnv: RagaEnv = 'production'
): Promise<SolicitudEtd | null> {
  const { data, error } = await supabase
    .from('etd_initial_change_requests')
    .select('*')
    .eq('order_number', orderNumber)
    .eq('trading_company', tradingCompany)
    .eq('status', 'PENDING')
    .eq('api_env', apiEnv)
    .maybeSingle();
  if (error) throw error;
  return (data as SolicitudEtd) || null;
}

// ─────────────────────────────────────────────────────────────
// ESCRITURA
// ─────────────────────────────────────────────────────────────

export async function registrarEventoEtd(params: {
  request_id: string;
  event_type: string;
  detail?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('etd_initial_change_events').insert([{
    request_id: params.request_id,
    event_type: params.event_type,
    detail: params.detail ?? null,
    actor_id: params.actor_id ?? null,
    actor_name: params.actor_name ?? null,
  }]);
  if (error) console.error('[ETD] Error registrando evento:', error.message);
}

// Crea una nueva solicitud en estado PENDING. NO modifica nada en Raga.
export async function crearSolicitudEtd(params: CrearSolicitudEtdParams): Promise<SolicitudEtd> {
  const { data, error } = await supabase
    .from('etd_initial_change_requests')
    .insert([{
      order_number: params.order_number,
      trading_company: params.trading_company,
      previous_etd_initial: params.previous_etd_initial,
      proposed_etd_initial: params.proposed_etd_initial,
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

  await registrarEventoEtd({
    request_id: data.id,
    event_type: 'CREATED',
    detail: `Solicitud creada. ETD Inicial propuesto: ${params.proposed_etd_initial} (entorno ${params.api_env || 'production'})`,
    actor_id: params.requested_by,
    actor_name: params.requested_by_name,
  });

  // Aviso en la campanita: únicamente los administradores reciben la notificación
  // de que existe una nueva solicitud pendiente de aprobación.
  await notificarNuevaSolicitudEtd({
    orderNumber: params.order_number,
    tradingCompany: params.trading_company,
    solicitanteNombre: params.requested_by_name || '',
    solicitanteId: params.requested_by,
    propuestoEtd: params.proposed_etd_initial,
    apiEnv: params.api_env === 'qa' ? 'qa' : 'production',
    solicitudId: data.id,
  });

  return data as SolicitudEtd;
}

// ─────────────────────────────────────────────────────────────
// APROBACIÓN / RECHAZO (con revalidación y sincronización con Raga)
// ─────────────────────────────────────────────────────────────

export interface ResultadoResolucionEtd {
  ok: boolean;
  error?: string;
}

// Aprueba una solicitud: revalida, ejecuta el PUT en Raga y solo entonces marca APROBADA.
export async function aprobarSolicitudEtd(params: {
  solicitud: SolicitudEtd;
  aprobadorId: string;
  aprobadorNombre: string;
}): Promise<ResultadoResolucionEtd> {
  const { solicitud, aprobadorId, aprobadorNombre } = params;

  // 1) Verificar que siga pendiente.
  const { data: actual, error: errorActual } = await supabase
    .from('etd_initial_change_requests')
    .select('status')
    .eq('id', solicitud.id)
    .maybeSingle();
  if (errorActual) return { ok: false, error: errorActual.message };
  if (!actual || actual.status !== 'PENDING') {
    return { ok: false, error: 'La solicitud ya fue procesada por otro usuario.' };
  }

  // 2) Revalidar el ETD Inicial vigente contra Raga (mismo entorno de la solicitud).
  const entornoRaga: RagaEnv = solicitud.api_env === 'production' ? 'production' : 'qa';
  const consulta = await buscarPurchaseOrder(solicitud.order_number, entornoRaga);
  if (!consulta.ok) {
    return { ok: false, error: consulta.error || 'No se pudo consultar la PO en Raga para revalidar.' };
  }
  const poActual = extraerPo(consulta.data, solicitud.order_number, solicitud.trading_company);
  if (!poActual) {
    return { ok: false, error: 'No se encontró la PO en Raga para revalidar el ETD Inicial.' };
  }
  const etdVigente = normalizarFecha(poActual.date_etd_initial ?? poActual.etd_initial);
  const etdPrevioSolicitud = normalizarFecha(solicitud.previous_etd_initial);
  if (etdVigente && etdPrevioSolicitud && etdVigente !== etdPrevioSolicitud) {
    return {
      ok: false,
      error: `El ETD Inicial en Raga cambió (${etdVigente}) desde que se creó la solicitud (${etdPrevioSolicitud}). Se requiere revisión antes de aprobar.`,
    };
  }

  // 3) Ejecutar el PUT en Raga (único momento en que se modifica el ETD Inicial).
  const put = await actualizarEtdInicialRaga({
    orderNumber: solicitud.order_number,
    tradingCompany: solicitud.trading_company,
    dateEtdInitial: normalizarFecha(solicitud.proposed_etd_initial),
    apiEnv: entornoRaga,
    requestId: solicitud.id,
  });
  if (!put.ok) {
    await supabase
      .from('etd_initial_change_requests')
      .update({ api_sync_status: 'ERROR', api_sync_error: put.error || 'Error de sincronización', updated_at: new Date().toISOString() })
      .eq('id', solicitud.id);
    await registrarEventoEtd({
      request_id: solicitud.id,
      event_type: 'API_SYNC_ERROR',
      detail: put.error || 'Error al actualizar en Raga',
      actor_id: aprobadorId,
      actor_name: aprobadorNombre,
    });
    return { ok: false, error: put.error || 'La API de Raga falló al actualizar. La solicitud NO se marcó como aprobada.' };
  }

  // 4) Marcar APROBADA solo si sigue pendiente (evita doble aprobación concurrente).
  const { data: filas, error: errorUpdate } = await supabase
    .from('etd_initial_change_requests')
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

  await registrarEventoEtd({
    request_id: solicitud.id,
    event_type: 'APPROVED',
    detail: `ETD Inicial actualizado en Raga (${entornoRaga}) a ${normalizarFecha(solicitud.proposed_etd_initial)}`,
    actor_id: aprobadorId,
    actor_name: aprobadorNombre,
  });

  await notificarResultadoEtd({
    usuarioId: solicitud.requested_by,
    poTiquetera: solicitud.order_number,
    tipo: 'etd_aprobada',
    icono: 'ri-checkbox-circle-line',
    mensaje: `Tu solicitud de cambio de ETD Inicial para la PO ${solicitud.order_number} fue aprobada. Nueva fecha: ${normalizarFecha(solicitud.proposed_etd_initial)}. Aprobado por: ${aprobadorNombre}.`,
  });

  return { ok: true };
}

// Rechaza una solicitud con comentario obligatorio. NUNCA ejecuta el PUT en Raga.
export async function rechazarSolicitudEtd(params: {
  solicitud: SolicitudEtd;
  revisorId: string;
  revisorNombre: string;
  comentario: string;
}): Promise<ResultadoResolucionEtd> {
  const { solicitud, revisorId, revisorNombre, comentario } = params;
  const detalle = (comentario || '').trim();
  if (!detalle) return { ok: false, error: 'El comentario de rechazo es obligatorio.' };

  const { data: filas, error } = await supabase
    .from('etd_initial_change_requests')
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

  await registrarEventoEtd({
    request_id: solicitud.id,
    event_type: 'REJECTED',
    detail: detalle,
    actor_id: revisorId,
    actor_name: revisorNombre,
  });

  await notificarResultadoEtd({
    usuarioId: solicitud.requested_by,
    poTiquetera: solicitud.order_number,
    tipo: 'etd_rechazada',
    icono: 'ri-close-circle-line',
    mensaje: `Tu solicitud de cambio de ETD Inicial para la PO ${solicitud.order_number} fue rechazada. Motivo: ${detalle}. Revisado por: ${revisorNombre}.`,
  });

  return { ok: true };
}