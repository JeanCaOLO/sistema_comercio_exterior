import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, obtenerSesionValida, limpiarSesionLocal, esErrorSesionInvalida } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: string; // Mantener por compatibilidad, pero usar roles[]
  roles: string[]; // Array de roles
  departamento?: string;
  estado: string;
}

interface AuthContextType {
  user: User | null;
  perfil: Perfil | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
  isBodega: () => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  const isBodega = () => {
    if (!perfil?.roles || perfil.roles.length === 0) return false;
    return perfil.roles.some(r => r.toLowerCase() === 'bodega');
  };

  const isAdmin = () => {
    if (!perfil?.roles || perfil.roles.length === 0) return false;
    return perfil.roles.some(r => r.toLowerCase() === 'admin');
  };

  const cargarPerfil = async (userEmail: string) => {
    try {
      console.log('🔍 Buscando perfil para email:', userEmail);
      
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (error) {
        console.error('❌ Error al cargar perfil:', error);

        // Si el token de sesión no es válido (JWT inválido/dañado), cerramos la
        // sesión para limpiar esas credenciales y permitir un inicio de sesión limpio.
        const esErrorDeSesion =
          error.code === 'PGRST301' ||
          /jwt|token|sesi[oó]n|key/i.test(`${error.message ?? ''} ${error.details ?? ''}`);

        if (esErrorDeSesion) {
          console.warn('⚠️ Sesión inválida detectada. Cerrando sesión para limpiar credenciales.');
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (errorCierre) {
            console.warn('No se pudo cerrar la sesión en el servidor, se limpia localmente:', errorCierre);
            limpiarSesionLocal();
          }
          setPerfil(null);
          setUser(null);
        }
        return;
      }

      if (data) {
        console.log('✅ Perfil cargado:', data);
        
        // Obtener roles desde la tabla usuario_roles (nueva estructura)
        let rolesArray: string[] = [];
        
        try {
          const { data: rolesData, error: rolesError } = await supabase
            .from('usuario_roles')
            .select('rol_id, roles!inner(nombre)')
            .eq('usuario_id', data.id);

          if (!rolesError && rolesData && rolesData.length > 0) {
            rolesArray = rolesData.map((r: any) => r.roles.nombre);
            console.log('✅ Roles desde usuario_roles:', rolesArray);
          }
        } catch (e) {
          console.warn('⚠️ Error consultando usuario_roles, usando fallback:', e);
        }

        // Fallback: si no hay roles en usuario_roles, parsear del campo rol (compatibilidad)
        if (rolesArray.length === 0 && data.rol) {
          if (typeof data.rol === 'string' && data.rol.includes(',')) {
            rolesArray = data.rol.split(',').map((r: string) => r.trim());
          } else if (typeof data.rol === 'string') {
            rolesArray = [data.rol];
          }
          console.log('⚠️ Roles desde campo rol (fallback):', rolesArray);
        }

        setPerfil({
          ...data,
          roles: rolesArray
        });
      }
    } catch (error) {
      console.error('❌ Error crítico al cargar perfil:', error);
    }
  };

  const refreshPerfil = async () => {
    if (user?.email) {
      await cargarPerfil(user.email);
    }
  };

  useEffect(() => {
    let activo = true;

    // Verificar sesión actual. Si el token guardado ya no es válido, se descarta
    // sin romper la aplicación y se envía al usuario al login.
    const inicializar = async () => {
      const session = await obtenerSesionValida();
      if (!activo) return;
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user?.email) {
        void cargarPerfil(session.user.email);
      }
    };

    void inicializar();

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user?.email) {
        void cargarPerfil(session.user.email);
      } else {
        setPerfil(null);
      }
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const basePath = __BASE_PATH__.split('/').filter(Boolean).join('/');
    const pathPrefix = basePath ? `/${basePath}` : '';
    const redirectTo = `${window.location.origin}${pathPrefix}/`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && !esErrorSesionInvalida(error)) throw error;
    } catch (error) {
      // Si la sesión ya no existe en el servidor, igualmente se limpia localmente
      // para que el usuario pueda volver a iniciar sesión.
      if (!esErrorSesionInvalida(error)) throw error;
    } finally {
      limpiarSesionLocal();
      setUser(null);
      setPerfil(null);
    }
  };

  const value = {
    user,
    perfil,
    loading,
    signIn,
    signInWithGoogle,
    signOut,
    refreshPerfil,
    isBodega,
    isAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
