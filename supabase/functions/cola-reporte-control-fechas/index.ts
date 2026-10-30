import { createClient } from 'npm:@supabase/supabase-js@2';

// ============================================================
// Cola de correos del Control de Fechas NEXT.
// Google Apps Script (cuenta jalvarez@ologistics.com) consulta esta
// función de lunes a viernes a las 8:00 a.m. (hora Costa Rica),
// envía los correos pendientes con GmailApp y avisa el resultado.
// No se publica ningún Web App: el script es el que "llama" aquí.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cola-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TOKEN_DEFECTO = 'ologistics-control-fechas-2026';
const CLAVE_CONFIG = 'control_fechas_correo';
// En modo "un correo por PO" una sola carga puede dejar decenas de correos
// pendientes (una PO = un correo), así que se entregan todos en la corrida.
const MAX_PENDIENTES = 250;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function aListaPos(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.filter((v): v is string => typeof v === 'string');
  if (typeof valor === 'string') {
    try {
      const parseado = JSON.parse(valor);
      if (Array.isArray(parseado)) return parseado.filter((v): v is string => typeof v === 'string');
    } catch {
      return [];
    }
  }
  return [];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return json({ ok: false, error: 'Falta la configuración interna del backend.' });
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let cuerpo: Record<string, unknown> = {};
    try {
      const texto = await req.text();
      cuerpo = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
    } catch {
      return json({ ok: false, error: 'La solicitud llegó con formato inválido.' });
    }

    let esperado = TOKEN_DEFECTO;
    try {
      const { data } = await supabase
        .from('configuracion_sistema')
        .select('valor')
        .eq('clave', CLAVE_CONFIG)
        .maybeSingle();
      const valor = (data as { valor?: string } | null)?.valor;
      if (valor) {
        const config = JSON.parse(valor) as { token?: string };
        if (config?.token) esperado = String(config.token);
      }
    } catch {
      esperado = TOKEN_DEFECTO;
    }

    const recibido = String(cuerpo.token || req.headers.get('x-cola-token') || '');
    if (recibido !== esperado) {
      return json({ ok: false, error: 'Token inválido. Revisá el TOKEN del script.' });
    }

    const accion = String(cuerpo.accion || 'pendientes');

    if (accion === 'pendientes') {
      const { data, error } = await supabase
        .from('control_fechas_cola_correos')
        .select(
          'id, seccion, modo, remitente, para, cc, asunto, cuerpo_html, cuerpo_texto, adjunto_nombre, adjunto_mime, adjunto_base64, total_pos, creado_at'
        )
        .eq('estado', 'pendiente')
        .order('creado_at', { ascending: true })
        .limit(MAX_PENDIENTES);

      if (error) return json({ ok: false, error: error.message });
      const pendientes = (data || []) as unknown[];
      return json({ ok: true, total: pendientes.length, pendientes });
    }

    if (accion === 'marcar') {
      const id = String(cuerpo.id || '');
      if (!id) return json({ ok: false, error: 'Falta el id del correo.' });

      const ok = cuerpo.ok === true;
      const mensaje = String(cuerpo.mensaje || (ok ? 'Correo enviado.' : 'Error al enviar el correo.'));

      const { data: fila, error: errorFila } = await supabase
        .from('control_fechas_cola_correos')
        .select('id, carga_id, seccion, modo, remitente, para, cc, asunto, adjunto_nombre, total_pos, pos, intentos')
        .eq('id', id)
        .maybeSingle();

      if (errorFila) return json({ ok: false, error: errorFila.message });
      if (!fila) return json({ ok: false, error: 'El correo ya no existe en la cola.' });

      const registro = fila as unknown as {
        id: string;
        carga_id: string | null;
        seccion: string;
        modo: string;
        remitente: string | null;
        para: string | null;
        cc: string | null;
        asunto: string | null;
        adjunto_nombre: string | null;
        total_pos: number | null;
        pos: unknown;
        intentos: number | null;
      };

      await supabase
        .from('control_fechas_cola_correos')
        .update({
          estado: ok ? 'enviado' : 'error',
          intentos: Number(registro.intentos || 0) + 1,
          error: ok ? null : mensaje,
          enviado_at: ok ? new Date().toISOString() : null,
        })
        .eq('id', registro.id);

      if (ok && registro.modo === 'real') {
        const pos = aListaPos(registro.pos);
        if (pos.length > 0) {
          const registros = pos.map((po) => ({
            seccion: registro.seccion,
            po,
            enviado_por: registro.remitente || null,
          }));
          for (let i = 0; i < registros.length; i += 400) {
            await supabase
              .from('control_fechas_pos_enviadas')
              .upsert(registros.slice(i, i + 400), { onConflict: 'seccion,po', ignoreDuplicates: true });
          }
        }
      }

      await supabase.from('control_fechas_envios').insert({
        carga_id: registro.carga_id,
        seccion: registro.seccion,
        modo: registro.modo,
        remitente: registro.remitente,
        destinatarios: registro.para,
        copia: registro.cc,
        asunto: registro.asunto,
        adjunto_nombre: registro.adjunto_nombre,
        total_hallazgos: Number(registro.total_pos) || 0,
        ok,
        mensaje,
        enviado_por: registro.remitente,
      });

      return json({ ok: true, mensaje: ok ? 'Correo marcado como enviado.' : 'Error registrado.' });
    }

    if (accion === 'estado') {
      const { count: pendientes } = await supabase
        .from('control_fechas_cola_correos')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pendiente');

      const { data: ultimo } = await supabase
        .from('control_fechas_envios')
        .select('seccion, enviado_at, ok, mensaje')
        .order('enviado_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return json({ ok: true, pendientes: pendientes || 0, ultimoEnvio: ultimo || null });
    }

    return json({ ok: false, error: `Acción no reconocida: ${accion}` });
  } catch (err) {
    return json({
      ok: false,
      error: `Error interno de la cola: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});
