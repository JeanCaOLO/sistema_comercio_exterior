// ============================================================
// EDGE FUNCTION: sincronizar-raga-dropship
//
// Sincroniza los expedientes de Dropship y de Zona Franca (ZF) en sus
// estados operativos contra la API de Raga y completa el ticket con:
//   - N° de BL          <- bill_of_lading | mbl_number | hbl_number
//   - N° de Contenedor  <- container_number
//   - ETD               <- date_atd   (salida real, solo Dropship)
//   - ETA Real          <- date_ata   (arribo real, solo Dropship)
// ZF no maneja ETD, así que en ese módulo solo se escriben el BL y el
// contenedor.
//
// Diseñada para NO saturar la API ni la base:
//   - Barrido por lotes: cada corrida procesa un lote acotado por tiempo y
//     por consultas, y devuelve cuántos tickets quedan pendientes.
//   - El cliente encadena lotes (con pausa entre uno y otro) hasta cubrir
//     TODOS los tickets de esos estados dentro de la ventana de 6 horas.
//   - A las 6 horas vuelve a barrer para retomar los que aún no tenían el dato.
//   - Por ticket: una sola consulta por ventana de 6 horas (10 min al forzar).
//   - Máximo 3 PO por ticket y 400 ms de pausa entre consultas.
//   - Bloqueo de corrida: nunca se ejecutan dos corridas en paralelo.
//   - Solo escribe lo que realmente cambió (y lo deja en el historial).
//   - Las consultas se cortan apenas se obtienen los 4 datos.
//
// Seguridad: JWT del usuario obligatorio. La escritura se hace con
// service role únicamente del lado del servidor.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_PROD_URL = 'https://next.ologistics.com';

// Estados del tablero Dropship que participan de la sincronización.
const ESTADOS_DROPSHIP_EN_ALCANCE = ['Asignado', 'En Proceso', 'Liberación', 'Liberacion', 'Liberado', 'LIBERADO'];

// ZF no tiene "Liberación": se sincroniza mientras el tíquete sigue abierto.
const ESTADOS_ZF_EN_ALCANCE = ['Asignado', 'En Proceso', 'Espera de Respuesta'];

const ESTADOS_EN_ALCANCE = [...ESTADOS_DROPSHIP_EN_ALCANCE, ...ESTADOS_ZF_EN_ALCANCE];
const MODULOS_EN_ALCANCE = ['dropship', 'zf'];

const INTERVALO_MINUTOS = 360;            // ventana de 6 h por ticket
const LIMITE_DEFECTO = 20;                // tickets por lote
const LIMITE_MAXIMO = 40;                 // tope duro por lote
const MAX_POS_POR_TICKET = 3;
const MAX_CONSULTAS_POR_CORRIDA = 60;
const PAUSA_ENTRE_CONSULTAS_MS = 400;
const TIMEOUT_CONSULTA_MS = 20000;
const PRESUPUESTO_MS = 80000;             // 80 s máximo por lote
const MINUTOS_MINIMOS_AL_FORZAR = 10;     // evita repetir un ticket al forzar
const BLOQUEO_MINUTOS = 20;
const USUARIO_SISTEMA = 'Sincronización Raga';
const EMAIL_SISTEMA = 'sincronizacion.raga@sistema';

const CAMPOS_HISTORIAL: Record<string, string> = {
  numero_bl: 'N° de BL',
  numero_contenedor: 'N° de Contenedor',
  etd: 'ETD',
  eta_real: 'ETA Real',
};

// Reciben siempre el aviso en la campanita (igual que el resto del sistema).
const EMAILS_NOTIFICACION_GLOBAL = ['jmora@ologistics.com', 'jalvarez@ologistics.com'];

interface PendienteAviso {
  expedienteId: string;
  po: string | null;
  mensaje: string;
  nombres: (string | null)[];
}

interface ExpedienteFila {
  id: string;
  po_tiquetera: string | null;
  numero_bl: string | null;
  numero_contenedor: string | null;
  etd: string | null;
  eta_real: string | null;
  estado_expediente: string | null;
  solicitante: string | null;
  responsable_creacion: string | null;
  tipo_modulo: string | null;
}

interface ControlFila {
  expediente_id: string;
  ultimo_intento_at: string | null;
  ultima_ok_at: string | null;
  intentos: number | null;
  errores_consecutivos: number | null;
}

