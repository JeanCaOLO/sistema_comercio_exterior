import { supabase } from './supabase';
import { getEmailsRuta } from './rutas';
import { buscarUsuariosPorEmails } from './usuarios';
import { formatearFechaCorta } from './fechas';

export interface Notificacion {
  id: string;
  usuario_id: string;
  mensaje: string;
  tipo: string;
  expediente_id: string | null;
  po_tiquetera: string | null;
  usuario_genero: string;
  icono: string;
  leida: boolean;
  created_at: string;
}

interface CrearNotificacionParams {
  poTiquetera: string;
  solicitante: string;
  responsable: string;
  usuarioGenero: string;
  tipo: string;
  mensaje: string;
  icono?: string;
  expedienteId?: string;
}

// Usuarios que SIEMPRE reciben todas las notificaciones (de todo)
export const EMAILS_NOTIFICACION_GLOBAL = [
  'jmora@ologistics.com',
  'jalvarez@ologistics.com',
];

// Usuarios que NO reciben notificaciones tipo toast (sí reciben las normales en la campana)
export const EMAILS_SIN_TOAST = [
  'smcdonald@ologistics.com',
  'lchavala@ologistics.com',
  'jmora@ologistics.com',
  'jalvarez@ologistics.com',
];

// Roles considerados administradores (se comparan normalizados, sin importar
// mayúsculas, espacios ni separadores).
const ROLES_ADMIN = ['admin', 'administrador'];

// Indica si el listado de roles corresponde a un administrador.
export function esRolAdministrador(roles?: string[] | null): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((rol) => {
    const normalizado = (rol || '').trim().toLowerCase().replace(/[_-]/g, ' ');
    if (!normalizado) return false;
    return ROLES_ADMIN.some((admin) => normalizado === admin || normalizado.includes(admin));
  });
}

// Regla centralizada de los avisos emergentes (toasts):
// los administradores y los correos de la lista no reciben toasts,
// pero sí conservan todas sus notificaciones en la campana.
export function debeSilenciarToast(email?: string | null, roles?: string[] | null): boolean {
  const correo = (email || '').trim().toLowerCase();
  if (correo && EMAILS_SIN_TOAST.includes(correo)) return true;
  return esRolAdministrador(roles);
}

