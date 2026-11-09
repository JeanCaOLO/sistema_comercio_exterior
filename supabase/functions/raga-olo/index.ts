// ============================================================
// EDGE FUNCTION: raga-olo
// Puente seguro entre la aplicación y la API de Raga (OLO Adapter).
//
// Entornos:
//   QA         → RAGA_API_BASE_URL_QA   (default: https://olo.orders.raga-x.ai)
//   Producción → RAGA_API_BASE_URL_PROD (default: https://next.ologistics.com)
//
// Seguridad:
//   - Siempre exige un JWT válido del usuario que invoca.
//   - Producción es el entorno por defecto para todos los usuarios
//     autenticados (lectura y modificación). QA queda disponible solo
//     como entorno de pruebas controlado.
//
// Acciones: get-purchase-order | update-etd-initial
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_QA_URL = 'https://olo.orders.raga-x.ai';
const DEFAULT_PROD_URL = 'https://next.ologistics.com';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true }, 200);
  }

  try {
    const env = Deno.env;
    const supabaseUrl = env.get('SUPABASE_URL') || '';
    const anonKey = env.get('SUPABASE_ANON_KEY') || '';

    // 1) Identificar al usuario que invoca la función.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token || !supabaseUrl || !anonKey) {
      return json({ ok: false, error: 'Falta la autenticación del usuario.' }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const email = (userData?.user?.email || '').trim().toLowerCase();
    if (userError || !email) {
      return json({ ok: false, error: 'Sesión inválida o expirada. Iniciá sesión de nuevo.' }, 401);
    }

    let body: Record<string, any> = {};
    try {
      body = await req.json();
    } catch (_e) {
      body = {};
    }

    const action = String(body?.action || '');
    const apiEnv = resolverEntorno(body?.api_env, env.get('RAGA_API_ENV'));

    const baseUrl = apiEnv === 'production'
      ? (env.get('RAGA_API_BASE_URL_PROD') || DEFAULT_PROD_URL)
      : (env.get('RAGA_API_BASE_URL_QA') || DEFAULT_QA_URL);

    if (action === 'get-purchase-order') {
      const orderNumber = String(body?.order_number || '').trim();
      if (!orderNumber) return json({ ok: false, error: 'Falta el número de orden (order_number).' }, 400);

      const url = `${baseUrl}/api/purchase-orders?order_number=${encodeURIComponent(orderNumber)}`;
      const cabeceras = cabecerasRaga({ Accept: 'application/json' });
      if (!cabeceras) return json({ ok: false, error: FALTA_TOKEN }, 500);
      const resp = await fetch(url, { method: 'GET', headers: cabeceras });
      const texto = await resp.text();

      if (!resp.ok) {
        return json({
          ok: false,
          api_env: apiEnv,
          upstream_status: resp.status,
          error: `Raga (${apiEnv}) respondió ${resp.status}: ${detalleUpstream(texto)}`,
        });
      }
      return json({ ok: true, api_env: apiEnv, data: parseSeguro(texto) });
    }

    if (action === 'update-etd-initial') {
      const orderNumber = String(body?.order_number || '').trim();
      const tradingCompany = String(body?.trading_company || '').trim();
      const dateEtdInitial = String(body?.date_etd_initial || '').trim();
      if (!orderNumber || !tradingCompany || !dateEtdInitial) {
        return json({ ok: false, error: 'Faltan datos obligatorios (order_number, trading_company, date_etd_initial).' }, 400);
      }

      const url = `${baseUrl}/api/purchase-orders/${encodeURIComponent(orderNumber)}`;
      const cabeceras = cabecerasRaga({ 'Content-Type': 'application/json', Accept: 'application/json' });
      if (!cabeceras) return json({ ok: false, error: FALTA_TOKEN }, 500);
      const resp = await fetch(url, {
        method: 'PUT',
        headers: cabeceras,
        // Actualización parcial: solo el ETD Inicial y la compañía identificadora.
        body: JSON.stringify({ trading_company: tradingCompany, date_etd_initial: dateEtdInitial }),
      });
      const texto = await resp.text();

      if (!resp.ok) {
        return json({
          ok: false,
          api_env: apiEnv,
          upstream_status: resp.status,
          error: `Raga (${apiEnv}) respondió ${resp.status}: ${detalleUpstream(texto)}`,
        });
      }
      return json({ ok: true, api_env: apiEnv, data: parseSeguro(texto) });
    }

    if (action === 'update-purchase-order-fields') {
      const orderNumber = String(body?.order_number || '').trim();
      const tradingCompany = String(body?.trading_company || '').trim();
      const entrada = body?.fields;

      if (!orderNumber || !tradingCompany) {
        return json({ ok: false, error: 'Faltan datos obligatorios (order_number, trading_company).' }, 400);
      }
      if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
        return json({ ok: false, error: 'Faltan los campos a actualizar (fields).' }, 400);
      }

      // Solo se permiten claves técnicas simples y nunca campos identificadores
      // ni de auditoría, para que el cliente no pueda reescribir la orden completa.
      const RESERVADOS = new Set([
        'id', 'uuid', 'order_number', 'po_number', 'trading_company',
        'created_at', 'updated_at', 'deleted_at', 'order_id', 'status_id',
      ]);
      const fields: Record<string, string | boolean> = {};
      for (const [clave, valor] of Object.entries(entrada)) {
        const nombre = String(clave || '').trim();
        if (!/^[a-z][a-z0-9_]{1,60}$/.test(nombre)) {
          return json({ ok: false, error: `Nombre de campo inválido: ${nombre || '(vacío)'}` }, 400);
        }
        if (RESERVADOS.has(nombre)) {
          return json({ ok: false, error: `El campo "${nombre}" no se puede modificar desde este módulo.` }, 400);
        }
        if (valor === null || valor === undefined) continue;
        // Los campos booleanos (ej. carga_lista_validada) se envían como boolean.
        if (typeof valor === 'boolean') {
          fields[nombre] = valor;
          continue;
        }
        fields[nombre] = String(valor).trim();
      }

      if (Object.keys(fields).length === 0) {
        return json({ ok: false, error: 'No hay cambios para enviar a Raga.' }, 400);
      }

      const url = `${baseUrl}/api/purchase-orders/${encodeURIComponent(orderNumber)}`;
      const cabeceras = cabecerasRaga({ 'Content-Type': 'application/json', Accept: 'application/json' });
      if (!cabeceras) return json({ ok: false, error: FALTA_TOKEN }, 500);
      const resp = await fetch(url, {
        method: 'PUT',
        headers: cabeceras,
        body: JSON.stringify({ trading_company: tradingCompany, ...fields }),
      });
      const texto = await resp.text();

      if (!resp.ok) {
        return json({
          ok: false,
          api_env: apiEnv,
          upstream_status: resp.status,
          enviado: fields,
          error: `Raga (${apiEnv}) respondió ${resp.status}: ${detalleUpstream(texto)}`,
        });
      }
      return json({ ok: true, api_env: apiEnv, data: parseSeguro(texto) });
    }

    return json({ ok: false, error: `Acción no reconocida: ${action || '(vacía)'}` }, 400);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error inesperado en la función raga-olo.';
    return json({ ok: false, error: mensaje }, 500);
  }
});