interface DatosRaga {
  bl: string;
  contenedor: string;
  atd: string;
  ata: string;
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

    // 1) Identificar al usuario que invoca (cliente anónimo, solo para auth).
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
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

    // 2) Cliente privilegiado SOLO para base de datos.
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
    const limiteSolicitado = Number(body?.limite);
    const limite = Number.isFinite(limiteSolicitado) && limiteSolicitado > 0
      ? Math.min(Math.floor(limiteSolicitado), LIMITE_MAXIMO)
      : LIMITE_DEFECTO;

    const baseUrl = Deno.env.get('RAGA_API_BASE_URL_PROD') || DEFAULT_PROD_URL;

    // 3) Liberar corridas que quedaron colgadas y verificar el bloqueo.
    await db
      .from('raga_sync_corridas')
      .update({
        estado: 'ERROR',
        finalizado_at: new Date().toISOString(),
        detalle: 'Corrida interrumpida (sin cierre). Se libera el bloqueo.',
      })
      .eq('estado', 'CORRIENDO')
      .lt('iniciado_at', isoHaceMinutos(BLOQUEO_MINUTOS));

    const { data: enCurso } = await db
      .from('raga_sync_corridas')
      .select('id, iniciado_at')
      .eq('estado', 'CORRIENDO')
      .gte('iniciado_at', isoHaceMinutos(BLOQUEO_MINUTOS))
      .limit(1);

    if (enCurso && enCurso.length > 0) {
      return json({
        ok: true,
        saltado: true,
        motivo: 'Ya hay una sincronización en curso. Se evita duplicar consultas a Raga.',
      });
    }

    // 4) Traer únicamente los tickets de Dropship y ZF en los estados pedidos.
    const { data: expedientes, error: errorExp } = await db
      .from('expedientes')
      .select('id, po_tiquetera, numero_bl, numero_contenedor, etd, eta_real, estado_expediente, solicitante, responsable_creacion, tipo_modulo')
      .in('tipo_modulo', MODULOS_EN_ALCANCE)
      .in('estado_expediente', ESTADOS_EN_ALCANCE)
      .order('updated_at', { ascending: true })
      .limit(600);

    if (errorExp) {
      return json({ ok: false, error: `No se pudieron leer los expedientes: ${errorExp.message}` }, 500);
    }

    // Cada módulo conserva su propio alcance: ZF no amplía los estados de Dropship.
    const lista = ((expedientes || []) as unknown as ExpedienteFila[]).filter((exp) => {
      const estado = texto(exp.estado_expediente);
      if (texto(exp.tipo_modulo) === 'zf') return ESTADOS_ZF_EN_ALCANCE.includes(estado);
      return ESTADOS_DROPSHIP_EN_ALCANCE.includes(estado);
    });
    if (lista.length === 0) {
      return json({ ok: true, tickets_revisados: 0, mensaje: 'No hay tickets de Dropship ni ZF en los estados configurados.' });
    }

    // 5) Control por ticket (para respetar el intervalo de 6 horas).
    const control = new Map<string, ControlFila>();
    for (const bloque of partir(lista.map((e) => e.id), 200)) {
      const { data: filas } = await db
        .from('raga_sync_dropship')
        .select('expediente_id, ultimo_intento_at, ultima_ok_at, intentos, errores_consecutivos')
        .in('expediente_id', bloque);
      (filas || []).forEach((f: any) => control.set(f.expediente_id, f as ControlFila));
    }

    const ahora = Date.now();
    const elegibles = lista
      .filter((exp) => {
        const c = control.get(exp.id);
        if (!c?.ultimo_intento_at) return true;
        const t = new Date(c.ultimo_intento_at).getTime();
        if (!Number.isFinite(t)) return true;
        // Al forzar se permite repetir, pero nunca dentro de los últimos minutos.
        if (forzar) return ahora - t >= MINUTOS_MINIMOS_AL_FORZAR * 60 * 1000;
        return ahora - t >= INTERVALO_MINUTOS * 60 * 1000;
      })
      // Primero los tickets a los que todavía les falta algún dato, luego los
      // que llevan más tiempo sin consultarse.
      .sort((a, b) => {
        const completaA = ticketCompleto(a);
        const completaB = ticketCompleto(b);
        if (completaA !== completaB) return completaA ? 1 : -1;
        const ta = control.get(a.id)?.ultimo_intento_at;
        const tb = control.get(b.id)?.ultimo_intento_at;
        if (!ta && !tb) return 0;
        if (!ta) return -1;
        if (!tb) return 1;
        return new Date(ta).getTime() - new Date(tb).getTime();
      });

