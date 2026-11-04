import * as XLSX from 'xlsx';

// ============================================================
// MOTOR DEL COMPARADOR DE DOCUMENTOS
// Compara una factura de proveedor contra el PO de Siglo.
// Acepta Excel y PDF, y permite indicar manualmente qué columna
// es la referencia, los bultos/cantidad y el precio unitario.
// ============================================================

export type Lado = 'a' | 'b';

export interface LineaPdf {
  pagina: number;
  tokens: string[];
}

export interface FilaDocumento {
  celdas: (string | number)[];
  ubicacion: string;
}

export interface MapeoColumnas {
  ref: number;
  qty: number;
  um: number;
  price: number;
  desc: number;
}

export interface SeleccionPdf {
  ref: number;
  qty: number;
  price: number;
  um: number;
}

export interface HojaExcel {
  nombre: string;
  filas: (string | number)[][];
}

export interface DocumentoLeido {
  nombre: string;
  tipo: 'excel' | 'pdf';
  etiquetas: string[];
  filas: FilaDocumento[];
  mapeo: MapeoColumnas;
  tieneEncabezado: boolean;
  hojas?: HojaExcel[];
  hojaActiva?: number;
  lineas?: LineaPdf[];
  paginas?: number;
  manual?: boolean;
  seleccion?: SeleccionPdf;
}

const ALIAS: Record<string, string> = {
  pza: 'pza', pz: 'pza', pieza: 'pza', piezas: 'pza', und: 'pza', un: 'pza', ud: 'pza',
  unid: 'pza', unidad: 'pza', u: 'pza', ea: 'pza', pcs: 'pza', pc: 'pza',
  kg: 'kg', kgs: 'kg', kilo: 'kg', g: 'g', gr: 'g',
  lt: 'l', lts: 'l', l: 'l', litro: 'l',
  m: 'm', mt: 'm', mts: 'm', metro: 'm', m2: 'm2', m3: 'm3', cm: 'cm', mm: 'mm',
  caja: 'caja', cj: 'caja', par: 'par', jgo: 'jgo', juego: 'jgo', rollo: 'rollo',
  rl: 'rollo', paq: 'paq', paquete: 'paq', bolsa: 'bolsa', bls: 'bolsa',
  gal: 'gal', galon: 'gal', saco: 'saco', sc: 'saco', doc: 'doc', docena: 'doc',
};

const UNIDADES = new Set(Object.values(ALIAS));
const REF_COMPUESTA = /^(?:[A-Za-z0-9]*\d[A-Za-z0-9]*[-/.][A-Za-z0-9\-/.]*|[A-Za-z]+\d+[A-Za-z0-9]*)$/;
const REF_GENERICA = /^[A-Za-z0-9]*\d[A-Za-z0-9]*[-/.]/;

const ETIQUETAS_PDF_AUTO = ['Cantidad', 'U/M', 'Referencia', 'Descripción', 'Precio', 'Monto'];
const ETIQUETAS_PDF_MANUAL = ['Referencia', 'Bultos / Cantidad', 'Precio unitario', 'Unidad', 'Descripción'];

export function canonUnidad(valor: unknown): string {
  const clave = String(valor ?? '')
    .toLowerCase()
    .trim()
    .replace(/[.\s]/g, '')
    .replace(/²/g, '2')
    .replace(/³/g, '3');
  return ALIAS[clave] || clave;
}

export function esNumero(valor: unknown): boolean {
  if (typeof valor === 'number') return true;
  return /^\s*[$€]?\s*-?\d[\d.,]*\s*$/.test(String(valor));
}

