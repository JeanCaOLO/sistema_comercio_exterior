// Lee facturas escaneadas o fotografiadas usando un modelo de visión.
// Recibe las páginas ya convertidas a imagen desde el navegador y devuelve
// las líneas de la factura en un formato fijo para el comparador.

const CLAVE_OPENAI = Deno.env.get('OPENAI_API_KEY');
const MODELO = Deno.env.get('OPENAI_VISION_MODEL') ?? 'gpt-4o-mini';
const LIMITE_IMAGENES = 4;

const CABECERAS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CABECERAS, 'Content-Type': 'application/json' },
  });

const INSTRUCCIONES = `Sos un lector experto de facturas comerciales y packing lists de importación.
Vas a recibir una o más imágenes de páginas de una factura. Devolvé SOLO un JSON válido, sin explicaciones ni bloques de código.

Formato exacto:
{"filas":[{"referencia":"","cantidad":0,"unidad":"","precio_unitario":0,"total":0,"descripcion":""}]}

Reglas obligatorias:
1. Una fila por cada artículo de la factura. No incluyas encabezados, pies, subtotales, totales, fletes, seguros ni firmas.
2. "referencia" es el código del artículo exactamente como aparece, con todos sus guiones y ceros (ejemplo: 03-04-023). Nunca la cortes ni la inventes.
3. "cantidad" es la cantidad de unidades o piezas vendidas (la que va junto a PCS, PZA, UNITS, EA). Si la celda muestra dos valores, por ejemplo "70 PCS" y abajo "14 CTNS", la cantidad es 70 y NO los cartones.
4. "unidad" es la unidad de esa cantidad, normalizada: PCS, PZA, KG, M, CAJA, PAR, SET. Si no se distingue, usá "".
5. "precio_unitario" es el precio por unidad, tal como aparece en la columna de precio (puede tener 4 decimales).
6. "total" es el importe de la línea (cantidad × precio unitario). Si no aparece, pon null.
7. "descripcion" es el texto del artículo, sin cortarlo, en una sola línea. Si la descripción sigue en varias líneas, unilas.
8. Escribí los números sin separadores de miles y con punto decimal. Si un dato no se puede leer, usá null (o "" en textos).
9. No agregues filas repetidas. Si la factura continúa en otra imagen, continuá la lista.`;

interface FilaIA {
  referencia?: string | null;
  cantidad?: number | string | null;
  unidad?: string | null;
  precio_unitario?: number | string | null;
  total?: number | string | null;
  descripcion?: string | null;
}

const aNumero = (valor: number | string | null | undefined): number | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const limpio = String(valor).replace(/[^\d.,-]/g, '');
  if (!/\d/.test(limpio)) return null;
  const coma = limpio.lastIndexOf(',');
  const punto = limpio.lastIndexOf('.');
  let texto = limpio;
  if (coma > -1 && punto > -1) {
    texto = coma > punto ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/,/g, '');
  } else if (coma > -1) {
    texto = /,\d{1,2}$/.test(limpio) ? limpio.replace(',', '.') : limpio.replace(/,/g, '');
  }
  const numero = Number.parseFloat(texto);
  return Number.isFinite(numero) ? numero : null;
};

/** Toma el JSON aunque el modelo lo envuelva en texto o bloques de código. */
function extraerJson(texto: string): any {
  const limpio = texto.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const inicio = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');
    if (inicio > -1 && fin > inicio) {
      try {
        return JSON.parse(limpio.slice(inicio, fin + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CABECERAS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);

  try {
    if (!CLAVE_OPENAI) {
      return responder({ error: 'Falta la clave OPENAI_API_KEY en los secretos del backend.' }, 500);
    }

    const cuerpo = await req.json().catch(() => null);
    const imagenes = Array.isArray(cuerpo?.imagenes) ? cuerpo.imagenes : [];
    const validas = imagenes
      .filter((imagen: unknown) => typeof imagen === 'string' && imagen.startsWith('data:image'))
      .slice(0, LIMITE_IMAGENES);

    if (!validas.length) {
      return responder({ error: 'No se recibieron imágenes válidas del documento.' }, 400);
    }

    const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLAVE_OPENAI}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELO,
        temperature: 0,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Respondés únicamente con JSON válido. Sos preciso con números y códigos de artículo.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: INSTRUCCIONES },
              ...validas.map((url: string) => ({
                type: 'image_url',
                image_url: { url, detail: 'high' },
              })),
            ],
          },
        ],
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      const mensaje = respuesta.status === 401
        ? 'La clave de OpenAI no es válida o venció.'
        : respuesta.status === 429
          ? 'OpenAI rechazó la solicitud por límite de uso. Probá de nuevo en un minuto.'
          : `OpenAI respondió con error ${respuesta.status}.`;
      return responder({ error: mensaje, detalle: detalle.slice(0, 500) }, 502);
    }

    const datos = await respuesta.json();
    const texto: string = datos?.choices?.[0]?.message?.content ?? '';
    const leido = extraerJson(texto);
    const crudas: FilaIA[] = Array.isArray(leido?.filas) ? leido.filas : [];

    const filas = crudas
      .map((fila) => ({
        referencia: String(fila?.referencia ?? '').trim(),
        cantidad: aNumero(fila?.cantidad),
        unidad: String(fila?.unidad ?? '').trim().toUpperCase(),
        precio: aNumero(fila?.precio_unitario),
        total: aNumero(fila?.total),
        descripcion: String(fila?.descripcion ?? '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((fila) => fila.referencia && /\d/.test(fila.referencia));

    if (!filas.length) {
      return responder({ error: 'La IA no pudo reconocer líneas de artículos en el documento.', filas: [] }, 422);
    }

    return responder({ filas, modelo: MODELO, imagenes: validas.length });
  } catch (error) {
    return responder({ error: `No se pudo leer el documento: ${String(error)}` }, 500);
  }
});
