import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
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
  signOut: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = async (userEmail: string) => {
    try {
      console.log('🔍 Buscando perfil para email:', userEmail);
      
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (error) {
        console.error('❌ Error al cargar perfil:', error);
        return;
      }

      if (data) {
        console.log('✅ Perfil cargado:', data);
        
        // Convertir el campo rol a array de roles
        let rolesArray: string[] = [];
        
        if (data.rol) {
          // Si el campo rol contiene múltiples roles separados por coma
          if (typeof data.rol === 'string' && data.rol.includes(',')) {
            rolesArray = data.rol.split(',').map((r: string) => r.trim());
          } else if (typeof data.rol === 'string') {
            rolesArray = [data.rol];
          }
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
    // Verificar sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        cargarPerfil(session.user.email);
      }
      setLoading(false);
    });

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        cargarPerfil(session.user.email);
      } else {
        setPerfil(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setPerfil(null);
  };

  return (
    <AuthContext.Provider value={{ user, perfil, loading, signIn, signOut, refreshPerfil }}>
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