export function aNumero(valor: unknown): number {
  if (typeof valor === 'number') return valor;
  let texto = String(valor ?? '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(texto)) return NaN;
  const coma = texto.lastIndexOf(',');
  const punto = texto.lastIndexOf('.');
  if (coma > -1 && punto > -1) {
    texto = coma > punto
      ? texto.replace(/\./g, '').replace(',', '.')
      : texto.replace(/,/g, '');
  } else if (coma > -1) {
    texto = /,\d{1,2}$/.test(texto) ? texto.replace(',', '.') : texto.replace(/,/g, '');
  }
  return parseFloat(texto);
}

export function normalizarRef(valor: unknown): string {
  return String(valor ?? '').toUpperCase().replace(/[\s\-_./]/g, '');
}

export function formatearNumero(valor: number): string {
  if (isNaN(valor)) return '';
  return valor.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function formatearMonto(valor: number): string {
  if (isNaN(valor)) return '';
  return valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

const vacio = (valor: unknown): boolean => valor === undefined || String(valor).trim() === '';

// ------------------------------------------------------------
// EXCEL
// ------------------------------------------------------------
function buscarColumna(head: string[] | null, patron: RegExp, excluir: RegExp | null, total: number): number {
  if (!head) return -1;
  for (let c = 0; c < total; c += 1) {
    const titulo = String(head[c] ?? '');
    if (patron.test(titulo) && !(excluir && excluir.test(titulo))) return c;
  }
  return -1;
}

export function analizarExcel(bruto: (string | number)[][]): {
  etiquetas: string[];
  filas: FilaDocumento[];
  mapeo: MapeoColumnas;
  tieneEncabezado: boolean;
} {
  const originales = bruto.map((r, i) => ({ r, fila: i + 1 })).filter((x) => x.r.some((c) => !vacio(c)));
  let indiceEncabezado = -1;
  for (let i = 0; i < Math.min(originales.length, 10); i += 1) {
    const coincidencias = originales[i].r.filter(
      (c) => !esNumero(c) && /ref|c[oó]d|prec|cost|cant|unid|desc|art[ií]c|item/i.test(String(c)),
    ).length;
    if (coincidencias >= 2) {
      indiceEncabezado = i;
      break;
    }
  }

  const encabezado = indiceEncabezado > -1 ? originales[indiceEncabezado].r.map(String) : null;
  let datos = indiceEncabezado > -1 ? originales.slice(indiceEncabezado + 1) : originales;
  const totalColumnas = Math.max(1, ...originales.map((x) => x.r.length));

  const mapeo: MapeoColumnas = { ref: -1, qty: -1, um: -1, price: -1, desc: -1 };
  mapeo.ref = buscarColumna(encabezado, /^ref/i, null, totalColumnas);
  if (mapeo.ref < 0) mapeo.ref = buscarColumna(encabezado, /ref|sku|art[ií]c|item|c[oó]d/i, /prov|olo/i, totalColumnas);

  const proporcionNumerica = (c: number) =>
    datos.length ? datos.filter((x) => esNumero(x.r[c])).length / datos.length : 0;

  if (mapeo.ref < 0) {
    let mejor = 0.4;
    for (let c = 0; c < totalColumnas; c += 1) {
      const valores = datos.map((x) => x.r[c]).filter((x) => !vacio(x));
      if (!valores.length) continue;
      const parecido = valores.filter((x) => !esNumero(x) && REF_COMPUESTA.test(String(x).trim())).length / valores.length;
      const puntaje = parecido * (new Set(valores.map(String)).size / valores.length);
      if (puntaje > mejor) {
        mejor = puntaje;
        mapeo.ref = c;
      }
    }
  }

  if (mapeo.ref > -1) datos = datos.filter((x) => !vacio(x.r[mapeo.ref]));

  mapeo.qty = buscarColumna(encabezado, /cant|unidades|qty|quantity|bulto/i, null, totalColumnas);
  mapeo.price = buscarColumna(encabezado, /costo|unitar|p\.?\s?u\b/i, null, totalColumnas);
  if (mapeo.price < 0) mapeo.price = buscarColumna(encabezado, /prec|price|pvp|valor/i, null, totalColumnas);

  if (mapeo.qty < 0 || mapeo.price < 0) {
    const numericas: number[] = [];
    for (let c = 0; c < totalColumnas; c += 1) {
      if (c !== mapeo.ref && proporcionNumerica(c) >= 0.7) numericas.push(c);
    }
    let encontrado = false;
    for (const q of numericas) {
      for (const p of numericas) {
        for (const t of numericas) {
          if (encontrado || q === p || q === t || p === t) continue;
          const validas = datos.filter(
            (x) => esNumero(x.r[q]) && esNumero(x.r[p]) && esNumero(x.r[t])
              && Math.abs(aNumero(x.r[q]) * aNumero(x.r[p]) - aNumero(x.r[t])) < 0.02,
          ).length;
          if (validas > 0 && validas >= 0.7 * datos.length) {
            encontrado = true;
            if (mapeo.qty < 0) mapeo.qty = q;
            if (mapeo.price < 0) mapeo.price = p;
          }
        }
      }
    }
    if (mapeo.qty < 0) {
      const candidata = numericas.find(
        (c) => c !== mapeo.price && datos.every((x) => !esNumero(x.r[c]) || Number.isInteger(aNumero(x.r[c]))),
      );
      mapeo.qty = candidata ?? -1;
    }
    if (mapeo.price < 0) {
      const candidata = numericas.find(
        (c) => c !== mapeo.qty && datos.some((x) => esNumero(x.r[c]) && !Number.isInteger(aNumero(x.r[c]))),
      );
      mapeo.price = candidata ?? -1;
    }
  }

  mapeo.um = buscarColumna(encabezado, /^unid(ad)?$|u\.?m\b|uom|medida/i, null, totalColumnas);
  if (mapeo.um > -1 && proporcionNumerica(mapeo.um) >= 0.3) mapeo.um = -1;
  if (mapeo.um < 0) {
    for (let c = 0; c < totalColumnas; c += 1) {
      if (c === mapeo.ref || !datos.length) continue;
      const unidades = datos.filter(
        (x) => !vacio(x.r[c]) && !esNumero(x.r[c])
          && String(x.r[c]).trim().length <= 6 && UNIDADES.has(canonUnidad(x.r[c])),
      ).length;
      if (unidades >= 0.5 * datos.length) {
        mapeo.um = c;
        break;
      }
    }
  }

  mapeo.desc = buscarColumna(encabezado, /desc/i, null, totalColumnas);
  if (mapeo.desc < 0) {
    let mejorLargo = 0;
    for (let c = 0; c < totalColumnas; c += 1) {
      if (c === mapeo.ref) continue;
      const valores = datos.map((x) => x.r[c]).filter((x) => !vacio(x) && !esNumero(x));
      if (valores.length < 0.5 * datos.length) continue;
      const promedio = valores.reduce((s, x) => s + String(x).length, 0) / valores.length;
      if (promedio > mejorLargo) {
        mejorLargo = promedio;
        mapeo.desc = c;
      }
    }
  }

  const etiquetas = Array.from({ length: totalColumnas }, (_, c) =>
    encabezado && !vacio(encabezado[c]) ? String(encabezado[c]) : `Columna ${c + 1}`,
  );

  const filas: FilaDocumento[] = datos.map((x) => ({ celdas: x.r, ubicacion: `fila ${x.fila}` }));
  return { etiquetas, filas, mapeo, tieneEncabezado: indiceEncabezado > -1 };
}

// ------------------------------------------------------------
// PDF
// ------------------------------------------------------------
export async function leerPdf(archivo: File): Promise<{ lineas: LineaPdf[]; paginas: number }> {
  const pdfjs: any = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as any).default;
  const datos = await archivo.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: datos }).promise;
  const lineas: LineaPdf[] = [];

  for (let p = 1; p <= pdf.numPages; p += 1) {
    try {
      const pagina = await pdf.getPage(p);
      const contenido = await pagina.getTextContent();
      const items = (contenido.items as any[]).filter((it) => it.str && String(it.str).trim());
      items.sort((a, b) => b.transform[5] - a.transform[5]);
      const grupos: { y: number; items: any[] }[] = [];
      items.forEach((it) => {
        const y = it.transform[5];
        const alto = Math.max(it.height || 0, 6);
        const grupo = grupos[grupos.length - 1];
        if (grupo && Math.abs(grupo.y - y) <= alto * 0.5) grupo.items.push(it);
        else grupos.push({ y, items: [it] });
      });
      grupos.forEach((g) => {
        g.items.sort((a, b) => a.transform[4] - b.transform[4]);
        const tokens = g.items.map((i) => String(i.str).trim()).join(' ').split(/\s+/).filter(Boolean);
        if (tokens.length) lineas.push({ pagina: p, tokens });
      });
    } catch {
      // Página ilegible: se omite y se continúa con el resto.
    }
  }

  return { lineas, paginas: pdf.numPages };
}

