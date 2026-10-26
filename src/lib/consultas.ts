import { supabase } from './supabase';

/**
 * PostgREST devuelve "Bad Request" (400) cuando la URL de la petición supera el
 * largo máximo permitido. Eso pasa con `.in('columna', ids)` cuando la lista
 * trae cientos de IDs (cada UUID ocupa ~37 caracteres en la query string).
 *
 * Por eso todas las consultas por lista de IDs deben hacerse en lotes pequeños.
 * Este helper divide la lista, ejecuta la consulta por lotes y devuelve todas
 * las filas juntas, así el resto del código no cambia.
 */
const TAMANO_LOTE_IDS = 60;

export async function consultarPorIds<T = any>(
  tabla: string,
  columnas: string,
  columna: string,
  ids: string[],
  configurar?: (consulta: any) => any
): Promise<T[]> {
  const unicos = Array.from(new Set((ids || []).filter(Boolean)));
  if (unicos.length === 0) return [];

  const filas: T[] = [];

  for (let i = 0; i < unicos.length; i += TAMANO_LOTE_IDS) {
    const lote = unicos.slice(i, i + TAMANO_LOTE_IDS);

    let consulta = (supabase as any).from(tabla).select(columnas).in(columna, lote);
    if (configurar) consulta = configurar(consulta);

    let data: any = null;
    let error: any = null;

    try {
      const respuesta = await consulta;
      data = respuesta.data;
      error = respuesta.error;
    } catch (err: any) {
      error = err;
    }

    if (error) {
      console.warn(
        `⚠️ No se pudo consultar ${tabla} (lote ${Math.floor(i / TAMANO_LOTE_IDS) + 1}):`,
        error.message || error
      );
      continue;
    }

    if (data) filas.push(...(data as T[]));
  }

  return filas;
}