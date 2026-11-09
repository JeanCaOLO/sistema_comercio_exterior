import { supabase } from './supabase';

// ============================================================
// SINCRONIZACIÓN CON RAGA (DROPSHIP Y ZF)
// El navegador nunca llama a Raga: siempre pasa por la Edge Function
// "sincronizar-raga-dropship", que aplica los límites de frecuencia,
// el bloqueo de corridas y el registro en el historial.
// ============================================================

export interface CambioSincronizado {
  antes: string;
  despues: string;
}

export interface DetalleTicketSincronizado {
  expediente_id: string;
  po: string | null;
  resultado: string;
  cambios?: Record<string, CambioSincronizado>;
}

export interface ResumenSincronizacionRaga {
  ok: boolean;
  saltado?: boolean;
  motivo?: string;
  corrida_id?: string;
  simulacion?: boolean;
  tickets_revisados?: number;
  tickets_en_alcance?: number;
  pendientes_restantes?: number;
  continuar?: boolean;
  consultas_api?: number;
  tickets_actualizados?: number;
  tickets_sin_cambios?: number;
  errores?: number;
  avisos_enviados?: number;
  detalle?: DetalleTicketSincronizado[];
  error?: string;
}

// Resultado de un barrido completo (varios lotes encadenados).
export interface ResumenBarrido {
  ok: boolean;
  lotes: number;
  tickets_revisados: number;
  tickets_actualizados: number;
  tickets_sin_cambios: number;
  consultas_api: number;
  errores: number;
  avisos_enviados: number;
  pendientes_restantes: number;
  detalle: DetalleTicketSincronizado[];
  motivo?: string;
  error?: string;
}

export interface CorridaSincronizacion {
  id: string;
  origen: string;
  estado: string;
  iniciado_at: string;
  finalizado_at: string | null;
  ejecutado_por: string | null;
  tickets_revisados: number;
  consultas_api: number;
  tickets_actualizados: number;
  tickets_sin_cambios: number;
  errores: number;
  detalle: string | null;
}

// Intervalo mínimo entre barridos automáticos (una ventana de 6 horas).
export const INTERVALO_AUTOMATICO_MS = 6 * 60 * 60 * 1000;
// Si un barrido quedó a medias (se cerró la pestaña), se retoma pronto.
export const INTERVALO_REANUDAR_MS = 10 * 60 * 1000;
// Pausa entre lote y lote para repartir la carga de la API.
export const PAUSA_ENTRE_LOTES_MS = 90 * 1000;
const MAX_LOTES_POR_BARRIDO = 15;
const CLAVE_ULTIMO_AUTOMATICO = 'raga_sync_dropship_ultimo_auto';
const CLAVE_PENDIENTES = 'raga_sync_dropship_pendientes';

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
      // Se intenta con el mensaje genérico más abajo.
    }
  }
  const mensaje = error instanceof Error ? error.message : '';
  if (mensaje && !/non-2xx status code/i.test(mensaje)) return mensaje;
  return 'No se pudo ejecutar la sincronización con Raga.';
}

// Ejecuta una corrida de sincronización.
// force = true ignora el intervalo de 6 horas (botón "Sincronizar ahora").
export async function ejecutarSincronizacionRaga(opts?: {
  force?: boolean;
  limite?: number;
  simular?: boolean;
}): Promise<ResumenSincronizacionRaga> {
  try {
    const { data, error } = await supabase.functions.invoke('sincronizar-raga-dropship', {
      body: {
        force: opts?.force === true,
        limite: opts?.limite ?? 25,
        dry_run: opts?.simular === true,
      },
    });

    if (error) {
      return { ok: false, error: await mensajeDeErrorFuncion(error) };
    }
    if (!data) {
      return { ok: false, error: 'La sincronización devolvió una respuesta vacía.' };
    }
    if (data.ok === false) {
      return { ok: false, error: data.error || 'La sincronización devolvió un error.' };
    }
    return data as ResumenSincronizacionRaga;
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error inesperado al sincronizar con Raga.';
    return { ok: false, error: mensaje };
  }
}

export interface ProgresoBarrido {
  lote: number;
  maxLotes: number;
  tickets_revisados: number;
  pendientes_restantes: number;
}

