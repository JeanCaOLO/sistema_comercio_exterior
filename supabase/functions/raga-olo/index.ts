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
      const resp = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      const texto = await resp.text();

      if (!resp.ok) {
        return json(
          { ok: false, api_env: apiEnv, error: `Raga (${apiEnv}) respondió ${resp.status}: ${texto.slice(0, 300)}` },
          502,
        );
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
      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        // Actualización parcial: solo el ETD Inicial y la compañía identificadora.
        body: JSON.stringify({ trading_company: tradingCompany, date_etd_initial: dateEtdInitial }),
      });
      const texto = await resp.text();

      if (!resp.ok) {
        return json(
          { ok: false, api_env: apiEnv, error: `Raga (${apiEnv}) respondió ${resp.status}: ${texto.slice(0, 300)}` },
          502,
        );
      }
      return json({ ok: true, api_env: apiEnv, data: parseSeguro(texto) });
    }

    return json({ ok: false, error: `Acción no reconocida: ${action || '(vacía)'}` }, 400);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error inesperado en la función raga-olo.';
    return json({ ok: false, error: mensaje }, 500);
  }
});

// Normaliza el entorno recibido desde el cliente. Producción es el valor por defecto.
function resolverEntorno(valor: unknown, porDefecto: string | undefined): 'qa' | 'production' {
  const solicitado = String(valor || '').trim().toLowerCase();
  if (solicitado === 'qa') return 'qa';
  if (solicitado === 'production' || solicitado === 'prod') return 'production';
  return String(porDefecto || 'production').trim().toLowerCase() === 'qa' ? 'qa' : 'production';
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
