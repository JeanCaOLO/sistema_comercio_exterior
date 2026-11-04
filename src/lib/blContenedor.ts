import { supabase } from './supabase';

// ============================================================
// BL Y CONTENEDOR · AGENTES DE CARGA
// El navegador nunca escribe directo en Raga: envía los datos a la
// Edge Function "actualizar-bl-contenedor-raga", que actualiza la PO,
// sincroniza el ticket local y deja la bitácora del cambio.
// ============================================================

export type EstadoCambioBl = 'APLICADO' | 'PARCIAL' | 'ERROR';

export interface EventoCambioBl {
  id: string;
  order_number: string;
  trading_company: string | null;
  previous_bl: string | null;
  new_bl: string | null;
  previous_container: string | null;
  new_container: string | null;
  change_reason: string;
  other_reason_detail: string | null;
  status: EstadoCambioBl;
  api_env: string;
  api_error: string | null;
  campos_aplicados: string[] | null;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_by_email: string | null;
  expedientes_actualizados: number | null;
  requested_at: string;
}

export interface ResultadoEnvioBl {
  ok: boolean;
  status?: EstadoCambioBl;
  error?: string;
  aplicados?: string[];
  errores?: string[];
  anterior_bl?: string;
  anterior_contenedor?: string;
  nuevo_bl?: string;
  nuevo_contenedor?: string;
  expedientes_actualizados?: number;
  trading_company?: string;
  event_id?: string | null;
}

export const MOTIVOS_CAMBIO_BL: string[] = [
  'BL emitido por el agente de carga',
  'Corrección de N° de BL',
  'Contenedor asignado por la naviera',
  'Cambio de contenedor',
  'Corrección de N° de contenedor',
  'Transbordo / cambio de ruta',
  'Otro',
];

export const ESTADOS_CAMBIO_BL: Record<EstadoCambioBl, {
  label: string;
  clase: string;
  icono: string;
}> = {
  APLICADO: {
    label: 'Aplicado',
    clase: 'bg-emerald-100 text-emerald-800',
    icono: 'ri-checkbox-circle-line',
  },
  PARCIAL: {
    label: 'Parcial',
    clase: 'bg-amber-100 text-amber-800',
    icono: 'ri-error-warning-line',
  },
  ERROR: {
    label: 'Error',
    clase: 'bg-red-100 text-red-800',
    icono: 'ri-close-circle-line',
  },
};

// Estados del tablero Dropship que los agentes de carga completan.
export const ESTADOS_DROPSHIP_BL = [
  'Asignado',
  'En Proceso',
  'Liberación',
  'Liberacion',
  'Liberado',
  'LIBERADO',
];

export const NOMBRES_CANDIDATOS_BL = ['bill_of_lading', 'mbl_number', 'hbl_number'];
export const NOMBRES_CANDIDATOS_CONTENEDOR = ['container_number', 'container'];

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

// ─────────────────────────────────────────────────────────────
// Lectura de la PO de Raga
// ─────────────────────────────────────────────────────────────

export function valorBl(po: Record<string, any> | null | undefined): string {
  if (!po) return '';
  for (const clave of NOMBRES_CANDIDATOS_BL) {
    const valor = texto(po[clave]).toUpperCase();
    if (valor && !['NULL', 'N/A', 'NA', '-'].includes(valor)) return valor;
  }
  return '';
}

export function valorContenedor(po: Record<string, any> | null | undefined): string {
  if (!po) return '';
  for (const clave of NOMBRES_CANDIDATOS_CONTENEDOR) {
    const valor = texto(po[clave]).toUpperCase();
    if (valor && !['NULL', 'N/A', 'NA', '-'].includes(valor)) return valor;
  }
  return '';
}

export function valorCampoPo(po: Record<string, any> | null | undefined, ...claves: string[]): string {
  if (!po) return '';
  for (const clave of claves) {
    const valor = texto(po[clave]);
    if (valor) return valor;
  }
  return '';
}

// ─────────────────────────────────────────────────────────────
// Envío a Raga
// ─────────────────────────────────────────────────────────────

