import { useCallback, useEffect, useRef, useState } from 'react';
import {
  debeSincronizarBandeja,
  ejecutarBarridoCompartido,
  intervaloBandejaMs,
  marcarBarridoBandeja,
  proximaSincronizacionBandeja,
  suscribirProgresoBandeja,
} from '@/lib/ragaBandeja';

const ESPERA_INICIAL_MS = 6000;      // deja que la bandeja termine de pintar
const REVISION_MS = 5 * 60 * 1000;   // revisa cada 5 minutos si ya venció la ventana

interface Opciones {
  activo: boolean;
  onCompletado?: () => void;
}

interface EstadoSincronizacionBandeja {
  sincronizando: boolean;
  progreso: { procesados: number; pendientes: number } | null;
  ultimaSincronizacion: Date | null;
  proximaSincronizacion: Date | null;
  error: string | null;
  mensaje: string | null;
  sincronizarAhora: () => Promise<void>;
}

// Mantiene al día la Etapa y el ATD de la bandeja con Raga.
// Ventana de 2 horas: recorre todas las filas en lotes espaciados.
// El barrido es compartido: si ya hay uno corriendo, el clic se suma a él
// en lugar de ignorarse.
export function useSincronizacionBandeja({ activo, onCompletado }: Opciones): EstadoSincronizacionBandeja {
  const [sincronizando, setSincronizando] = useState(false);
  const [progreso, setProgreso] = useState<{ procesados: number; pendientes: number } | null>(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<Date | null>(() => {
    const proximaGuardada = proximaSincronizacionBandeja();
    if (!proximaGuardada) return null;
    return new Date(proximaGuardada.getTime() - intervaloBandejaMs());
  });
  const [proximaSincronizacion, setProximaSincronizacion] = useState<Date | null>(
    proximaSincronizacionBandeja()
  );
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const montado = useRef(true);
  const callback = useRef(onCompletado);
  callback.current = onCompletado;

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Cualquier barrido activo (aunque lo haya lanzado otra vista) se refleja aquí.
  useEffect(() => {
    const baja = suscribirProgresoBandeja((p) => {
      if (!montado.current) return;
      setSincronizando(true);
      setError(null);
      setProgreso(p);
    });
    return baja;
  }, []);

  const ejecutar = useCallback(async (forzar: boolean) => {
    if (montado.current) {
      setSincronizando(true);
      setError(null);
      setMensaje(null);
      setProgreso(null);
    }

    try {
      const res = await ejecutarBarridoCompartido({
        force: forzar,
        cancelado: () => !montado.current,
        onProgreso: (procesados, pendientes) => {
          if (montado.current) setProgreso({ procesados, pendientes });
        },
      });

      if (!res.ok) {
        if (montado.current) setError(res.error || 'No se pudo sincronizar la bandeja con Raga.');
        return;
      }

      // Si quedaron filas pendientes, se reintenta en pocos minutos.
      marcarBarridoBandeja(res.pendientes_restantes);

      if (!montado.current) return;

      if (res.procesados > 0) {
        setUltimaSincronizacion(new Date());
        setProximaSincronizacion(proximaSincronizacionBandeja());

        const actualizados = res.actualizados || 0;
        const errores = res.errores || 0;
        const total = res.total_bandeja || res.procesados;
        const alcance = `Revisé ${res.procesados} de ${total} PO(s) de la bandeja`;
        if (errores > 0) {
          setMensaje(
            `${alcance}: ${actualizados} con datos nuevos y ${errores} con problemas al consultar Raga (se reintentan en 15 minutos).`
          );
        } else {
          setMensaje(
            actualizados > 0
              ? `${alcance}: ${actualizados} recibieron Etapa o ATD desde Raga.`
              : `${alcance} y Raga no reportó cambios.`
          );
        }

        window.dispatchEvent(new CustomEvent('bandejaRagaSyncCompletada'));
        callback.current?.();
      } else if (res.motivo) {
        setMensaje(res.motivo);
      } else if (res.lotes === 0 || res.pendientes_restantes === 0) {
        setMensaje('Listo: la bandeja ya estaba al día con Raga.');
      }
    } catch (err) {
      const texto = err instanceof Error ? err.message : 'Error inesperado al sincronizar la bandeja.';
      if (montado.current) setError(texto);
    } finally {
      if (montado.current) {
        setSincronizando(false);
        setProgreso(null);
      }
    }
  }, []);

  const sincronizarAhora = useCallback(() => ejecutar(true), [ejecutar]);

  useEffect(() => {
    if (!activo) return;

    let vigente = true;

    const intentar = async () => {
      if (!vigente) return;
      if (!debeSincronizarBandeja()) {
        setProximaSincronizacion(proximaSincronizacionBandeja());
        return;
      }
      await ejecutar(false);
    };

    const arranque = setTimeout(intentar, ESPERA_INICIAL_MS);
    const intervalo = setInterval(intentar, REVISION_MS);

    return () => {
      vigente = false;
      clearTimeout(arranque);
      clearInterval(intervalo);
    };
  }, [activo, ejecutar]);

  return {
    sincronizando,
    progreso,
    ultimaSincronizacion,
    proximaSincronizacion,
    error,
    mensaje,
    sincronizarAhora,
  };
}