const esTokenUnidad = (t: string) => /^[A-Za-z]{2,6}$/.test(t) && UNIDADES.has(t.toLowerCase());

/** Fila automática (misma lógica del comparador original). */
export function filasPdfAuto(lineas: LineaPdf[]): FilaDocumento[] {
  const candidatas = lineas.map((linea) => {
    const t = linea.tokens;
    const numeros: number[] = [];
    t.forEach((token, ix) => {
      if (esNumero(token)) numeros.push(ix);
    });
    let triplete: { a: number; b: number; c: number } | null = null;
    for (const a of numeros) {
      const q = aNumero(t[a]);
      if (!Number.isInteger(q) || q < 1) continue;
      for (const b of numeros) {
        if (b === a) continue;
        const p = aNumero(t[b]);
        for (const c of numeros) {
          if (c === a || c === b) continue;
          if (Math.abs(q * p - aNumero(t[c])) < 0.02) {
            triplete = { a, b, c };
            break;
          }
        }
        if (triplete) break;
      }
      if (triplete) break;
    }
    return { linea, triplete };
  });

  const conTriplete = candidatas.filter((c) => c.triplete);
  const filas: FilaDocumento[] = [];

  if (conTriplete.length >= 3) {
    candidatas.forEach((c, i) => {
      if (!c.triplete) return;
      const t = c.linea.tokens;
      const { a, b, c: cc } = c.triplete;
      const refIndex = t.findIndex((token, ix) => ix !== a && ix !== b && ix !== cc && !esNumero(token) && REF_GENERICA.test(token));
      if (refIndex < 0) return;
      let unidad = t.find(esTokenUnidad) || '';
      if (!unidad) {
        for (const j of [i - 1, i + 1]) {
          const vecina = candidatas[j];
          if (vecina && !vecina.triplete && vecina.linea.pagina === c.linea.pagina) {
            const u = vecina.linea.tokens.find(esTokenUnidad);
            if (u) {
              unidad = u;
              break;
            }
          }
        }
      }
      const descripcion = t
        .filter((token, ix) => ![a, b, cc, refIndex].includes(ix) && token !== unidad && token !== 'CHI' && !/^([A-Z]{1,3}\.)+$/.test(token))
        .join(' ');
      filas.push({
        celdas: [aNumero(t[a]), unidad.toUpperCase(), t[refIndex], descripcion, aNumero(t[b]), aNumero(t[cc])],
        ubicacion: `pág. ${c.linea.pagina}`,
      });
    });
  } else {
    candidatas.forEach((c) => {
      const t = c.linea.tokens;
      const refIndex = t.findIndex((token) => !esNumero(token) && REF_GENERICA.test(token));
      if (refIndex < 0) return;
      const decimales = t
        .map((token, ix) => ({ token, ix }))
        .filter(({ token, ix }) => ix !== refIndex && esNumero(token) && /[.,]\d{1,4}$/.test(token));
      if (!decimales.length) return;
      const qtyIndex = t.findIndex((token, ix) => ix !== refIndex && esNumero(token) && Number.isInteger(aNumero(token)));
      filas.push({
        celdas: [
          qtyIndex > -1 ? aNumero(t[qtyIndex]) : NaN,
          (t.find(esTokenUnidad) || '').toUpperCase(),
          t[refIndex],
          t.filter((token, ix) => ix !== refIndex && !esNumero(token)).join(' '),
          aNumero(decimales[decimales.length - 1].token),
          NaN,
        ],
        ubicacion: `pág. ${c.linea.pagina}`,
      });
    });
  }
  return filas;
}

const lineaNoEsItem = (tokens: string[]): boolean => {
  const texto = tokens.join(' ').toLowerCase();
  if (/^(total|subtotal|gran total|iva|impuesto|descuento|flete|observ|nota)/.test(texto)) return true;
  if (!tokens.some((t) => /\d/.test(t))) return true;
  return /(referencia|descripci[oó]n|cantidad|precio unitario)/i.test(texto) && tokens.filter((t) => /\d/.test(t)).length <= 1;
};

