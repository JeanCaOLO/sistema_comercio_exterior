const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HOSTS_PERMITIDOS = ['script.google.com', 'script.googleusercontent.com'];

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parsear(texto: string): Record<string, unknown> | null {
  try {
    const valor = JSON.parse(texto);
    if (valor && typeof valor === 'object') return valor as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

/** Resumen legible del HTML que devuelve Google cuando algo no está publicado. */
function resumirHtml(texto: string): string {
  const titulo = texto.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titulo && titulo[1]) {
    return titulo[1].replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  const limpio = texto.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return limpio.slice(0, 160) || '(respuesta vacía)';
}

function pistaSegunHtml(texto: string): string {
  const bajo = texto.toLowerCase();

  if (bajo.includes('accounts.google.com') || bajo.includes('sign in') || bajo.includes('iniciar sesión')) {
    return 'El Web App pide iniciar sesión con Google, así que no está publicado para "Cualquier persona". En Apps Script: Implementar → Gestionar implementaciones → editar → "Quién tiene acceso: Cualquier persona" → crear NUEVA implementación → copiar la URL /exec.';
  }
  if (bajo.includes('script function not found') || bajo.includes('doPost')) {
    return 'La implementación publicada no tiene la función doPost. Copiá el código completo del script y volvé a implementar como nueva versión.';
  }
  if (bajo.includes('authorization is required') || bajo.includes('necesita autorización')) {
    return 'El script todavía no está autorizado. Abrí el editor de Apps Script, ejecutá la función probarEnvio y aceptá los permisos de Gmail.';
  }
  return 'El Web App de Google no devolvió JSON. Verificá que la URL termine en /exec y que la implementación esté publicada como Aplicación web.';
}

/** GET al Web App: sirve para saber si está publicado y accesible. */
async function pingWebApp(destino: string): Promise<{ ok: boolean; mensaje: string; activo: boolean }> {
  try {
    const respuesta = await fetch(destino, { method: 'GET', redirect: 'follow' });
    const texto = await respuesta.text();
    const datos = parsear(texto);

    if (datos && datos.ok === true) {
      return {
        ok: true,
        activo: true,
        mensaje: String(datos.mensaje || 'El Web App de Google respondió correctamente.'),
      };
    }

    if (datos && datos.ok === false) {
      return { ok: false, activo: true, mensaje: String(datos.error || 'El Web App respondió con un error.') };
    }

    return { ok: false, activo: false, mensaje: `${pistaSegunHtml(texto)} (Recibido: ${resumirHtml(texto)})` };
  } catch (err) {
    return {
      ok: false,
      activo: false,
      mensaje: `No se pudo contactar al Web App de Google: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let cuerpo: Record<string, unknown> = {};
    let textoCrudo = '';
    try {
      textoCrudo = await req.text();
      cuerpo = textoCrudo ? (JSON.parse(textoCrudo) as Record<string, unknown>) : {};
    } catch {
      return json({ ok: false, error: 'La solicitud llegó con formato inválido.' });
    }

    const webhookUrl = cuerpo.webhookUrl;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return json({ ok: false, error: 'Falta la URL del Web App de Google Apps Script.' });
    }

    let url: URL;
    try {
      url = new URL(webhookUrl.trim());
    } catch {
      return json({
        ok: false,
        error: 'La URL del Web App no es válida. Debe empezar con https://script.google.com/macros/s/.../exec',
      });
    }

    if (url.protocol !== 'https:' || !HOSTS_PERMITIDOS.includes(url.hostname)) {
      return json({
        ok: false,
        error: `La URL debe ser un Web App de Google Apps Script. Recibido: ${url.hostname}`,
      });
    }

    const destino = url.toString();

    // Diagnóstico sin enviar correo.
    if (cuerpo.accion === 'ping') {
      const ping = await pingWebApp(destino);
      return json({ ok: ping.ok, activo: ping.activo, mensaje: ping.mensaje, error: ping.ok ? null : ping.mensaje });
    }

    const token = cuerpo.token;
    const payload = cuerpo.payload;

    if (!payload || typeof payload !== 'object') {
      return json({ ok: false, error: 'No hay datos del reporte para enviar.' });
    }

    let respuesta: Response | null = null;
    let errorRed = '';

    try {
      respuesta = await fetch(destino, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token: typeof token === 'string' ? token : '', payload }),
        redirect: 'follow',
      });
    } catch (err) {
      errorRed = err instanceof Error ? err.message : String(err);
    }

    if (!respuesta) {
      return json({
        ok: false,
        error: `No se pudo conectar con el Web App de Google: ${errorRed || 'error de red'}`,
      });
    }

    const texto = await respuesta.text();
    const datos = parsear(texto);

    if (!datos) {
      const ping = await pingWebApp(destino);
      const pista = ping.activo
        ? 'El Web App está publicado y accesible, pero rechazó el envío. Volvé a implementar el script como NUEVA versión (Implementar → Nueva implementación) y actualizá la URL si cambió.'
        : ping.mensaje;
      return json({
        ok: false,
        error: `${pista} Respuesta del POST: ${resumirHtml(texto)}`,
        statusGoogle: respuesta.status,
      });
    }

    if (datos.ok !== true) {
      return json({
        ok: false,
        error: String(datos.error || 'El script de Google rechazó el envío.'),
        detalle: datos.detalle ? String(datos.detalle) : null,
      });
    }

    return json({
      ok: true,
      mensaje: String(datos.mensaje || 'Correo enviado correctamente.'),
      modo: datos.modo || null,
      destinatarios: datos.destinatarios || null,
    });
  } catch (err) {
    return json({
      ok: false,
      error: `Error interno del envío: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});