    if (elegibles.length === 0) {
      const { data: ultima } = await db
        .from('raga_sync_corridas')
        .select('iniciado_at, tickets_revisados, tickets_actualizados, consultas_api')
        .eq('estado', 'COMPLETADA')
        .order('iniciado_at', { ascending: false })
        .limit(1);
      const incompletos = lista.filter((e) => !ticketCompleto(e)).length;
      return json({
        ok: true,
        tickets_revisados: 0,
        tickets_en_alcance: 0,
        pendientes_restantes: 0,
        continuar: false,
        saltado: true,
        motivo: incompletos > 0
          ? `Los ${incompletos} ticket(s) a los que aún les falta un dato ya se consultaron en las últimas ${INTERVALO_MINUTOS / 60} horas. La próxima pasada los vuelve a intentar.`
          : `Los ${lista.length} ticket(s) de esos estados ya fueron consultados en las últimas ${INTERVALO_MINUTOS / 60} horas.`,
        ultima_corrida: ultima?.[0] || null,
      });
    }

    // 6) Registrar la corrida (sirve también como bloqueo).
    const { data: corrida, error: errorCorrida } = await db
      .from('raga_sync_corridas')
      .insert([{
        origen: forzar ? 'manual' : 'automatico',
        estado: 'CORRIENDO',
        ejecutado_por: email,
        tickets_revisados: 0,
        consultas_api: 0,
        tickets_actualizados: 0,
        tickets_sin_cambios: 0,
        errores: 0,
      }])
      .select('id')
      .single();

    if (errorCorrida || !corrida) {
      return json({ ok: false, error: `No se pudo registrar la corrida: ${errorCorrida?.message || 'sin id'}` }, 500);
    }

    const inicioLote = Date.now();
    let consultas = 0;
    let actualizados = 0;
    let sinCambios = 0;
    let errores = 0;
    const detalleTickets: Array<Record<string, unknown>> = [];
    const pendientesAviso: PendienteAviso[] = [];
    const procesados: ExpedienteFila[] = [];

