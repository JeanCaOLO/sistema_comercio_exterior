// ============================================================
// EDGE FUNCTION: sincronizar-raga-bandeja
// Etapa + ETD + ATD de la BANDEJA (documentos_caa) desde Raga.
// - Recorre TODA la bandeja (lectura paginada, sin tope de 800 filas).
// - Ventana de 2 horas por fila y espera de 15 min antes de reintentar
//   una fila que falló (así el barrido siempre avanza y termina).
// - La etapa se toma de la etapa real del embarque, en este orden:
//     1) la etapa explícita que devuelve Raga;
//     2) la etapa de la exportación de POs Activas (Control de Fechas) o
//        del Agente de Carga, que traen la columna Etapa de Raga;
//     3) la inferencia por señales del embarque (contenedor, booking, fechas).
//   Los estados administrativos (draft, active, open…) nunca se guardan
//   como etapa: se reemplazan por la etapa real.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_PROD_URL = 'https://next.ologistics.com';
const DEFAULT_QA_URL = 'https://olo.orders.raga-x.ai';

const INTERVALO_MINUTOS = 120;
const MINUTOS_MINIMOS_AL_FORZAR = 1;
const MINUTOS_ESPERA_TRAS_ERROR = 15;
const LIMITE_DEFECTO = 30;
const LIMITE_MAXIMO = 60;
const MAX_POS_POR_FILA = 4;
const MAX_CONSULTAS_POR_CORRIDA = 160;
const PAUSA_ENTRE_CONSULTAS_MS = 400;
const TIMEOUT_CONSULTA_MS = 20000;
const PRESUPUESTO_MS = 80000;
const FILAS_POR_PAGINA = 500;
const MAX_FILAS_BANDEJA = 6000;
const TABLA = 'documentos_caa';

interface FilaBandeja {
  id: string;
  po_tiquetera: string | null;
  etapa: string | null;
  etd: string | null;
  atd: string | null;
  raga_sync_at: string | null;
  raga_sync_error_at: string | null;
  created_at: string | null;
}

