import { useEffect } from 'react';
import {
  debeEjecutarseAutomatico,
  ejecutarBarridoRaga,
  marcarEjecucionAutomatica,
} from '@/lib/ragaSync';

// Evita que la misma pestaña lance dos barridos a la vez.
let ejecutando = false;

const ESPERA_INICIAL_MS = 8000;         // deja que la app termine de cargar
const REVISION_MS = 5 * 60 * 1000;      // revisa cada 5 minutos
const LIMITE_POR_LOTE = 20;             // tickets por lote (mismo tope del servidor)

// Dispara el barrido automático con Raga para los tickets de Dropship.
// Ventana de 6 horas: se recorren TODOS los tickets de esos estados en lotes
// espaciados. Si el barrido queda a medias, se retoma a los pocos minutos.
export function useSincronizacionRaga(activo: boolean): void {
  useEffect(() => {
    if (!activo) return;

    let vigente = true;

    const intentar = async () => {
      if (!vigente || ejecutando) return;
      if (!debeEjecutarseAutomatico()) return;

      ejecutando = true;
      try {
        const res = await ejecutarBarridoRaga({
          force: false,
          limite: LIMITE_POR_LOTE,
          cancelado: () => !vigente,
        });

        if (!res.ok) {
          console.warn('[RagaSync] No se pudo sincronizar:', res.error);
          return;
        }

        // Se registra la ventana. Si quedaron tickets pendientes, el próximo
        // intento se hace en pocos minutos en lugar de esperar 6 horas.
        marcarEjecucionAutomatica(res.pendientes_restantes);

        if (res.lotes > 0 && (res.tickets_actualizados > 0 || res.errores > 0)) {
          window.dispatchEvent(new CustomEvent('ragaSyncCompletada', { detail: res }));
        }
      } catch (error) {
        console.warn('[RagaSync] Error inesperado:', error);
      } finally {
        ejecutando = false;
      }
    };

    const arranque = setTimeout(intentar, ESPERA_INICIAL_MS);
    const intervalo = setInterval(intentar, REVISION_MS);

    return () => {
      vigente = false;
      clearTimeout(arranque);
      clearInterval(intervalo);
    };
  }, [activo]);
}