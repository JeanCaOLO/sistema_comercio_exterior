import { supabase } from '@/lib/supabase';
import type { DocumentoLeido, FilaDocumento } from '@/lib/comparadorDocumentos';

// ============================================================
// LECTURA DE FACTURAS CON IA (PDF escaneado o foto)
// Convierte las páginas del PDF en imágenes en el navegador y las
// envía a la función del backend, que devuelve las líneas ya armadas.
// ============================================================

const ETIQUETAS_IA = ['Referencia', 'Bultos / Cantidad', 'Precio unitario', 'Unidad', 'Descripción'];
const MAXIMO_PAGINAS = 3;

interface FilaIA {
  referencia: string;
  cantidad: number | null;
  unidad: string;
  precio: number | null;
  total: number | null;
  descripcion: string;
}

/** Convierte cada página del PDF en una imagen JPEG (data URL). */
async function paginasComoImagenes(archivo: File): Promise<string[]> {
  const pdfjs: any = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as any).default;

  const datos = await archivo.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: datos }).promise;
  const total = Math.min(pdf.numPages, MAXIMO_PAGINAS);
  const imagenes: string[] = [];

  for (let p = 1; p <= total; p += 1) {
    const pagina = await pdf.getPage(p);
    const viewport = pagina.getViewport({ scale: 2 });
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(viewport.width);
    lienzo.height = Math.round(viewport.height);
    const contexto = lienzo.getContext('2d');
    if (!contexto) continue;
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, lienzo.width, lienzo.height);
    await pagina.render({ canvasContext: contexto, viewport }).promise;
    imagenes.push(lienzo.toDataURL('image/jpeg', 0.85));
  }

  return imagenes;
}

/**
 * Lee una factura sin texto (escaneada o foto) usando el modelo de visión.
 * Devuelve el mismo formato que el resto del comparador.
 */
export async function leerFacturaConIa(archivo: File): Promise<DocumentoLeido> {
  const imagenes = await paginasComoImagenes(archivo);
  if (!imagenes.length) {
    throw new Error('No pude convertir el PDF en imágenes para leerlo con IA.');
  }

  const { data, error } = await supabase.functions.invoke('ocr-factura', {
    body: { imagenes },
  });

  if (error) {
    throw new Error('La lectura con IA no está disponible en este momento. Revisá que la clave de OpenAI esté cargada.');
  }

  const respuesta = data as { filas?: FilaIA[]; error?: string } | null;
  if (respuesta?.error) throw new Error(respuesta.error);

  const crudas = Array.isArray(respuesta?.filas) ? respuesta!.filas : [];
  const filas: FilaDocumento[] = crudas
    .filter((fila) => fila?.referencia && /\d/.test(fila.referencia))
    .map((fila, indice) => ({
      celdas: [
        fila.referencia,
        fila.cantidad ?? NaN,
        fila.precio ?? NaN,
        fila.unidad ?? '',
        fila.descripcion ?? '',
      ],
      ubicacion: `IA · línea ${indice + 1}`,
    }));

  if (!filas.length) {
    throw new Error('La IA no reconoció líneas de artículos en este documento.');
  }

  return {
    nombre: archivo.name,
    tipo: 'pdf',
    etiquetas: ETIQUETAS_IA,
    filas,
    mapeo: { ref: 0, qty: 1, price: 2, um: 3, desc: 4 },
    tieneEncabezado: true,
    paginas: imagenes.length,
    manual: false,
  };
}