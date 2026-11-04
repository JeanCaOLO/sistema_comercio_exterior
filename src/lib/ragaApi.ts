import { supabase } from './supabase';

// ============================================================
// CLIENTE DE LA API DE RAGA (OLO Adapter)
// El navegador NUNCA llama a Raga directamente ni conoce las URLs.
// Toda la comunicación pasa por la Edge Function "raga-olo", que lee
// la configuración centralizada (QA / Producción) desde variables de
// entorno del backend.
// ============================================================

export type RagaEnv = 'qa' | 'production';

export interface RagaResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const RAGA_ENV_LABEL: Record<RagaEnv, string> = {
  qa: 'QA',
  production: 'Producción',
};

// Extrae el mensaje real que devolvió la función, incluso cuando responde con
// un código HTTP de error (supabase-js lo entrega dentro de error.context).
async function extraerMensajeErrorFuncion(error: unknown): Promise<string> {
  const contexto = (error as { context?: unknown } | null)?.context;
  if (contexto && typeof contexto === 'object' && typeof (contexto as Response).text === 'function') {
    try {
      const texto = await (contexto as Response).clone().text();
      const limpio = (texto || '').trim();
      if (limpio) {
        try {
          const cuerpo = JSON.parse(limpio) as Record<string, any>;
          const mensaje = String(
            cuerpo?.error
            || cuerpo?.message
            || cuerpo?.meta?.message
            || cuerpo?.meta?.detail
            || '',
          ).trim();
          if (mensaje) return mensaje;
        } catch (_e) {
          return limpio.slice(0, 400);
        }
        return limpio.slice(0, 400);
      }
    } catch (_e) {
      // Sin cuerpo legible: se usa el mensaje genérico de abajo.
    }
  }

  const mensaje = error instanceof Error ? error.message : '';
  if (mensaje && !/non-2xx status code/i.test(mensaje)) return mensaje;
  return 'El servicio de Raga no respondió correctamente. Volvé a intentar en unos segundos.';
}