interface DatosRagaBandeja {
  etapa: string;
  etd: string;
  atd: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true }, 200);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: 'Faltan las credenciales del backend.' }, 500);
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json({ ok: false, error: 'Falta la autenticación del usuario.' }, 401);
    }

    // Cliente público SOLO para validar el token del usuario.
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const email = (userData?.user?.email || '').trim().toLowerCase();
    if (userError || !email) {
      return json({ ok: false, error: 'Sesión inválida o expirada. Iniciá sesión de nuevo.' }, 401);
    }

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch (_e) {
      body = {};
    }

    const forzar = body?.force === true;
    const simular = body?.dry_run === true;
    const idsSolicitados = Array.isArray(body?.documento_ids)
      ? (body?.documento_ids as unknown[])
        .map((v) => String(v || '').trim())
        .filter((v) => v.length > 0)
        .slice(0, LIMITE_MAXIMO)
      : [];

    const limiteSolicitado = Number(body?.limite);
    const limite = Number.isFinite(limiteSolicitado) && limiteSolicitado > 0
      ? Math.min(Math.floor(limiteSolicitado), LIMITE_MAXIMO)
      : LIMITE_DEFECTO;

    const apiEnv = String(body?.api_env || '').trim().toLowerCase() === 'qa' ? 'qa' : 'production';
    const baseUrl = apiEnv === 'production'
      ? (Deno.env.get('RAGA_API_BASE_URL_PROD') || DEFAULT_PROD_URL)
      : (Deno.env.get('RAGA_API_BASE_URL_QA') || DEFAULT_QA_URL);

    const lectura = await leerBandeja(db, idsSolicitados);
    if (lectura.error) {
      return json({ ok: false, error: `No se pudo leer la bandeja: ${lectura.error}` }, 500);
    }

    const todas = lectura.filas;
    if (todas.length === 0) {
      return json({ ok: true, filas_en_alcance: 0, procesados: 0, continuar: false, mensaje: 'La bandeja está vacía.' });
    }

    const ahora = Date.now();
    const elegibles = todas
      .filter((f) => dentroDeVentana(f, ahora, forzar, idsSolicitados.length > 0))
      .sort((a, b) => {
        const faltaA = !texto(a.etapa) || !texto(a.atd) ? 0 : 1;
        const faltaB = !texto(b.etapa) || !texto(b.atd) ? 0 : 1;
        if (faltaA !== faltaB) return faltaA - faltaB;
        const ta = texto(a.raga_sync_at);
        const tb = texto(b.raga_sync_at);
        if (!ta && !tb) return 0;
        if (!ta) return -1;
        if (!tb) return 1;
        return new Date(ta).getTime() - new Date(tb).getTime();
      });

    if (elegibles.length === 0) {
      return json({
        ok: true,
        saltado: true,
        total_bandeja: todas.length,
        filas_en_alcance: 0,
        procesados: 0,
        pendientes_restantes: 0,
        continuar: false,
        mensaje: (forzar || idsSolicitados.length > 0)
          ? `Las ${todas.length} fila(s) de la bandeja se consultaron hace menos de ${MINUTOS_MINIMOS_AL_FORZAR} minuto(s). Probá de nuevo en un momento.`
          : `Las ${todas.length} fila(s) de la bandeja ya se sincronizaron en las últimas ${INTERVALO_MINUTOS / 60} horas.`,
      });
    }

    // Etapas de referencia: la exportación "POs Activas" (Control de Fechas)
    // y el Agente de Carga traen la columna Etapa tal como la publica Raga.
    // Sirven de respaldo cuando la API no expone la etapa del embarque.
    const referenciaRaga = await cargarReferenciaRaga(
      db,
      elegibles.slice(0, limite).flatMap((f) => extraerNumerosPo(f.po_tiquetera)),
    );
    const mapaEtapas = referenciaRaga.etapas;
    const mapaAtds = referenciaRaga.atds;

    const inicioLote = Date.now();
    let consultas = 0;
    let procesados = 0;
    let actualizados = 0;
    let sinDatos = 0;
    let errores = 0;
    const detalle: Array<Record<string, unknown>> = [];

    for (const fila of elegibles) {
      if (procesados >= limite) break;
      if (consultas >= MAX_CONSULTAS_POR_CORRIDA) break;
      if (Date.now() - inicioLote > PRESUPUESTO_MS) break;

      procesados += 1;

      const numerosPo = extraerNumerosPo(fila.po_tiquetera);
      const datos: DatosRagaBandeja = { etapa: '', etd: '', atd: '' };
      let etapaInferida = '';
      let consultaOk = false;
      let falloConsulta = false;
      let pistas: string[] = [];
      const notas: string[] = [];

      if (numerosPo.length === 0) {
        notas.push('La fila no tiene un número de PO válido.');
      } else {
        for (const orden of numerosPo.slice(0, MAX_POS_POR_FILA)) {
          if (consultas >= MAX_CONSULTAS_POR_CORRIDA) {
            notas.push('Se alcanzó el máximo de consultas por lote.');
            break;
          }
          if (consultas > 0) await esperar(PAUSA_ENTRE_CONSULTAS_MS);

          consultas += 1;
          const res = await consultarPo(baseUrl, orden);
          if (!res.ok) {
            falloConsulta = true;
            notas.push(`PO ${orden}: ${res.error}`);
            continue;
          }
          consultaOk = true;
          if (!res.po) {
            notas.push(`PO ${orden}: Raga no devolvió datos.`);
            continue;
          }

          const po = res.po as Record<string, unknown>;
          if (!datos.etapa) datos.etapa = extraerEtapa(po);
          if (!datos.etapa && pistas.length === 0) pistas = pistasEtapa(po);
          if (!etapaInferida) etapaInferida = inferirEtapaPorSenales(po);
          if (!datos.etd) datos.etd = extraerEtd(po);
          if (!datos.atd) datos.atd = extraerAtd(po);

          if (datos.etapa && datos.etd && datos.atd) break;
        }
      }

      const update: Record<string, unknown> = {};
      const etapaActual = texto(fila.etapa);
      const etdActual = soloFecha(fila.etd);
      const atdActual = soloFecha(fila.atd);

      // Orden de confianza: etapa explícita de Raga → etapa de la exportación
      // (Control de Fechas / Agente de Carga) → inferencia por señales.
      let etapaFinal = datos.etapa;
      let origenEtapa = datos.etapa ? 'raga' : '';
      if (!etapaFinal) {
        for (const orden of numerosPo) {
          const referencia = mapaEtapas.get(orden);
          if (referencia) {
            etapaFinal = referencia;
            origenEtapa = 'referencia';
            break;
          }
        }
      }
      if (!etapaFinal && etapaInferida) {
        etapaFinal = etapaInferida;
        origenEtapa = 'inferida';
      }

      // Una inferencia nunca pisa una etapa válida ya guardada; en cambio sí
      // corrige estados administrativos como "draft" o una etapa vacía.
      const actualValida = Boolean(etapaConocida(etapaActual));
      const puedeEscribirEtapa = Boolean(etapaFinal)
        && etapaFinal !== etapaActual
        && (origenEtapa !== 'inferida' || !actualValida);

      // ATD (zarpe real): primero lo que devuelve Raga y, si no viene,
      // la columna ATD de la exportación de POs Activas (Control de Fechas).
      let atdFinal = datos.atd;
      if (!atdFinal) {
        for (const orden of numerosPo) {
          const referencia = mapaAtds.get(orden);
          if (referencia) {
            atdFinal = referencia;
            break;
          }
        }
      }

      if (puedeEscribirEtapa) update.etapa = etapaFinal;
      if (datos.etd && datos.etd !== etdActual) update.etd = datos.etd;
      // Las fechas de relleno (0000-00-00, 2000-01-01…) se limpian.
      else if (!datos.etd && etdActual && fechaPlaceholder(etdActual)) update.etd = null;

      if (atdFinal && atdFinal !== atdActual) update.atd = atdFinal;
      else if (!atdFinal && atdActual && fechaPlaceholder(atdActual)) update.atd = null;

      // Se marca como revisada solo si Raga respondió (o si la fila no tiene PO).
      // Si la consulta falló, se guarda la marca de error para esperar 15 min
      // antes de reintentar y así no trabar el recorrido de toda la bandeja.
      const marcar = consultaOk || numerosPo.length === 0;
      if (marcar) {
        update.raga_sync_at = new Date().toISOString();
        if (fila.raga_sync_error_at) update.raga_sync_error_at = null;
      } else if (falloConsulta) {
        update.raga_sync_error_at = new Date().toISOString();
      }

      if (Object.keys(update).length > 0 && !simular) {
        const { error: errorUpdate } = await db.from(TABLA).update(update).eq('id', fila.id);
        if (errorUpdate) {
          errores += 1;
          notas.push(`No se pudo guardar: ${errorUpdate.message}`);
        }
      }

      const cambioEtapa = Boolean(update.etapa);
      const cambioEtd = Boolean(update.etd);
      const cambioAtd = Boolean(update.atd);
      if (cambioEtapa || cambioEtd || cambioAtd) actualizados += 1;
      else if (consultaOk && !etapaFinal && !datos.etd && !datos.atd) sinDatos += 1;
      if (falloConsulta && !consultaOk) errores += 1;

      if (etapaFinal) notas.push(`Etapa: ${etapaFinal} (${origenEtapa}).`);
      if (datos.etd) notas.push(`ETD: ${datos.etd}.`);
      if (atdFinal) notas.push(`ATD: ${atdFinal}.`);
      if (consultaOk && !datos.etapa && pistas.length > 0) {
        notas.push(`Sin etapa reconocida. Campos: ${pistas.join(' · ')}`);
      }

      detalle.push({
        documento_id: fila.id,
        po: fila.po_tiquetera,
        etapa: etapaFinal || null,
        etd: datos.etd || null,
        atd: atdFinal || null,
        actualizado: cambioEtapa || cambioEtd || cambioAtd,
        simulacion: simular,
        notas: notas.join(' ').slice(0, 600),
      });
    }

    const pendientesRestantes = Math.max(0, elegibles.length - procesados);

    return json({
      ok: true,
      simulacion: simular,
      api_env: apiEnv,
      total_bandeja: todas.length,
      filas_en_alcance: elegibles.length,
      procesados,
      actualizados,
      sin_datos: sinDatos,
      errores,
      consultas_api: consultas,
      pendientes_restantes: pendientesRestantes,
      continuar: pendientesRestantes > 0,
      detalle,
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error inesperado en la sincronización de la bandeja.';
    return json({ ok: false, error: mensaje }, 500);
  }
});

