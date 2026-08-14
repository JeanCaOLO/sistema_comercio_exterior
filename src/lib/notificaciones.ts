import { supabase } from './supabase';

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
];

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
    const emailsRuta = getEmailsRutaCAA(ruta);
    if (emailsRuta.length === 0) return;

    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id')
      .in('email', emailsRuta);

    if (!usuarios || usuarios.length === 0) return;

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
    default:
      return tipo;
  }
}