// ============================================================
// EDGE FUNCTION: raga-olo
// Puente seguro entre la aplicación y la API de Raga (OLO Adapter).
//
// Variables de entorno (Supabase Secrets):
//   RAGA_API_ENV           = qa | production            (default: qa)
//   RAGA_API_BASE_URL_QA   = https://olo.orders.raga-x.ai
//   RAGA_API_BASE_URL_PROD = (definir cuando exista la URL productiva)
//
// Acciones: get-purchase-order | update-etd-initial
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true }, 200);
  }

  try {
    const env = Deno.env;
    const apiEnv = (env.get('RAGA_API_ENV') || 'qa').toLowerCase();
    const baseUrlQa = env.get('RAGA_API_BASE_URL_QA') || 'https://olo.orders.raga-x.ai';
    const baseUrlProd = env.get('RAGA_API_BASE_URL_PROD') || '';
    const baseUrl = apiEnv === 'production' ? baseUrlProd : baseUrlQa;

    if (!baseUrl) {
      return json({ ok: false, error: 'No hay URL productiva configurada (RAGA_API_BASE_URL_PROD).' }, 500);
    }

    let body = {};
    try {
      body = await req.json();
    } catch (_e) {
      body = {};
    }
    const action = (body as any)?.action as string;

    if (action === 'get-purchase-order') {
      const orderNumber = String((body as any)?.order_number || '').trim();
      if (!orderNumber) return json({ ok: false, error: 'Falta el número de orden (order_number).' }, 400);

      const url = `${baseUrl}/api/purchase-orders?order_number=${encodeURIComponent(orderNumber)}`;
      const resp = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      const texto = await resp.text();

      if (!resp.ok) {
        return json({ ok: false, error: `Raga respondió ${resp.status}: ${texto.slice(0, 300)}` }, 502);
      }
      return json({ ok: true, data: parseSeguro(texto) });
    }

    if (action === 'update-etd-initial') {
      const orderNumber = String((body as any)?.order_number || '').trim();
      const tradingCompany = String((body as any)?.trading_company || '').trim();
      const dateEtdInitial = String((body as any)?.date_etd_initial || '').trim();
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
        return json({ ok: false, error: `Raga respondió ${resp.status}: ${texto.slice(0, 300)}` }, 502);
      }
      return json({ ok: true, data: parseSeguro(texto) });
    }

    return json({ ok: false, error: `Acción no reconocida: ${action || '(vacía)'}` }, 400);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error inesperado en la función raga-olo.';
    return json({ ok: false, error: mensaje }, 500);
  }
});

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