/** Fila según las columnas (posiciones de token) que elige el usuario. */
export function filasPdfManual(lineas: LineaPdf[], sel: SeleccionPdf): FilaDocumento[] {
  const filas: FilaDocumento[] = [];
  const excluidas = [sel.ref, sel.qty, sel.price, sel.um];
  lineas.forEach((linea) => {
    const t = linea.tokens;
    if (t.length < 3 || lineaNoEsItem(t)) return;
    const ref = String(t[sel.ref] ?? '').trim();
    if (!ref || !/\d/.test(ref)) return;
    const qty = sel.qty >= 0 ? aNumero(t[sel.qty]) : NaN;
    const price = sel.price >= 0 ? aNumero(t[sel.price]) : NaN;
    const um = sel.um >= 0 ? String(t[sel.um] ?? '').trim() : '';
    const descripcion = t.filter((_, ix) => !excluidas.includes(ix)).join(' ').trim();
    filas.push({ celdas: [ref, qty, price, um, descripcion], ubicacion: `pág. ${linea.pagina}` });
  });
  return filas;
}

export function muestrasColumnas(lineas: LineaPdf[], maximo = 40): { indice: number; muestras: string[] }[] {
  const columnas = Math.min(12, Math.max(0, ...lineas.map((l) => l.tokens.length)));
  const utiles = lineas.filter((l) => !lineaNoEsItem(l.tokens) && l.tokens.length >= 3).slice(0, maximo);
  return Array.from({ length: columnas }, (_, indice) => ({
    indice,
    muestras: utiles.map((l) => String(l.tokens[indice] ?? '')).filter(Boolean).slice(0, 3),
  }));
}

/** Propone una selección inicial de columnas para un PDF leído. */
export function sugerirSeleccionPdf(lineas: LineaPdf[]): SeleccionPdf {
  const utiles = lineas.filter((l) => !lineaNoEsItem(l.tokens) && l.tokens.length >= 3).slice(0, 80);
  const total = Math.min(12, Math.max(0, ...lineas.map((l) => l.tokens.length)));
  const valoresDe = (c: number) => utiles.map((l) => String(l.tokens[c] ?? '')).filter(Boolean);

  let ref = 0;
  let mejor = -1;
  for (let c = 0; c < total; c += 1) {
    const valores = valoresDe(c);
    if (!valores.length) continue;
    const noNumericos = valores.filter((v) => !/^\d+([.,]\d+)?$/.test(v)).length / valores.length;
    const conDigito = valores.filter((v) => /\d/.test(v)).length / valores.length;
    const variados = new Set(valores).size / valores.length;
    const puntaje = noNumericos * conDigito * variados;
    if (puntaje > mejor) {
      mejor = puntaje;
      ref = c;
    }
  }

  const numericas: number[] = [];
  for (let c = 0; c < total; c += 1) {
    if (c === ref) continue;
    const valores = valoresDe(c);
    if (valores.length >= Math.max(2, utiles.length * 0.5) && valores.every((v) => esNumero(v))) numericas.push(c);
  }
  const qty = numericas.find((c) => utiles.every((l) => !esNumero(l.tokens[c]) || Number.isInteger(aNumero(l.tokens[c])))) ?? numericas[0] ?? -1;
  const price = numericas.find((c) => c > qty) ?? numericas.find((c) => c !== qty) ?? -1;

  return { ref, qty, price, um: -1 };
}

// ------------------------------------------------------------
// DOCUMENTOS
// ------------------------------------------------------------
export async function leerDocumento(archivo: File): Promise<DocumentoLeido> {
  const esPdf = /\.pdf$/i.test(archivo.name);
  if (esPdf) {
    const { lineas, paginas } = await leerPdf(archivo);
    if (lineas.length < 3) {
      throw new Error('No pude leer texto en este PDF (¿es un escaneo o una foto?). Necesito un PDF con texto seleccionable.');
    }
    const filas = filasPdfAuto(lineas);
    return {
      nombre: archivo.name,
      tipo: 'pdf',
      etiquetas: ETIQUETAS_PDF_AUTO,
      filas,
      mapeo: { qty: 0, um: 1, ref: 2, desc: 3, price: 4 },
      tieneEncabezado: true,
      lineas,
      paginas,
      manual: false,
    };
  }

  const buffer = await archivo.arrayBuffer();
  const libro = XLSX.read(buffer, { type: 'array' });
  const hojas: HojaExcel[] = libro.SheetNames.map((nombre) => ({
    nombre,
    filas: XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, defval: '', raw: true }) as (string | number)[][],
  }));
  if (!hojas.length) throw new Error('El archivo no tiene hojas legibles.');

  let indice = 0;
  let maximo = -1;
  hojas.forEach((hoja, i) => {
    const conteo = hoja.filas.filter((r) => r.some((c) => !vacio(c))).length;
    if (conteo > maximo) {
      maximo = conteo;
      indice = i;
    }
  });

  const activa = hojas[indice];
  const analisis = analizarExcel(activa.filas);
  return {
    nombre: archivo.name,
    tipo: 'excel',
    etiquetas: analisis.etiquetas,
    filas: analisis.filas,
    mapeo: analisis.mapeo,
    tieneEncabezado: analisis.tieneEncabezado,
    hojas,
    hojaActiva: indice,
  };
}

export function cambiarHoja(doc: DocumentoLeido, indice: number): DocumentoLeido {
  if (!doc.hojas || !doc.hojas[indice]) return doc;
  const analisis = analizarExcel(doc.hojas[indice].filas);
  return {
    ...doc,
    hojaActiva: indice,
    etiquetas: analisis.etiquetas,
    filas: analisis.filas,
    mapeo: analisis.mapeo,
    tieneEncabezado: analisis.tieneEncabezado,
  };
}