    for (const exp of elegibles) {
      // Corte del lote. Los tickets que no alcanzaron a procesarse no se tocan
      // en el control, así que la siguiente corrida los retoma de inmediato.
      if (procesados.length >= limite) break;
      if (consultas >= MAX_CONSULTAS_POR_CORRIDA) break;
      if (Date.now() - inicioLote > PRESUPUESTO_MS) break;

      procesados.push(exp);

      const detalle: string[] = [];
      const datos: DatosRaga = { bl: '', contenedor: '', atd: '', ata: '' };
      let falloConsulta = false;

      const numerosPo = extraerNumerosPo(exp.po_tiquetera);

      if (numerosPo.length === 0) {
        detalle.push('El ticket no tiene un número de PO válido.');
        errores += 1;
        await upsertControl(db, {
          expediente_id: exp.id,
          po_tiquetera: exp.po_tiquetera,
          resultado: 'SIN_PO',
          detalle: detalle.join(' '),
          cambios: 0,
          ok: false,
          intentos: (control.get(exp.id)?.intentos || 0) + 1,
          erroresConsecutivos: (control.get(exp.id)?.errores_consecutivos || 0) + 1,
        });
        detalleTickets.push({ expediente_id: exp.id, po: exp.po_tiquetera, resultado: 'SIN_PO' });
        continue;
      }

      for (const orden of numerosPo.slice(0, MAX_POS_POR_TICKET)) {
        if (consultas >= MAX_CONSULTAS_POR_CORRIDA) {
          detalle.push('Se alcanzó el máximo de consultas por corrida.');
          break;
        }
        if (consultas > 0) await esperar(PAUSA_ENTRE_CONSULTAS_MS);

        consultas += 1;
        const res = await consultarPo(baseUrl, orden);
        if (!res.ok) {
          falloConsulta = true;
          detalle.push(`PO ${orden}: ${res.error}`);
          continue;
        }
        if (!res.po) {
          detalle.push(`PO ${orden}: Raga no devolvió datos de la orden.`);
          continue;
        }

        const po = res.po as Record<string, unknown>;
        if (!datos.bl) {
          datos.bl = limpiarIdentificador(po.bill_of_lading)
            || limpiarIdentificador(po.mbl_number)
            || limpiarIdentificador(po.hbl_number);
        }
        if (!datos.contenedor) {
          datos.contenedor = limpiarIdentificador(po.container_number)
            || limpiarIdentificador(po.container);
        }
        if (!datos.atd) datos.atd = soloFecha(po.date_atd);
        if (!datos.ata) datos.ata = soloFecha(po.date_ata);

        if (datos.bl && datos.contenedor && datos.atd && datos.ata) break;
      }

      // 7) Calcular únicamente lo que cambia.
      // ZF no tiene ETD: en ese módulo solo se completa el BL y el contenedor.
      const esZf = texto(exp.tipo_modulo) === 'zf';
      const cambios: Record<string, { antes: string; despues: string }> = {};

      const blActual = texto(exp.numero_bl);
      if (datos.bl && datos.bl !== blActual) {
        cambios.numero_bl = { antes: blActual, despues: datos.bl };
      }
      const contActual = texto(exp.numero_contenedor);
      if (datos.contenedor && datos.contenedor !== contActual) {
        cambios.numero_contenedor = { antes: contActual, despues: datos.contenedor };
      }
      // Raga manda: si hay ATD/ATA se sobrescribe la fecha del ticket (Dropship).
      if (!esZf && datos.atd && datos.atd !== soloFecha(exp.etd)) {
        cambios.etd = { antes: soloFecha(exp.etd), despues: datos.atd };
      }
      if (!esZf && datos.ata && datos.ata !== soloFecha(exp.eta_real)) {
        cambios.eta_real = { antes: soloFecha(exp.eta_real), despues: datos.ata };
      }

      const claves = Object.keys(cambios);
      const sinDatosRaga = !datos.bl && !datos.contenedor && !datos.atd && !datos.ata;

      let resultado = 'SIN_CAMBIOS';
      let aplicado = false;

      if (claves.length > 0 && !simular) {
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        claves.forEach((k) => { update[k] = cambios[k].despues; });

        const { error: errorUpdate } = await db.from('expedientes').update(update).eq('id', exp.id);
        if (errorUpdate) {
          errores += 1;
          detalle.push(`No se pudo guardar en el ticket: ${errorUpdate.message}`);
          resultado = 'ERROR';
        } else {
          aplicado = true;
          actualizados += 1;
          resultado = 'ACTUALIZADO';
          const filasHistorial = claves.map((k) => ({
            expediente_id: exp.id,
            campo_modificado: CAMPOS_HISTORIAL[k] || k,
            valor_anterior: cambios[k].antes || '',
            valor_nuevo: cambios[k].despues,
            usuario: USUARIO_SISTEMA,
            usuario_email: EMAIL_SISTEMA,
            fecha_cambio: new Date().toISOString(),
          }));
          const { error: errorHistorial } = await db.from('expedientes_historial').insert(filasHistorial);
          if (errorHistorial) {
            detalle.push(`Cambios aplicados, pero no se pudo registrar el historial: ${errorHistorial.message}`);
          }

          // Aviso para la campanita: Raga completó o corrigió datos del ticket.
          pendientesAviso.push({
            expedienteId: exp.id,
            po: exp.po_tiquetera,
            mensaje: mensajeSincronizacion(exp.po_tiquetera, cambios, exp.tipo_modulo),
            nombres: [exp.solicitante, exp.responsable_creacion],
          });
        }
      } else if (claves.length > 0 && simular) {
        resultado = 'SIMULADO';
        detalle.push(`Se actualizarían: ${claves.map((k) => CAMPOS_HISTORIAL[k] || k).join(', ')}.`);
      } else {
        sinCambios += 1;
        resultado = sinDatosRaga ? 'SIN_DATOS' : 'SIN_CAMBIOS';
      }

      if (falloConsulta && !aplicado) {
        errores += 1;
        resultado = 'ERROR';
      }

      if (datos.bl) detalle.push(`BL: ${datos.bl}.`);
      if (datos.contenedor) detalle.push(`Contenedor: ${datos.contenedor}.`);
      if (datos.atd) detalle.push(`ATD: ${datos.atd}.`);
      if (datos.ata) detalle.push(`ATA: ${datos.ata}.`);
      if (!datos.bl && !datos.contenedor) detalle.push('Raga no tiene BL ni contenedor para esta PO.');

      await upsertControl(db, {
        expediente_id: exp.id,
        po_tiquetera: exp.po_tiquetera,
        resultado,
        detalle: detalle.join(' ').slice(0, 900),
        cambios: claves.length,
        ok: !falloConsulta,
        intentos: (control.get(exp.id)?.intentos || 0) + 1,
        erroresConsecutivos: falloConsulta
          ? (control.get(exp.id)?.errores_consecutivos || 0) + 1
          : 0,
      });

      detalleTickets.push({
        expediente_id: exp.id,
        po: exp.po_tiquetera,
        resultado,
        cambios: claves,
      });
    }

