import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables de entorno faltantes:', {
    url: supabaseUrl ? 'Presente' : 'Faltante',
    key: supabaseAnonKey ? 'Presente' : 'Faltante'
  });
  throw new Error('Faltan las variables de entorno de Supabase');
}

console.log('Inicializando Supabase con URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Clave usada para avisar en la pantalla de login que la sesión anterior caducó.
export const CLAVE_AVISO_SESION_EXPIRADA = 'sesion_expirada_aviso';

// Detecta si un error corresponde a una sesión inválida o a un refresh token
// que ya no existe en el servidor (por ejemplo, sesión cerrada desde otro equipo).
export function esErrorSesionInvalida(error: unknown): boolean {
  if (!error) return false;
  const partes: string[] = [];
  if (typeof error === 'string') partes.push(error);
  if (typeof error === 'object') {
    const objeto = error as Record<string, unknown>;
    ['message', 'error_description', 'code', 'name', 'details', 'hint'].forEach((campo) => {
      const valor = objeto[campo];
      if (typeof valor === 'string') partes.push(valor);
    });
  }
  const texto = partes.join(' ').toLowerCase();
  return (
    texto.includes('refresh token') ||
    texto.includes('token not found') ||
    texto.includes('invalid grant') ||
    texto.includes('invalid_grant') ||
    texto.includes('invalid jwt') ||
    texto.includes('jwt expired') ||
    texto.includes('auth session missing')
  );
}

// Elimina del navegador las credenciales de Supabase que ya no sirven.
export function limpiarSesionLocal(): void {
  try {
    Object.keys(window.localStorage)
      .filter((clave) => clave.startsWith('sb-') && clave.includes('auth-token'))
      .forEach((clave) => window.localStorage.removeItem(clave));
  } catch (error) {
    console.warn('No se pudo limpiar la sesión local:', error);
  }
}

// Deja marcado que la sesión caducó para mostrar un aviso en el login.
export function marcarSesionExpirada(): void {
  try {
    window.sessionStorage.setItem(CLAVE_AVISO_SESION_EXPIRADA, '1');
  } catch (error) {
    console.warn('No se pudo registrar el aviso de sesión:', error);
  }
}

let depuracionEnCurso = false;

// Limpia credenciales inválidas y cierra la sesión en el navegador una sola vez.
export async function depurarSesionInvalida(): Promise<void> {
  if (depuracionEnCurso) return;
  depuracionEnCurso = true;
  try {
    limpiarSesionLocal();
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.warn('Cierre de sesión local sin conexión:', error);
  } finally {
    depuracionEnCurso = false;
  }
}

// Devuelve una sesión confiable. Si el token ya no es válido se descarta en lugar
// de dejar la aplicación atrapada en un error de refresco de sesión.
export async function obtenerSesionValida(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (esErrorSesionInvalida(error)) {
        marcarSesionExpirada();
        await depurarSesionInvalida();
      }
      return null;
    }

    const session = data.session ?? null;
    if (!session) return null;

    const { error: errorUsuario } = await supabase.auth.getUser();
    if (errorUsuario && esErrorSesionInvalida(errorUsuario)) {
      marcarSesionExpirada();
      await depurarSesionInvalida();
      return null;
    }

    return session;
  } catch (error) {
    if (esErrorSesionInvalida(error)) {
      marcarSesionExpirada();
      await depurarSesionInvalida();
      return null;
    }
    console.warn('No se pudo validar la sesión:', error);
    return null;
  }
}

// Red de seguridad: si el refresco automático de Supabase falla por credenciales
// vencidas, se limpia la sesión en vez de propagar un error no controlado.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (!esErrorSesionInvalida(event.reason)) return;
    event.preventDefault();
    console.warn('Sesión inválida detectada. Se limpian las credenciales locales.');
    marcarSesionExpirada();
    void depurarSesionInvalida();
  });
}

// Validar conexión al iniciar
export async function validarConexionSupabase(): Promise<boolean> {
  try {
    console.log('🔍 Validando conexión con Supabase...');
    
    // Intentar una consulta simple
    const { error } = await supabase
      .from('expedientes')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Error al validar conexión:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return false;
    }
    
    console.log('✅ Conexión con Supabase exitosa');
    return true;
  } catch (error: any) {
    console.error('❌ Error crítico al validar conexión:', {
      message: error.message,
      stack: error.stack
    });
    return false;
  }
}

// Función helper para reintentar peticiones fallidas
export async function supabaseRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ Intento ${i + 1}/${maxRetries} fallido:`, error.message);
      
      // Si es el último intento, lanzar el error
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Esperar antes de reintentar (backoff exponencial)
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  
  throw lastError;
}

// Manejo de errores de autenticación
supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔐 Estado de autenticación:', event);
  
  if (event === 'TOKEN_REFRESHED') {
    console.log('✅ Token refrescado exitosamente');
  }
  if (event === 'SIGNED_OUT') {
    console.log('👋 Sesión cerrada');
  }
  if (event === 'USER_UPDATED') {
    console.log('👤 Usuario actualizado');
  }
  if (event === 'SIGNED_IN') {
    console.log('✅ Sesión iniciada correctamente');
  }
});

// Tipos para TypeScript
export interface Expediente {
  id?: string;
  po_tiquetera: string;
  tipo_po: string;
  solicitante: string;
  fecha_solicitud: string;
  prioridad: string;
  prioridad_urgente: boolean;
  dificultad: string;
  tiempo_minutos: number;
  dias_entrega: number;
  fecha_requerimiento: string;
  exp_id: string;
  lineas_oc: number;
  fecha_creacion_expediente: string;
  estado_expediente: string;
  responsable_creacion: string;
  instrucciones_adicionales?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Usuario {
  id?: string;
  nombre: string;
  email: string;
  rol: string;
  departamento?: string;
  estado: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReporteHistorico {
  id?: string;
  tipo_reporte: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  generado_por?: string;
  formato: string;
  created_at?: string;
}

export interface ConfiguracionSistema {
  id?: string;
  clave: string;
  valor: string;
  descripcion?: string;
  updated_at?: string;
}
