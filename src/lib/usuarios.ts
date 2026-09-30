import { supabase } from './supabase';

// ============================================================
// UTILIDADES DE USUARIOS POR CORREO
// Se usan para validar que los correos configurados en las rutas
// (notificaciones de Carga CAA) correspondan a usuarios registrados.
// Las notificaciones de la campanita se crean por usuario_id, por lo
// que si el correo no existe como usuario, la notificación nunca llega.
// ============================================================

// Normaliza un correo para comparaciones (minúsculas y sin espacios).
export function normalizarEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

// Devuelve el conjunto de correos de usuarios registrados (en minúsculas).
export async function obtenerEmailsUsuarios(): Promise<Set<string>> {
  const { data, error } = await supabase.from('usuarios').select('email');
  if (error) throw error;

  const set = new Set<string>();
  (data || []).forEach((u: any) => {
    const email = normalizarEmail(u?.email);
    if (email) set.add(email);
  });
  return set;
}

// Verifica qué correos están registrados como usuarios y cuáles no.
// Comparación tolerante a mayúsculas/minúsculas y espacios.
export async function verificarCorreosRegistrados(
  emails: string[]
): Promise<{ registrados: string[]; noRegistrados: string[] }> {
  const limpios = [...new Set(emails.map(normalizarEmail).filter(Boolean))];
  if (limpios.length === 0) return { registrados: [], noRegistrados: [] };

  try {
    const set = await obtenerEmailsUsuarios();
    return {
      registrados: limpios.filter((e) => set.has(e)),
      noRegistrados: limpios.filter((e) => !set.has(e)),
    };
  } catch (error) {
    console.error('[Usuarios] Error al verificar correos registrados:', error);
    // Falla abierta: si no se puede verificar, no marcamos falsos "no registrado".
    return { registrados: limpios, noRegistrados: [] };
  }
}

// Busca usuarios por correo (tolerante a mayúsculas/minúsculas) y devuelve sus ids.
export async function buscarUsuariosPorEmails(
  emails: string[]
): Promise<{ id: string; email: string }[]> {
  const limpios = [...new Set(emails.map(normalizarEmail).filter(Boolean))];
  if (limpios.length === 0) return [];

  const { data, error } = await supabase.from('usuarios').select('id, email');
  if (error) throw error;

  const objetivo = new Set(limpios);
  return (data || [])
    .filter((u: any) => objetivo.has(normalizarEmail(u?.email)))
    .map((u: any) => ({ id: u.id, email: u.email }));
}