// ------------------------- lectura de la bandeja -------------------------

const COLUMNAS_LECTURA = 'id, po_tiquetera, etapa, etd, atd, raga_sync_at, raga_sync_error_at, created_at';

async function leerBandeja(
  db: ReturnType<typeof createClient>,
  idsSolicitados: string[],
): Promise<{ filas: FilaBandeja[]; error?: string }> {
  if (idsSolicitados.length > 0) {
    const { data, error } = await db
      .from(TABLA)
      .select(COLUMNAS_LECTURA)
      .in('id', idsSolicitados);
    if (error) return { filas: [], error: error.message };
    return { filas: (data || []) as unknown as FilaBandeja[] };
  }

  const filas: FilaBandeja[] = [];
  for (let desde = 0; desde < MAX_FILAS_BANDEJA; desde += FILAS_POR_PAGINA) {
    const { data, error } = await db
      .from(TABLA)
      .select(COLUMNAS_LECTURA)
      .order('raga_sync_at', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })
      .range(desde, desde + FILAS_POR_PAGINA - 1);

    if (error) return { filas: [], error: error.message };
    const pagina = (data || []) as unknown as FilaBandeja[];
    filas.push(...pagina);
    if (pagina.length < FILAS_POR_PAGINA) break;
  }
  return { filas };
}