export function aplicarSeleccionPdf(doc: DocumentoLeido, sel: SeleccionPdf): DocumentoLeido {
  if (!doc.lineas) return doc;
  return {
    ...doc,
    manual: true,
    seleccion: sel,
    etiquetas: ETIQUETAS_PDF_MANUAL,
    filas: filasPdfManual(doc.lineas, sel),
    mapeo: { ref: 0, qty: 1, price: 2, um: 3, desc: 4 },
  };
}

export function volverAAutomaticoPdf(doc: DocumentoLeido): DocumentoLeido {
  if (!doc.lineas) return doc;
  return {
    ...doc,
    manual: false,
    seleccion: undefined,
    etiquetas: ETIQUETAS_PDF_AUTO,
    filas: filasPdfAuto(doc.lineas),
    mapeo: { qty: 0, um: 1, ref: 2, desc: 3, price: 4 },
  };
}

// ------------------------------------------------------------
// COMPARACIÓN
// ------------------------------------------------------------
export type Estado = 'soloA' | 'soloB' | 'qty' | 'uni' | 'pre';

export interface FilaComparada {
  ref: string;
  descripcion: string;
  qa: number;
  qb: number;
  ua: string;
  ub: string;
  pa: number;
  pb: number;
  ma: number;
  mb: number;
  fa: string;
  fb: string;
  estados: Estado[];
  na: number;
  nb: number;
}

export interface SeccionReporte {
  titulo: string;
  encabezados: string[];
  filas: string[][];
}

export interface ResultadoComparacion {
  filas: FilaComparada[];
  conteo: {
    all: number; dif: number; ok: number; soloA: number; soloB: number;
    qty: number; uni: number; pre: number; rep: number; ambos: number;
  };
  comparaCantidad: boolean;
  comparaUnidad: boolean;
  comparaPrecio: boolean;
  refsA: number;
  refsB: number;
  totalA: number;
  totalB: number;
  repetidasA: number;
  repetidasB: number;
  secciones: SeccionReporte[];
}

interface ItemLeido {
  ref: string;
  fila: string;
  q: number;
  u: string;
  p: number;
  d: string;
}

interface LadoLeido {
  mapa: Map<string, ItemLeido[]>;
  total: number;
  comparaQty: boolean;
  comparaUm: boolean;
  comparaPrecio: boolean;
}

function leerLado(doc: DocumentoLeido): LadoLeido {
  const mapa = new Map<string, ItemLeido[]>();
  const { ref, qty, um, price, desc } = doc.mapeo;
  let total = 0;

  doc.filas.forEach(({ celdas, ubicacion }) => {
    const referencia = String(celdas[ref] ?? '').trim();
    if (!referencia) return;
    const clave = normalizarRef(referencia);
    const item: ItemLeido = {
      ref: referencia,
      fila: ubicacion,
      q: qty > -1 && esNumero(celdas[qty]) ? aNumero(celdas[qty]) : NaN,
      u: um > -1 ? String(celdas[um] ?? '').trim() : '',
      p: price > -1 && esNumero(celdas[price]) ? aNumero(celdas[price]) : NaN,
      d: desc > -1 ? String(celdas[desc] ?? '').replace(/\s+/g, ' ').trim() : '',
    };
    if (!isNaN(item.q) && !isNaN(item.p)) total += item.q * item.p;
    const lista = mapa.get(clave);
    if (lista) lista.push(item);
    else mapa.set(clave, [item]);
  });

  return { mapa, total, comparaQty: qty > -1, comparaUm: um > -1, comparaPrecio: price > -1 };
}

