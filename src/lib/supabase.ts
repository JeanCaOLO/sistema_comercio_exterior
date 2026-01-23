
import { createClient } from '@supabase/supabase-js';

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
    storage: window.localStorage,
    storageKey: 'supabase.auth.token',
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-client-info': 'supabase-js-web',
    },
    fetch: (url, options = {}) => {
      console.log('🌐 Realizando petición a:', url);
      return window.fetch(url, {
        ...options,
        mode: 'cors',
        credentials: 'omit',
      }).catch(error => {
        console.error('❌ Error en fetch:', error);
        throw new Error(`Error de conexión: ${error.message}. Verifica que el proyecto de Supabase esté activo y la URL sea correcta.`);
      });
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

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