function dentroDeVentana(
  fila: FilaBandeja,
  ahora: number,
  forzar: boolean,
  porId: boolean,
): boolean {
  const esperaMin = (forzar || porId) ? MINUTOS_MINIMOS_AL_FORZAR : INTERVALO_MINUTOS;
  const marca = texto(fila.raga_sync_at);
  if (marca) {
    const t = new Date(marca).getTime();
    if (Number.isFinite(t) && ahora - t < esperaMin * 60 * 1000) return false;
  }
  const marcaError = texto(fila.raga_sync_error_at);
  if (marcaError) {
    const t = new Date(marcaError).getTime();
    if (Number.isFinite(t) && ahora - t < MINUTOS_ESPERA_TRAS_ERROR * 60 * 1000) return false;
  }
  return true;
}

// ------------------------- etapas de referencia -------------------------

// La exportación de POs Activas (Control de Fechas) y el Agente de Carga
// traen la columna Etapa tal como la publica Raga, y Control de Fechas
// también trae el ATD (zarpe real). Se usan como respaldo cuando la API
// no devuelve esos datos.
async function cargarReferenciaRaga(
  db: ReturnType<typeof createClient>,
  pos: string[],
): Promise<{ etapas: Map<string, string>; atds: Map<string, string> }> {
  const etapas = new Map<string, string>();
  const atds = new Map<string, string>();
  const unicos = Array.from(new Set(pos.map((p) => p.trim()).filter(Boolean))).slice(0, 200);
  if (unicos.length === 0) return { etapas, atds };

  const fuentes = [
    { tabla: 'control_fechas_pos', columnas: 'po, etapa, atd, cargado_at' },
    { tabla: 'agente_carga_pos', columnas: 'po, etapa, cargado_at' },
  ];

  for (const fuente of fuentes) {
    try {
      const { data, error } = await db
        .from(fuente.tabla)
        .select(fuente.columnas)
        .in('po', unicos)
        .order('cargado_at', { ascending: false, nullsFirst: false })
        .limit(2000);
      if (error || !data) continue;
      for (const fila of data as unknown as Array<Record<string, unknown>>) {
        const po = texto(fila.po);
        if (!po) continue;
        if (!etapas.has(po)) {
          const etapa = etapaConocida(texto(fila.etapa));
          if (etapa) etapas.set(po, etapa);
        }
        if (!atds.has(po)) {
          const atd = soloFecha(fila.atd);
          if (atd && !fechaPlaceholder(atd)) atds.set(po, atd);
        }
      }
    } catch (_e) {
      // Si una tabla no está disponible, se usa la siguiente.
    }
  }
  return { etapas, atds };
}

