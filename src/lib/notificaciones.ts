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
    if (!solicitante && !responsable) return;

    const nombresUnicos = [...new Set([solicitante, responsable].filter(Boolean))];

    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .in('nombre', nombresUnicos);

    if (!usuarios || usuarios.length === 0) return;

    const notificaciones = usuarios.map((u) => ({
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