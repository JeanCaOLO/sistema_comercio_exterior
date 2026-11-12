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
// Acciones: get-purchase-order | update-etd-initial | update-kanban-status
//           update-purchase-order-fields | diagnose-kanban
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
      const textoResp = await resp.text();

      if (!resp.ok) {
        return json({
          ok: false,
          api_env: apiEnv,
          upstream_status: resp.status,
          error: `Raga (${apiEnv}) respondió ${resp.status}: ${detalleUpstream(textoResp)}`,
        });
      }
      return json({ ok: true, api_env: apiEnv, data: parseSeguro(textoResp) });
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
      const textoResp = await resp.text();

      if (!resp.ok) {
        return json({
          ok: false,
          api_env: apiEnv,
          upstream_status: resp.status,
          error: `Raga (${apiEnv}) respondió ${resp.status}: ${detalleUpstream(textoResp)}`,
        });
      }
      return json({ ok: true, api_env: apiEnv, data: parseSeguro(textoResp) });
    }

    // Diagnóstico: devuelve cómo expone Raga la etapa de una PO concreta.
    // No modifica nada; sirve para confirmar nombres de campos y valores reales.
    if (action === 'diagnose-kanban') {
      const orderNumber = String(body?.order_number || '').trim();
      const tradingCompany = String(body?.trading_company || '').trim();
      if (!orderNumber) return json({ ok: false, error: 'Falta el número de orden (order_number).' }, 400);

      const cabeceras = cabecerasRaga({ Accept: 'application/json' });
      if (!cabeceras) return json({ ok: false, error: FALTA_TOKEN }, 500);

      const lectura = await leerPo(baseUrl, orderNumber, tradingCompany, cabeceras);
      if (!lectura.ok || !lectura.po) {
        return json({ ok: false, api_env: apiEnv, error: lectura.error || 'No se pudo leer la PO en Raga.' });
      }
      return json({
        ok: true,
        api_env: apiEnv,
        campos_etapa: camposEtapa(lectura.po),
        claves_orden: Object.keys(lectura.po).slice(0, 150),
      });
    }

    // Cambio de ETAPA (estado de kanban) de una PO.
    // La API de Raga puede aceptar el PUT con un 200 sin aplicar el cambio
    // (porque el campo no es escribible o el valor no es el esperado), así que
    // NUNCA se confirma el éxito por el código HTTP: después de cada intento se
    // vuelve a leer la PO y se verifica que la etapa haya cambiado de verdad.
    if (action === 'update-kanban-status') {
      const orderNumber = String(body?.order_number || '').trim();
      const tradingCompany = String(body?.trading_company || '').trim();
      const fieldKey = String(body?.field_key || 'kanban_status').trim();
      const objetivo: ObjetivoEtapa = {
        valor: texto(body?.status_value),
        id: texto(body?.status_id) || null,
        nombre: texto(body?.status_name) || null,
      };

      if (!orderNumber || !tradingCompany) {
        return json({ ok: false, error: 'Faltan datos obligatorios (order_number, trading_company).' }, 400);
      }
      if (!objetivo.valor) {
        return json({ ok: false, error: 'Falta la etapa destino (status_value).' }, 400);
      }
      if (!CAMPOS_ETAPA.has(fieldKey)) {
        return json({ ok: false, error: `El campo de etapa "${fieldKey}" no está habilitado para este módulo.` }, 400);
      }

      const cabeceras = cabecerasRaga({ 'Content-Type': 'application/json', Accept: 'application/json' });
      if (!cabeceras) return json({ ok: false, error: FALTA_TOKEN }, 500);

      // 1) Estado actual real de la PO.
      const antes = await leerPo(baseUrl, orderNumber, tradingCompany, cabeceras);
      if (!antes.ok || !antes.po) {
        return json({
          ok: false,
          api_env: apiEnv,
          verificado: false,
          error: antes.error || 'No se pudo leer la PO antes de cambiar la etapa.',
        });
      }

      // 2) Si ya está en la etapa destino no hace falta escribir nada.
      if (coincideEtapa(antes.po, objetivo)) {
        return json({
          ok: true,
          api_env: apiEnv,
          verificado: true,
          ya_estaba: true,
          etapa_observada: camposEtapa(antes.po),
        });
      }

      const planes = construirIntentos(baseUrl, orderNumber, tradingCompany, fieldKey, objetivo, antes.po);
      const intentos: ResultadoIntento[] = [];

      for (const plan of planes) {
        let resp: Response;
        try {
          resp = await fetch(plan.url, {
            method: plan.metodo,
            headers: cabeceras,
            body: JSON.stringify(plan.cuerpo),
          });
        } catch (e) {
          intentos.push({
            ruta: plan.etiqueta,
            enviado: plan.cuerpo,
            status: null,
            respuesta: e instanceof Error ? e.message : 'sin respuesta',
            verificado: false,
          });
          continue;
        }

        const textoRespuesta = await resp.text();
        const registro: ResultadoIntento = {
          ruta: plan.etiqueta,
          enviado: plan.cuerpo,
          status: resp.status,
          respuesta: detalleUpstream(textoRespuesta),
          verificado: false,
        };
        intentos.push(registro);

        // Un error del endpoint no descarta el siguiente intento.
        if (!resp.ok) continue;

        // Verificación real: se relee la PO y se compara la etapa observada.
        const despues = await leerPo(baseUrl, orderNumber, tradingCompany, cabeceras);
        if (despues.ok && despues.po && coincideEtapa(despues.po, objetivo)) {
          registro.verificado = true;
          return json({
            ok: true,
            api_env: apiEnv,
            verificado: true,
            intento_efectivo: plan.etiqueta,
            enviado: plan.cuerpo,
            intentos,
            etapa_observada: camposEtapa(despues.po),
          });
        }
      }

      const resumen = intentos
        .map((i) => `${i.ruta} → ${i.status === null ? 'sin respuesta' : i.status}`)
        .join(' · ');
      const ultima = intentos.length > 0 ? intentos[intentos.length - 1].respuesta : '';

      return json({
        ok: false,
        api_env: apiEnv,
        verificado: false,
        intentos,
        etapa_observada: camposEtapa(antes.po),
        error: `Raga respondió pero la etapa de la PO ${orderNumber} no cambió. Intentos: ${resumen}. Última respuesta: ${ultima || 'sin detalle'}. La solicitud sigue pendiente.`,
      });
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
      const textoResp = await resp.text();

      if (!resp.ok) {
        return json({
          ok: false,
          api_env: apiEnv,
          upstream_status: resp.status,
          enviado: fields,
          error: `Raga (${apiEnv}) respondió ${resp.status}: ${detalleUpstream(textoResp)}`,
        });
      }
      return json({ ok: true, api_env: apiEnv, data: parseSeguro(textoResp) });
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

// Campos de la PO que representan la etapa / estado de kanban.
const CAMPOS_ETAPA = new Set([
  'kanban_status_id',
  'kanban_status',
  'kanban_status_name',
  'kanban_status_slug',
  'kanban_status_key',
  'kanban_state_id',
  'kanban_state',
  'kanban_state_slug',
  'estado_kanban_id',
  'estado_kanban',
  'status_id',
  'etapa_id',
  'etapa',
  'stage',
]);

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

// ─────────────────────────────────────────────────────────────
// LECTURA Y VERIFICACIÓN DE LA ETAPA
// ─────────────────────────────────────────────────────────────

interface ObjetivoEtapa {
  valor: string;
  id: string | null;
  nombre: string | null;
}

interface ResultadoIntento {
  ruta: string;
  enviado: Record<string, unknown>;
  status: number | null;
  respuesta: string;
  verificado: boolean;
}

interface LecturaPo {
  ok: boolean;
  po?: Record<string, any>;
  error?: string;
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

function normalizarTexto(valor: unknown): string {
  return texto(valor).toLowerCase();
}

function listaPos(payload: unknown): Record<string, any>[] {
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

async function leerPo(
  baseUrl: string,
  orderNumber: string,
  tradingCompany: string,
  cabeceras: Record<string, string>,
): Promise<LecturaPo> {
  const url = `${baseUrl}/api/purchase-orders?order_number=${encodeURIComponent(orderNumber)}`;
  let resp: Response;
  try {
    resp = await fetch(url, { method: 'GET', headers: cabeceras });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo consultar Raga.' };
  }
  const cuerpo = await resp.text();
  if (!resp.ok) {
    return { ok: false, error: `Raga respondió ${resp.status} al leer la PO: ${detalleUpstream(cuerpo)}` };
  }

  const lista = listaPos(parseSeguro(cuerpo));
  const numero = orderNumber.trim().toLowerCase();
  const compania = tradingCompany.trim().toLowerCase();

  const porNumero = lista.filter(
    (po) => texto(po.order_number ?? po.po_number).toLowerCase() === numero,
  );
  if (porNumero.length === 0) return { ok: false, error: `No se encontró la PO ${orderNumber} en Raga.` };
  if (porNumero.length === 1) return { ok: true, po: porNumero[0] };

  if (compania) {
    const porCompania = porNumero.find(
      (po) => texto(po.trading_company).toLowerCase() === compania,
    );
    if (porCompania) return { ok: true, po: porCompania };
  }
  return { ok: true, po: porNumero[0] };
}

// Patrón de claves que describen la etapa del embarque / kanban.
const CLAVES_ETAPA_RE = /kanban|etapa|stage|milestone|embarque|shipment|status/i;

// Recorre la PO y devuelve todos los valores relacionados con la etapa,
// incluidos los que vienen dentro de objetos anidados.
function valoresEtapa(po: Record<string, any>): Map<string, string> {
  const mapa = new Map<string, string>();

  const agregar = (ruta: string, valor: unknown) => {
    const t = texto(valor);
    if (!t || t.length > 120) return;
    mapa.set(ruta, t);
  };

  const visitar = (valor: unknown, ruta: string, dentro: boolean, profundidad: number) => {
    if (profundidad > 4) return;

    if (Array.isArray(valor)) {
      valor.forEach((item, i) => visitar(item, `${ruta}[${i}]`, dentro, profundidad + 1));
      return;
    }

    if (valor && typeof valor === 'object') {
      const obj = valor as Record<string, any>;
      for (const clave of Object.keys(obj)) {
        const hijo = obj[clave];
        const esEtapa = dentro || CLAVES_ETAPA_RE.test(clave);
        if (hijo && typeof hijo === 'object') {
          visitar(hijo, `${ruta}.${clave}`.replace(/^\./, ''), esEtapa, profundidad + 1);
          continue;
        }
        if (!esEtapa) continue;
        agregar(`${ruta}.${clave}`.replace(/^\./, ''), hijo);
      }
      return;
    }

    if (dentro) agregar(ruta, valor);
  };

  visitar(po, '', false, 0);
  return mapa;
}

// ¿La PO ya refleja la etapa objetivo (por slug, id o nombre)?
function coincideEtapa(po: Record<string, any>, objetivo: ObjetivoEtapa): boolean {
  const valores = valoresEtapa(po);
  const buscados = [objetivo.valor, objetivo.id, objetivo.nombre]
    .map((v) => normalizarTexto(v))
    .filter(Boolean);
  if (buscados.length === 0) return false;

  for (const valor of valores.values()) {
    const normalizado = valor.toLowerCase();
    if (buscados.some((b) => b === normalizado)) return true;
    // Tolera valores compuestos tipo "Producción (po-produccion-1)".
    if (buscados.some((b) => b.length >= 4 && normalizado.includes(b))) return true;
  }
  return false;
}

// Vista legible de los campos de etapa de la PO (para diagnóstico y errores).
function camposEtapa(po: Record<string, any>): Record<string, string> {
  const valores = valoresEtapa(po);
  const salida: Record<string, string> = {};
  let contador = 0;
  for (const [ruta, valor] of valores) {
    if (contador >= 40) break;
    salida[ruta] = valor;
    contador += 1;
  }
  return salida;
}

// Busca en el catálogo de estados de la PO el identificador numérico que
// corresponde al slug / nombre destino.
function resolverIdCatalogo(po: Record<string, any>, objetivo: ObjetivoEtapa): string | null {
  const buscados = [objetivo.valor, objetivo.nombre]
    .map((v) => normalizarTexto(v))
    .filter(Boolean);
  if (buscados.length === 0) return null;

  let encontrado: string | null = null;

  const revisar = (valor: unknown, profundidad: number) => {
    if (encontrado || profundidad > 4) return;
    if (Array.isArray(valor)) {
      valor.forEach((item) => revisar(item, profundidad + 1));
      return;
    }
    if (!valor || typeof valor !== 'object') return;

    const obj = valor as Record<string, any>;
    const identidad = [obj.slug, obj.key, obj.clave, obj.code, obj.codigo, obj.name, obj.nombre]
      .map((v) => normalizarTexto(v))
      .filter(Boolean);
    if (identidad.some((i) => buscados.includes(i))) {
      const id = texto(obj.id ?? obj.uuid ?? obj.kanban_status_id);
      if (/^\d+$/.test(id)) {
        encontrado = id;
        return;
      }
    }
    Object.values(obj).forEach((hijo) => {
      if (hijo && typeof hijo === 'object') revisar(hijo, profundidad + 1);
    });
  };

  revisar(po, 0);
  return encontrado;
}

interface PlanIntento {
  etiqueta: string;
  metodo: string;
  url: string;
  cuerpo: Record<string, unknown>;
}

// Estrategias de escritura, de la más conservadora a la más específica.
// Se detiene en la primera que quede verificada al releer la PO.
function construirIntentos(
  baseUrl: string,
  orderNumber: string,
  tradingCompany: string,
  fieldKey: string,
  objetivo: ObjetivoEtapa,
  po: Record<string, any>,
): PlanIntento[] {
  const idCatalogo = objetivo.id || resolverIdCatalogo(po, objetivo);
  const slug = objetivo.valor || objetivo.nombre || idCatalogo || '';
  const id = idCatalogo || (/^\d+$/.test(objetivo.valor) ? objetivo.valor : null);
  const url = `${baseUrl}/api/purchase-orders/${encodeURIComponent(orderNumber)}`;
  const planes: PlanIntento[] = [];
  const vistos = new Set<string>();

  const agregar = (etiqueta: string, metodo: string, destino: string, cuerpo: Record<string, unknown>) => {
    const limpio: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cuerpo)) {
      if (v === null || v === undefined || v === '') continue;
      limpio[k] = v;
    }
    const firma = `${metodo} ${destino} ${JSON.stringify(limpio)}`;
    if (vistos.has(firma)) return;
    vistos.add(firma);
    planes.push({ etiqueta, metodo, url: destino, cuerpo: limpio });
  };

  // 1) El mismo PUT que ya usa el resto de los campos editables, probando los
  //    nombres de campo posibles (el módulo veía "kanban_status_id", pero Raga
  //    puede esperar el slug en "kanban_status").
  const campos = Array.from(new Set([
    fieldKey,
    'kanban_status',
    'kanban_status_slug',
    'kanban_status_key',
    'estado_kanban',
    'kanban_status_id',
    'etapa',
  ])).filter((c) => CAMPOS_ETAPA.has(c));

  for (const campo of campos) {
    const esId = /_id$/.test(campo);
    if (esId) {
      if (!id) continue;
      agregar(
        `PUT /api/purchase-orders/{po} · ${campo}`,
        'PUT',
        url,
        { trading_company: tradingCompany, [campo]: Number(id) },
      );
      continue;
    }
    if (!slug) continue;
    agregar(
      `PUT /api/purchase-orders/{po} · ${campo}`,
      'PUT',
      url,
      { trading_company: tradingCompany, [campo]: slug },
    );
  }

  // 2) Endpoints dedicados al movimiento de kanban, por si la etapa no se puede
  //    escribir en el endpoint general de la orden.
  for (const sufijo of ['kanban-status', 'kanban']) {
    const destino = `${url}/${sufijo}`;
    agregar(
      `PUT /api/purchase-orders/{po}/${sufijo}`,
      'PUT',
      destino,
      { trading_company: tradingCompany, kanban_status: slug, kanban_status_id: id ? Number(id) : null },
    );
    agregar(
      `POST /api/purchase-orders/{po}/${sufijo}`,
      'POST',
      destino,
      { trading_company: tradingCompany, kanban_status: slug, kanban_status_id: id ? Number(id) : null },
    );
  }

  // 3) PATCH sobre la orden (algunas instalaciones solo aceptan PATCH parcial).
  agregar(
    'PATCH /api/purchase-orders/{po}',
    'PATCH',
    url,
    { trading_company: tradingCompany, kanban_status: slug, [fieldKey]: slug },
  );

  return planes.slice(0, 10);
}

// Resumen legible del cuerpo de error devuelto por Raga (JSON o texto plano).
function detalleUpstream(textoRespuesta: string): string {
  const limpio = (textoRespuesta || '').trim();
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
    return limpio.slice(0, 400);
  } catch (_e) {
    // no es JSON: se devuelve el texto tal cual
  }
  return limpio.slice(0, 400);
}

function parseSeguro(textoRespuesta: string): unknown {
  if (!textoRespuesta) return null;
  try {
    return JSON.parse(textoRespuesta);
  } catch (_e) {
    return textoRespuesta;
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