// Ejecuta un barrido completo: encadena lotes hasta cubrir todos los tickets de
// los estados en alcance, dejando una pausa entre lote y lote para no saturar
// ni la API de Raga ni el sistema.
export async function ejecutarBarridoRaga(opts?: {
  force?: boolean;
  limite?: number;
  onProgreso?: (p: ProgresoBarrido) => void;
  cancelado?: () => boolean;
  pausaMs?: number;
}): Promise<ResumenBarrido> {
  const acumulado: ResumenBarrido = {
    ok: true,
    lotes: 0,
    tickets_revisados: 0,
    tickets_actualizados: 0,
    tickets_sin_cambios: 0,
    consultas_api: 0,
    errores: 0,
    avisos_enviados: 0,
    pendientes_restantes: 0,
    detalle: [],
  };

  for (let lote = 1; lote <= MAX_LOTES_POR_BARRIDO; lote += 1) {
    if (opts?.cancelado?.()) break;

    const res = await ejecutarSincronizacionRaga({
      // Solo el primer lote puede ignorar la ventana de 6 horas.
      force: opts?.force === true && lote === 1,
      limite: opts?.limite ?? 20,
    });

    if (!res.ok) {
      acumulado.ok = false;
      acumulado.error = res.error;
      break;
    }
    if (res.saltado) {
      if (lote === 1) acumulado.motivo = res.motivo;
      break;
    }

    acumulado.lotes = lote;
    acumulado.tickets_revisados += res.tickets_revisados || 0;
    acumulado.tickets_actualizados += res.tickets_actualizados || 0;
    acumulado.tickets_sin_cambios += res.tickets_sin_cambios || 0;
    acumulado.consultas_api += res.consultas_api || 0;
    acumulado.errores += res.errores || 0;
    acumulado.avisos_enviados += res.avisos_enviados || 0;
    acumulado.pendientes_restantes = res.pendientes_restantes || 0;
    if (res.detalle) acumulado.detalle.push(...res.detalle);

    opts?.onProgreso?.({
      lote,
      maxLotes: MAX_LOTES_POR_BARRIDO,
      tickets_revisados: acumulado.tickets_revisados,
      pendientes_restantes: acumulado.pendientes_restantes,
    });

    if (!res.continuar || acumulado.pendientes_restantes === 0) break;
    if (!(await esperarCancelable(opts?.pausaMs ?? PAUSA_ENTRE_LOTES_MS, opts?.cancelado))) break;
  }

  return acumulado;
}

// Espera en tramos cortos para poder cancelar si se cierra la vista.
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

