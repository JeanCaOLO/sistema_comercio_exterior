import { supabase } from './supabase';

// ============================================================
// SINCRONIZACIÓN DE LA BANDEJA CON RAGA
// El navegador nunca llama a Raga: siempre pasa por la Edge Function
// "sincronizar-raga-bandeja", que aplica la ventana de 2 horas por fila,
// los lotes acotados y el token guardado en el backend.
// Trae la Etapa del embarque y el ETD (inicial y, si no existe, actual).
// ============================================================

export interface DetalleFilaBandeja {
  documento_id: string;
  po: string | null;
  etapa: string | null;
  etd: string | null;
  actualizado: boolean;
  simulacion?: boolean;
  notas?: string;
}

export interface ResumenSincronizacionBandeja {
  ok: boolean;
  saltado?: boolean;
  mensaje?: string;
  simulacion?: boolean;
  total_bandeja?: number;
  filas_en_alcance?: number;
  procesados?: number;
  actualizados?: number;
  sin_datos?: number;
  errores?: number;
  consultas_api?: number;
  pendientes_restantes?: number;
  continuar?: boolean;
  detalle?: DetalleFilaBandeja[];
  error?: string;
}

export interface ResumenBarridoBandeja {
  ok: boolean;
  total_bandeja: number;
  lotes: number;
  procesados: number;
  actualizados: number;
  errores: number;
  pendientes_restantes: number;
  detalle: DetalleFilaBandeja[];
  motivo?: string;
  error?: string;
}

// Ventana: toda la bandeja se vuelve a consultar cada 2 horas.
export const INTERVALO_BANDEJA_MS = 2 * 60 * 60 * 1000;
// Si un barrido quedó a medias, se retoma pronto para completarlo.
export const INTERVALO_REANUDAR_BANDEJA_MS = 10 * 60 * 1000;
const PAUSA_ENTRE_LOTES_MS = 3000;
const MAX_LOTES_POR_BARRIDO = 60;
const LIMITE_POR_LOTE = 30;

const CLAVE_ULTIMO_BARRIDO = 'raga_bandeja_ultimo_barrido';
const CLAVE_PENDIENTES = 'raga_bandeja_pendientes';

async function mensajeDeErrorFuncion(error: unknown): Promise<string> {
  const contexto = (error as { context?: unknown } | null)?.context;
  if (contexto && typeof contexto === 'object' && typeof (contexto as Response).text === 'function') {
    try {
      const texto = await (contexto as Response).clone().text();
      const limpio = (texto || '').trim();
      if (limpio) {
        try {
          const cuerpo = JSON.parse(limpio) as Record<string, any>;
          const mensaje = String(cuerpo?.error || cuerpo?.message || '').trim();
          if (mensaje) return mensaje;
        } catch (_e) {
          return limpio.slice(0, 300);
        }
        return limpio.slice(0, 300);
      }
    } catch (_e) {
      // Se usa el mensaje genérico más abajo.
    }
  }
  const mensaje = error instanceof Error ? error.message : '';
  if (mensaje && !/non-2xx status code/i.test(mensaje)) return mensaje;
  return 'No se pudo sincronizar la bandeja con Raga.';
}

// Ejecuta un lote de sincronización.
export async function ejecutarSincronizacionBandeja(opts?: {
  force?: boolean;
  limite?: number;
  documentoIds?: string[];
}): Promise<ResumenSincronizacionBandeja> {
  try {
    const { data, error } = await supabase.functions.invoke('sincronizar-raga-bandeja', {
      body: {
        force: opts?.force === true,
        limite: opts?.limite ?? LIMITE_POR_LOTE,
        documento_ids: opts?.documentoIds ?? [],
      },
    });

    if (error) return { ok: false, error: await mensajeDeErrorFuncion(error) };
    if (!data) return { ok: false, error: 'La sincronización devolvió una respuesta vacía.' };
    if (data.ok === false) return { ok: false, error: data.error || 'La sincronización devolvió un error.' };
    return data as ResumenSincronizacionBandeja;
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error inesperado al sincronizar la bandeja.';
    return { ok: false, error: mensaje };
  }
}

// Encadena lotes hasta cubrir toda la bandeja (con pausa entre lote y lote).
export async function ejecutarBarridoBandeja(opts?: {
  force?: boolean;
  onProgreso?: (procesados: number, pendientes: number) => void;
  cancelado?: () => boolean;
  pausaMs?: number;
}): Promise<ResumenBarridoBandeja> {
  const acumulado: ResumenBarridoBandeja = {
    ok: true,
    total_bandeja: 0,
    lotes: 0,
    procesados: 0,
    actualizados: 0,
    errores: 0,
    pendientes_restantes: 0,
    detalle: [],
  };

  for (let lote = 1; lote <= MAX_LOTES_POR_BARRIDO; lote += 1) {
    if (opts?.cancelado?.()) break;

    const res = await ejecutarSincronizacionBandeja({
      // El forzado se mantiene en todos los lotes para que un clic manual
      // recorra la bandeja completa, no solo el primer lote.
      force: opts?.force === true,
      limite: LIMITE_POR_LOTE,
    });

    if (!res.ok) {
      acumulado.ok = false;
      acumulado.error = res.error;
      break;
    }
    if (res.saltado) {
      if (lote === 1) acumulado.motivo = res.mensaje;
      break;
    }

    acumulado.lotes = lote;
    if (res.total_bandeja) acumulado.total_bandeja = res.total_bandeja;
    acumulado.procesados += res.procesados || 0;
    acumulado.actualizados += res.actualizados || 0;
    acumulado.errores += res.errores || 0;
    acumulado.pendientes_restantes = res.pendientes_restantes || 0;
    if (res.detalle) acumulado.detalle.push(...res.detalle);

    opts?.onProgreso?.(acumulado.procesados, acumulado.pendientes_restantes);

    // Si un lote no revisó ninguna fila, no tiene sentido seguir encadenando.
    if ((res.procesados || 0) === 0) break;
    if (!res.continuar || acumulado.pendientes_restantes === 0) break;
    if (!(await esperarCancelable(opts?.pausaMs ?? PAUSA_ENTRE_LOTES_MS, opts?.cancelado))) break;
  }

  return acumulado;
}

