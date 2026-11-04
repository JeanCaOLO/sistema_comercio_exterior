// Marca de sincronización Raga para muchos tickets a la vez.
// Cada tarjeta pide su estado y el hook agrupa todas las solicitudes en una
// sola consulta por lote, para no disparar una consulta por tarjeta.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface MarcaRagaTicket {
  resultado: string | null;
  actualizado: boolean;
  cambios: number;
  ultimaOk: string | null;
  detalle: string | null;
}

interface FilaControlRaga {
  expediente_id: string;
  resultado: string | null;
  cambios: number | null;
  ultima_ok_at: string | null;
  detalle: string | null;
}

const cache = new Map<string, MarcaRagaTicket | null>();
const pendientes = new Set<string>();
const oyentes = new Set<() => void>();
let programado: ReturnType<typeof setTimeout> | null = null;
let consultando = false;

function notificar(): void {
  oyentes.forEach((fn) => fn());
}

function volcarProgramado(): void {
  if (programado) return;
  programado = setTimeout(() => {
    programado = null;
    void volcar();
  }, 80);
}

async function volcar(): Promise<void> {
  if (consultando) return;
  const ids = Array.from(pendientes);
  if (ids.length === 0) return;
  pendientes.clear();
  consultando = true;

  try {
    const { data, error } = await supabase
      .from('raga_sync_dropship')
      .select('expediente_id, resultado, cambios, ultima_ok_at, detalle')
      .in('expediente_id', ids);

    if (error) {
      // Sin datos no se muestra la marca, pero se evita reintentar en bucle.
      ids.forEach((id) => cache.set(id, null));
      return;
    }

    const filas = (data || []) as unknown as FilaControlRaga[];
    const porId = new Map<string, FilaControlRaga>();
    filas.forEach((fila) => porId.set(fila.expediente_id, fila));

    ids.forEach((id) => {
      const fila = porId.get(id);
      if (!fila) {
        cache.set(id, null);
        return;
      }
      cache.set(id, {
        resultado: fila.resultado,
        actualizado: fila.resultado === 'ACTUALIZADO' || (fila.cambios || 0) > 0,
        cambios: fila.cambios || 0,
        ultimaOk: fila.ultima_ok_at,
        detalle: fila.detalle,
      });
    });
  } catch (_e) {
    ids.forEach((id) => cache.set(id, null));
  } finally {
    consultando = false;
    notificar();
    if (pendientes.size > 0) volcarProgramado();
  }
}

// Al terminar un barrido hay que volver a leer las marcas.
export function invalidarMarcaRaga(): void {
  cache.clear();
  notificar();
}

if (typeof window !== 'undefined') {
  window.addEventListener('ragaSyncCompletada', () => invalidarMarcaRaga());
}

export function useEstadoRagaTicket(expedienteId: string | null | undefined): {
  marca: MarcaRagaTicket | null;
  cargando: boolean;
} {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const alCambiar = () => setVersion((v) => v + 1);
    oyentes.add(alCambiar);
    return () => {
      oyentes.delete(alCambiar);
    };
  }, []);

  useEffect(() => {
    if (!expedienteId) return;
    if (cache.has(expedienteId)) return;
    pendientes.add(expedienteId);
    volcarProgramado();
  }, [expedienteId]);

  const marca = expedienteId ? cache.get(expedienteId) ?? null : null;
  const cargando = Boolean(expedienteId) && !cache.has(expedienteId as string);

  return { marca, cargando };
}