export function comparar(docA: DocumentoLeido, docB: DocumentoLeido, tolerancia: number): ResultadoComparacion {
  const A = leerLado(docA);
  const B = leerLado(docB);
  const comparaCantidad = A.comparaQty && B.comparaQty;
  const comparaUnidad = A.comparaUm && B.comparaUm;
  const comparaPrecio = A.comparaPrecio && B.comparaPrecio;

  const difiere = (x: number, y: number) => {
    if (isNaN(x) && isNaN(y)) return false;
    if (isNaN(x) || isNaN(y)) return true;
    return Math.abs(x - y) > tolerancia + 1e-9;
  };
  const cantidadDistinta = (a: ItemLeido, b: ItemLeido) =>
    !(isNaN(a.q) && isNaN(b.q)) && (isNaN(a.q) || isNaN(b.q) || Math.abs(a.q - b.q) > 1e-9);
  const unidadDistinta = (a: ItemLeido, b: ItemLeido) => !!(a.u && b.u && canonUnidad(a.u) !== canonUnidad(b.u));
  const iguales = (a: ItemLeido, b: ItemLeido) =>
    !(comparaCantidad && cantidadDistinta(a, b))
    && !(comparaUnidad && unidadDistinta(a, b))
    && !(comparaPrecio && difiere(a.p, b.p));

  const claves = [...A.mapa.keys(), ...[...B.mapa.keys()].filter((k) => !A.mapa.has(k))];
  const filas: FilaComparada[] = [];
  const repetidas: { ref: string; la: ItemLeido[]; lb: ItemLeido[] }[] = [];

  claves.forEach((clave) => {
    const la = A.mapa.get(clave) || [];
    const lb = B.mapa.get(clave) || [];
    const sobrantesA = la.slice();
    const sobrantesB = lb.slice();
    const parejas: [ItemLeido | null, ItemLeido | null][] = [];

    for (let i = 0; i < sobrantesA.length; i += 1) {
      const j = sobrantesB.findIndex((b) => iguales(sobrantesA[i], b));
      if (j > -1) {
        parejas.push([sobrantesA[i], sobrantesB[j]]);
        sobrantesA.splice(i, 1);
        sobrantesB.splice(j, 1);
        i -= 1;
      }
    }
    while (sobrantesA.length && sobrantesB.length) {
      parejas.push([sobrantesA.shift() as ItemLeido, sobrantesB.shift() as ItemLeido]);
    }
    sobrantesA.forEach((a) => parejas.push([a, null]));
    sobrantesB.forEach((b) => parejas.push([null, b]));

    if (la.length > 1 || lb.length > 1) repetidas.push({ ref: (la[0] || lb[0]).ref, la, lb });

    parejas.forEach(([a, b]) => {
      const estados: Estado[] = [];
      if (!b) estados.push('soloA');
      else if (!a) estados.push('soloB');
      else {
        if (comparaCantidad && cantidadDistinta(a, b)) estados.push('qty');
        if (comparaUnidad && unidadDistinta(a, b)) estados.push('uni');
        if (comparaPrecio && difiere(a.p, b.p)) estados.push('pre');
      }
      filas.push({
        ref: (a || b)!.ref,
        descripcion: (a && a.d) || (b && b.d) || '',
        qa: a ? a.q : NaN,
        qb: b ? b.q : NaN,
        ua: a ? a.u : '',
        ub: b ? b.u : '',
        pa: a ? a.p : NaN,
        pb: b ? b.p : NaN,
        ma: a && !isNaN(a.q) && !isNaN(a.p) ? a.q * a.p : NaN,
        mb: b && !isNaN(b.q) && !isNaN(b.p) ? b.q * b.p : NaN,
        fa: a ? a.fila : '—',
        fb: b ? b.fila : '—',
        estados,
        na: la.length,
        nb: lb.length,
      });
    });
  });

  const prioridad = (f: FilaComparada) =>
    f.estados.includes('soloA') ? 0 : f.estados.includes('soloB') ? 1 : f.estados.length ? 2 : 3;
  filas.sort((x, y) => prioridad(x) - prioridad(y));

  const conteo = {
    all: filas.length, dif: 0, ok: 0, soloA: 0, soloB: 0, qty: 0, uni: 0, pre: 0, rep: 0, ambos: 0,
  };
  filas.forEach((f) => {
    if (f.estados.length) conteo.dif += 1;
    else conteo.ok += 1;
    f.estados.forEach((e) => { conteo[e] += 1; });
    if (f.na > 1 || f.nb > 1) conteo.rep += 1;
  });
  conteo.ambos = conteo.all - conteo.soloA - conteo.soloB;

  const resultado: ResultadoComparacion = {
    filas,
    conteo,
    comparaCantidad,
    comparaUnidad,
    comparaPrecio,
    refsA: A.mapa.size,
    refsB: B.mapa.size,
    totalA: A.total,
    totalB: B.total,
    repetidasA: repetidas.filter((g) => g.la.length > 1).length,
    repetidasB: repetidas.filter((g) => g.lb.length > 1).length,
    secciones: [],
  };
  resultado.secciones = construirReporte(resultado, repetidas);
  return resultado;
}

const nombreLado = (lado: Lado) => (lado === 'a' ? 'la factura de proveedor' : 'el PO de Siglo');
const cortoLado = (lado: Lado) => (lado === 'a' ? 'Factura proveedor' : 'PO Siglo');
const ordenarPorRef = (x: { ref: string }, y: { ref: string }) => (x.ref < y.ref ? -1 : x.ref > y.ref ? 1 : 0);

function construirReporte(
  r: ResultadoComparacion,
  repetidas: { ref: string; la: ItemLeido[]; lb: ItemLeido[] }[],
): SeccionReporte[] {
  const secciones: SeccionReporte[] = [];

  const soloEn = (lado: Lado) => {
    const lista = r.filas.filter((f) => f.estados.includes(lado === 'a' ? 'soloA' : 'soloB'));
    if (!lista.length) return;
    const otro: Lado = lado === 'a' ? 'b' : 'a';
    let total = 0;
    const filas = lista.slice().sort(ordenarPorRef).map((f) => {
      const q = lado === 'a' ? f.qa : f.qb;
      const p = lado === 'a' ? f.pa : f.pb;
      const monto = q * p;
      if (!isNaN(monto)) total += monto;
      return [f.ref, r.comparaCantidad ? formatearNumero(q) : '', r.comparaPrecio ? formatearMonto(p) : '', r.comparaCantidad && r.comparaPrecio ? formatearMonto(monto) : ''];
    });
    secciones.push({
      titulo: `${lista.length} ${lista.length === 1 ? 'referencia está' : 'referencias están'} en ${nombreLado(lado)} y no en ${nombreLado(otro)}`
        + (r.comparaCantidad && r.comparaPrecio ? ` (${formatearMonto(total)})` : ''),
      encabezados: ['Referencia', ...(r.comparaCantidad ? ['Cant.'] : []), ...(r.comparaPrecio ? ['Precio'] : []), ...(r.comparaCantidad && r.comparaPrecio ? ['Monto'] : [])],
      filas,
    });
  };
  soloEn('a');
  soloEn('b');

  const cantidad = r.filas.filter((f) => f.estados.includes('qty')).sort(ordenarPorRef);
  if (cantidad.length) {
    secciones.push({
      titulo: `${cantidad.length} con cantidad distinta`,
      encabezados: ['Referencia', `Cant. ${cortoLado('a')}`, `Cant. ${cortoLado('b')}`, 'Dif.'],
      filas: cantidad.map((f) => [f.ref, formatearNumero(f.qa), formatearNumero(f.qb), formatearNumero(f.qb - f.qa)]),
    });
  }

  const unidad = r.filas.filter((f) => f.estados.includes('uni')).sort(ordenarPorRef);
  if (unidad.length) {
    secciones.push({
      titulo: `${unidad.length} con unidad distinta`,
      encabezados: ['Referencia', `Unidad ${cortoLado('a')}`, `Unidad ${cortoLado('b')}`],
      filas: unidad.map((f) => [f.ref, f.ua, f.ub]),
    });
  }

  const precio = r.filas.filter((f) => f.estados.includes('pre')).sort(ordenarPorRef);
  if (precio.length) {
    secciones.push({
      titulo: `${precio.length} con precio distinto`,
      encabezados: ['Referencia', `Precio ${cortoLado('a')}`, `Precio ${cortoLado('b')}`, 'Dif.', 'Dif. %'],
      filas: precio.map((f) => {
        const d = f.pb - f.pa;
        return [f.ref, formatearMonto(f.pa), formatearMonto(f.pb), isNaN(d) ? '' : formatearMonto(d), !isNaN(d) && f.pa !== 0 ? `${((d / f.pa) * 100).toFixed(2)}%` : ''];
      }),
    });
  }

  const duplicadas = repetidas.slice().sort(ordenarPorRef);
  if (duplicadas.length) {
    const filas: string[][] = [];
    duplicadas.forEach((g) => {
      ([['a', g.la], ['b', g.lb]] as [Lado, ItemLeido[]][]).forEach(([lado, lista]) => {
        lista.forEach((e) => {
          filas.push([g.ref, cortoLado(lado), String(lista.length), formatearNumero(e.q), formatearMonto(e.p), isNaN(e.q * e.p) ? '' : formatearMonto(e.q * e.p), e.fila]);
        });
      });
    });
    secciones.push({
      titulo: `${duplicadas.length} ${duplicadas.length === 1 ? 'referencia repetida' : 'referencias repetidas'} (en ${nombreLado('a')}: ${r.repetidasA}, en ${nombreLado('b')}: ${r.repetidasB}; no se eliminaron, se comparan línea por línea)`,
      encabezados: ['Referencia', 'Documento', 'Veces en este documento', 'Cant.', 'Precio', 'Monto', 'Ubicación'],
      filas,
    });
  }

  return secciones;
}

