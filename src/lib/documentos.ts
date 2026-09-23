// Utilidades compartidas para el campo `doc` de documentos_caa y expedientes.
//
// Formato RETROCOMPATIBLE: el campo `doc` es una lista JSON que puede contener
// tanto strings (formato viejo, "sin tipo") como objetos { url, tipo }.
// Los registros existentes NUNCA se reescriben solo por leerlos.

export interface DocEntry {
  url: string;
  tipo: string | null;
}

export const TIPO_FACTURA = 'factura';

const esUrlValida = (valor: unknown): valor is string =>
  typeof valor === 'string' && valor.trim() !== '';

/**
 * Normaliza cualquier valor almacenado en `doc` a una lista de entradas.
 * Acepta:
 *  - string JSON (array o URL simple)
 *  - array de strings (formato viejo)
 *  - array de objetos { url, tipo }
 *  - null / undefined
 */
export function parseDocEntries(doc: unknown): DocEntry[] {
  if (!doc) return [];

  let raw: unknown = doc;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      raw = JSON.parse(trimmed);
    } catch {
      // No era JSON: asumimos que es una URL suelta (formato viejo)
      return [{ url: trimmed, tipo: null }];
    }
  }

  const lista = Array.isArray(raw) ? raw : [raw];
  const entradas: DocEntry[] = [];

  for (const item of lista) {
    if (!item) continue;
    if (esUrlValida(item)) {
      entradas.push({ url: item, tipo: null });
    } else if (typeof item === 'object' && esUrlValida((item as any).url)) {
      const tipo = (item as any).tipo;
      entradas.push({
        url: (item as any).url,
        tipo: typeof tipo === 'string' && tipo.trim() ? tipo : null,
      });
    }
  }

  return entradas;
}

/** ¿Esta entrada está marcada como factura? */
export function esFactura(entry: DocEntry): boolean {
  return entry.tipo === TIPO_FACTURA;
}

/**
 * Combina varias listas de entradas en una sola, deduplicando por URL.
 * Si una misma URL aparece con y sin tipo factura, se conserva la marca factura.
 */
export function combinarEntradas(entradas: DocEntry[]): DocEntry[] {
  const mapa = new Map<string, DocEntry>();
  for (const entry of entradas) {
    const existente = mapa.get(entry.url);
    if (!existente) {
      mapa.set(entry.url, { ...entry });
    } else if (!existente.tipo && entry.tipo) {
      mapa.set(entry.url, { ...entry });
    }
  }
  return Array.from(mapa.values());
}

/** Extrae el nombre legible del archivo a partir de su URL de Storage. */
export function nombreDeArchivo(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/');
    const rawName = segments[segments.length - 1] || 'documento';
    const underscoreIdx = rawName.indexOf('_');
    if (underscoreIdx > 0 && /^\d{13}_/.test(rawName)) {
      return decodeURIComponent(rawName.substring(underscoreIdx + 1));
    }
    return decodeURIComponent(rawName);
  } catch {
    return 'documento';
  }
}