// Estado de la sincronización con Raga para un ticket puntual.
// Se usa en el detalle del ticket para mostrar la marca "Actualizado por Raga"
// junto con la fecha de la última sincronización.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Correo con el que la Edge Function firma los cambios en el historial.
const EMAIL_SISTEMA_RAGA = 'sincronizacion.raga@sistema';

export interface EstadoSincronizacionRaga {
  cargando: boolean;
  // Raga escribió datos en el ticket (hay historial del sistema).
  actualizado: boolean;
  // Fecha del último cambio aplicado por Raga (ISO) o null.
  fechaActualizacion: string | null;
  // Campos que Raga completó o corrigió en la última sincronización.
  campos: string[];
  // Última vez que se consultó el ticket en Raga (ISO) o null.
  ultimaConsulta: string | null;
  // Resultado guardado por el control de sincronización.
  resultado: string | null;
  detalle: string | null;
  error: boolean;
}

const ESTADO_INICIAL: EstadoSincronizacionRaga = {
  cargando: false,
  actualizado: false,
  fechaActualizacion: null,
  campos: [],
  ultimaConsulta: null,
  resultado: null,
  detalle: null,
  error: false,
};

interface FilaHistorial {
  campo_modificado: string | null;
  valor_nuevo: string | null;
  fecha_cambio: string | null;
}

interface FilaControl {
  ultimo_intento_at: string | null;
  ultima_ok_at: string | null;
  resultado: string | null;
  detalle: string | null;
}

// Agrupa los campos escritos en la misma pasada (ventana de 10 minutos).
function camposDeLaUltimaPasada(filas: FilaHistorial[]): string[] {
  if (filas.length === 0) return [];
  const primera = filas[0]?.fecha_cambio;
  const base = primera ? new Date(primera).getTime() : NaN;
  const campos: string[] = [];

  for (const fila of filas) {
    const campo = (fila.campo_modificado || '').trim();
    if (!campo) continue;
    const t = fila.fecha_cambio ? new Date(fila.fecha_cambio).getTime() : NaN;
    if (Number.isFinite(base) && Number.isFinite(t) && Math.abs(base - t) > 10 * 60 * 1000) {
      continue;
    }
    if (!campos.includes(campo)) campos.push(campo);
    if (campos.length >= 4) break;
  }
  return campos;
}

export function useRagaSyncExpediente(
  expedienteId: string | null | undefined,
  habilitado = true
): EstadoSincronizacionRaga {
  const [estado, setEstado] = useState<EstadoSincronizacionRaga>(ESTADO_INICIAL);

  useEffect(() => {
    let activo = true;

    if (!habilitado || !expedienteId) {
      setEstado(ESTADO_INICIAL);
      return () => {
        activo = false;
      };
    }

    const cargar = async () => {
      setEstado({ ...ESTADO_INICIAL, cargando: true });
      try {
        const [historial, control] = await Promise.all([
          supabase
            .from('expedientes_historial')
            .select('campo_modificado, valor_nuevo, fecha_cambio')
            .eq('expediente_id', expedienteId)
            .eq('usuario_email', EMAIL_SISTEMA_RAGA)
            .order('fecha_cambio', { ascending: false })
            .limit(10),
          supabase
            .from('raga_sync_dropship')
            .select('ultimo_intento_at, ultima_ok_at, resultado, detalle')
            .eq('expediente_id', expedienteId)
            .maybeSingle(),
        ]);

        if (!activo) return;

        if (historial.error && control.error) {
          setEstado({ ...ESTADO_INICIAL, error: true });
          return;
        }

        const filasHistorial = (historial.data || []) as unknown as FilaHistorial[];
        const filaControl = (control.data || null) as FilaControl | null;

        const fechaCambio = filasHistorial[0]?.fecha_cambio || null;
        const fechaConsulta =
          filaControl?.ultimo_intento_at || filaControl?.ultima_ok_at || null;

        setEstado({
          cargando: false,
          actualizado: filasHistorial.length > 0,
          fechaActualizacion: fechaCambio,
          campos: camposDeLaUltimaPasada(filasHistorial),
          ultimaConsulta: fechaConsulta,
          resultado: filaControl?.resultado || null,
          detalle: filaControl?.detalle || null,
          error: false,
        });
      } catch (_e) {
        if (activo) setEstado({ ...ESTADO_INICIAL, error: true });
      } finally {
        if (activo) setEstado((prev) => ({ ...prev, cargando: false }));
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [expedienteId, habilitado]);

  return estado;
}