// Señales del embarque que permiten ubicar la etapa cuando Raga no la expone.
const CLAVES_CONTENEDOR = ['numero_contenedor', 'container_number', 'contenedor', 'container', 'nro_contenedor'];
const CLAVES_BOOKING = ['numero_booking', 'booking', 'booking_number', 'nro_booking'];
const CLAVES_ATD = ['date_atd', 'atd', 'date_departure', 'departure_date', 'fecha_atd'];
const CLAVES_ATA = ['date_ata', 'ata', 'date_arrival', 'arrival_date', 'fecha_ata'];
const CLAVES_ETD_SENAL = ['date_etd_initial', 'date_etd', 'etd', 'date_etd_variable', 'etd_variable'];

function inferirEtapaPorSenales(po: Record<string, unknown>): string {
  // Si ya hay zarpe o arribo, la etapa la resuelve la referencia (o Raga).
  if (algunFecha(po, CLAVES_ATA) || algunFecha(po, CLAVES_ATD)) return '';
  // Con contenedor, booking o ETD confirmado el embarque ya está reservado.
  if (algunValor(po, CLAVES_CONTENEDOR)) return 'Booking';
  if (algunValor(po, CLAVES_BOOKING)) return 'Booking';
  if (algunFecha(po, CLAVES_ETD_SENAL)) return 'Booking';
  // Sin nada asignado todavía: la orden está en producción.
  return 'Producción';
}

function valoresDeCampo(po: Record<string, unknown>, claves: string[]): unknown[] {
  const objetivo = new Set(claves);
  const encontrados: unknown[] = [];

  const visitar = (valor: unknown, profundidad: number): void => {
    if (profundidad > 3 || valor === null || valor === undefined) return;
    if (Array.isArray(valor)) {
      valor.slice(0, 6).forEach((item) => visitar(item, profundidad + 1));
      return;
    }
    if (typeof valor !== 'object') return;
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      const clave = k.trim().toLowerCase();
      if (objetivo.has(clave) || claves.some((c) => clave.includes(c))) {
        encontrados.push(v);
        continue;
      }
      visitar(v, profundidad + 1);
    }
  };

  visitar(po, 0);
  return encontrados;
}

function algunValor(po: Record<string, unknown>, claves: string[]): boolean {
  return valoresDeCampo(po, claves).some((valor) => {
    const t = texto(valor);
    if (!t || t.length < 2) return false;
    const limpio = t.toLowerCase();
    return limpio !== 'null' && limpio !== 'undefined' && !/^[-0\s]+$/.test(limpio);
  });
}

function algunFecha(po: Record<string, unknown>, claves: string[]): boolean {
  return valoresDeCampo(po, claves).some((valor) => {
    const fecha = soloFecha(valor);
    return Boolean(fecha) && !fechaPlaceholder(fecha);
  });
}

// Fechas de relleno que Raga devuelve cuando todavía no hay fecha real.
function fechaPlaceholder(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return true;
  const anio = Number(m[1]);
  if (!Number.isFinite(anio) || anio < 2001 || anio > 2100) return true;
  if (m[1] === '0000' || m[2] === '00' || m[3] === '00') return true;
  return false;
}

// ------------------------- Raga -------------------------

function cabecerasRaga(extra: Record<string, string> = {}): Record<string, string> | null {
  const token = (Deno.env.get('RAGA_API_TOKEN') || '').trim();
  if (!token) return null;
  return { ...extra, Authorization: `Bearer ${token}` };
}

