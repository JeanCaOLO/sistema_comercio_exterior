import { createClient } from 'npm:@supabase/supabase-js@2';

// ============================================================
// Cola de correos del Control de Fechas NEXT.
// Google Apps Script (cuenta jalvarez@ologistics.com) consulta esta
// función de lunes a viernes a las 8:00 a.m. (hora Costa Rica),
// envía los correos pendientes con GmailApp y avisa el resultado.
// No se publica ningún Web App: el script es el que "llama" aquí.
//
// DEDUPLICACIÓN: antes de enviar, el script RECLAMA cada correo.
// El reclamo es un candado con vencimiento: mientras un correo está
// reclamado, ninguna otra corrida lo recibe ni lo puede reenviar.
// Si la corrida se cae antes de enviar, el reclamo vence solo y el
// correo vuelve a estar disponible. Si ya se envió, se marca y no
// se vuelve a entregar nunca más.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cola-token, x-cola-worker',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TOKEN_DEFECTO = 'ologistics-control-fechas-2026';
const CLAVE_CONFIG = 'control_fechas_correo';
// En modo "un correo por PO" una sola carga puede dejar decenas de correos
// pendientes (una PO = un correo), así que se entregan todos en la corrida.
const MAX_PENDIENTES = 250;
const MAX_RECLAMO = 500;
/** Minutos que un correo queda reclamado antes de volver a estar disponible. */
const MINUTOS_RECLAMO = 120;

const COLUMNAS_CORREO =
  'id, seccion, modo, remitente, para, cc, asunto, cuerpo_html, cuerpo_texto, adjunto_nombre, adjunto_mime, adjunto_base64, total_pos, creado_at, intentos, reclamado_at, reclamado_por';

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

function aEntero(valor: unknown, defecto: number, minimo: number, maximo: number): number {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return defecto;
  return Math.min(maximo, Math.max(minimo, Math.trunc(numero)));
}

/** Filtro PostgREST: libre (sin reclamo) o con el reclamo vencido. */
function filtroDisponible(corte: string): string {
  return `reclamado_at.is.null,reclamado_at.lt.${corte}`;
}

