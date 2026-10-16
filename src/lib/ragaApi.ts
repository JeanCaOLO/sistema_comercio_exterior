import { supabase } from './supabase';

// ============================================================
// CLIENTE DE LA API DE RAGA (OLO Adapter)
// El navegador NUNCA llama a Raga directamente ni conoce las URLs.
// Toda la comunicación pasa por la Edge Function "raga-olo", que lee
// la configuración centralizada (QA / Producción) desde variables de
// entorno del backend.
// ============================================================

export interface RagaResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function invocarRaga<T>(body: Record<string, unknown>): Promise<RagaResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('raga-olo', { body });
    if (error) {
      return { ok: false, error: error.message || 'No se pudo contactar el servicio de Raga.' };
    }
    if (!data) {
      return { ok: false, error: 'El servicio de Raga devolvió una respuesta vacía.' };
    }
    if (data.ok === false) {
      return { ok: false, error: data.error || 'Raga devolvió un error.' };
    }
    return { ok: true, data: data.data as T };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error inesperado al contactar Raga.';
    return { ok: false, error: mensaje };
  }
}

// Consulta una orden de compra por número en Raga.
export function buscarPurchaseOrder(orderNumber: string) {
  return invocarRaga<unknown>({ action: 'get-purchase-order', order_number: orderNumber });
}

// Actualiza el ETD Inicial de una PO en Raga. SOLO debe ejecutarse tras una aprobación autorizada.
export function actualizarEtdInicialRaga(params: {
  orderNumber: string;
  tradingCompany: string;
  dateEtdInitial: string;
}) {
  return invocarRaga<unknown>({
    action: 'update-etd-initial',
    order_number: params.orderNumber,
    trading_company: params.tradingCompany,
    date_etd_initial: params.dateEtdInitial,
  });
}

// --- Utilidades de normalización (la forma exacta del JSON puede variar) ---

// Devuelve la lista de POs contenido en la respuesta, contemplando varias formas posibles.
export function normalizarListaPos(payload: unknown): Record<string, any>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Record<string, any>[];
  if (typeof payload !== 'object') return [];
  const obj = payload as Record<string, any>;
  for (const clave of ['data', 'purchase_orders', 'orders', 'results']) {
    if (Array.isArray(obj[clave])) return obj[clave] as Record<string, any>[];
  }
  if (obj.data && typeof obj.data === 'object') {
    const anidado = obj.data as Record<string, unknown>;
    for (const clave of ['data', 'purchase_orders', 'orders', 'results']) {
      if (Array.isArray(anidado[clave])) return anidado[clave] as Record<string, any>[];
    }
  }
  // Si es un único objeto con campos propios, lo tratamos como una sola PO.
  if (Object.keys(obj).length > 0) return [obj];
  return [];
}

// Selecciona la PO que coincide con el número y, si aplica, la compañía.
export function extraerPo(
  payload: unknown,
  orderNumber: string,
  tradingCompany?: string
): Record<string, any> | null {
  const lista = normalizarListaPos(payload);
  const numero = (orderNumber || '').trim().toLowerCase();
  const compania = (tradingCompany || '').trim().toLowerCase();

  const coincidenNumero = lista.filter(
    (po) => String(po.order_number ?? po.po_number ?? '').trim().toLowerCase() === numero
  );
  if (coincidenNumero.length === 0) return null;
  if (coincidenNumero.length === 1) return coincidenNumero[0];

  if (compania) {
    const porCompania = coincidenNumero.find(
      (po) => String(po.trading_company ?? '').trim().toLowerCase() === compania
    );
    if (porCompania) return porCompania;
  }
  return coincidenNumero[0];
}

// Normaliza un valor de fecha a formato YYYY-MM-DD (para inputs de fecha y comparaciones).
export function normalizarFecha(valor: unknown): string {
  if (!valor) return '';
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return '';
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}