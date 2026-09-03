// Autocorrector de ortografía en español.
// Carga un diccionario Hunspell (es) bajo demanda y expone una función para
// corregir la última palabra escrita al momento de presionar espacio.

let instancia: any = null;
let promesaDiccionario: Promise<any> | null = null;

// Términos propios del dominio logístico que no deben corregirse.
const PALABRAS_DOMINIO = [
  'dropship',
  'tiquetera',
  'tiqueteras',
  'po',
  'bl',
  'tc',
  'tlc',
  'caa',
  'zf',
  'mcg',
  'etd',
  'eta',
  'oc',
];

const URL_AFF = 'https://cdn.jsdelivr.net/npm/dictionary-es@2.0.0/index.aff';
const URL_DIC = 'https://cdn.jsdelivr.net/npm/dictionary-es@2.0.0/index.dic';

async function cargarDiccionario() {
  if (instancia) return instancia;

  if (!promesaDiccionario) {
    promesaDiccionario = (async () => {
      const [aff, dic] = await Promise.all([
        fetch(URL_AFF).then((r) => r.text()),
        fetch(URL_DIC).then((r) => r.text()),
      ]);

      // Import dinámico para no bloquear el bundle principal y evitar
      // problemas de tipado con el módulo CommonJS.
      const mod: any = await import('nspell');
      const nspell = mod.default || mod;

      const spell = nspell({ aff, dic });
      PALABRAS_DOMINIO.forEach((palabra) => spell.add(palabra));

      instancia = spell;
      return spell;
    })();
  }

  return promesaDiccionario;
}

const REGEX_SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/;

function esRevisable(palabra: string): boolean {
  if (palabra.length < 3) return false;
  if (!REGEX_SOLO_LETRAS.test(palabra)) return false;
  // Ignora acrónimos escritos en mayúsculas (BL, TC, TLC, CAA, ZF...).
  if (palabra === palabra.toUpperCase()) return false;
  return true;
}

function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const fila: number[] = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= m; i += 1) {
    let diagonalAnterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const temporal = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        diagonalAnterior + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonalAnterior = temporal;
    }
  }

  return fila[n];
}

export interface Correccion {
  texto: string;
  cursor: number;
}

// Dado el texto actual y la posición del cursor, revisa la palabra que acaba
// de completarse (justo antes de un espacio) y devuelve la corrección si la
// encuentra. Devuelve null si no hay nada que corregir.
export async function corregirTexto(
  texto: string,
  cursor: number
): Promise<Correccion | null> {
  const charAnterior = texto[cursor - 1];
  if (!charAnterior || !/\s/.test(charAnterior)) return null;

  const finToken = cursor - 1;
  let inicioToken = finToken - 1;
  while (inicioToken >= 0 && !/\s/.test(texto[inicioToken])) inicioToken -= 1;
  inicioToken += 1;

  const token = texto.slice(inicioToken, finToken);
  const coincidencia = token.match(
    /^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)([^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*)$/
  );
  if (!coincidencia) return null;

  const palabra = coincidencia[1];
  const sufijo = coincidencia[2];
  if (!esRevisable(palabra)) return null;

  const spell = await cargarDiccionario();
  if (spell.correct(palabra)) return null;

  const sugerencias: string[] = spell.suggest(palabra) || [];
  if (sugerencias.length === 0) return null;

  const palabraLower = palabra.toLowerCase();
  let mejor: string | null = null;
  let mejorDistancia = Infinity;

  for (const sugerencia of sugerencias) {
    const sugerenciaLower = sugerencia.toLowerCase();
    if (sugerenciaLower === palabraLower) continue;
    const distancia = distanciaLevenshtein(palabraLower, sugerenciaLower);
    if (distancia <= 2 && distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejor = sugerencia;
    }
  }

  if (!mejor) return null;

  const nuevoTexto =
    texto.slice(0, inicioToken) + mejor + sufijo + texto.slice(finToken);
  const nuevoCursor = inicioToken + mejor.length + sufijo.length + 1;

  return { texto: nuevoTexto, cursor: nuevoCursor };
}

// Precarga el diccionario en segundo plano para que la primera corrección sea
// inmediata. Los errores se ignoran silenciosamente.
export function precargarDiccionario() {
  cargarDiccionario().catch(() => {});
}