export function seccionATexto(seccion: SeccionReporte): string {
  return [
    seccion.titulo,
    seccion.encabezados.join('\t'),
    ...seccion.filas.map((f) => f.join('\t')),
  ].join('\n');
}

export function tablaATexto(filas: FilaComparada[]): string {
  const nombreEstado: Record<Estado, string> = {
    soloA: 'Solo en factura',
    soloB: 'Solo en PO',
    qty: 'Bultos distintos',
    uni: 'Unidad distinta',
    pre: 'Precio distinto',
  };
  const encabezados = [
    'Referencia', 'Descripción', 'Estado',
    'Cant. Factura', 'Cant. PO',
    'Unidad Factura', 'Unidad PO',
    'Precio Factura', 'Precio PO',
    'Monto Factura', 'Monto PO', 'Dif. Monto',
  ];
  const cuerpo = filas.map((f) => [
    f.ref,
    f.descripcion,
    (f.estados.length ? f.estados.map((e) => nombreEstado[e]).join(', ') : 'OK') + (f.na > 1 || f.nb > 1 ? ' (repetida)' : ''),
    isNaN(f.qa) ? '' : f.qa,
    isNaN(f.qb) ? '' : f.qb,
    f.ua,
    f.ub,
    isNaN(f.pa) ? '' : f.pa,
    isNaN(f.pb) ? '' : f.pb,
    isNaN(f.ma) ? '' : Number(f.ma.toFixed(4)),
    isNaN(f.mb) ? '' : Number(f.mb.toFixed(4)),
    isNaN(f.ma) || isNaN(f.mb) ? '' : Number((f.mb - f.ma).toFixed(4)),
  ].join('\t'));
  return [encabezados.join('\t'), ...cuerpo].join('\n');
}

// ------------------------------------------------------------
// EXPORTACIÓN A EXCEL
// ------------------------------------------------------------
const LIMPIAR_HOJA = /[\\/?*[\]:]/g;