async function consultarPo(
  baseUrl: string,
  orderNumber: string,
): Promise<{ ok: boolean; po?: Record<string, unknown>; error?: string }> {
  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), TIMEOUT_CONSULTA_MS);
  try {
    const url = `${baseUrl}/api/purchase-orders?order_number=${encodeURIComponent(orderNumber)}`;
    const cabeceras = cabecerasRaga({ Accept: 'application/json' });
    if (!cabeceras) {
      return { ok: false, error: 'Falta configurar el token de acceso de Raga en el backend (RAGA_API_TOKEN).' };
    }

    const resp = await fetch(url, { method: 'GET', headers: cabeceras, signal: controller.signal });
    const cuerpo = await resp.text();

    if (!resp.ok) {
      return { ok: false, error: `Raga respondió ${resp.status}.` };
    }

    let payload: unknown = null;
    try {
      payload = JSON.parse(cuerpo);
    } catch (_e) {
      return { ok: false, error: 'Raga devolvió una respuesta no legible.' };
    }

    const lista = normalizarLista(payload);
    if (lista.length === 0) return { ok: true, po: undefined };

    const numero = orderNumber.trim().toLowerCase();
    const digitos = numero.replace(/\D+/g, '');
    const coincidencia = lista.find((p) => {
      const candidatos = [p.order_number, p.po_number, p.numero_orden, p.number]
        .map((v) => String(v ?? '').trim().toLowerCase())
        .filter(Boolean);
      return candidatos.some(
        (c) => c === numero || (digitos.length > 0 && c.replace(/\D+/g, '') === digitos),
      );
    });
    if (coincidencia) return { ok: true, po: coincidencia };
    // Si Raga devolvió una sola orden, es la pedida.
    if (lista.length === 1) return { ok: true, po: lista[0] };
    // Con varias órdenes y sin coincidencia no se toma una al azar: así no se
    // guarda la etapa ni el ETD de otra PO.
    return { ok: true, po: undefined };
  } catch (error) {
    const abortado = error instanceof Error && error.name === 'AbortError';
    return { ok: false, error: abortado ? 'Raga no respondió a tiempo.' : 'No se pudo consultar Raga.' };
  } finally {
    clearTimeout(temporizador);
  }
}

function normalizarLista(payload: unknown): Record<string, any>[] {
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
  if (Object.keys(obj).length > 0) return [obj];
  return [];
}

// ------------------------- etapa -------------------------

const CANDIDATOS_ETAPA = [
  'etapa',
  'etapa_actual',
  'etapa_embarque',
  'etapa_logistica',
  'etapa_po',
  'stage',
  'current_stage',
  'order_stage',
  'purchase_order_stage',
  'shipment_stage',
  'estado_embarque',
  'estado_orden',
  'estado',
  'status',
  'milestone',
];

// Etapas reales del embarque (las mismas que usa Control de Fechas).
const ETAPAS_CONOCIDAS: Array<{ etiqueta: string; patrones: string[] }> = [
  { etiqueta: 'En Tránsito', patrones: ['en transito', 'in transit', 'transito', 'transit', 'navegando', 'en navegacion'] },
  { etiqueta: 'Producción', patrones: ['produccion', 'production'] },
  { etiqueta: 'Booking', patrones: ['booking', 'reserva', 'reserved', 'booked'] },
  { etiqueta: 'Puerto', patrones: ['puerto', 'port', 'at port', 'arribo'] },
  { etiqueta: 'Alm Fiscal', patrones: ['alm fiscal', 'almacen fiscal', 'almacenaje fiscal', 'bonded'] },
  { etiqueta: 'Recibiendo CDI', patrones: ['recibiendo cdi', 'recibiendo', 'receiving', 'bodega cdi', 'entregado'] },
];

// Estados administrativos que NO describen la etapa del embarque.
const ESTADOS_GENERICOS = new Set([
  'draft', 'active', 'open', 'closed', 'pending', 'created', 'new', 'deleted',
  'canceled', 'cancelled', 'archived', 'enabled', 'disabled', 'void', 'approved',
  'borrador', 'activo', 'inactivo', 'pendiente', 'abierto', 'cerrado', 'anulado',
  'aprobado', 'aprobada', 'rechazado', 'en proceso', 'procesando',
]);