// ─────────────────────────────────────────────────────────────
// Autenticación con Raga
// Raga exige un token de acceso (formato Sanctum: "12|xxxx"). Vive como
// secreto del backend (RAGA_API_TOKEN) y nunca llega al navegador.
// ─────────────────────────────────────────────────────────────

const FALTA_TOKEN = 'Falta configurar el token de acceso de Raga en el backend (RAGA_API_TOKEN).';

function cabecerasRaga(extra: Record<string, string> = {}): Record<string, string> | null {
  const token = (Deno.env.get('RAGA_API_TOKEN') || '').trim();
  if (!token) return null;
  return { ...extra, Authorization: `Bearer ${token}` };
}

// Normaliza el entorno recibido desde el cliente. Producción es el valor por defecto.
function resolverEntorno(valor: unknown, porDefecto: string | undefined): 'qa' | 'production' {
  const solicitado = String(valor || '').trim().toLowerCase();
  if (solicitado === 'qa') return 'qa';
  if (solicitado === 'production' || solicitado === 'prod') return 'production';
  return String(porDefecto || 'production').trim().toLowerCase() === 'qa' ? 'qa' : 'production';
}

// Resumen legible del cuerpo de error devuelto por Raga (JSON o texto plano).
function detalleUpstream(texto: string): string {
  const limpio = (texto || '').trim();
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
    // no es JSON: se devuelve el texto tal cual
  }
  return limpio.slice(0, 400);
}

function parseSeguro(texto: string): unknown {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch (_e) {
    return texto;
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
