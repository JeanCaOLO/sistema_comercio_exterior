import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  obtenerNotificaciones,
  contarNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas,
  debeSilenciarToast,
  conexionDisponible,
  type Notificacion,
} from '@/lib/notificaciones';

export interface ToastItem {
  clave: string;
  notificacion: Notificacion;
}

// Frecuencia normal de consulta y frecuencia reducida cuando hubo fallos de red.
const INTERVALO_NORMAL_MS = 15000;
const INTERVALO_REINTENTO_MS = 45000;

const paginaVisible = () =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function useNotificaciones(usuarioId: string, email?: string, roles?: string[]) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const conocidosRef = useRef<Set<string>>(new Set());
  const inicializadoRef = useRef(false);
  const contadorClaveRef = useRef(0);
  const consultaEnCursoRef = useRef(false);
  const fallosSeguidosRef = useRef(0);

  const emailRef = useRef(email);
  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  // Los administradores (y los correos de la lista) no reciben avisos
  // emergentes; sus notificaciones siguen llegando a la campana.
  const rolesRef = useRef<string[]>(roles || []);
  useEffect(() => {
    rolesRef.current = roles || [];
  }, [roles]);

  const suprimirToast = useCallback(() => {
    return debeSilenciarToast(emailRef.current, rolesRef.current);
  }, []);

  const generarClave = (id: string) =>
    `${id}-${Date.now()}-${contadorClaveRef.current++}`;

  // Devuelve true si la consulta se completó; false si falló la conexión.
  const cargarNotificaciones = useCallback(async (): Promise<boolean> => {
    if (!usuarioId) return false;
    if (!conexionDisponible()) return false;
    if (consultaEnCursoRef.current) return false;

    consultaEnCursoRef.current = true;
    try {
      const data = await obtenerNotificaciones(usuarioId);
      if (data === null) {
        fallosSeguidosRef.current += 1;
        return false;
      }

      if (!inicializadoRef.current) {
        data.forEach((n) => conocidosRef.current.add(n.id));
        inicializadoRef.current = true;
      } else {
        const nuevas = data.filter((n) => !conocidosRef.current.has(n.id));
        if (nuevas.length > 0) {
          nuevas.forEach((n) => conocidosRef.current.add(n.id));
          if (!suprimirToast()) {
            setToasts((prev) => [
              ...prev,
              ...nuevas.map((n) => ({ clave: generarClave(n.id), notificacion: n })),
            ]);
          }
        }
      }

      setNotificaciones(data);
      fallosSeguidosRef.current = 0;
      return true;
    } catch {
      fallosSeguidosRef.current += 1;
      return false;
    } finally {
      consultaEnCursoRef.current = false;
      setCargando(false);
    }
  }, [usuarioId, suprimirToast]);

  const cargarContador = useCallback(async () => {
    if (!usuarioId) return;
    if (!conexionDisponible()) return;
    try {
      const count = await contarNoLeidas(usuarioId);
      // null = no se pudo consultar: se conserva el valor anterior.
      if (count !== null) setNoLeidas(count);
    } catch {
      // Silencioso: se reintenta en el siguiente ciclo.
    }
  }, [usuarioId]);

  const sincronizar = useCallback(async () => {
    if (!usuarioId) return;
    const ok = await cargarNotificaciones();
    if (ok) await cargarContador();
  }, [usuarioId, cargarNotificaciones, cargarContador]);

  // Carga inicial + consulta periódica respaldada.
  // - No consulta si el navegador está sin conexión.
  // - No consulta si la pestaña está en segundo plano.
  // - Si falla, baja la frecuencia para no saturar la red.
  useEffect(() => {
    if (!usuarioId) {
      setCargando(false);
      return;
    }

    let cancelado = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const programar = (ms: number) => {
      if (cancelado) return;
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(ciclo, ms);
    };

    const ciclo = async () => {
      if (cancelado) return;
      if (paginaVisible() && conexionDisponible()) {
        await sincronizar();
      }
      const retraso = fallosSeguidosRef.current > 0 ? INTERVALO_REINTENTO_MS : INTERVALO_NORMAL_MS;
      programar(retraso);
    };

    void (async () => {
      if (!paginaVisible() || !conexionDisponible()) {
        setCargando(false);
        programar(INTERVALO_NORMAL_MS);
        return;
      }
      await sincronizar();
      if (cancelado) return;
      const retraso = fallosSeguidosRef.current > 0 ? INTERVALO_REINTENTO_MS : INTERVALO_NORMAL_MS;
      programar(retraso);
    })();

    const alCambiarVisibilidad = () => {
      if (paginaVisible() && conexionDisponible()) {
        void sincronizar();
      }
    };
    const alVolverEnLinea = () => {
      fallosSeguidosRef.current = 0;
      void sincronizar();
    };
    const alPerderConexion = () => {
      // Se espera a que vuelva la conexión para revertir el estado.
      fallosSeguidosRef.current += 1;
    };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('online', alVolverEnLinea);
    window.addEventListener('offline', alPerderConexion);

    return () => {
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('online', alVolverEnLinea);
      window.removeEventListener('offline', alPerderConexion);
    };
  }, [usuarioId, sincronizar]);

  // Suscripción en tiempo real para mostrar el toast apenas sucede
  useEffect(() => {
    if (!usuarioId) return;

    let canal: ReturnType<typeof supabase.channel> | null = null;
    try {
      canal = supabase
        .channel(`notificaciones-usuario-${usuarioId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificaciones',
            filter: `usuario_id=eq.${usuarioId}`,
          },
          (payload) => {
            const nueva = payload.new as Notificacion;
            if (conocidosRef.current.has(nueva.id)) return;
            conocidosRef.current.add(nueva.id);

            setNotificaciones((prev) => [nueva, ...prev.filter((n) => n.id !== nueva.id)]);
            if (!nueva.leida) {
              setNoLeidas((prev) => prev + 1);
            }
            if (!suprimirToast()) {
              setToasts((prev) => [
                ...prev,
                { clave: generarClave(nueva.id), notificacion: nueva },
              ]);
            }
          }
        )
        .subscribe();
    } catch (error) {
      console.warn('Tiempo real de notificaciones no disponible, se usa la consulta periódica:', error);
    }

    return () => {
      if (canal) {
        try {
          supabase.removeChannel(canal);
        } catch {
          // El canal ya no existe: no pasa nada.
        }
      }
    };
  }, [usuarioId, suprimirToast]);

  const cerrarToast = useCallback((clave: string) => {
    setToasts((prev) => prev.filter((t) => t.clave !== clave));
  }, []);

  const marcarLeida = useCallback(async (id: string) => {
    await marcarComoLeida(id);
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
    setNoLeidas((prev) => Math.max(0, prev - 1));
    // Al marcar como leída, se limpia su notificación emergente (toast)
    setToasts((prev) => prev.filter((t) => t.notificacion.id !== id));
  }, []);

  const marcarTodasLeidas = useCallback(async () => {
    await marcarTodasComoLeidas(usuarioId);
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    setNoLeidas(0);
    // Al marcar todas como leídas, se limpian todas las notificaciones emergentes
    setToasts([]);
  }, [usuarioId]);

  return {
    notificaciones,
    noLeidas,
    cargando,
    toasts,
    cerrarToast,
    marcarLeida,
    marcarTodasLeidas,
  };
}