    const pendientesRestantes = Math.max(0, elegibles.length - procesados.length);
    const resumen = `${actualizados} actualizados · ${sinCambios} sin cambios · ${errores} con error`;
    const avisos = await registrarAvisosCampanita(db, pendientesAviso);

    await db
      .from('raga_sync_corridas')
      .update({
        estado: 'COMPLETADA',
        finalizado_at: new Date().toISOString(),
        tickets_revisados: procesados.length,
        consultas_api: consultas,
        tickets_actualizados: actualizados,
        tickets_sin_cambios: sinCambios,
        errores,
        detalle: `${resumen} · lote ${procesados.length}/${elegibles.length}${simular ? ' · simulación' : ''}`,
      })
      .eq('id', corrida.id);

    return json({
      ok: true,
      corrida_id: corrida.id,
      simulacion: simular,
      tickets_revisados: procesados.length,
      tickets_en_alcance: elegibles.length,
      pendientes_restantes: pendientesRestantes,
      continuar: pendientesRestantes > 0,
      consultas_api: consultas,
      tickets_actualizados: actualizados,
      tickets_sin_cambios: sinCambios,
      errores,
      avisos_enviados: avisos,
      detalle: detalleTickets,
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error inesperado en la sincronización.';
    return json({ ok: false, error: mensaje }, 500);
  }
});

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────