async function invocarRaga<T>(body: Record<string, unknown>): Promise<RagaResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('raga-olo', { body });
    if (error) {
      return { ok: false, error: await extraerMensajeErrorFuncion(error) };
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
export function buscarPurchaseOrder(orderNumber: string, apiEnv: RagaEnv = 'production') {
  return invocarRaga<unknown>({ action: 'get-purchase-order', order_number: orderNumber, api_env: apiEnv });
}

// Actualiza el ETD Inicial de una PO en Raga. SOLO debe ejecutarse tras una aprobación autorizada.
export function actualizarEtdInicialRaga(params: {
  orderNumber: string;
  tradingCompany: string;
  dateEtdInitial: string;
  apiEnv?: RagaEnv;
  requestId?: string;
}) {
  return invocarRaga<unknown>({
    action: 'update-etd-initial',
    order_number: params.orderNumber,
    trading_company: params.tradingCompany,
    date_etd_initial: params.dateEtdInitial,
    api_env: params.apiEnv || 'production',
    request_id: params.requestId || null,
  });
}

// --- Utilidades de normalización (la forma exacta del JSON puede variar) ---

export interface ResultadoActualizacionCampos {
  ok: boolean;
  error?: string;
  // Claves que se actualizaron correctamente (o que ya tenían el valor pedido).
  aplicados: string[];
  // Claves que quedaron sin aplicar por un error de la API.
  fallidos: string[];
  // Clave exacta que provocó el error, si hubo alguno.
  campoConError?: string;
}

// Actualiza una PO en Raga **campo por campo**: la API de Raga hace un
// Carbon::parse() sobre el valor recibido, por lo que enviar un booleano junto
// a una fecha en el mismo PUT rompe la petición completa. Se manda un PUT por
// cada campo, en orden, y se informa cuáles quedaron aplicados si alguno falla.
export async function actualizarCamposCompraRaga(params: {
  orderNumber: string;
  tradingCompany: string;
  fields: Record<string, string | boolean>;
  // Nombres legibles por clave, solo para los mensajes de error.
  etiquetas?: Record<string, string>;
  apiEnv?: RagaEnv;
  requestId?: string;
}): Promise<ResultadoActualizacionCampos> {
  const entradas = Object.entries(params.fields).filter(([clave, valor]) => {
    if (!clave) return false;
    if (typeof valor === 'boolean') return true;
    return String(valor ?? '').trim() !== '';
  });

  if (entradas.length === 0) {
    return { ok: false, aplicados: [], fallidos: [], error: 'No hay cambios para enviar a Raga.' };
  }

  const aplicados: string[] = [];

  for (const [clave, valor] of entradas) {
    const unaSola: Record<string, string | boolean> = { [clave]: valor };
    const res = await invocarRaga<unknown>({
      action: 'update-purchase-order-fields',
      order_number: params.orderNumber,
      trading_company: params.tradingCompany,
      fields: unaSola,
      api_env: params.apiEnv || 'production',
      request_id: params.requestId || null,
    });

    if (!res.ok) {
      const etiqueta = params.etiquetas?.[clave] || clave;
      const fallidos = entradas
        .map(([k]) => k)
        .filter((k) => !aplicados.includes(k));
      return {
        ok: false,
        aplicados,
        fallidos,
        campoConError: clave,
        error: `Raga rechazó el dato "${etiqueta}": ${res.error || 'error desconocido.'}`,
      };
    }

    aplicados.push(clave);
  }

  return { ok: true, aplicados, fallidos: [] };
}

// ============================================================
// DETECCIÓN DE CAMPOS DE LA PO
// La API de Next devuelve la orden con distintos nombres según la
// versión del esquema, por eso buscamos por patrones conocidos y,
// si no aparece ninguno, dejamos que el usuario elija la columna.
// ============================================================

export type CampoOrdenEditable = 'carga_lista' | 'incoterm';

const CANDIDATOS_CARGA_LISTA = [
  'date_theorical_load',
  'date_theoretical_load',
  'theoretical_load_date',
  'date_carga_lista_teorica',
  'carga_lista_teorica',
  'date_carga_lista',
  'carga_lista',
  'fecha_carga_lista_teorica',
  'fecha_carga_lista',
  'date_load_ready',
  'load_ready_date',
  'date_ready_to_load',
  'ready_to_load_date',
  'date_cargo_ready',
  'cargo_ready_date',
  'date_ready_date',
];

// Campos que guardan si la carga lista ya fue validada (booleano true/false).
const CANDIDATOS_CARGA_LISTA_VALIDADA = [
  'carga_lista_validada',
  'carga_lista_validado',
  'carga_lista_valida',
  'load_ready_validated',
  'load_ready_validada',
  'validated_load_ready',
  'carga_lista_validacion',
];

const CANDIDATOS_INCOTERM = [
  'incoterm_compra',
  'incoterms_compra',
  'incoterm_purchase',
  'purchase_incoterm',
  'incoterm',
  'incoterms',
  'incoterm_code',
];

const PALABRAS_CLAVE: Record<CampoOrdenEditable, string[]> = {
  carga_lista: [
    'theorical_load', 'theoretical_load', 'carga_lista_teorica', 'fecha_carga_lista_teorica',
    'carga_lista', 'load_ready', 'ready_to_load', 'cargo_ready', 'ready_date',
  ],
  incoterm: ['incoterm'],
};

// Una clave corresponde al flag "carga lista validada" cuando habla de validación
// y de carga lista. Se usa para no confundirla con la fecha teórica.
function esClaveValidacionCargaLista(clave: string): boolean {
  const normalizada = clave.trim().toLowerCase();
  if (!normalizada.includes('valid')) return false;
  return ['carga', 'load', 'ready', 'teorica', 'theorical'].some((p) => normalizada.includes(p));
}

// El flag "Carga Lista Validada" queda FUERA del módulo hasta confirmar el
// contrato real de Raga: su endpoint aplica Carbon::parse() al valor recibido y
// un booleano (true/false) rompe la petición con un 400. Esta función permite
// detectar solicitudes antiguas que todavía incluyan ese dato para omitirlo.
export function esClaveCargaListaValidada(clave: string | null | undefined): boolean {
  const texto = (clave || '').trim();
  if (!texto) return false;
  const normalizada = texto.toLowerCase();
  if (CANDIDATOS_CARGA_LISTA_VALIDADA.includes(normalizada)) return true;
  return esClaveValidacionCargaLista(normalizada);
}

// Devuelve la clave real del flag booleano "carga lista validada", si existe en la PO.
export function detectarClaveCargaListaValidada(
  po: Record<string, any> | null | undefined
): string | null {
  if (!po) return null;
  const claves = clavesDePo(po);

  for (const candidato of CANDIDATOS_CARGA_LISTA_VALIDADA) {
    const encontrada = claves.find((k) => k.trim().toLowerCase() === candidato);
    if (encontrada) return encontrada;
  }

  return claves.find((k) => esClaveValidacionCargaLista(k)) || null;
}

// ─────────────────────────────────────────────────────────────
// BLOQUE DE CARGA LISTA
// Next devuelve varias fechas del proceso de carga lista. Cada una se identifica
// por su nombre técnico conocido y, si no aparece, por palabra clave. El mismo
// catálogo alimenta la pantalla de solicitud para que el usuario elija qué dato
// quiere actualizar.
// ─────────────────────────────────────────────────────────────

export type TipoDatoCargaLista = 'fecha' | 'booleano';

export interface CampoDetectado {
  id: string;
  etiqueta: string;
  tipo: TipoDatoCargaLista;
  clave: string | null;
  valor: string;
}

interface DefinicionCargaLista {
  id: string;
  etiqueta: string;
  tipo: TipoDatoCargaLista;
  candidatos: string[];
  palabras: string[];
}

// En el módulo de Carga Lista solo se editan estos dos datos: fecha teórica y
// fecha variable. El flag "Carga Lista Validada" se retiró hasta confirmar el
// contrato real de Raga (su endpoint no acepta un booleano).
const CAMPOS_CARGA_LISTA: DefinicionCargaLista[] = [
  {
    // La fecha teórica es el dato principal del módulo: en el esquema de Next
    // la columna se llama exactamente "date_theorical_load".
    id: 'teorica',
    etiqueta: 'Carga Lista Teórica',
    tipo: 'fecha',
    candidatos: CANDIDATOS_CARGA_LISTA,
    palabras: [
      'theorical_load',
      'theoretical_load',
      'carga_lista_teorica',
      'fecha_carga_lista_teorica',
      'load_ready',
      'ready_to_load',
      'cargo_ready',
      'ready_date',
    ],
  },
  {
    id: 'variable',
    etiqueta: 'Carga Lista Variable',
    tipo: 'fecha',
    candidatos: [
      'date_variable_date',
      'date_variable_load',
      'variable_load_date',
      'date_carga_lista_variable',
      'carga_lista_variable',
      'fecha_carga_lista_variable',
      'variable_date',
      'date_load_variable',
      'load_variable_date',
      'date_variable_load_ready',
      'date_variable',
      'variable_load',
    ],
    palabras: [
      'date_variable',
      'variable_load',
      'carga_lista_variable',
      'load_variable',
      'variable_date',
      'fecha_carga_lista_variable',
    ],
  },
];

// Devuelve los datos del bloque de carga lista que trae la PO, con la clave
// técnica detectada y el valor actual de cada uno.
export function detectarCamposCargaLista(
  po: Record<string, any> | null | undefined
): CampoDetectado[] {
  if (!po) {
    return CAMPOS_CARGA_LISTA.map((def) => ({
      id: def.id,
      etiqueta: def.etiqueta,
      tipo: def.tipo,
      clave: null,
      valor: '',
    }));
  }

  // Se incluyen también las columnas cuyo valor viene vacío: así el campo se
  // reconoce por su nombre técnico aunque todavía no tenga fecha cargada.
  const claves = clavesDePoCompletas(po);
  const usadas = new Set<string>();
  const asignadas = new Map<string, string>();

  const tomar = (id: string, clave: string) => {
    asignadas.set(id, clave);
    usadas.add(clave);
  };

  // 1) Coincidencia exacta con los nombres técnicos conocidos.
  for (const def of CAMPOS_CARGA_LISTA) {
    const encontrada = claves.find(
      (k) => !usadas.has(k) && def.candidatos.includes(k.trim().toLowerCase())
    );
    if (encontrada) tomar(def.id, encontrada);
  }

  // 2) Coincidencia por palabra clave sobre las columnas que quedaron libres.
  for (const def of CAMPOS_CARGA_LISTA) {
    if (asignadas.has(def.id)) continue;
    const encontrada = claves.find((k) => {
      if (usadas.has(k)) return false;
      const normalizada = k.trim().toLowerCase();
      return def.palabras.some((p) => normalizada.includes(p));
    });
    if (encontrada) tomar(def.id, encontrada);
  }

  return CAMPOS_CARGA_LISTA.map((def) => {
    const clave = asignadas.get(def.id) || null;
    return {
      id: def.id,
      etiqueta: def.etiqueta,
      tipo: def.tipo,
      clave,
      valor: clave ? textoValorPo(po[clave]) : '',
    };
  });
}

// Devuelve todas las claves de primer nivel con valor simple (incluye vacías y
// nulas: una fecha en null es una columna que existe, solo que sin dato).
// Las claves con valor cargado quedan primero, para que la búsqueda por
// palabra clave no elija una columna vacía.
export function clavesDePoCompletas(
  po: Record<string, any> | null | undefined
): string[] {
  if (!po || typeof po !== 'object') return [];
  return Object.keys(po)
    .filter((k) => {
      const v = po[k];
      if (v === null || v === undefined) return true;
      return typeof v !== 'object';
    })
    .sort((a, b) => {
      const tieneA = textoValorPo(po[a]) ? 0 : 1;
      const tieneB = textoValorPo(po[b]) ? 0 : 1;
      return tieneA - tieneB;
    });
}

// Devuelve las claves de primer nivel de la PO (solo las que tienen valor).
export function clavesDePo(po: Record<string, any> | null | undefined): string[] {
  if (!po || typeof po !== 'object') return [];
  return Object.keys(po).filter((k) => {
    const v = po[k];
    return v !== null && v !== undefined && v !== '' && typeof v !== 'object';
  });
}

// Convierte cualquier valor de la PO en texto utilizable.
export function textoValorPo(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

// Busca la clave real de la PO que corresponde al campo editable.
export function detectarClaveCampo(
  po: Record<string, any> | null | undefined,
  campo: CampoOrdenEditable
): string | null {
  if (!po) return null;
  const claves = clavesDePo(po);
  const candidatos = campo === 'carga_lista' ? CANDIDATOS_CARGA_LISTA : CANDIDATOS_INCOTERM;

  // 1) Coincidencia exacta con los nombres conocidos.
  for (const candidato of candidatos) {
    const encontrada = claves.find((k) => k.trim().toLowerCase() === candidato);
    if (encontrada) return encontrada;
  }

  // 2) Coincidencia por palabra clave (tolera prefijos/sufijos del esquema).
  // Para carga lista se descartan las claves de validación (booleanas).
  const palabras = PALABRAS_CLAVE[campo];
  const porPatron = claves.find((k) => {
    const normalizada = k.trim().toLowerCase();
    if (campo === 'carga_lista' && normalizada.includes('valid')) return false;
    return palabras.some((p) => normalizada.includes(p));
  });
  return porPatron || null;
}

// Devuelve el valor actual del campo editable, si se pudo detectar.
export function obtenerValorCampo(
  po: Record<string, any> | null | undefined,
  campo: CampoOrdenEditable
): { clave: string; valor: string } | null {
  const clave = detectarClaveCampo(po, campo);
  if (!clave || !po) return null;
  return { clave, valor: textoValorPo(po[clave]) };
}

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