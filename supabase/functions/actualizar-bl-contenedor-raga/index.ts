// ============================================================
// EDGE FUNCTION: actualizar-bl-contenedor-raga
//
// Los agentes de carga cargan el N° de BL y el N° de Contenedor de
// una PO. La función:
//   1) Valida al usuario (JWT).
//   2) Consulta la PO en Raga para conocer la compañía y los valores
//      actuales (y para detectar el nombre real de cada columna).
//   3) Envía a Raga un PUT por campo, porque su API aplica Carbon::parse
//      al valor recibido y un payload combinado puede rechazar todo.
//   4) Actualiza el ticket local (expedientes) y su historial.
//   5) Deja la bitácora en carga_bl_change_events.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_PROD_URL = 'https://next.ologistics.com';
const DEFAULT_QA_URL = 'https://olo.orders.raga-x.ai';
const TIMEOUT_MS = 20000;

const CANDIDATOS_BL = ['bill_of_lading', 'mbl_number', 'hbl_number'];
const CANDIDATOS_CONTENEDOR = ['container_number', 'container'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);

  try {
    const env = Deno.env;
    const supabaseUrl = env.get('SUPABASE_URL') || '';
    const anonKey = env.get('SUPABASE_ANON_KEY') || '';
    const serviceKey = env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: 'Faltan las credenciales del backend.' }, 500);
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ ok: false, error: 'Falta la autenticación del usuario.' }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const email = (userData?.user?.email || '').trim().toLowerCase();
    const userId = userData?.user?.id || null;
    if (userError || !email) {
      return json({ ok: false, error: 'Sesión inválida o expirada. Iniciá sesión de nuevo.' }, 401);
    }

    // Cliente privilegiado SOLO para base de datos (el JWT ya se validó arriba).
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch (_e) {
      body = {};
    }

    const orderNumber = texto(body?.order_number).toUpperCase();
    const companiaSolicitada = texto(body?.trading_company);
    const bl = texto(body?.bl).toUpperCase();
    const contenedor = texto(body?.contenedor).toUpperCase();
    const motivo = texto(body?.change_reason);
    const detalleMotivo = texto(body?.other_reason_detail);
    const apiEnv = resolverEntorno(body?.api_env);

    if (!orderNumber) return json({ ok: false, error: 'Falta el número de PO.' }, 400);
    if (!/^[A-Z0-9._\-/]{3,40}$/.test(orderNumber)) {
      return json({ ok: false, error: 'El número de PO no tiene un formato válido.' }, 400);
    }
    if (!bl && !contenedor) {
      return json({ ok: false, error: 'Ingresá al menos el N° de BL o el N° de Contenedor.' }, 400);
    }
    if (bl && !/^[A-Z0-9._\-/]{3,40}$/.test(bl)) {
      return json({ ok: false, error: 'El N° de BL no tiene un formato válido.' }, 400);
    }
    if (contenedor && !/^[A-Z0-9\-]{3,20}$/.test(contenedor)) {
      return json({ ok: false, error: 'El N° de Contenedor no tiene un formato válido.' }, 400);
    }
    if (!motivo) {
      return json({ ok: false, error: 'Indicá el motivo del cambio.' }, 400);
    }

    // Nombre visible del agente que carga los datos.
    let nombreUsuario = email;
    try {
      const { data: usuario } = await db
        .from('usuarios')
        .select('nombre')
        .eq('email', email)
        .maybeSingle();
      if (usuario?.nombre) nombreUsuario = String(usuario.nombre);
    } catch (_e) {
      // Se mantiene el correo como respaldo.
    }

    const baseUrl = apiEnv === 'production'
      ? (env.get('RAGA_API_BASE_URL_PROD') || DEFAULT_PROD_URL)
      : (env.get('RAGA_API_BASE_URL_QA') || DEFAULT_QA_URL);

    const consulta = await consultarPo(baseUrl, orderNumber);
    if (!consulta.ok || !consulta.po) {
      const error = consulta.ok
        ? `Raga no devolvió datos de la PO ${orderNumber}.`
        : (consulta.error || 'No se pudo consultar la PO en Raga.');
      await registrarEvento(db, {
        orderNumber,
        compania: companiaSolicitada,
        anteriorBl: '',
        anteriorContenedor: '',
        bl,
        contenedor,
        motivo,
        detalleMotivo,
        status: 'ERROR',
        apiEnv,
        error,
        aplicados: [],
        userId,
        nombreUsuario,
        email,
        expedientesActualizados: 0,
      });
      return json({ ok: false, error }, 200);
    }

    const po = consulta.po;
    const compania = companiaSolicitada || texto(po.trading_company);
    if (!compania) {
      const error = 'La PO no tiene compañía (trading company) y no se puede actualizar en Raga.';
      await registrarEvento(db, {
        orderNumber, compania, anteriorBl: '', anteriorContenedor: '',
        bl, contenedor, motivo, detalleMotivo,
        status: 'ERROR', apiEnv, error, aplicados: [], userId, nombreUsuario, email,
        expedientesActualizados: 0,
      });
      return json({ ok: false, error }, 200);
    }

    const claveBl = claveEscritura(po, CANDIDATOS_BL, 'bill_of_lading');
    const claveContenedor = claveEscritura(po, CANDIDATOS_CONTENEDOR, 'container_number');
    const anteriorBl = primerTexto(po, CANDIDATOS_BL);
    const anteriorContenedor = primerTexto(po, CANDIDATOS_CONTENEDOR);

    const cambios: { campo: string; clave: string; valor: string; anterior: string }[] = [];
    if (bl && bl !== anteriorBl) {
      cambios.push({ campo: 'BL', clave: claveBl, valor: bl, anterior: anteriorBl });
    }
    if (contenedor && contenedor !== anteriorContenedor) {
      cambios.push({ campo: 'Contenedor', clave: claveContenedor, valor: contenedor, anterior: anteriorContenedor });
    }

    if (cambios.length === 0) {
      return json({
        ok: false,
        error: 'Los datos ingresados ya son los que tiene Raga. No hay nada para actualizar.',
        anterior_bl: anteriorBl,
        anterior_contenedor: anteriorContenedor,
      }, 200);
    }

    const aplicados: string[] = [];
    const errores: string[] = [];

    for (const cambio of cambios) {
      const res = await actualizarCampo(baseUrl, orderNumber, compania, cambio.clave, cambio.valor);
      if (res.ok) aplicados.push(cambio.campo);
      else errores.push(`${cambio.campo}: ${res.error}`);
    }

    const status = aplicados.length === cambios.length
      ? 'APLICADO'
      : (aplicados.length > 0 ? 'PARCIAL' : 'ERROR');

    let expedientesActualizados = 0;
    // En QA se actualiza solo el entorno de pruebas de Raga: los tickets reales
    // del sistema no deben quedar contaminados con datos de prueba.
    if (aplicados.length > 0 && apiEnv === 'production') {
      expedientesActualizados = await sincronizarTickets(db, {
        orderNumber,
        bl: aplicados.includes('BL') ? bl : '',
        contenedor: aplicados.includes('Contenedor') ? contenedor : '',
        usuarioNombre: nombreUsuario,
        usuarioEmail: email,
      });
    }

    const errorTexto = errores.length > 0 ? errores.join(' ') : null;
    const eventId = await registrarEvento(db, {
      orderNumber,
      compania,
      anteriorBl,
      anteriorContenedor,
      bl,
      contenedor,
      motivo,
      detalleMotivo,
      status,
      apiEnv,
      error: errorTexto,
      aplicados,
      userId,
      nombreUsuario,
      email,
      expedientesActualizados,
    });

    if (status === 'ERROR') {
      return json({
        ok: false,
        status,
        error: errorTexto || 'Raga rechazó la actualización.',
        anterior_bl: anteriorBl,
        anterior_contenedor: anteriorContenedor,
        event_id: eventId,
      }, 200);
    }

    return json({
      ok: true,
      status,
      event_id: eventId,
      aplicados,
      errores,
      anterior_bl: anteriorBl,
      anterior_contenedor: anteriorContenedor,
      nuevo_bl: aplicados.includes('BL') ? bl : anteriorBl,
      nuevo_contenedor: aplicados.includes('Contenedor') ? contenedor : anteriorContenedor,
      expedientes_actualizados: expedientesActualizados,
      trading_company: compania,
      api_env: apiEnv,
    }, 200);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error inesperado al actualizar el BL y el contenedor.';
    return json({ ok: false, error: mensaje }, 500);
  }
});