// Ejecuta un barrido compartido: si ya hay uno en curso, se reutiliza en lugar
// de ignorar la petición. Así el botón "Sincronizar ahora" nunca queda mudo.
export type ProgresoBarridoBandeja = { procesados: number; pendientes: number };

interface BarridoEnCurso {
  promesa: Promise<ResumenBarridoBandeja>;
  forzado: boolean;
}

const oyentesProgreso = new Set<(p: ProgresoBarridoBandeja) => void>();
let barridoEnCurso: BarridoEnCurso | null = null;

// Permite que cualquier parte de la app se entere del avance del barrido.
export function suscribirProgresoBandeja(
  oyente: (p: ProgresoBarridoBandeja) => void
): () => void {
  oyentesProgreso.add(oyente);
  return () => {
    oyentesProgreso.delete(oyente);
  };
}

export function hayBarridoBandejaEnCurso(): boolean {
  return barridoEnCurso !== null;
}

export function ejecutarBarridoCompartido(opts?: {
  force?: boolean;
  onProgreso?: (procesados: number, pendientes: number) => void;
  cancelado?: () => boolean;
}): Promise<ResumenBarridoBandeja> {
  if (barridoEnCurso) {
    const actual = barridoEnCurso;
    // Si el usuario pidió forzar y el barrido en curso no era forzado,
    // se encola una pasada forzada al terminar.
    if (opts?.force === true && !actual.forzado) {
      return actual.promesa
        .catch(() => null)
        .then(() => {
          if (barridoEnCurso === actual) barridoEnCurso = null;
          return ejecutarBarridoCompartido(opts);
        });
    }
    return actual.promesa;
  }

  const registro: Partial<BarridoEnCurso> = { forzado: opts?.force === true };
  const promesa = ejecutarBarridoBandeja({
    force: opts?.force === true,
    cancelado: opts?.cancelado,
    onProgreso: (procesados, pendientes) => {
      opts?.onProgreso?.(procesados, pendientes);
      oyentesProgreso.forEach((oyente) => {
        try {
          oyente({ procesados, pendientes });
        } catch (_e) {
          // Un oyente roto no debe cortar el barrido.
        }
      });
    },
  }).finally(() => {
    if (barridoEnCurso === (registro as BarridoEnCurso)) barridoEnCurso = null;
  });

  registro.promesa = promesa;
  barridoEnCurso = registro as BarridoEnCurso;
  return promesa;
}

function esperarCancelable(ms: number, cancelado?: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const paso = 1000;
    let restante = ms;
    const tic = setInterval(() => {
      if (cancelado?.()) {
        clearInterval(tic);
        resolve(false);
        return;
      }
      restante -= paso;
      if (restante <= 0) {
        clearInterval(tic);
        resolve(true);
      }
    }, paso);
  });
}

// Después de guardar en Carga CAA: se piden Etapa y ETD de esas filas ya mismo.
export async function sincronizarDocumentosBandeja(documentoIds: string[]): Promise<ResumenSincronizacionBandeja> {
  if (!documentoIds || documentoIds.length === 0) {
    return { ok: true, procesados: 0 };
  }
  return ejecutarSincronizacionBandeja({ force: true, documentoIds, limite: documentoIds.length });
}

export function pendientesBandeja(): number {
  try {
    const valor = Number(window.localStorage.getItem(CLAVE_PENDIENTES) || '0');
    return Number.isFinite(valor) && valor > 0 ? valor : 0;
  } catch (_e) {
    return 0;
  }
}

export function intervaloBandejaMs(): number {
  return pendientesBandeja() > 0 ? INTERVALO_REANUDAR_BANDEJA_MS : INTERVALO_BANDEJA_MS;
}

// ¿Ya pasaron 2 horas desde el último barrido de la bandeja?
export function debeSincronizarBandeja(): boolean {
  try {
    const guardado = window.localStorage.getItem(CLAVE_ULTIMO_BARRIDO);
    if (!guardado) return true;
    const t = Number(guardado);
    if (!Number.isFinite(t)) return true;
    return Date.now() - t >= intervaloBandejaMs();
  } catch (_e) {
    return false;
  }
}

export function marcarBarridoBandeja(pendientes = 0): void {
  try {
    window.localStorage.setItem(CLAVE_ULTIMO_BARRIDO, String(Date.now()));
    window.localStorage.setItem(CLAVE_PENDIENTES, String(Math.max(0, pendientes)));
  } catch (_e) {
    // Sin localStorage se reintenta en la próxima visita.
  }
}

export function proximaSincronizacionBandeja(): Date | null {
  try {
    const guardado = window.localStorage.getItem(CLAVE_ULTIMO_BARRIDO);
    if (!guardado) return null;
    const t = Number(guardado);
    if (!Number.isFinite(t)) return null;
    return new Date(t + intervaloBandejaMs());
  } catch (_e) {
    return null;
  }
}