async function mensajeDeErrorFuncion(error: unknown): Promise<string> {
  const contexto = (error as { context?: unknown } | null)?.context;
  if (contexto && typeof contexto === 'object' && typeof (contexto as Response).text === 'function') {
    try {
      const respuesta = await (contexto as Response).clone().text();
      const limpio = (respuesta || '').trim();
      if (limpio) {
        try {
          const cuerpo = JSON.parse(limpio) as Record<string, any>;
          const mensaje = String(cuerpo?.error || cuerpo?.message || cuerpo?.meta?.message || '').trim();
          if (mensaje) return mensaje;
        } catch (_e) {
          return limpio.slice(0, 300);
        }
        return limpio.slice(0, 300);
      }
    } catch (_e) {
      // Se usa el mensaje genérico de abajo.
    }
  }
  const mensaje = error instanceof Error ? error.message : '';
  if (mensaje && !/non-2xx status code/i.test(mensaje)) return mensaje;
  return 'No se pudo actualizar el BL y el contenedor en Raga.';
}

export interface EnvioBlParams {
  orderNumber: string;
  tradingCompany?: string;
  bl?: string;
  contenedor?: string;
  motivo: string;
  detalleMotivo?: string;
  apiEnv?: 'qa' | 'production';
}

export async function enviarCambioBlContenedor(params: EnvioBlParams): Promise<ResultadoEnvioBl> {
  try {
    const { data, error } = await supabase.functions.invoke('actualizar-bl-contenedor-raga', {
      body: {
        order_number: params.orderNumber,
        trading_company: params.tradingCompany || null,
        bl: params.bl || null,
        contenedor: params.contenedor || null,
        change_reason: params.motivo,
        other_reason_detail: params.detalleMotivo || null,
        api_env: params.apiEnv || 'production',
      },
    });

    if (error) return { ok: false, error: await mensajeDeErrorFuncion(error) };
    if (!data) return { ok: false, error: 'La actualización devolvió una respuesta vacía.' };
    return data as ResultadoEnvioBl;
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error inesperado al actualizar el BL y el contenedor.';
    return { ok: false, error: mensaje };
  }
}

// ─────────────────────────────────────────────────────────────
// Bitácora
// ─────────────────────────────────────────────────────────────

export async function listarCambiosBl(limite = 1500): Promise<EventoCambioBl[]> {
  try {
    const { data, error } = await supabase
      .from('carga_bl_change_events')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(limite);

    if (error) throw error;
    return (data || []) as unknown as EventoCambioBl[];
  } catch (error) {
    console.error('[BL] No se pudo cargar la bitácora:', error);
    throw new Error('No se pudo cargar la bitácora de cambios de BL y contenedor.');
  }
}