// ─────────────────────────────────────────────────────────────
// Raga
// ─────────────────────────────────────────────────────────────

const FALTA_TOKEN = 'Falta configurar el token de acceso de Raga en el backend (RAGA_API_TOKEN).';

// Raga exige un token de acceso (formato Sanctum: "12|xxxx"). Vive como
// secreto del backend y nunca llega al navegador.
function cabecerasRaga(extra: Record<string, string> = {}): Record<string, string> | null {
  const token = (Deno.env.get('RAGA_API_TOKEN') || '').trim();
  if (!token) return null;
  return { ...extra, Authorization: `Bearer ${token}` };
}

async function consultarPo(
  baseUrl: string,
  orderNumber: string,
): Promise<{ ok: boolean; po?: Record<string, any>; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${baseUrl}/api/purchase-orders?order_number=${encodeURIComponent(orderNumber)}`;
    const cabeceras = cabecerasRaga({ Accept: 'application/json' });
    if (!cabeceras) return { ok: false, error: FALTA_TOKEN };
    const resp = await fetch(url, { method: 'GET', headers: cabeceras, signal: controller.signal });
    const cuerpo = await resp.text();
    if (!resp.ok) return { ok: false, error: `Raga respondió ${resp.status}: ${detalleUpstream(cuerpo)}` };

    let payload: unknown = null;
    try {
      payload = JSON.parse(cuerpo);
    } catch (_e) {
      return { ok: false, error: 'Raga devolvió una respuesta no legible.' };
    }

    const lista = normalizarLista(payload);
    if (lista.length === 0) return { ok: true, po: undefined };

    const buscado = orderNumber.trim().toLowerCase();
    const coincidencia = lista.find(
      (p) => String(p.order_number ?? p.po_number ?? '').trim().toLowerCase() === buscado,
    );
    return { ok: true, po: coincidencia || lista[0] };
  } catch (error) {
    const abortado = error instanceof Error && error.name === 'AbortError';
    return { ok: false, error: abortado ? 'Raga no respondió a tiempo.' : 'No se pudo consultar Raga.' };
  } finally {
    clearTimeout(timer);
  }
}

async function actualizarCampo(
  baseUrl: string,
  orderNumber: string,
  tradingCompany: string,
  clave: string,
  valor: string,
): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${baseUrl}/api/purchase-orders/${encodeURIComponent(orderNumber)}`;
    const cabeceras = cabecerasRaga({ 'Content-Type': 'application/json', Accept: 'application/json' });
    if (!cabeceras) return { ok: false, error: FALTA_TOKEN };
    const resp = await fetch(url, {
      method: 'PUT',
      headers: cabeceras,
      // Un solo dato por petición: Raga aplica Carbon::parse al valor recibido.
      body: JSON.stringify({ trading_company: tradingCompany, [clave]: valor }),
      signal: controller.signal,
    });
    const cuerpo = await resp.text();
    if (!resp.ok) return { ok: false, error: `Raga respondió ${resp.status}: ${detalleUpstream(cuerpo)}` };
    return { ok: true };
  } catch (error) {
    const abortado = error instanceof Error && error.name === 'AbortError';
    return { ok: false, error: abortado ? 'Raga no respondió a tiempo.' : 'No se pudo contactar Raga.' };
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────
// Tickets locales
// ─────────────────────────────────────────────────────────────

async function sincronizarTickets(
  db: any,
  params: {
    orderNumber: string;
    bl: string;
    contenedor: string;
    usuarioNombre: string;
    usuarioEmail: string;
  },
): Promise<number> {
  let actualizados = 0;
  try {
    const { data, error } = await db
      .from('expedientes')
      .select('id, po_tiquetera, numero_bl, numero_contenedor')
      .ilike('po_tiquetera', `%${params.orderNumber}%`)
      .limit(30);

    if (error) {
      console.error('[BL-RAGA] No se pudieron leer los expedientes:', error.message);
      return 0;
    }

    for (const exp of (data || []) as Array<Record<string, any>>) {
      if (!poCoincide(exp.po_tiquetera, params.orderNumber)) continue;

      const cambios: Array<{ campo: string; anterior: string; nuevo: string }> = [];
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (params.bl && texto(exp.numero_bl) !== params.bl) {
        update.numero_bl = params.bl;
        cambios.push({ campo: 'N° de BL', anterior: texto(exp.numero_bl), nuevo: params.bl });
      }
      if (params.contenedor && texto(exp.numero_contenedor) !== params.contenedor) {
        update.numero_contenedor = params.contenedor;
        cambios.push({
          campo: 'N° de Contenedor',
          anterior: texto(exp.numero_contenedor),
          nuevo: params.contenedor,
        });
      }
      if (cambios.length === 0) continue;

      const { error: errorUpdate } = await db.from('expedientes').update(update).eq('id', exp.id);
      if (errorUpdate) {
        console.error('[BL-RAGA] No se pudo actualizar el expediente:', errorUpdate.message);
        continue;
      }

      const filas = cambios.map((c) => ({
        expediente_id: exp.id,
        campo_modificado: c.campo,
        valor_anterior: c.anterior,
        valor_nuevo: c.nuevo,
        usuario: params.usuarioNombre,
        usuario_email: params.usuarioEmail,
        fecha_cambio: new Date().toISOString(),
      }));

      const { error: errorHistorial } = await db.from('expedientes_historial').insert(filas);
      if (errorHistorial) {
        console.error('[BL-RAGA] No se pudo registrar el historial:', errorHistorial.message);
      }
      actualizados += 1;
    }
  } catch (err) {
    console.error('[BL-RAGA] Error sincronizando tickets:', err);
  }
  return actualizados;
}

// ─────────────────────────────────────────────────────────────
// Bitácora
// ─────────────────────────────────────────────────────────────

async function registrarEvento(
  db: any,
  params: {
    orderNumber: string;
    compania: string;
    anteriorBl: string;
    anteriorContenedor: string;
    bl: string;
    contenedor: string;
    motivo: string;
    detalleMotivo: string;
    status: string;
    apiEnv: string;
    error: string | null;
    aplicados: string[];
    userId: string | null;
    nombreUsuario: string;
    email: string;
    expedientesActualizados: number;
  },
): Promise<string | null> {
  try {
    const { data, error } = await db
      .from('carga_bl_change_events')
      .insert([{
        order_number: params.orderNumber,
        trading_company: params.compania || null,
        previous_bl: params.anteriorBl || null,
        new_bl: params.bl || null,
        previous_container: params.anteriorContenedor || null,
        new_container: params.contenedor || null,
        change_reason: params.motivo,
        other_reason_detail: params.detalleMotivo || null,
        status: params.status,
        api_env: params.apiEnv,
        api_error: params.error,
        campos_aplicados: params.aplicados,
        requested_by: params.userId,
        requested_by_name: params.nombreUsuario,
        requested_by_email: params.email,
        expedientes_actualizados: params.expedientesActualizados,
      }])
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[BL-RAGA] No se pudo guardar la bitácora:', error.message);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.error('[BL-RAGA] Error guardando la bitácora:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────

function resolverEntorno(valor: unknown): 'qa' | 'production' {
  const solicitado = String(valor || '').trim().toLowerCase();
  return solicitado === 'qa' ? 'qa' : 'production';
}

function claveEscritura(po: Record<string, any>, candidatos: string[], porDefecto: string): string {
  for (const candidato of candidatos) {
    if (Object.prototype.hasOwnProperty.call(po, candidato)) return candidato;
  }
  return porDefecto;
}

function primerTexto(po: Record<string, any>, claves: string[]): string {
  for (const clave of claves) {
    const valor = texto(po[clave]).toUpperCase();
    if (valor && !['NULL', 'N/A', 'NA', '-'].includes(valor)) return valor;
  }
  return '';
}

function poCoincide(poTiquetera: unknown, orderNumber: string): boolean {
  const partes = texto(poTiquetera).split(/[\/,;\n|]+/).map((p) => p.trim().toUpperCase());
  return partes.includes(orderNumber.trim().toUpperCase());
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

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

function detalleUpstream(respuesta: string): string {
  const limpio = (respuesta || '').trim();
  if (!limpio) return 'sin detalle en la respuesta';
  try {
    const cuerpo = JSON.parse(limpio) as Record<string, any>;
    const candidatos = [
      cuerpo?.error,
      cuerpo?.message,
      cuerpo?.detail,
      cuerpo?.errors,
      cuerpo?.meta?.message,
      cuerpo?.meta?.detail,
    ];
    for (const valor of candidatos) {
      if (!valor) continue;
      if (typeof valor === 'string') return valor.slice(0, 400);
      try {
        return JSON.stringify(valor).slice(0, 400);
      } catch (_e) {
        // continúa con el siguiente candidato
      }
    }
  } catch (_e) {
    // No es JSON: se devuelve el texto tal cual.
  }
  return limpio.slice(0, 400);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