async function consultarPo(
  baseUrl: string,
  orderNumber: string,
): Promise<{ ok: boolean; po?: Record<string, unknown>; error?: string }> {
  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), TIMEOUT_CONSULTA_MS);
  try {
    const url = `${baseUrl}/api/purchase-orders?order_number=${encodeURIComponent(orderNumber)}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
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
    const coincidencia = lista.find(
      (p) => String(p.order_number ?? p.po_number ?? '').trim().toLowerCase() === numero,
    );
    return { ok: true, po: coincidencia || lista[0] };
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

// Un ticket puede tener varias PO ("6703309 / 6703712 / 6703716").
function extraerNumerosPo(valor: string | null): string[] {
  const textoPo = texto(valor);
  if (!textoPo) return [];
  const partes = textoPo.split(/[\/,;\n|]+/).map((p) => p.trim()).filter(Boolean);
  const validos = partes.filter((p) => /^[A-Za-z0-9-]{3,}$/.test(p));
  return Array.from(new Set(validos));
}

function limpiarIdentificador(valor: unknown): string {
  const t = texto(valor).toUpperCase();
  if (!t) return '';
  if (['NULL', 'N/A', 'NA', 'SIN BL', 'SIN CONTENEDOR', '-'].includes(t)) return '';
  return t.length > 40 ? '' : t;
}

function soloFecha(valor: unknown): string {
  const t = texto(valor);
  if (!t) return '';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  return m ? m[1] : '';
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

// ¿El ticket ya tiene los 4 datos que aporta Raga?
// Los incompletos se consultan primero en cada barrido.
function ticketCompleto(exp: ExpedienteFila): boolean {
  const tieneBlYContenedor = Boolean(texto(exp.numero_bl) && texto(exp.numero_contenedor));
  // ZF no maneja ETD ni ETA Real desde Raga: con BL y contenedor ya está completo.
  if (texto(exp.tipo_modulo) === 'zf') return tieneBlYContenedor;
  return tieneBlYContenedor && Boolean(soloFecha(exp.etd) && soloFecha(exp.eta_real));
}

// Construye el texto del aviso según lo que Raga completó o corrigió.
function mensajeSincronizacion(
  po: string | null,
  cambios: Record<string, { antes: string; despues: string }>,
  tipoModulo: string | null,
): string {
  const partes: string[] = [];
  if (cambios.numero_bl) partes.push(`N° de BL ${cambios.numero_bl.despues}`);
  if (cambios.numero_contenedor) partes.push(`N° de Contenedor ${cambios.numero_contenedor.despues}`);
  if (cambios.etd) partes.push(`ETD ${cambios.etd.despues}`);
  if (cambios.eta_real) partes.push(`ETA Real ${cambios.eta_real.despues}`);

  const detalle = partes.length > 0 ? partes.join(' · ') : 'datos del embarque';
  const soloCompletado = Object.values(cambios).every((c) => !c.antes);
  const accion = soloCompletado ? 'completó' : 'actualizó';
  const modulo = texto(tipoModulo) === 'zf' ? 'ZF' : 'Dropship';
  return `Raga ${accion} datos del ticket ${po || 'sin PO'} (${modulo}): ${detalle}.`;
}

// Inserta los avisos de la campanita: solicitante, responsable y los correos globales.
async function registrarAvisosCampanita(db: any, pendientes: PendienteAviso[]): Promise<number> {
  if (pendientes.length === 0) return 0;

  const nombres = Array.from(
    new Set(
      pendientes
        .flatMap((p) => p.nombres)
        .map((n) => texto(n))
        .filter(Boolean),
    ),
  );

  const usuarios = new Map<string, { id: string; nombre: string }>();

  if (nombres.length > 0) {
    const { data, error } = await db.from('usuarios').select('id, nombre').in('nombre', nombres);
    if (error) console.error('[RAGA-SYNC] No se pudieron leer los usuarios:', error.message);
    (data || []).forEach((u: any) => usuarios.set(u.id, { id: u.id, nombre: u.nombre }));
  }

  const { data: globales, error: errorGlobales } = await db
    .from('usuarios')
    .select('id, nombre')
    .in('email', EMAILS_NOTIFICACION_GLOBAL);
  if (errorGlobales) console.error('[RAGA-SYNC] No se pudieron leer los usuarios globales:', errorGlobales.message);
  (globales || []).forEach((u: any) => usuarios.set(u.id, { id: u.id, nombre: u.nombre }));

  const destinatarios = Array.from(usuarios.values());
  if (destinatarios.length === 0) return 0;

  const filas: Record<string, unknown>[] = [];
  for (const pendiente of pendientes) {
    for (const usuario of destinatarios) {
      filas.push({
        usuario_id: usuario.id,
        mensaje: pendiente.mensaje,
        tipo: 'raga_datos_actualizados',
        expediente_id: pendiente.expedienteId,
        po_tiquetera: pendiente.po,
        usuario_genero: 'Sistema',
        icono: 'ri-ship-2-line',
        leida: false,
      });
    }
  }

  const { error } = await db.from('notificaciones').insert(filas);
  if (error) {
    console.error('[RAGA-SYNC] No se pudieron crear los avisos:', error.message);
    return 0;
  }
  return filas.length;
}

function partir<T>(lista: T[], tamano: number): T[][] {
  const bloques: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) {
    bloques.push(lista.slice(i, i + tamano));
  }
  return bloques;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoHaceMinutos(minutos: number): string {
  return new Date(Date.now() - minutos * 60 * 1000).toISOString();
}

async function upsertControl(
  db: any,
  params: {
    expediente_id: string;
    po_tiquetera: string | null;
    resultado: string;
    detalle: string;
    cambios: number;
    ok: boolean;
    intentos: number;
    erroresConsecutivos: number;
  },
): Promise<void> {
  const ahora = new Date().toISOString();
  const { error } = await db.from('raga_sync_dropship').upsert([{
    expediente_id: params.expediente_id,
    po_tiquetera: params.po_tiquetera,
    ultimo_intento_at: ahora,
    ultima_ok_at: params.ok ? ahora : null,
    resultado: params.resultado,
    detalle: params.detalle,
    cambios: params.cambios,
    intentos: params.intentos,
    errores_consecutivos: params.erroresConsecutivos,
    updated_at: ahora,
  }], { onConflict: 'expediente_id' });

  if (error) console.error('[RAGA-SYNC] No se pudo guardar el control:', error.message);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