// Mapa de rutas logísticas → usuario(s) a notificar al cargar un documento + PO en Carga CAA
export function getEmailsRutaCAA(ruta: string): string[] {
  switch (ruta) {
    case 'Directo VE - FEBECA':
    case 'Directo VE - EPA VE':
      return ['nherrera@ologistics.com'];
    case 'Directo GT - EPA GT':
    case 'Directo SV - EPA SV':
    case 'GL GT - EPA GT':
    case 'GL SV - EPA SV':
      return ['kcortesm@ologistics.com'];
    case 'Directo CR - EPA CR':
    case 'Directo CR - CONSORCIO':
      return ['jchavarrias@ologistics.com'];
    case 'ZF - OVERSEAS':
      return ['scambronero@ologistics.com'];
    default:
      return [];
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `Hace ${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
}

export { timeAgo };

export async function crearNotificacion({
  poTiquetera,
  solicitante,
  responsable,
  usuarioGenero,
  tipo,
  mensaje,
  icono = 'ri-file-add-line',
  expedienteId
}: CrearNotificacionParams): Promise<void> {
  try {
    const nombresUnicos = [...new Set([solicitante, responsable].filter(Boolean))];

    // 1) Destinatarios por nombre (solicitante / responsable)
    let usuariosPorNombre: { id: string; nombre: string }[] = [];
    if (nombresUnicos.length > 0) {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .in('nombre', nombresUnicos);
      usuariosPorNombre = data || [];
    }

    // 2) Destinatarios globales: siempre reciben todo
    const { data: usuariosGlobales } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .in('email', EMAILS_NOTIFICACION_GLOBAL);

    const usuarios = [...usuariosPorNombre, ...(usuariosGlobales || [])];
    const unicos = Array.from(new Map(usuarios.map((u) => [u.id, u])).values());

    if (unicos.length === 0) return;

    const notificaciones = unicos.map((u) => ({
      usuario_id: u.id,
      mensaje,
      tipo,
      expediente_id: expedienteId || null,
      po_tiquetera: poTiquetera,
      usuario_genero: usuarioGenero,
      icono,
    }));

    const { error } = await supabase.from('notificaciones').insert(notificaciones);
    if (error) console.error('[Notificaciones] Error al insertar:', error.message);
  } catch (err: any) {
    console.error('[Notificaciones] Error:', err.message || err);
  }
}

interface NotificarCargaCAAParams {
  ruta: string;
  poTiquetera: string;
  usuarioGenero: string;
  tipoModulo: 'dropship' | 'zf';
  totalDocumentos: number;
}

// Notifica al responsable de la ruta cuando se carga un documento + PO en el módulo Carga CAA
export async function notificarCargaCAA({
  ruta,
  poTiquetera,
  usuarioGenero,
  tipoModulo,
  totalDocumentos,
}: NotificarCargaCAAParams): Promise<void> {
  try {
    // Primero respeta los correos configurados en la ruta (Configuración → Rutas).
    // Si la ruta no tiene correos configurados, cae al mapa por defecto.
    let emailsRuta = await getEmailsRuta(ruta);
    if (emailsRuta.length === 0) {
      emailsRuta = getEmailsRutaCAA(ruta);
    }
    if (emailsRuta.length === 0) return;

    // Match tolerante a mayúsculas/minúsculas: el correo configurado en la ruta
    // debe corresponder a un usuario registrado para poder notificarle.
    const usuarios = await buscarUsuariosPorEmails(emailsRuta);

    if (usuarios.length === 0) {
      console.warn(
        `[Notificaciones] Ningún usuario registrado coincide con los correos de la ruta "${ruta}". Correos configurados: ${emailsRuta.join(', ')}`
      );
      return;
    }

    const emailsEncontrados = new Set(usuarios.map((u) => (u.email || '').trim().toLowerCase()));
    const emailsSinUsuario = emailsRuta.filter((e) => !emailsEncontrados.has(e.trim().toLowerCase()));
    if (emailsSinUsuario.length > 0) {
      console.warn(
        `[Notificaciones] Correos de la ruta "${ruta}" sin usuario registrado (no recibirán notificación): ${emailsSinUsuario.join(', ')}`
      );
    }

    const moduloLabel = tipoModulo === 'dropship' ? 'Dropship' : 'ZF';
    const mensaje = `Nueva carga CAA en la ruta ${ruta} (${moduloLabel}): ${totalDocumentos} documento(s) para las POs ${poTiquetera}`;

    const notificaciones = usuarios.map((u) => ({
      usuario_id: u.id,
      mensaje,
      tipo: 'carga_caa',
      expediente_id: null,
      po_tiquetera: poTiquetera,
      usuario_genero: usuarioGenero,
      icono: 'ri-file-upload-line',
    }));

    const { error } = await supabase.from('notificaciones').insert(notificaciones);
    if (error) console.error('[Notificaciones] Error al insertar (Carga CAA):', error.message);
  } catch (err: any) {
    console.error('[Notificaciones] Error (Carga CAA):', err.message || err);
  }
}

interface NotificarComentarioParams {
  poTiquetera: string;
  solicitante: string;
  responsable: string;
  usuarioGenero: string;
  expedienteId?: string;
  textoComentario: string;
}

// Notifica al solicitante, responsable y administradores cuando se agrega o
// modifica un comentario/observación en un ticket o documento.
export async function notificarComentario({
  poTiquetera,
  solicitante,
  responsable,
  usuarioGenero,
  expedienteId,
  textoComentario,
}: NotificarComentarioParams): Promise<void> {
  try {
    const detalle = textoComentario.trim();
    const detalleCorto = detalle.length > 140 ? `${detalle.substring(0, 140)}…` : detalle;
    const mensaje = detalleCorto
      ? `Nuevo comentario en ${poTiquetera}: "${detalleCorto}"`
      : `Nuevo comentario en ${poTiquetera}`;

    // 1) Destinatarios por nombre (solicitante / responsable)
    const nombresUnicos = [...new Set([solicitante, responsable].filter(Boolean))];
    let usuariosPorNombre: { id: string; nombre: string }[] = [];
    if (nombresUnicos.length > 0) {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .in('nombre', nombresUnicos);
      usuariosPorNombre = data || [];
    }

    // 2) Admins por rol (Administrador / admin)
    const { data: usuariosAdmin } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .or('rol.ilike.%Administrador%,rol.ilike.%admin%');

    // 3) Admins globales (siempre reciben todo)
    const { data: usuariosGlobales } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .in('email', EMAILS_NOTIFICACION_GLOBAL);

    const usuarios = [
      ...usuariosPorNombre,
      ...(usuariosAdmin || []),
      ...(usuariosGlobales || []),
    ];
    const unicos = Array.from(new Map(usuarios.map((u) => [u.id, u])).values());

    if (unicos.length === 0) return;

    const notificaciones = unicos.map((u) => ({
      usuario_id: u.id,
      mensaje,
      tipo: 'comentario_agregado',
      expediente_id: expedienteId || null,
      po_tiquetera: poTiquetera,
      usuario_genero: usuarioGenero,
      icono: 'ri-chat-3-line',
    }));

    const { error } = await supabase.from('notificaciones').insert(notificaciones);
    if (error) console.error('[Notificaciones] Error al insertar (comentario):', error.message);
  } catch (err: any) {
    console.error('[Notificaciones] Error (comentario):', err.message || err);
  }
}

interface NotificarResultadoEtdParams {
  usuarioId: string | null;
  poTiquetera: string;
  mensaje: string;
  tipo: 'etd_aprobada' | 'etd_rechazada';
  icono: string;
}

// Notifica al solicitante cuando su solicitud de cambio de ETD Inicial se resuelve.
export async function notificarResultadoEtd({
  usuarioId,
  poTiquetera,
  mensaje,
  tipo,
  icono,
}: NotificarResultadoEtdParams): Promise<void> {
  if (!usuarioId) return;
  try {
    const { error } = await supabase.from('notificaciones').insert([{
      usuario_id: usuarioId,
      mensaje,
      tipo,
      expediente_id: null,
      po_tiquetera: poTiquetera,
      usuario_genero: 'Sistema',
      icono,
      leida: false,
    }]);
    if (error) console.error('[Notificaciones] Error al insertar (ETD):', error.message);
  } catch (err: any) {
    console.error('[Notificaciones] Error (ETD):', err.message || err);
  }
}

// ============================================================
// NUEVA SOLICITUD DE CAMBIO DE ETD INICIAL
// Solo los administradores reciben este aviso (nada de otros perfiles).
// ============================================================

// Devuelve los usuarios con rol de administrador, ya sea por la columna
// usuarios.rol o por la asignación de roles (usuario_roles → roles).
async function obtenerAdministradores(): Promise<{ id: string; nombre: string }[]> {
  const acumulados: { id: string; nombre: string }[] = [];

  // 1) Rol declarado directamente en el usuario
  const { data: porColumna, error: errorColumna } = await supabase
    .from('usuarios')
    .select('id, nombre, rol')
    .ilike('rol', '%admin%');
  if (!errorColumna && porColumna) {
    acumulados.push(...porColumna.map((u: any) => ({ id: u.id, nombre: u.nombre })));
  }

  // 2) Rol asignado por la tabla de roles
  const { data: rolesAdmin, error: errorRoles } = await supabase
    .from('roles')
    .select('id')
    .ilike('nombre', '%admin%');
  if (!errorRoles && rolesAdmin && rolesAdmin.length > 0) {
    const { data: asignaciones } = await supabase
      .from('usuario_roles')
      .select('usuario_id')
      .in('rol_id', rolesAdmin.map((r: any) => r.id));
    const ids = [...new Set((asignaciones || []).map((a: any) => a.usuario_id).filter(Boolean))];
    if (ids.length > 0) {
      const { data: usuarios } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .in('id', ids);
      acumulados.push(...(usuarios || []).map((u: any) => ({ id: u.id, nombre: u.nombre })));
    }
  }

  return Array.from(new Map(acumulados.map((u) => [u.id, u])).values());
}

interface NotificarNuevaSolicitudEtdParams {
  orderNumber: string;
  tradingCompany: string;
  solicitanteNombre: string;
  solicitanteId?: string | null;
  propuestoEtd: string;
  apiEnv: 'production' | 'qa';
  solicitudId?: string | null;
}

// Avisa únicamente a los administradores que existe una nueva solicitud
// de cambio de ETD Inicial pendiente de aprobación.
export async function notificarNuevaSolicitudEtd({
  orderNumber,
  tradingCompany,
  solicitanteNombre,
  solicitanteId,
  propuestoEtd,
  apiEnv,
  solicitudId,
}: NotificarNuevaSolicitudEtdParams): Promise<void> {
  try {
    let destinatarios = await obtenerAdministradores();

    // Las solicitudes de QA son exclusivas del perfil autorizado: no se
    // avisa a los demás administradores para no mezclar entornos.
    if (apiEnv === 'qa') {
      const { data: autorizados } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .in('email', ['jalvarez@ologistics.com']);
      destinatarios = (autorizados || []).map((u: any) => ({ id: u.id, nombre: u.nombre }));
    }

    // El solicitante ya sabe que la creó: no se auto-notifica.
    const finales = destinatarios.filter((u) => u.id !== solicitanteId);
    if (finales.length === 0) return;

    const etdTexto = propuestoEtd ? formatearFechaCorta(propuestoEtd) : propuestoEtd;
    const prefijo = apiEnv === 'qa' ? '[QA] ' : '';
    const mensaje =
      `${prefijo}Nueva solicitud de cambio de ETD Inicial para la PO ${orderNumber}` +
      `${tradingCompany ? ` (${tradingCompany})` : ''}. ` +
      `Nuevo ETD propuesto: ${etdTexto || '—'}. ` +
      `Solicitado por: ${solicitanteNombre || 'Usuario'}. Requiere aprobación.`;

    const notificaciones = finales.map((u) => ({
      usuario_id: u.id,
      mensaje,
      tipo: 'etd_solicitud_pendiente',
      // Se guarda el ID de la solicitud para poder abrirla directo desde la campanita.
      expediente_id: solicitudId ?? null,
      po_tiquetera: orderNumber,
      usuario_genero: 'Sistema',
      icono: 'ri-calendar-check-line',
      leida: false,
    }));

    const { error } = await supabase.from('notificaciones').insert(notificaciones);
    if (error) console.error('[Notificaciones] Error al insertar (nueva solicitud ETD):', error.message);
  } catch (err: any) {
    console.error('[Notificaciones] Error (nueva solicitud ETD):', err.message || err);
  }
}

// ============================================================
// RECORDATORIO AUTOMÁTICO DE SOLICITUDES ETD ATRASADAS
// Si una solicitud sigue PENDING más de 2 días, se recuerda a
// los administradores (QA solo al perfil autorizado). Máximo
// un recordatorio por solicitud cada 24 horas.
// ============================================================

export const DIAS_UMBRAL_ETD_ATRASADA = 2;
const HORAS_ENTRE_RECORDATORIOS_ETD = 24;

interface SolicitudEtdAtrasada {
  id: string;
  order_number: string;
  trading_company: string | null;
  requested_at: string;
  proposed_etd_initial: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  api_env: string | null;
}

// Revisa las solicitudes pendientes y avisa a los administradores
// cuando llevan más de 2 días sin resolverse.
export async function verificarSolicitudesEtdAtrasadas(): Promise<void> {
  try {
    const { data: pendientes, error } = await supabase
      .from('etd_initial_change_requests')
      .select('id, order_number, trading_company, requested_at, proposed_etd_initial, requested_by, requested_by_name, api_env')
      .eq('status', 'PENDING');

    if (error) throw error;
    const lista = (pendientes || []) as SolicitudEtdAtrasada[];
    if (lista.length === 0) return;

    const ahora = Date.now();
    const atrasadas = lista.filter((s) => {
      const fecha = new Date(s.requested_at).getTime();
      if (Number.isNaN(fecha)) return false;
      return ahora - fecha > DIAS_UMBRAL_ETD_ATRASADA * 24 * 60 * 60 * 1000;
    });
    if (atrasadas.length === 0) return;

    const ids = atrasadas.map((s) => s.id);

    // Recordatorios ya enviados (se evita duplicar dentro de las últimas 24 h).
    const { data: previos } = await supabase
      .from('notificaciones')
      .select('expediente_id, created_at')
      .eq('tipo', 'etd_recordatorio')
      .in('expediente_id', ids);

    const limite = ahora - HORAS_ENTRE_RECORDATORIOS_ETD * 60 * 60 * 1000;
    const recientementeAvisadas = new Set(
      (previos || [])
        .filter((n: any) => n.expediente_id && new Date(n.created_at).getTime() >= limite)
        .map((n: any) => n.expediente_id)
    );

    const administradores = await obtenerAdministradores();
    const destinatariosQa = new Map<string, { id: string; nombre: string }>();
    if (atrasadas.some((s) => s.api_env && s.api_env !== 'production')) {
      const { data: autorizados } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .in('email', ['jalvarez@ologistics.com']);
      (autorizados || []).forEach((u: any) => destinatariosQa.set(u.id, { id: u.id, nombre: u.nombre }));
    }

    const nuevas: Record<string, unknown>[] = [];

    atrasadas.forEach((s) => {
      if (recientementeAvisadas.has(s.id)) return;

      const esQa = Boolean(s.api_env && s.api_env !== 'production');
      const base = esQa
        ? Array.from(destinatariosQa.values())
        : administradores;

      const destinatarios = base.filter((u) => u.id !== s.requested_by);
      if (destinatarios.length === 0) return;

      const fechaSolicitud = new Date(s.requested_at).getTime();
      const dias = Math.floor((ahora - fechaSolicitud) / (24 * 60 * 60 * 1000));
      const prefijo = esQa ? '[QA] ' : '';
      const etdTexto = s.proposed_etd_initial ? formatearFechaCorta(s.proposed_etd_initial) : '—';
      const mensaje =
        `${prefijo}Recordatorio: la solicitud de cambio de ETD Inicial para la PO ${s.order_number}` +
        `${s.trading_company ? ` (${s.trading_company})` : ''} lleva ${dias} días sin aprobarse. ` +
        `Nuevo ETD propuesto: ${etdTexto}. Solicitado por: ${s.requested_by_name || 'Usuario'}.`;

      destinatarios.forEach((u) => {
        nuevas.push({
          usuario_id: u.id,
          mensaje,
          tipo: 'etd_recordatorio',
          expediente_id: s.id,
          po_tiquetera: s.order_number,
          usuario_genero: 'Sistema',
          icono: 'ri-alarm-warning-line',
          leida: false,
        });
      });
    });

    if (nuevas.length === 0) return;

    const { error: errorInsert } = await supabase.from('notificaciones').insert(nuevas);
    if (errorInsert) console.error('[Notificaciones] Error al insertar recordatorios ETD:', errorInsert.message);
  } catch (err: any) {
    console.error('[Notificaciones] Error verificando solicitudes ETD atrasadas:', err.message || err);
  }
}

// Tipos de notificación que apuntan a una solicitud de cambio de ETD Inicial.
const TIPOS_NOTIFICACION_ETD = [
  'etd_solicitud_pendiente',
  'etd_recordatorio',
  'etd_aprobada',
  'etd_rechazada',
];

export function esNotificacionEtd(tipo: string): boolean {
  return TIPOS_NOTIFICACION_ETD.includes(tipo);
}

export async function obtenerNotificaciones(usuarioId: string): Promise<Notificacion[]> {
  try {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (err: any) {
    console.error('[Notificaciones] Error al obtener:', err.message || err);
    return [];
  }
}

export async function contarNoLeidas(usuarioId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId)
      .eq('leida', false);

    if (error) throw error;
    return count || 0;
  } catch (err: any) {
    console.error('[Notificaciones] Error al contar:', err.message || err);
    return 0;
  }
}

export async function marcarComoLeida(notificacionId: string): Promise<void> {
  try {
    await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', notificacionId);
  } catch (err: any) {
    console.error('[Notificaciones] Error al marcar leída:', err.message || err);
  }
}

export async function marcarTodasComoLeidas(usuarioId: string): Promise<void> {
  try {
    await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('usuario_id', usuarioId)
      .eq('leida', false);
  } catch (err: any) {
    console.error('[Notificaciones] Error al marcar todas:', err.message || err);
  }
}

export function getIconoColor(tipo: string): string {
  switch (tipo) {
    case 'documento_agregado':
      return 'text-teal-600 bg-teal-100';
    case 'documento_modificado':
      return 'text-amber-600 bg-amber-100';
    case 'ticket_creado':
      return 'text-emerald-600 bg-emerald-100';
    case 'creacion_inicial':
      return 'text-rose-600 bg-rose-100';
    case 'carga_caa':
      return 'text-orange-600 bg-orange-100';
    case 'ticket_estancado':
      return 'text-red-600 bg-red-100';
    case 'comentario_agregado':
      return 'text-blue-600 bg-blue-100';
    case 'etd_aprobada':
      return 'text-emerald-600 bg-emerald-100';
    case 'etd_rechazada':
      return 'text-red-600 bg-red-100';
    case 'etd_solicitud_pendiente':
      return 'text-amber-600 bg-amber-100';
    case 'etd_recordatorio':
      return 'text-orange-600 bg-orange-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

export function getTipoLabel(tipo: string): string {
  switch (tipo) {
    case 'documento_agregado':
      return 'Documento agregado';
    case 'documento_modificado':
      return 'Documento modificado';
    case 'ticket_creado':
      return 'Ticket creado';
    case 'creacion_inicial':
      return 'Creación inicial';
    case 'carga_caa':
      return 'Carga CAA';
    case 'ticket_estancado':
      return 'Alerta de estancamiento';
    case 'comentario_agregado':
      return 'Comentario agregado';
    case 'etd_aprobada':
      return 'Cambio ETD Inicial aprobado';
    case 'etd_rechazada':
      return 'Cambio ETD Inicial rechazado';
    case 'etd_solicitud_pendiente':
      return 'Nueva solicitud ETD Inicial';
    case 'etd_recordatorio':
      return 'Recordatorio ETD Inicial';
    default:
      return tipo;
  }
}

// ============================================================
// ALERTA DE TICKETS ESTANCADOS EN "ESPERA DE RESPUESTA"
// Notifica al solicitante, responsable y admins cuando un
// ticket lleva más de N días sin moverse en ese estado.
// ============================================================

const DIAS_UMBRAL_ESTANCAMIENTO = 2;

const ESTADOS_ESPERA = ['Espera de Respuesta', 'Espera de respuesta'];

interface NotificarTicketEstancadoParams {
  poTiquetera: string;
  solicitante: string;
  responsable: string;
  expedienteId: string;
  dias: number;
}

async function notificarTicketEstancado({
  poTiquetera,
  solicitante,
  responsable,
  expedienteId,
  dias,
}: NotificarTicketEstancadoParams): Promise<void> {
  try {
    const mensaje = `El ticket ${poTiquetera} lleva ${dias} día(s) en "Espera de Respuesta" sin moverse. Por favor actualiza la observación del caso.`;

    // 1) Destinatarios por nombre (solicitante / responsable)
    const nombresUnicos = [...new Set([solicitante, responsable].filter(Boolean))];
    let usuariosPorNombre: { id: string; nombre: string }[] = [];
    if (nombresUnicos.length > 0) {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .in('nombre', nombresUnicos);
      usuariosPorNombre = data || [];
    }

    // 2) Admins por rol (Administrador / admin)
    const { data: usuariosAdmin } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .or('rol.ilike.%Administrador%,rol.ilike.%admin%');

    // 3) Admins globales (siempre reciben todo)
    const { data: usuariosGlobales } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .in('email', EMAILS_NOTIFICACION_GLOBAL);

    const usuarios = [
      ...usuariosPorNombre,
      ...(usuariosAdmin || []),
      ...(usuariosGlobales || []),
    ];
    const unicos = Array.from(new Map(usuarios.map((u) => [u.id, u])).values());

    if (unicos.length === 0) return;

    const notificaciones = unicos.map((u) => ({
      usuario_id: u.id,
      mensaje,
      tipo: 'ticket_estancado',
      expediente_id: expedienteId,
      po_tiquetera: poTiquetera,
      usuario_genero: 'Sistema',
      icono: 'ri-alert-line',
    }));

    const { error } = await supabase.from('notificaciones').insert(notificaciones);
    if (error) console.error('[Notificaciones] Error al insertar (ticket estancado):', error.message);
  } catch (err: any) {
    console.error('[Notificaciones] Error (ticket estancado):', err.message || err);
  }
}

// Revisa los tickets que están en "Espera de Respuesta" y notifica
// a los involucrados si llevan más de DIAS_UMBRAL_ESTANCAMIENTO días.
export async function verificarTicketsEstancados(): Promise<void> {
  try {
    // 1) Tickets actualmente en Espera de Respuesta
    const { data: expedientes, error: expError } = await supabase
      .from('expedientes')
      .select('id, po_tiquetera, solicitante, responsable_creacion, created_at')
      .in('estado_expediente', ESTADOS_ESPERA);

    if (expError) throw expError;
    if (!expedientes || expedientes.length === 0) return;

    const ids = (expedientes as any[]).map((e) => e.id);

    // 2) Última fecha en que cada uno entró a "Espera de Respuesta" (historial)
    const { data: historial, error: histError } = await supabase
      .from('expedientes_historial')
      .select('expediente_id, fecha_cambio')
      .in('expediente_id', ids)
      .eq('campo_modificado', 'Estado')
      .in('valor_nuevo', ESTADOS_ESPERA);

    if (histError) throw histError;

    const fechaEntrada: Record<string, string> = {};
    (historial || []).forEach((h: any) => {
      const actual = fechaEntrada[h.expediente_id];
      if (!actual || new Date(h.fecha_cambio) > new Date(actual)) {
        fechaEntrada[h.expediente_id] = h.fecha_cambio;
      }
    });

    // 3) Notificaciones ya enviadas para no duplicar
    const { data: yaNotificados, error: notifError } = await supabase
      .from('notificaciones')
      .select('expediente_id')
      .eq('tipo', 'ticket_estancado')
      .in('expediente_id', ids);

    if (notifError) throw notifError;
    const notificados = new Set(
      (yaNotificados || []).map((n: any) => n.expediente_id).filter(Boolean)
    );

    const ahora = Date.now();

    for (const exp of expedientes as any[]) {
      if (notificados.has(exp.id)) continue;

      const fecha = fechaEntrada[exp.id] || exp.created_at;
      if (!fecha) continue;

      const dias = (ahora - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24);
      if (dias <= DIAS_UMBRAL_ESTANCAMIENTO) continue;

      await notificarTicketEstancado({
        poTiquetera: exp.po_tiquetera,
        solicitante: exp.solicitante || '',
        responsable: exp.responsable_creacion || '',
        expedienteId: exp.id,
        dias: Math.floor(dias),
      });
    }
  } catch (err: any) {
    console.error('[Notificaciones] Error verificando tickets estancados:', err.message || err);
  }
}