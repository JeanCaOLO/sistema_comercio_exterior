import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type Fila = Record<string, unknown>;

/** Tablas expuestas a Power BI. Las sensibles quedan fuera a propósito. */
const TABLAS: Array<{ nombre: string; descripcion: string }> = [
  { nombre: 'expedientes', descripcion: 'Expedientes de importación (registro principal)' },
  { nombre: 'documentos_caa', descripcion: 'Documentos cargados en Carga CAA' },
  { nombre: 'expedientes_historial', descripcion: 'Bitácora de cambios de los expedientes' },
  { nombre: 'expedientes_tiempos_estados', descripcion: 'Tiempos por estado de cada expediente' },
  { nombre: 'documento_modificaciones', descripcion: 'Historial de modificaciones de documentos' },
  { nombre: 'agente_carga_pos', descripcion: 'Detalle de POs cargadas por el agente de carga' },
  { nombre: 'agente_carga_cargas', descripcion: 'Cabeceras de las cargas del agente de carga' },
  { nombre: 'agente_carga_comparativo', descripcion: 'Comparativo por proveedor de servicio y país' },
  { nombre: 'control_fechas_pos', descripcion: 'Detalle de POs del control de fechas' },
  { nombre: 'control_fechas_cargas', descripcion: 'Cabeceras de las cargas de control de fechas' },
  { nombre: 'control_fechas_envios', descripcion: 'Envíos de reportes de control de fechas' },
  { nombre: 'control_fechas_pos_enviadas', descripcion: 'POs incluidas en cada envío' },
  { nombre: 'control_fechas_cola_correos', descripcion: 'Cola de correos del control de fechas' },
  { nombre: 'etd_initial_change_requests', descripcion: 'Solicitudes de cambio de ETD inicial' },
  { nombre: 'etd_initial_change_events', descripcion: 'Eventos de las solicitudes de cambio de ETD' },
  { nombre: 'reportes_historicos', descripcion: 'Reportes históricos generados' },
  { nombre: 'rfp_condiciones_operativas_r2', descripcion: 'Condiciones operativas RFP' },
];

const TABLAS_PERMITIDAS = new Set(TABLAS.map((t) => t.nombre));

const LIMITE_DEFECTO = 1000;
const LIMITE_MAXIMO = 5000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Comparación en tiempo constante para no filtrar información por tiempos. */
function llaveCoincide(recibida: string, esperada: string): boolean {
  if (!recibida || !esperada || recibida.length !== esperada.length) return false;
  let diferencia = 0;
  for (let i = 0; i < recibida.length; i += 1) {
    diferencia |= recibida.charCodeAt(i) ^ esperada.charCodeAt(i);
  }
  return diferencia === 0;
}

function escaparCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') {
    const texto = JSON.stringify(valor);
    return `"${texto.replace(/"/g, '""')}"`;
  }
  const texto = String(valor);
  if (/[",;\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function aCsv(filas: Fila[]): string {
  if (!filas.length) return '';
  const columnas: string[] = [];
  filas.forEach((fila) => {
    Object.keys(fila).forEach((clave) => {
      if (!columnas.includes(clave)) columnas.push(clave);
    });
  });
  const encabezado = columnas.join(',');
  const cuerpo = filas.map((fila) => columnas.map((c) => escaparCsv(fila[c])).join(','));
  return [encabezado, ...cuerpo].join('\r\n');
}

function numero(valor: string | null, porDefecto: number): number {
  if (!valor) return porDefecto;
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

function identificadorValido(valor: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(valor);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const llaveEsperada = Deno.env.get('POWERBI_API_KEY') || '';
  if (!llaveEsperada) {
    return json(
      {
        ok: false,
        error: 'Falta configurar el secreto POWERBI_API_KEY en el proyecto de Supabase.',
      },
      500,
    );
  }

  const url = new URL(req.url);
  const llaveRecibida = req.headers.get('x-api-key') || url.searchParams.get('key') || '';

  if (!llaveCoincide(llaveRecibida, llaveEsperada)) {
    return json(
      {
        ok: false,
        error: 'No autorizado. Enviá la llave en el header x-api-key o en el parámetro key de la URL.',
      },
      401,
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'El proyecto de Supabase no tiene configuradas las credenciales internas.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Catálogo de tablas disponibles
    if (url.searchParams.get('tablas') === '1' || url.searchParams.get('catalogo') === '1') {
      return json({
        ok: true,
        total_tablas: TABLAS.length,
        tablas: TABLAS.map((t) => ({
          nombre: t.nombre,
          descripcion: t.descripcion,
          url: `${supabaseUrl}/functions/v1/powerbi-api?tabla=${t.nombre}&limit=${LIMITE_DEFECTO}&page=1`,
        })),
        limites: { limite_defecto: LIMITE_DEFECTO, limite_maximo: LIMITE_MAXIMO },
      });
    }

    if (url.searchParams.get('ping') === '1') {
      return json({ ok: true, mensaje: 'API de Power BI operativa.', fecha: new Date().toISOString() });
    }

    const tabla = (url.searchParams.get('tabla') || '').trim().toLowerCase();

    if (!tabla) {
      return json(
        {
          ok: false,
          error: 'Falta el parámetro "tabla". Ejemplo: ?tabla=expedientes&limit=1000&page=1',
          tablas_disponibles: TABLAS.map((t) => t.nombre),
        },
        400,
      );
    }

    if (!identificadorValido(tabla) || !TABLAS_PERMITIDAS.has(tabla)) {
      return json(
        {
          ok: false,
          error: `La tabla "${tabla}" no está expuesta por esta API.`,
          tablas_disponibles: TABLAS.map((t) => t.nombre),
        },
        403,
      );
    }

    const limiteBruto = numero(url.searchParams.get('limit'), LIMITE_DEFECTO);
    const limite = Math.min(Math.max(Math.trunc(limiteBruto), 1), LIMITE_MAXIMO);

    const paginaBruta = numero(url.searchParams.get('page'), 1);
    const pagina = Math.max(Math.trunc(paginaBruta), 1);

    const desde = (pagina - 1) * limite;
    const hasta = desde + limite - 1;

    const columnasPedidas = (url.searchParams.get('columnas') || '')
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && identificadorValido(c));

    const seleccion = columnasPedidas.length > 0 ? columnasPedidas.join(',') : '*';

    const ordenBruto = url.searchParams.get('order') || 'id';
    const [ordenColBruto, ordenDirBruto] = ordenBruto.split('.');
    const columnaOrden = ordenColBruto && identificadorValido(ordenColBruto) ? ordenColBruto : 'id';
    const ascendente = (ordenDirBruto || 'asc').toLowerCase() !== 'desc';

    let data: Fila[] | null = null;
    let error: { message: string } | null = null;
    let count: number | null = null;

    const primera = await supabase
      .from(tabla)
      .select(seleccion, { count: 'exact' })
      .order(columnaOrden, { ascending: ascendente })
      .range(desde, hasta);

    data = (primera.data as Fila[] | null) ?? null;
    error = primera.error;
    count = primera.count;

    // Algunas tablas no tienen columna "id": se reintenta sin orden.
    if (error) {
      const reintento = await supabase
        .from(tabla)
        .select(seleccion, { count: 'exact' })
        .range(desde, hasta);

      if (!reintento.error) {
        data = (reintento.data as Fila[] | null) ?? null;
        error = null;
        count = reintento.count;
      }
    }

    if (error) {
      return json(
        { ok: false, error: `No se pudo leer la tabla "${tabla}": ${error.message}` },
        502,
      );
    }

    const filas = data ?? [];
    const total = count ?? filas.length;
    const paginas = limite > 0 ? Math.max(Math.ceil(total / limite), 1) : 1;

    if ((url.searchParams.get('format') || url.searchParams.get('formato') || '').toLowerCase() === 'csv') {
      return new Response(aCsv(filas), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${tabla}-pagina-${pagina}.csv"`,
        },
      });
    }

    return json({
      ok: true,
      tabla,
      pagina,
      limite,
      total_registros: total,
      total_paginas: paginas,
      hay_mas: pagina < paginas,
      orden: { columna: columnaOrden, direccion: ascendente ? 'asc' : 'desc' },
      columnas: columnasPedidas.length > 0 ? columnasPedidas : null,
      filas,
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: `Error interno de la API: ${err instanceof Error ? err.message : String(err)}`,
      },
      500,
    );
  }
});