function fechaCorte(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000).toISOString();
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

    // ---------------------------------------------------------
    // RECLAMAR: entrega los correos y los bloquea para esta corrida.
    // Es lo que usa el script antes de mandar nada por Gmail.
    // ---------------------------------------------------------
    if (accion === 'reclamar') {
      const worker = String(cuerpo.worker || req.headers.get('x-cola-worker') || 'apps-script');
      const limite = aEntero(cuerpo.limite, MAX_PENDIENTES, 1, MAX_RECLAMO);
      const minutos = aEntero(cuerpo.minutos, MINUTOS_RECLAMO, 5, 1440);
      const corte = fechaCorte(minutos);

      const { data: candidatos, error: errorCandidatos } = await supabase
        .from('control_fechas_cola_correos')
        .select('id')
        .eq('estado', 'pendiente')
        .or(filtroDisponible(corte))
        .order('creado_at', { ascending: true })
        .limit(limite);

      if (errorCandidatos) return json({ ok: false, error: errorCandidatos.message });

      const ids = ((candidatos || []) as unknown as { id: string }[]).map((fila) => fila.id);
      if (ids.length === 0) {
        return json({
          ok: true,
          total: 0,
          worker,
          minutos_reclamo: minutos,
          pendientes: [],
          mensaje: 'No hay correos pendientes.',
        });
      }

      // El UPDATE solo toma las filas que siguen libres: si otra corrida las
      // reclamó un instante antes, la condición ya no coincide y no se entregan
      // dos veces. Es lo que evita el reenvío al día siguiente.
      const marca = new Date().toISOString();
      const reclamados: Record<string, unknown>[] = [];
      let primerError = '';

      for (let i = 0; i < ids.length; i += 100) {
        const lote = ids.slice(i, i + 100);
        const { data, error } = await supabase
          .from('control_fechas_cola_correos')
          .update({ reclamado_at: marca, reclamado_por: worker })
          .in('id', lote)
          .eq('estado', 'pendiente')
          .or(filtroDisponible(corte))
          .select(COLUMNAS_CORREO);

        if (error) {
          primerError = error.message;
          break;
        }
        if (data) reclamados.push(...(data as unknown as Record<string, unknown>[]));
      }

      if (reclamados.length === 0) {
        return json({
          ok: false,
          error: primerError || 'Otro proceso tomó los correos pendientes. Reintentá en un minuto.',
          total: 0,
          worker,
          pendientes: [],
        });
      }

      reclamados.sort((a, b) => String(a.creado_at || '').localeCompare(String(b.creado_at || '')));

      return json({
        ok: true,
        total: reclamados.length,
        worker,
        minutos_reclamo: minutos,
        expira_at: new Date(Date.now() + minutos * 60_000).toISOString(),
        pendientes: reclamados,
      });
    }

    // ---------------------------------------------------------
    // PENDIENTES: solo lectura (compatibilidad). No reclama nada,
    // así que ya no entrega correos que otra corrida está enviando.
    // ---------------------------------------------------------
    if (accion === 'pendientes') {
      const corte = fechaCorte(MINUTOS_RECLAMO);
      const { data, error } = await supabase
        .from('control_fechas_cola_correos')
        .select(
          'id, seccion, modo, remitente, para, cc, asunto, cuerpo_html, cuerpo_texto, adjunto_nombre, adjunto_mime, adjunto_base64, total_pos, creado_at, intentos'
        )
        .eq('estado', 'pendiente')
        .or(filtroDisponible(corte))
        .order('creado_at', { ascending: true })
        .limit(MAX_PENDIENTES);

      if (error) return json({ ok: false, error: error.message });
      const pendientes = (data || []) as unknown[];
      return json({ ok: true, total: pendientes.length, pendientes });
    }

    // ---------------------------------------------------------
    // LIBERAR: suelta el reclamo sin enviar (para reintentar después).
    // ---------------------------------------------------------
    if (accion === 'liberar') {
      const id = String(cuerpo.id || '');
      if (!id) return json({ ok: false, error: 'Falta el id del correo.' });

      const { error } = await supabase
        .from('control_fechas_cola_correos')
        .update({ reclamado_at: null, reclamado_por: null })
        .eq('id', id)
        .eq('estado', 'pendiente');

      if (error) return json({ ok: false, error: error.message });
      return json({ ok: true, mensaje: 'Correo liberado: queda disponible para la próxima corrida.' });
    }

    // ---------------------------------------------------------
    // MARCAR: registra el resultado del envío. Es idempotente:
    // si el correo ya estaba enviado, no vuelve a registrar el envío
    // ni vuelve a marcar las POs como reportadas.
    // ---------------------------------------------------------
    if (accion === 'marcar') {
      const id = String(cuerpo.id || '');
      if (!id) return json({ ok: false, error: 'Falta el id del correo.' });

      const ok = cuerpo.ok === true;
      const mensaje = String(cuerpo.mensaje || (ok ? 'Correo enviado.' : 'Error al enviar el correo.'));

      const { data: fila, error: errorFila } = await supabase
        .from('control_fechas_cola_correos')
        .select(
          'id, estado, carga_id, seccion, modo, remitente, para, cc, asunto, adjunto_nombre, total_pos, pos, intentos, reclamado_por'
        )
        .eq('id', id)
        .maybeSingle();

      if (errorFila) return json({ ok: false, error: errorFila.message });
      if (!fila) return json({ ok: false, error: 'El correo ya no existe en la cola.' });

      const registro = fila as unknown as {
        id: string;
        estado: string;
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
        reclamado_por: string | null;
      };

      if (registro.estado === 'enviado') {
        return json({
          ok: true,
          duplicado: true,
          mensaje: 'Ese correo ya estaba marcado como enviado: no se registró de nuevo.',
        });
      }

      await supabase
        .from('control_fechas_cola_correos')
        .update({
          estado: ok ? 'enviado' : 'error',
          intentos: Number(registro.intentos || 0) + 1,
          error: ok ? null : mensaje,
          enviado_at: ok ? new Date().toISOString() : null,
          reclamado_at: null,
          reclamado_por: null,
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

      return json({
        ok: true,
        mensaje: ok ? 'Correo marcado como enviado.' : 'Error registrado: no se reintenta.',
      });
    }

    if (accion === 'estado') {
      const { count: pendientes } = await supabase
        .from('control_fechas_cola_correos')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pendiente');

      const { count: reclamados } = await supabase
        .from('control_fechas_cola_correos')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pendiente')
        .not('reclamado_at', 'is', null)
        .gte('reclamado_at', fechaCorte(MINUTOS_RECLAMO));

      const { data: ultimo } = await supabase
        .from('control_fechas_envios')
        .select('seccion, enviado_at, ok, mensaje')
        .order('enviado_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return json({
        ok: true,
        pendientes: pendientes || 0,
        reclamados: reclamados || 0,
        ultimoEnvio: ultimo || null,
      });
    }

    return json({ ok: false, error: `Acción no reconocida: ${accion}` });
  } catch (err) {
    return json({
      ok: false,
      error: `Error interno de la cola: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});