export async function obtenerCambioBlPorId(id: string): Promise<EventoCambioBl | null> {
  try {
    const { data, error } = await supabase
      .from('carga_bl_change_events')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as EventoCambioBl;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Tickets locales vinculados
// ─────────────────────────────────────────────────────────────

export interface TicketVinculado {
  id: string;
  exp_id: string | null;
  po_tiquetera: string;
  numero_bl: string | null;
  numero_contenedor: string | null;
  estado_expediente: string | null;
  tipo_modulo: string | null;
}

export function poCoincide(poTiquetera: string | null | undefined, orderNumber: string): boolean {
  const partes = texto(poTiquetera)
    .split(/[/,;|\n]+/)
    .map((p) => p.trim().toUpperCase());
  return partes.includes(orderNumber.trim().toUpperCase());
}

export async function buscarTicketsPorPo(orderNumber: string): Promise<TicketVinculado[]> {
  const numero = orderNumber.trim();
  if (!numero) return [];
  try {
    const { data, error } = await supabase
      .from('expedientes')
      .select('id, exp_id, po_tiquetera, numero_bl, numero_contenedor, estado_expediente, tipo_modulo')
      .ilike('po_tiquetera', `%${numero}%`)
      .limit(30);

    if (error || !data) return [];
    return (data as unknown as TicketVinculado[]).filter((t) => poCoincide(t.po_tiquetera, numero));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Tickets Dropship a los que les falta BL o contenedor
// ─────────────────────────────────────────────────────────────

export interface TicketPendienteBl {
  id: string;
  exp_id: string | null;
  po_tiquetera: string;
  numero_bl: string | null;
  numero_contenedor: string | null;
  estado_expediente: string | null;
}

export async function listarTicketsPendientesBl(): Promise<TicketPendienteBl[]> {
  try {
    const { data, error } = await supabase
      .from('expedientes')
      .select('id, exp_id, po_tiquetera, numero_bl, numero_contenedor, estado_expediente')
      .eq('tipo_modulo', 'dropship')
      .in('estado_expediente', ESTADOS_DROPSHIP_BL)
      .limit(600);

    if (error || !data) return [];
    return (data as unknown as TicketPendienteBl[]).filter(
      (t) => !texto(t.numero_bl) || !texto(t.numero_contenedor)
    );
  } catch {
    return [];
  }
}

// Toma el primer número de PO de un ticket ("6703309 / 6703712" → "6703309").
export function poPrincipal(poTiquetera: string | null | undefined): string {
  const partes = texto(poTiquetera)
    .split(/[/,;|\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return partes[0] || '';
}

// ─────────────────────────────────────────────────────────────
// Métricas del dashboard
// ─────────────────────────────────────────────────────────────

export interface PuntoDia {
  fecha: string;
  etiqueta: string;
  total: number;
}

export interface ConteoEtiquetado {
  etiqueta: string;
  total: number;
}

export interface ResumenCambiosBl {
  total: number;
  aplicados: number;
  parciales: number;
  errores: number;
  blActualizados: number;
  contenedoresActualizados: number;
  ticketsActualizados: number;
  posImpactadas: number;
  agentes: ConteoEtiquetado[];
  motivos: ConteoEtiquetado[];
  porDia: PuntoDia[];
  ultimoCambio: EventoCambioBl | null;
}

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function calcularResumenBl(eventos: EventoCambioBl[], dias = 14): ResumenCambiosBl {
  const aplicados = eventos.filter((e) => e.status === 'APLICADO');
  const parciales = eventos.filter((e) => e.status === 'PARCIAL');
  const errores = eventos.filter((e) => e.status === 'ERROR');

  const campos = (e: EventoCambioBl): string[] => e.campos_aplicados || [];
  const blActualizados = eventos.filter((e) => campos(e).some((c) => c.toUpperCase() === 'BL')).length;
  const contenedoresActualizados = eventos.filter(
    (e) => campos(e).some((c) => c.toUpperCase().startsWith('CONTENEDOR'))
  ).length;
  const ticketsActualizados = eventos.reduce((acc, e) => acc + (e.expedientes_actualizados || 0), 0);
  const posImpactadas = new Set(
    eventos.filter((e) => e.status !== 'ERROR').map((e) => e.order_number.toUpperCase())
  ).size;

  const contar = (valores: string[]): ConteoEtiquetado[] => {
    const mapa = new Map<string, number>();
    valores.forEach((v) => {
      const clave = (v || '').trim() || 'Sin especificar';
      mapa.set(clave, (mapa.get(clave) || 0) + 1);
    });
    return Array.from(mapa.entries())
      .map(([etiqueta, total]) => ({ etiqueta, total }))
      .sort((a, b) => b.total - a.total);
  };

  // Serie diaria continua (incluye días sin cambios).
  const porDia: PuntoDia[] = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  for (let i = dias - 1; i >= 0; i -= 1) {
    const dia = new Date(hoy.getTime() - i * 86400000);
    const clave = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
    const total = eventos.filter((e) => (e.requested_at || '').slice(0, 10) === clave).length;
    porDia.push({
      fecha: clave,
      etiqueta: `${DIAS_CORTO[dia.getDay()]} ${String(dia.getDate()).padStart(2, '0')}`,
      total,
    });
  }

  const ordenados = [...eventos].sort(
    (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
  );

  return {
    total: eventos.length,
    aplicados: aplicados.length,
    parciales: parciales.length,
    errores: errores.length,
    blActualizados,
    contenedoresActualizados,
    ticketsActualizados,
    posImpactadas,
    agentes: contar(eventos.map((e) => e.requested_by_name || e.requested_by_email || 'Sin identificar')).slice(0, 6),
    motivos: contar(eventos.map((e) => e.change_reason)).slice(0, 6),
    porDia,
    ultimoCambio: ordenados[0] || null,
  };
}

// Filas listas para exportar a Excel.
export function filasExportables(eventos: EventoCambioBl[]): Record<string, unknown>[] {
  return eventos.map((e) => ({
    PO: e.order_number,
    Compañía: e.trading_company || '',
    'BL anterior': e.previous_bl || '',
    'BL nuevo': e.new_bl || '',
    'Contenedor anterior': e.previous_container || '',
    'Contenedor nuevo': e.new_container || '',
    'Campos aplicados': (e.campos_aplicados || []).join(', '),
    Motivo: e.change_reason,
    Detalle: e.other_reason_detail || '',
    Estado: e.status,
    'Tickets actualizados': e.expedientes_actualizados || 0,
    'Cargado por': e.requested_by_name || e.requested_by_email || '',
    'Fecha de carga': e.requested_at,
    Entorno: e.api_env === 'production' ? 'Producción' : 'QA',
    Error: e.api_error || '',
  }));
}