const CANDIDATOS_ETD_INICIAL = [
  'date_etd_initial',
  'etd_initial',
  'date_etd_inicial',
  'etd_inicial',
  'date_initial_etd',
  'initial_etd',
  'date_etd_ini',
  'etd_ini',
];

const CANDIDATOS_ETD_ACTUAL = [
  'date_etd',
  'etd',
  'date_etd_variable',
  'etd_variable',
  'date_variable_etd',
  'variable_etd',
  'date_estimated_departure',
  'estimated_departure_date',
];

interface Coincidencia {
  etiqueta: string;
  puntaje: number;
}

function extraerEtapa(po: Record<string, unknown>): string {
  // 1) Buscar la etapa real del embarque en cualquier campo del payload
  //    (incluidos objetos anidados). Así, aunque "status" diga "draft",
  //    si el embarque está "En Tránsito" se usa esa etapa.
  const coincidencias: Coincidencia[] = [];
  recorrer(po, '', 0, (clave, valor, profundidad) => {
    const etiqueta = etapaConocida(valor);
    if (!etiqueta) return;
    coincidencias.push({ etiqueta, puntaje: puntajeClave(clave) - profundidad });
  });

  if (coincidencias.length > 0) {
    coincidencias.sort((a, b) => b.puntaje - a.puntaje);
    return recortar(coincidencias[0].etiqueta);
  }

  // 2) Respaldo: campos típicos de etapa, descartando estados genéricos.
  const claves = Object.keys(po);
  for (const candidato of CANDIDATOS_ETAPA) {
    const clave = claves.find((k) => k.trim().toLowerCase() === candidato);
    if (!clave) continue;
    const valor = describirEtapa(po[clave]);
    if (valor && !esGenerica(valor)) return valor;
  }

  for (const clave of claves) {
    const normalizada = clave.trim().toLowerCase();
    if (!normalizada.includes('etapa') && !normalizada.includes('stage')) continue;
    if (normalizada.includes('date') || normalizada.includes('fecha')) continue;
    if (normalizada.endsWith('_id') || normalizada.includes('created') || normalizada.includes('updated')) continue;
    const valor = describirEtapa(po[clave]);
    if (valor && !esGenerica(valor)) return valor;
  }

  return '';
}

function recorrer(
  valor: unknown,
  clave: string,
  profundidad: number,
  visitar: (clave: string, valor: string, profundidad: number) => void,
): void {
  if (profundidad > 3 || valor === null || valor === undefined) return;
  if (Array.isArray(valor)) {
    valor.slice(0, 6).forEach((item) => recorrer(item, clave, profundidad + 1, visitar));
    return;
  }
  if (typeof valor !== 'object') return;
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === 'string') {
      if (v.trim()) visitar(k, v, profundidad);
    } else if (typeof v === 'object') {
      recorrer(v, k, profundidad + 1, visitar);
    }
  }
}

function etapaConocida(valor: string): string {
  const t = normalizarTexto(valor);
  if (!t || t.length > 80) return '';
  if (t.includes('corto')) return '';
  for (const etapa of ETAPAS_CONOCIDAS) {
    for (const patron of etapa.patrones) {
      if (t === patron) return etapa.etiqueta;
      const regex = new RegExp(`(^|[^a-z0-9])${patron}([^a-z0-9]|$)`);
      if (regex.test(t)) return etapa.etiqueta;
    }
  }
  return '';
}

function puntajeClave(clave: string): number {
  const k = clave.trim().toLowerCase();
  let puntaje = 0;
  if (/(actual|current|vigente)/.test(k)) puntaje += 4;
  if (/(etapa|stage|fase|milestone|embarque|shipment)/.test(k)) puntaje += 3;
  if (/(anterior|previo|previous|last|old|historial|history|pasado)/.test(k)) puntaje -= 4;
  if (/(nota|comment|observacion|description|descripcion)/.test(k)) puntaje -= 2;
  return puntaje;
}

