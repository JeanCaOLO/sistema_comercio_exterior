import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  obtenerNotificaciones,
  contarNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas,
  EMAILS_SIN_TOAST,
  type Notificacion,
} from '@/lib/notificaciones';

export interface ToastItem {
  clave: string;
  notificacion: Notificacion;
}

export function useNotificaciones(usuarioId: string, email?: string) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const conocidosRef = useRef<Set<string>>(new Set());
  const inicializadoRef = useRef(false);
  const contadorClaveRef = useRef(0);

  const emailRef = useRef(email);
  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  const suprimirToast = useCallback(() => {
    return emailRef.current
      ? EMAILS_SIN_TOAST.includes(emailRef.current.toLowerCase())
      : false;
  }, []);

  const generarClave = (id: string) =>
    `${id}-${Date.now()}-${contadorClaveRef.current++}`;

  const cargarNotificaciones = useCallback(async () => {
    if (!usuarioId) return;
    const data = await obtenerNotificaciones(usuarioId);

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
    setCargando(false);
  }, [usuarioId]);

  const cargarContador = useCallback(async () => {
    if (!usuarioId) return;
    const count = await contarNoLeidas(usuarioId);
    setNoLeidas(count);
  }, [usuarioId]);

  // Carga inicial + polling como respaldo por si el tiempo real no está disponible
  useEffect(() => {
    cargarNotificaciones();
    cargarContador();

    const interval = setInterval(() => {
      cargarNotificaciones();
      cargarContador();
    }, 10000);

    return () => clearInterval(interval);
  }, [cargarNotificaciones, cargarContador]);

  // Suscripción en tiempo real para mostrar el toast apenas sucede
  useEffect(() => {
    if (!usuarioId) return;

    const canal = supabase
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

    return () => {
      supabase.removeChannel(canal);
    };
  }, [usuarioId]);

  const cerrarToast = useCallback((clave: string) => {
    setToasts((prev) => prev.filter((t) => t.clave !== clave));
  }, []);

  const marcarLeida = useCallback(async (id: string) => {
    await marcarComoLeida(id);
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
    setNoLeidas((prev) => Math.max(0, prev - 1));
  }, []);

  const marcarTodasLeidas = useCallback(async () => {
    await marcarTodasComoLeidas(usuarioId);
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    setNoLeidas(0);
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