function nombreHojaValido(titulo: string, indice: number, usados: Set<string>): string {
  const base = titulo.replace(LIMPIAR_HOJA, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || `Hoja ${indice + 1}`;
  let nombre = base;
  let contador = 2;
  while (usados.has(nombre.toLowerCase())) {
    nombre = `${base.slice(0, 26)} ${contador}`;
    contador += 1;
  }
  usados.add(nombre.toLowerCase());
  return nombre;
}

function celdaExcel(valor: string, columna: number): string | number {
  if (columna === 0) return valor;
  const limpio = valor.replace(/,/g, '');
  if (limpio && /^-?\d+(\.\d+)?$/.test(limpio) && !/^0\d/.test(limpio)) return Number(limpio);
  return valor;
}

/** Genera y descarga un Excel con el resumen, cada hallazgo y la comparación completa. */
export function exportarResultadoExcel(resultado: ResultadoComparacion, nombreArchivo = 'comparacion'): void {
  const libro = XLSX.utils.book_new();

  const resumen: (string | number)[][] = [
    ['Comparador de Documentos'],
    [],
    ['Resumen', 'Valor'],
    ['Referencias en factura de proveedor', resultado.refsA],
    ['Referencias en PO de Siglo', resultado.refsB],
    ['Referencias en ambos documentos', resultado.conteo.ambos],
    ['Solo en factura de proveedor', resultado.conteo.soloA],
    ['Solo en PO de Siglo', resultado.conteo.soloB],
    ['Con diferencias', resultado.conteo.dif],
    ['Sin diferencias', resultado.conteo.ok],
    ['Bultos distintos', resultado.conteo.qty],
    ['Unidad distinta', resultado.conteo.uni],
    ['Precio distinto', resultado.conteo.pre],
    ['Referencias repetidas', resultado.conteo.rep],
    [],
    ['Total factura de proveedor', resultado.comparaCantidad && resultado.comparaPrecio ? resultado.totalA : ''],
    ['Total PO de Siglo', resultado.comparaCantidad && resultado.comparaPrecio ? resultado.totalB : ''],
    [],
    ['Se compara cantidad', resultado.comparaCantidad ? 'Sí' : 'No'],
    ['Se compara unidad', resultado.comparaUnidad ? 'Sí' : 'No'],
    ['Se compara precio', resultado.comparaPrecio ? 'Sí' : 'No'],
    ['Generado', new Date().toLocaleString('es-CR')],
  ];
  const hojaResumen = XLSX.utils.aoa_to_sheet(resumen);
  hojaResumen['!cols'] = [{ wch: 34 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');

  const usados = new Set<string>(['resumen']);

  resultado.secciones.forEach((seccion, indice) => {
    const contenido: (string | number)[][] = [
      [seccion.titulo],
      [],
      seccion.encabezados,
      ...seccion.filas.map((fila) => fila.map((valor, columna) => celdaExcel(valor, columna))),
    ];
    const hoja = XLSX.utils.aoa_to_sheet(contenido);
    hoja['!cols'] = seccion.encabezados.map((_, columna) => ({ wch: columna === 0 ? 18 : 16 }));
    XLSX.utils.book_append_sheet(libro, hoja, nombreHojaValido(seccion.titulo, indice, usados));
  });

  const nombreEstado: Record<Estado, string> = {
    soloA: 'Solo en factura',
    soloB: 'Solo en PO',
    qty: 'Bultos distintos',
    uni: 'Unidad distinta',
    pre: 'Precio distinto',
  };
  const completa: (string | number)[][] = [
    [
      'Referencia', 'Descripción', 'Estado',
      'Bultos factura', 'Bultos PO', 'Unidad factura', 'Unidad PO',
      'Precio factura', 'Precio PO', 'Monto factura', 'Monto PO', 'Dif. monto', 'Diferencia', 'Diferencia %',
      'Ubicación factura', 'Ubicación PO', 'Repetida',
    ],
    ...resultado.filas.map((fila) => {
      const tienePrecios = !isNaN(fila.pa) && !isNaN(fila.pb);
      const diferencia = tienePrecios ? fila.pb - fila.pa : '';
      const porcentaje = tienePrecios && fila.pa !== 0 ? Number((((fila.pb - fila.pa) / fila.pa) * 100).toFixed(2)) : '';
      const difMonto = !isNaN(fila.ma) && !isNaN(fila.mb) ? Number((fila.mb - fila.ma).toFixed(4)) : '';
      return [
        fila.ref,
        fila.descripcion,
        fila.estados.length ? fila.estados.map((estado) => nombreEstado[estado]).join(', ') : 'OK',
        isNaN(fila.qa) ? '' : fila.qa,
        isNaN(fila.qb) ? '' : fila.qb,
        fila.ua,
        fila.ub,
        isNaN(fila.pa) ? '' : fila.pa,
        isNaN(fila.pb) ? '' : fila.pb,
        isNaN(fila.ma) ? '' : Number(fila.ma.toFixed(4)),
        isNaN(fila.mb) ? '' : Number(fila.mb.toFixed(4)),
        difMonto,
        diferencia,
        porcentaje,
        fila.fa,
        fila.fb,
        fila.na > 1 || fila.nb > 1 ? `×${fila.na} / ×${fila.nb}` : '',
      ];
    }),
  ];
  const hojaCompleta = XLSX.utils.aoa_to_sheet(completa);
  hojaCompleta['!cols'] = [
    { wch: 18 }, { wch: 44 }, { wch: 24 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 14 }, { wch: 14 }, { wch: 13 },
    { wch: 18 }, { wch: 18 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(libro, hojaCompleta, nombreHojaValido('Comparación completa', 99, usados));

  const limpio = nombreArchivo.replace(/\.(xlsx|xls|csv|pdf)$/i, '').replace(/[^\w\-. ]/g, '').trim() || 'comparacion';
  XLSX.writeFile(libro, `${limpio.replace(/\.[^.]+$/, '')}-comparacion.xlsx`);
}

const normalizarEtiqueta = (valor: string) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Reaplica un mapeo de columnas guardado (perfil de proveedor) sobre un Excel
 * nuevo. Primero busca cada campo por el nombre de la columna guardada y, si
 * no la encuentra, usa la posición original cuando sigue siendo válida.
 */
export function aplicarMapeoPorEtiquetas(
  doc: DocumentoLeido,
  mapeo: MapeoColumnas,
  etiquetasGuardadas: string[],
): DocumentoLeido {
  if (doc.tipo !== 'excel') return doc;
  const actuales = doc.etiquetas.map(normalizarEtiqueta);
  const resolver = (campo: keyof MapeoColumnas): number => {
    const indiceGuardado = mapeo[campo];
    const etiqueta = etiquetasGuardadas[indiceGuardado];
    if (etiqueta !== undefined) {
      const buscada = normalizarEtiqueta(etiqueta);
      if (buscada) {
        const encontrada = actuales.findIndex((valor) => valor && valor === buscada);
        if (encontrada > -1) return encontrada;
      }
    }
    return indiceGuardado > -1 && indiceGuardado < doc.etiquetas.length ? indiceGuardado : -1;
  };

  return {
    ...doc,
    mapeo: {
      ref: resolver('ref'),
      qty: resolver('qty'),
      um: resolver('um'),
      price: resolver('price'),
      desc: resolver('desc'),
    },
  };
}