// Última corrida registrada (para mostrar el estado en pantalla).
export async function obtenerUltimaCorrida(): Promise<CorridaSincronizacion | null> {
  try {
    const { data, error } = await supabase
      .from('raga_sync_corridas')
      .select('*')
      .order('iniciado_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as CorridaSincronizacion) || null;
  } catch (_e) {
    return null;
  }
}

// Cantidad de tickets rastreados, con datos y con error (para el resumen).
export async function obtenerResumenControl(): Promise<{
  rastreados: number;
  conDatos: number;
  conError: number;
}> {
  try {
    const { data, error } = await supabase
      .from('raga_sync_dropship')
      .select('resultado, cambios');
    if (error || !data) return { rastreados: 0, conDatos: 0, conError: 0 };

    const filas = data as Array<{ resultado: string | null; cambios: number | null }>;
    return {
      rastreados: filas.length,
      conDatos: filas.filter((f) => (f.cambios || 0) > 0).length,
      conError: filas.filter((f) => f.resultado === 'ERROR').length,
    };
  } catch (_e) {
    return { rastreados: 0, conDatos: 0, conError: 0 };
  }
}

// Tickets que Raga ya completó o corrigió (para el listado del panel).
export interface TicketActualizadoRaga {
  expediente_id: string;
  po_tiquetera: string | null;
  ultima_ok_at: string | null;
  cambios: number;
  detalle: string | null;
}

// Últimos tickets actualizados por Raga, del más reciente al más antiguo.
export async function obtenerUltimosTicketsActualizadosRaga(
  limite = 30
): Promise<TicketActualizadoRaga[]> {
  try {
    const { data, error } = await supabase
      .from('raga_sync_dropship')
      .select('expediente_id, po_tiquetera, ultima_ok_at, cambios, detalle')
      .eq('resultado', 'ACTUALIZADO')
      .order('ultima_ok_at', { ascending: false })
      .limit(limite);

    if (error || !data) return [];
    return data as TicketActualizadoRaga[];
  } catch (_e) {
    return [];
  }
}

// Estados que cubre la sincronización (mismos que usa la Edge Function).
export const ESTADOS_EN_ALCANCE_DROPSHIP = [
  'Asignado',
  'En Proceso',
  'Liberación',
  'Liberacion',
  'Liberado',
  'LIBERADO',
];

// ZF no tiene "Liberación": se sincroniza mientras el tíquete sigue abierto.
export const ESTADOS_EN_ALCANCE_ZF = ['Asignado', 'En Proceso', 'Espera de Respuesta'];

// Estados que barre Raga en ambos módulos.
export const ESTADOS_EN_ALCANCE_RAGA = [
  ...ESTADOS_EN_ALCANCE_DROPSHIP,
  ...ESTADOS_EN_ALCANCE_ZF,
];

export type ModuloRagaSync = 'dropship' | 'zf';

// Cobertura de datos de embarque de los tickets Dropship en alcance.
export interface CoberturaEmbarque {
  total: number;
  completos: number;
  sinBl: number;
  sinContenedor: number;
  sinFechas: number;
  pendientes: number;
  porcentajeCompletos: number;
}

export const crearCoberturaVacia = (): CoberturaEmbarque => ({
  total: 0,
  completos: 0,
  sinBl: 0,
  sinContenedor: 0,
  sinFechas: 0,
  pendientes: 0,
  porcentajeCompletos: 0,
});

const tieneTexto = (valor: unknown): boolean => String(valor ?? '').trim().length > 0;

// Cuenta, entre los tickets en los estados que barre Raga,
// cuántos ya tienen todo y cuántos siguen sin BL, sin contenedor o sin fechas.
export async function obtenerCoberturaEmbarque(
  tipoModulo: ModuloRagaSync = 'dropship'
): Promise<CoberturaEmbarque> {
  try {
    const estados = tipoModulo === 'zf' ? ESTADOS_EN_ALCANCE_ZF : ESTADOS_EN_ALCANCE_DROPSHIP;
    const { data, error } = await supabase
      .from('expedientes')
      .select('id, numero_bl, numero_contenedor, etd, eta_real')
      .eq('tipo_modulo', tipoModulo)
      .in('estado_expediente', estados);

    if (error || !data) return crearCoberturaVacia();

    const filas = data as Array<{
      numero_bl: string | null;
      numero_contenedor: string | null;
      etd: string | null;
      eta_real: string | null;
    }>;

    const total = filas.length;
    if (total === 0) return crearCoberturaVacia();

    const sinBl = filas.filter((f) => !tieneTexto(f.numero_bl)).length;
    const sinContenedor = filas.filter((f) => !tieneTexto(f.numero_contenedor)).length;
    // ZF no maneja ETD: solo se controla la ETA Real.
    const sinFechas = tipoModulo === 'zf'
      ? filas.filter((f) => !tieneTexto(f.eta_real)).length
      : filas.filter((f) => !tieneTexto(f.etd) || !tieneTexto(f.eta_real)).length;
    const pendientes = filas.filter(
      (f) => !tieneTexto(f.numero_bl) || !tieneTexto(f.numero_contenedor)
    ).length;
    const completos = total - pendientes;

    return {
      total,
      completos,
      sinBl,
      sinContenedor,
      sinFechas,
      pendientes,
      porcentajeCompletos: Math.round((completos / total) * 100),
    };
  } catch (_e) {
    return crearCoberturaVacia();
  }
}

// ¿Ya pasaron las 6 horas desde el último barrido automático de este navegador?
// Si el barrido anterior quedó con tickets pendientes, se retoma mucho antes
// para terminar de cubrirlos dentro de la misma ventana.
export function debeEjecutarseAutomatico(): boolean {
  try {
    const guardado = window.localStorage.getItem(CLAVE_ULTIMO_AUTOMATICO);
    if (!guardado) return true;
    const t = Number(guardado);
    if (!Number.isFinite(t)) return true;
    return Date.now() - t >= intervaloAutomaticoMs();
  } catch (_e) {
    return false;
  }
}

export function pendientesDelUltimoBarrido(): number {
  try {
    const valor = Number(window.localStorage.getItem(CLAVE_PENDIENTES) || '0');
    return Number.isFinite(valor) && valor > 0 ? valor : 0;
  } catch (_e) {
    return 0;
  }
}

export function intervaloAutomaticoMs(): number {
  return pendientesDelUltimoBarrido() > 0 ? INTERVALO_REANUDAR_MS : INTERVALO_AUTOMATICO_MS;
}

export function marcarEjecucionAutomatica(pendientes = 0): void {
  try {
    window.localStorage.setItem(CLAVE_ULTIMO_AUTOMATICO, String(Date.now()));
    window.localStorage.setItem(CLAVE_PENDIENTES, String(Math.max(0, pendientes)));
  } catch (_e) {
    // Sin localStorage simplemente se reintenta en la próxima sesión.
  }
}

export function proximaEjecucionAutomatica(): Date | null {
  try {
    const guardado = window.localStorage.getItem(CLAVE_ULTIMO_AUTOMATICO);
    if (!guardado) return null;
    const t = Number(guardado);
    if (!Number.isFinite(t)) return null;
    return new Date(t + intervaloAutomaticoMs());
  } catch (_e) {
    return null;
  }
}