function esGenerica(valor: string): boolean {
  return ESTADOS_GENERICOS.has(normalizarTexto(valor));
}

function describirEtapa(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;
    const nombres = [obj.nombre, obj.name, obj.label, obj.etapa, obj.stage, obj.descripcion, obj.description];
    for (const nombre of nombres) {
      const t = texto(nombre);
      if (t && !esGenerica(t)) return recortar(t);
    }
    return '';
  }
  const t = texto(valor);
  if (!t || /^\d+$/.test(t)) return '';
  return recortar(t);
}

// Solo para diagnóstico: muestra los campos de texto corto del payload
// cuando no se pudo reconocer la etapa.
function pistasEtapa(po: Record<string, unknown>): string[] {
  const pistas: string[] = [];
  recorrer(po, '', 0, (clave, valor) => {
    if (pistas.length >= 8) return;
    const t = valor.trim();
    if (!t || t.length > 40) return;
    if (!/^[a-zA-ZÁÉÍÓÚáéíóúñÑ\s._-]+$/.test(t)) return;
    pistas.push(`${clave}=${t}`);
  });
  return pistas;
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function recortar(valor: string): string {
  return valor.length > 120 ? valor.slice(0, 120) : valor;
}

// ------------------------- ETD / ATD -------------------------

function extraerEtd(po: Record<string, unknown>): string {
  const claves = Object.keys(po);

  for (const lista of [CANDIDATOS_ETD_INICIAL, CANDIDATOS_ETD_ACTUAL]) {
    for (const candidato of lista) {
      const clave = claves.find((k) => k.trim().toLowerCase() === candidato);
      if (!clave) continue;
      const fecha = soloFecha(po[clave]);
      if (fecha && !fechaPlaceholder(fecha)) return fecha;
    }
  }

  const conEtd = claves.filter((k) => k.trim().toLowerCase().includes('etd'));
  const inicial = conEtd.find((k) => /initial|inicial|_ini$|ini_/.test(k.trim().toLowerCase()));
  const ordenadas = inicial ? [inicial, ...conEtd.filter((k) => k !== inicial)] : conEtd;
  for (const clave of ordenadas) {
    const fecha = soloFecha(po[clave]);
    if (fecha && !fechaPlaceholder(fecha)) return fecha;
  }

  return '';
}

// ATD = zarpe real del embarque. Solo existe cuando el buque ya zarpó.
const CANDIDATOS_ATD = [
  'date_atd',
  'atd',
  'date_atd_real',
  'atd_real',
  'date_atd_actual',
  'atd_actual',
  'fecha_atd',
  'date_actual_departure',
  'actual_departure_date',
  'date_departure',
  'departure_date',
];

function extraerAtd(po: Record<string, unknown>): string {
  // 1) Campos típicos (incluidos los anidados dentro del payload).
  for (const valor of valoresDeCampo(po, CANDIDATOS_ATD)) {
    const fecha = soloFecha(valor);
    if (fecha && !fechaPlaceholder(fecha)) return fecha;
  }

  // 2) Cualquier campo cuyo nombre contenga "atd".
  const claves = Object.keys(po).filter((k) => k.trim().toLowerCase().includes('atd'));
  for (const clave of claves) {
    const fecha = soloFecha(po[clave]);
    if (fecha && !fechaPlaceholder(fecha)) return fecha;
  }

  return '';
}

function extraerNumerosPo(valor: string | null): string[] {
  const textoPo = texto(valor);
  if (!textoPo) return [];
  const partes = textoPo.split(/[\/,;\n|]+/).map((p) => p.trim()).filter(Boolean);
  const validos = partes.filter((p) => /^[A-Za-z0-9-]{3,}$/.test(p));
  return Array.from(new Set(validos));
}

function soloFecha(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const t = typeof valor === 'string' ? valor.trim() : String(valor);
  if (!t) return '';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  if (m) return m[1];
  const fecha = new Date(t);
  if (Number.isNaN(fecha.getTime())) return '';
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
