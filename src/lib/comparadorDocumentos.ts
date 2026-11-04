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
  /** Coordenada X (izquierda) de cada token. Solo en PDF con texto. */
  xs?: number[];
  /** Ancho aproximado de cada token. Solo en PDF con texto. */
  anchos?: number[];
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
  /** PDF: líneas ya armadas en columnas reales (una celda por columna). */
  grilla?: LineaPdf[];
  /** PDF: columnas detectadas, para el selector de columnas. */
  columnas?: ColumnaPdf[];
  /** PDF: columnas que se detectaron automáticamente. */
  analisis?: AnalisisGrillaPdf;
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
        const tokens: string[] = [];
        const xs: number[] = [];
        const anchos: number[] = [];
        g.items.forEach((item) => {
          const texto = String(item.str ?? '').trim();
          if (!texto) return;
          const partes = texto.split(/\s+/).filter(Boolean);
          if (!partes.length) return;
          const x0 = Number(item.transform?.[4]) || 0;
          const anchoTotal = Number(item.width) || 0;
          const caracteres = partes.reduce((suma, parte) => suma + parte.length, 0) || 1;
          let recorrido = 0;
          partes.forEach((parte) => {
            const ancho = anchoTotal > 0
              ? (anchoTotal * parte.length) / caracteres
              : Math.max(3, parte.length * 4.6);
            tokens.push(parte);
            xs.push(x0 + (anchoTotal > 0 ? (anchoTotal * recorrido) / caracteres : 0));
            anchos.push(ancho);
            recorrido += parte.length;
          });
        });
        const unidos = recomponerCodigos(tokens, xs, anchos);
        if (unidos.tokens.length) {
          lineas.push({ pagina: p, tokens: unidos.tokens, xs: unidos.xs, anchos: unidos.anchos });
        }
      });
    } catch {
      // Página ilegible: se omite y se continúa con el resto.
    }
  }

  return { lineas, paginas: pdf.numPages };
}

const esTokenUnidad = (t: string) => /^[A-Za-z]{2,6}$/.test(t) && UNIDADES.has(t.toLowerCase());

const UNIDAD_MEDIDA = /^(cm|mm|m2|m3|mt|mts|kgs?|gr?|lt?|lts)$/i;

/** Prefiere la unidad pegada a la cantidad y descarta medidas (cm, kg…) del producto. */
function unidadDeLinea(tokens: string[], indiceCantidad: number): string {
  const vecinos = [tokens[indiceCantidad + 1], tokens[indiceCantidad - 1]];
  for (const vecino of vecinos) {
    if (vecino && esTokenUnidad(vecino) && !UNIDAD_MEDIDA.test(vecino)) return vecino;
  }
  const resto = tokens.filter((token) => esTokenUnidad(token) && !UNIDAD_MEDIDA.test(token));
  if (resto.length) return resto[0];
  return tokens.find(esTokenUnidad) ?? '';
}

const SEPARADOR_CODIGO = /^[-/._]$/;
const FRAGMENTO_CODIGO = /^[A-Za-z0-9]+$/;
const CODIGO_UNIDO = /^[A-Za-z0-9][A-Za-z0-9\-/._]*$/;

/**
 * Muchos PDF escriben la referencia en trozos sueltos: "03" "-" "04" "-" "023".
 * Aquí se vuelven a unir para que la referencia sea un solo token legible.
 */
function recomponerCodigos(
  tokens: string[],
  xs?: number[],
  anchos?: number[],
): { tokens: string[]; xs?: number[]; anchos?: number[] } {
  const salida: string[] = [];
  const salidaX: number[] = [];
  const salidaAnchos: number[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const anterior = salida[salida.length - 1];
    const siguiente = tokens[i + 1];
    if (
      SEPARADOR_CODIGO.test(token)
      && anterior
      && CODIGO_UNIDO.test(anterior)
      && siguiente
      && FRAGMENTO_CODIGO.test(siguiente)
      && (/\d/.test(anterior) || /\d/.test(siguiente))
    ) {
      salida[salida.length - 1] = `${anterior}${token}${siguiente}`;
      const ultimo = salidaAnchos.length - 1;
      if (ultimo >= 0) {
        salidaAnchos[ultimo] = (salidaAnchos[ultimo] ?? 0) + (anchos?.[i] ?? 0) + (anchos?.[i + 1] ?? 0);
      }
      i += 1;
      continue;
    }
    salida.push(token);
    salidaX.push(xs?.[i] ?? 0);
    salidaAnchos.push(anchos?.[i] ?? 0);
  }
  return {
    tokens: salida,
    xs: xs ? salidaX : undefined,
    anchos: anchos ? salidaAnchos : undefined,
  };
}

/** ¿Este token parece una referencia de producto (03-04-023, SKU-1234…)? */
const esReferenciaToken = (token: string): boolean => {
  const texto = String(token ?? '').trim();
  if (!texto || esNumero(texto)) return false;
  if (!REF_GENERICA.test(texto) || !/\d/.test(texto)) return false;
  return !/^(pcs|pc|ctns?|cartons?|pza|pzas|units?|kgs?|cm|mm|m2|m3|lbs?)$/i.test(texto);
};

/**
 * Busca dentro de una línea la combinación cantidad × precio = total,
 * priorizando el total que aparece al final y la cantidad seguida de su unidad.
 */
function mejorTriplete(tokens: string[]): { a: number; b: number; c: number; puntaje: number } | null {
  const numeros: number[] = [];
  tokens.forEach((token, indice) => {
    if (esNumero(token)) numeros.push(indice);
  });
  if (numeros.length < 3) return null;
  const ultimo = numeros[numeros.length - 1];
  const candidatos: { a: number; b: number; c: number; puntaje: number }[] = [];

  numeros.forEach((a) => {
    const cantidad = aNumero(tokens[a]);
    if (!Number.isInteger(cantidad) || cantidad < 1) return;
    numeros.forEach((b) => {
      if (b === a) return;
      const precio = aNumero(tokens[b]);
      if (!(precio > 0)) return;
      numeros.forEach((c) => {
        if (c === a || c === b) return;
        if (Math.abs(cantidad * precio - aNumero(tokens[c])) > 0.02) return;
        let puntaje = 0;
        if (c === ultimo) puntaje += 4;
        const despues = tokens[a + 1];
        if (despues && esTokenUnidad(despues)) puntaje += 3;
        if (a < b && b < c) puntaje += 1;
        if (/[.,]\d/.test(tokens[b])) puntaje += 1;
        candidatos.push({ a, b, c, puntaje });
      });
    });
  });

  if (!candidatos.length) return null;
  candidatos.sort((x, y) => y.puntaje - x.puntaje);
  return candidatos[0];
}

/**
 * Plan B: hay facturas que ponen la referencia en una línea y los números
 * (bultos, precio, total) en otra. Aquí se empareja cada línea numérica con la
 * referencia más cercana de la misma página.
 */
function filasPdfPorBloques(lineas: LineaPdf[]): FilaDocumento[] {
  const refs = lineas
    .map((linea, indice) => {
      const tope = Math.min(linea.tokens.length, 6);
      let refIndex = -1;
      for (let i = 0; i < tope; i += 1) {
        if (esReferenciaToken(linea.tokens[i])) {
          refIndex = i;
          break;
        }
      }
      return { linea, indice, refIndex };
    })
    .filter((item) => item.refIndex > -1);

  if (!refs.length) return [];

  const filas: FilaDocumento[] = [];
  const usadas = new Set<number>();

  lineas.forEach((linea, indice) => {
    const triplete = mejorTriplete(linea.tokens);
    if (!triplete) return;
    let indiceElegido = -1;
    let distancia = Infinity;
    for (const ref of refs) {
      if (usadas.has(ref.indice)) continue;
      if (ref.linea.pagina !== linea.pagina) continue;
      if (ref.indice === indice) continue;
      const delta = Math.abs(ref.indice - indice);
      if (delta > 6 || delta >= distancia) continue;
      distancia = delta;
      indiceElegido = ref.indice;
    }
    if (indiceElegido < 0) return;
    const ref = refs.find((item) => item.indice === indiceElegido);
    if (!ref) return;
    usadas.add(ref.indice);

    const tokens = linea.tokens;
    let unidad = unidadDeLinea(tokens, triplete.a);
    if (!unidad) unidad = ref.linea.tokens.find(esTokenUnidad) || '';
    const descripcion = ref.linea.tokens
      .filter((_, ix) => ix !== ref.refIndex)
      .join(' ')
      .trim();

    filas.push({
      celdas: [
        aNumero(tokens[triplete.a]),
        unidad.toUpperCase(),
        ref.linea.tokens[ref.refIndex],
        descripcion,
        aNumero(tokens[triplete.b]),
        aNumero(tokens[triplete.c]),
      ],
      ubicacion: `pág. ${linea.pagina}`,
    });
  });

  return filas;
}

/** Fila automática (misma lógica del comparador original). */
export function filasPdfAuto(lineas: LineaPdf[]): FilaDocumento[] {
  const candidatas = lineas.map((linea) => ({ linea, triplete: mejorTriplete(linea.tokens) }));

  const conTriplete = candidatas.filter((c) => c.triplete);
  const filas: FilaDocumento[] = [];
  const usadasDescripcion = new Set<number>();
  const esTextoNoItem = (tokens: string[]) =>
    !tokens.some((token) => esReferenciaToken(token))
    && !/^(total|subtotal|invoice|item|descrip|cantidad|precio|sku|messer|date|from|to|vessel)/i.test(tokens.join(' '));

  if (conTriplete.length >= 3) {
    candidatas.forEach((c, i) => {
      if (!c.triplete) return;
      const t = c.linea.tokens;
      const { a, b, c: cc } = c.triplete;
      const refIndex = t.findIndex((token, ix) => ix !== a && ix !== b && ix !== cc && esReferenciaToken(token));
      if (refIndex < 0) return;
      let unidad = unidadDeLinea(t, a);
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
        .join(' ')
        .trim();

      // Si la descripción viene en otra línea del PDF, se toma de las líneas vecinas.
      let descripcionFinal = descripcion;
      if (!/[A-Za-z]{3}/.test(descripcionFinal)) {
        for (const j of [i - 1, i + 1]) {
          const vecina = candidatas[j];
          if (!vecina || vecina.triplete || usadasDescripcion.has(j)) continue;
          if (vecina.linea.pagina !== c.linea.pagina) continue;
          if (!esTextoNoItem(vecina.linea.tokens)) continue;
          const texto = vecina.linea.tokens
            .filter((token) => !esTokenUnidad(token) && !esNumero(token))
            .join(' ')
            .trim();
          if (!/[A-Za-z]{3}/.test(texto)) continue;
          usadasDescripcion.add(j);
          descripcionFinal = `${descripcionFinal} ${texto}`.trim();
        }
      }
      filas.push({
        celdas: [aNumero(t[a]), unidad.toUpperCase(), t[refIndex], descripcionFinal, aNumero(t[b]), aNumero(t[cc])],
        ubicacion: `pág. ${c.linea.pagina}`,
      });
    });
  } else {
    candidatas.forEach((c) => {
      const t = c.linea.tokens;
      const refIndex = t.findIndex((token) => esReferenciaToken(token));
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

  if (!filas.length) {
    const porBloques = filasPdfPorBloques(lineas);
    if (porBloques.length) return porBloques;
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
// PDF: COLUMNAS REALES POR POSICIÓN
// ------------------------------------------------------------
// Un PDF no trae columnas: trae palabras sueltas, cada una con una
// coordenada. Contar palabras por línea falla en cuanto la descripción
// ocupa varias palabras o una celda viene vacía, porque todo se corre
// un lugar. Aquí se agrupan las palabras por su posición horizontal para
// reconstruir las columnas verdaderas de la tabla, de modo que la
// referencia, la cantidad y el precio se lean igual en cualquier factura.

export interface BandaPdf {
  x: number;
  fin: number;
}

export interface ColumnaPdf {
  indice: number;
  etiqueta: string;
  muestras: string[];
  x: number;
  ancho: number;
}

export interface GrillaPdf {
  bandas: BandaPdf[];
  lineas: LineaPdf[];
  etiquetas: (string | undefined)[];
}

export interface AnalisisGrillaPdf {
  seleccion: SeleccionPdf;
  total: number;
  descripcion: number;
}

interface PalabraPdf {
  texto: string;
  x: number;
  fin: number;
}

const ETIQUETA_COLUMNA: Record<string, string> = {
  ref: 'Referencia',
  desc: 'Descripción',
  qty: 'Cantidad',
  um: 'Unidad',
  price: 'Precio unitario',
  total: 'Total',
};

function palabrasConPosicion(linea: LineaPdf): PalabraPdf[] {
  if (!linea.xs || linea.xs.length !== linea.tokens.length) return [];
  const salida: PalabraPdf[] = [];
  linea.tokens.forEach((token, indice) => {
    if (!token) return;
    const x = linea.xs?.[indice] ?? 0;
    const ancho = linea.anchos?.[indice] || Math.max(3, token.length * 4.6);
    salida.push({ texto: token, x, fin: x + ancho });
  });
  return salida;
}

/** Traduce el título de una columna del PDF a un campo del comparador. */
function claveEncabezado(token: string, siguiente?: string): string | null {
  const texto = normalizarEtiqueta(token);
  if (!texto || texto.length > 16) return null;
  const sig = siguiente ? normalizarEtiqueta(siguiente) : '';
  if (/^(unit|unidad|um|uom|measure|medida)$/.test(texto) && /^(price|precio|costo|cost|valor)/.test(sig)) return 'price';
  if (/^(qty|quantity|cant|cantidad|bultos?|piezas?|pcs|units|cantidadbultos)$/.test(texto)) return 'qty';
  if (/^(unit|unidad|uom|um|medida|measure)$/.test(texto)) return 'um';
  if (/^(description|descripcion|descrip|detalle|producto|product|descripcionproducto)$/.test(texto)) return 'desc';
  if (/^(unitprice|preciounitario|precio|price|preciou|pu|punit|valorunitario|costo|cost|pvp)$/.test(texto)) return 'price';
  if (/^(total|amount|monto|importe|subtotal|valortotal|totalusd)$/.test(texto)) return 'total';
  if (/^(item|itemno|items|sku|skunumber|codigo|cod|code|ref|referencia|articulo|art|modelo|model|part|partnumber|partno|noitem|itemnumber)$/.test(texto)) return 'ref';
  return null;
}

function bandaDeCentro(bandas: BandaPdf[], centro: number, tolerancia: number): number {
  for (let b = 0; b < bandas.length; b += 1) {
    if (centro >= bandas[b].x - 1 && centro <= bandas[b].fin + 1) return b;
  }
  let elegido = -1;
  let distancia = Infinity;
  bandas.forEach((banda, b) => {
    const d = centro < banda.x ? banda.x - centro : centro - banda.fin;
    if (d < distancia) {
      distancia = d;
      elegido = b;
    }
  });
  return distancia <= tolerancia ? elegido : -1;
}

/** Busca en el encabezado del PDF los títulos de cada columna. */
function etiquetasDeEncabezado(lineas: LineaPdf[], bandas: BandaPdf[], anchoPagina: number): (string | undefined)[] {
  const etiquetas: (string | undefined)[] = bandas.map(() => undefined);
  const asignadas = new Set<string>();
  const tolerancia = Math.max(8, anchoPagina * 0.06);
  const limite = Math.min(lineas.length, 120);

  for (let i = 0; i < limite; i += 1) {
    const palabras = palabrasConPosicion(lineas[i]);
    if (palabras.length < 2) continue;
    if (palabras.filter((palabra) => esNumero(palabra.texto)).length > 1) continue;

    const encontradas: { clave: string; palabra: PalabraPdf }[] = [];
    palabras.forEach((palabra, ix) => {
      const clave = claveEncabezado(palabra.texto, palabras[ix + 1]?.texto);
      if (clave) encontradas.push({ clave, palabra });
    });
    if (encontradas.length < 2) continue;

    encontradas.forEach(({ clave, palabra }) => {
      if (asignadas.has(clave)) return;
      // El título manda cuando su inicio cae dentro de la columna. Si cae en un
      // espacio libre (títulos partidos en varias palabras) se ignora, así no
      // se pisa el nombre de otra columna.
      const indice = bandas.findIndex(
        (banda) => palabra.x >= banda.x - tolerancia && palabra.x <= banda.fin + 2,
      );
      if (indice < 0 || etiquetas[indice]) return;
      etiquetas[indice] = ETIQUETA_COLUMNA[clave];
      asignadas.add(clave);
    });
  }
  return etiquetas;
}

/** Une filas que el PDF partió en dos líneas (texto arriba, números abajo). */
function unirFilasPartidas(filas: LineaPdf[]): LineaPdf[] {
  const salida: LineaPdf[] = [];
  filas.forEach((linea) => {
    const anterior = salida[salida.length - 1];
    const conReferencia = linea.tokens.some((token) => esReferenciaToken(token));
    const conNumero = linea.tokens.some((token) => esNumero(token));
    if (anterior && anterior.pagina === linea.pagina && conNumero && !conReferencia) {
      const anteriorReferencia = anterior.tokens.some((token) => esReferenciaToken(token));
      const anteriorNumero = anterior.tokens.some((token) => esNumero(token));
      if (anteriorReferencia && !anteriorNumero) {
        salida[salida.length - 1] = {
          pagina: anterior.pagina,
          tokens: anterior.tokens.map((celda, columna) => {
            const extra = linea.tokens[columna] ?? '';
            if (!extra) return celda;
            if (!celda) return extra;
            return `${celda} ${extra}`;
          }),
        };
        return;
      }
    }
    salida.push(linea);
  });
  return salida;
}

/**
 * Reconstruye la tabla del PDF: cada línea queda con una celda por columna,
 * sin importar cuántas palabras tenga cada celda ni si alguna viene vacía.
 */
export function construirGrillaPdf(lineas: LineaPdf[]): GrillaPdf {
  const vacia: GrillaPdf = { bandas: [], lineas: [], etiquetas: [] };
  const conPosicion = lineas
    .map((linea) => ({ linea, palabras: palabrasConPosicion(linea) }))
    .filter((item) => item.palabras.length >= 2);
  if (!conPosicion.length) return vacia;

  const anchoPagina = Math.max(1, ...conPosicion.flatMap((item) => item.palabras.map((p) => p.fin)));
  const cuantosNumeros = (palabras: PalabraPdf[]) =>
    palabras.filter((palabra) => esNumero(palabra.texto)).length;

  let aprendizaje = conPosicion.filter(
    (item) => item.palabras.length >= 3 && cuantosNumeros(item.palabras) >= 2,
  );
  if (aprendizaje.length < 2) aprendizaje = conPosicion.filter((item) => cuantosNumeros(item.palabras) >= 2);
  if (!aprendizaje.length) aprendizaje = conPosicion;

  const puntos: BandaPdf[] = [];
  aprendizaje.forEach((item) => item.palabras.forEach((palabra) => puntos.push({ x: palabra.x, fin: palabra.fin })));
  if (puntos.length < 3) return vacia;
  puntos.sort((a, b) => a.x - b.x || a.fin - b.fin);

  const holgura = Math.max(2, anchoPagina * 0.004);
  const bandas: BandaPdf[] = [];
  puntos.forEach((punto) => {
    const ultima = bandas[bandas.length - 1];
    if (ultima && punto.x <= ultima.fin + holgura) {
      ultima.fin = Math.max(ultima.fin, punto.fin);
      return;
    }
    bandas.push({ x: punto.x, fin: punto.fin });
  });
  if (bandas.length < 2) return vacia;

  const filas: LineaPdf[] = [];
  conPosicion.forEach(({ linea, palabras }) => {
    const celdas: string[][] = bandas.map(() => []);
    palabras.forEach((palabra) => {
      const indice = bandaDeCentro(bandas, (palabra.x + palabra.fin) / 2, anchoPagina);
      if (indice >= 0) celdas[indice].push(palabra.texto);
    });
    const tokens = celdas.map((partes) => partes.join(' ').trim());
    if (tokens.filter((token) => token !== '').length < 2) return;
    filas.push({ pagina: linea.pagina, tokens });
  });
  if (!filas.length) return vacia;

  return {
    bandas,
    lineas: unirFilasPartidas(filas),
    etiquetas: etiquetasDeEncabezado(lineas, bandas, anchoPagina),
  };
}

interface ResumenColumnaPdf {
  indice: number;
  total: number;
  ratioNumerico: number;
  ratioEntero: number;
  ratioDecimal: number;
  ratioReferencia: number;
  ratioUnidad: number;
  ratioConDigito: number;
  variados: number;
  largo: number;
}

/** Decide cuál columna es la referencia, la cantidad, la unidad y el precio. */
function analizarGrillaPdf(grilla: GrillaPdf): AnalisisGrillaPdf {
  const columnas = Math.max(0, ...grilla.lineas.map((linea) => linea.tokens.length));
  const base = grilla.lineas.filter((linea) => !lineaNoEsItem(linea.tokens));
  const filas = base.length ? base : grilla.lineas;

  const resumen: ResumenColumnaPdf[] = Array.from({ length: columnas }, (_, indice) => {
    const valores = filas
      .map((linea) => String(linea.tokens[indice] ?? '').trim())
      .filter(Boolean);
    const cuenta = (condicion: (valor: string) => boolean) => valores.filter(condicion).length;
    const total = valores.length || 1;
    return {
      indice,
      total: valores.length,
      ratioNumerico: cuenta((valor) => esNumero(valor)) / total,
      ratioEntero: cuenta((valor) => esNumero(valor) && Number.isInteger(aNumero(valor))) / total,
      ratioDecimal: cuenta((valor) => esNumero(valor) && /[.,]\d{1,4}$/.test(valor)) / total,
      ratioReferencia: cuenta((valor) => esReferenciaToken(valor)) / total,
      ratioUnidad:
        cuenta((valor) => !esNumero(valor) && valor.length <= 6 && UNIDADES.has(canonUnidad(valor))) / total,
      ratioConDigito: cuenta((valor) => /\d/.test(valor)) / total,
      variados: new Set(valores).size / total,
      largo: valores.length
        ? valores.reduce((suma, valor) => suma + valor.length, 0) / valores.length
        : 0,
    };
  });

  const porEtiqueta = (nombre: string) =>
    resumen.find((columna) => grilla.etiquetas[columna.indice] === nombre)?.indice ?? -1;

  const numericas = resumen.filter((columna) => columna.total >= 2 && columna.ratioNumerico >= 0.55);
  let qty = -1;
  let price = -1;
  let totalCol = -1;
  let mejor = 0;

  // La mejor señal es matemática: cantidad × precio = total.
  numericas.forEach((colCantidad) => {
    numericas.forEach((colPrecio) => {
      if (colPrecio.indice === colCantidad.indice) return;
      numericas.forEach((colTotal) => {
        if (colTotal.indice === colCantidad.indice || colTotal.indice === colPrecio.indice) return;
        let validos = 0;
        let aciertos = 0;
        filas.forEach((linea) => {
          const textoCantidad = String(linea.tokens[colCantidad.indice] ?? '');
          const textoPrecio = String(linea.tokens[colPrecio.indice] ?? '');
          const textoTotal = String(linea.tokens[colTotal.indice] ?? '');
          if (!esNumero(textoCantidad) || !esNumero(textoPrecio) || !esNumero(textoTotal)) return;
          const cantidad = aNumero(textoCantidad);
          const precio = aNumero(textoPrecio);
          const monto = aNumero(textoTotal);
          if (!(cantidad > 0) || !(precio > 0)) return;
          validos += 1;
          if (Math.abs(cantidad * precio - monto) <= Math.max(0.02, Math.abs(monto) * 0.002)) aciertos += 1;
        });
        if (aciertos < 2 || !validos) return;
        const ratio = aciertos / validos;
        if (ratio < 0.5) return;
        const puntaje = ratio
          + (colCantidad.ratioEntero >= 0.7 ? 0.12 : 0)
          + (colTotal.indice > colPrecio.indice ? 0.08 : 0);
        if (puntaje > mejor) {
          mejor = puntaje;
          qty = colCantidad.indice;
          price = colPrecio.indice;
          totalCol = colTotal.indice;
        }
      });
    });
  });

  // Sin relación matemática clara: se usa el título y la forma del dato.
  if (qty < 0) {
    const porNombre = porEtiqueta('Cantidad');
    qty = porNombre > -1
      ? porNombre
      : (resumen.find(
        (columna) => columna.total >= 2
          && columna.ratioNumerico >= 0.5
          && columna.ratioEntero >= 0.6
          && columna.indice !== price
          && columna.indice !== totalCol,
      )?.indice ?? -1);
  }
  if (price < 0) {
    const porNombre = porEtiqueta('Precio unitario');
    if (porNombre > -1) price = porNombre;
  }
  if (price < 0) {
    const candidatas = resumen
      .filter(
        (columna) => columna.total >= 2
          && columna.ratioNumerico >= 0.5
          && columna.indice !== qty
          && columna.indice !== totalCol
          && (qty < 0 || columna.indice > qty),
      )
      .sort((a, b) => b.ratioDecimal - a.ratioDecimal || a.indice - b.indice);
    price = candidatas[0]?.indice ?? -1;
  }
  if (price < 0) {
    const candidatas = resumen
      .filter(
        (columna) => columna.total >= 2
          && columna.ratioNumerico >= 0.5
          && columna.indice !== qty
          && columna.indice !== totalCol,
      )
      .sort((a, b) => b.ratioDecimal - a.ratioDecimal || a.indice - b.indice);
    price = candidatas[0]?.indice ?? -1;
  }

  const candidatasRef = resumen
    .filter(
      (columna) => columna.total >= 2
        && columna.ratioNumerico < 0.5
        && columna.indice !== qty
        && columna.indice !== price
        && columna.indice !== totalCol,
    )
    .map((columna) => ({
      indice: columna.indice,
      puntaje: columna.ratioReferencia * 1.8
        + columna.ratioConDigito
        + columna.variados * 0.6
        - columna.ratioUnidad * 1.2
        - columna.ratioDecimal
        + (qty > -1 && columna.indice < qty ? 0.3 : 0),
    }))
    .sort((a, b) => b.puntaje - a.puntaje);

  let ref = candidatasRef.length ? candidatasRef[0].indice : -1;
  if (ref < 0) {
    ref = resumen.find(
      (columna) => columna.ratioConDigito >= 0.3 && columna.indice !== qty && columna.indice !== price,
    )?.indice ?? 0;
  }

  let um = -1;
  const porUnidad = resumen.find(
    (columna) => columna.indice !== ref
      && columna.indice !== qty
      && columna.indice !== price
      && columna.indice !== totalCol
      && columna.ratioUnidad >= 0.4,
  );
  if (porUnidad) {
    um = porUnidad.indice;
  } else {
    const porNombre = porEtiqueta('Unidad');
    if (porNombre > -1 && porNombre !== qty) um = porNombre;
  }

  const usadas = new Set([ref, qty, price, totalCol, um]);
  const candidatasDesc = resumen
    .filter((columna) => !usadas.has(columna.indice) && columna.total >= 1 && columna.ratioNumerico < 0.4)
    .sort((a, b) => b.largo - a.largo);

  return {
    seleccion: { ref, qty, price, um },
    total: totalCol,
    descripcion: candidatasDesc[0]?.indice ?? -1,
  };
}

/** Muestra, para el selector de columnas, qué datos trae cada columna. */
function describirColumnasPdf(grilla: GrillaPdf): ColumnaPdf[] {
  const columnas = Math.max(0, ...grilla.lineas.map((linea) => linea.tokens.length));
  const filas = grilla.lineas
    .filter((linea) => linea.tokens.some((token) => /\d/.test(token)))
    .slice(0, 200);

  return Array.from({ length: columnas }, (_, indice) => {
    const muestras: string[] = [];
    filas.forEach((linea) => {
      const valor = String(linea.tokens[indice] ?? '').trim();
      if (!valor || muestras.includes(valor) || muestras.length >= 4) return;
      muestras.push(valor);
    });
    const banda = grilla.bandas[indice];
    return {
      indice,
      etiqueta: grilla.etiquetas[indice] ?? '',
      muestras,
      x: banda?.x ?? 0,
      ancho: banda ? banda.fin - banda.x : 0,
    };
  });
}

/** Arma las filas de la comparación ya separadas en columnas reales. */
function filasDesdeGrillaPdf(grilla: LineaPdf[], analisis: AnalisisGrillaPdf): FilaDocumento[] {
  const { ref, qty, price, um } = analisis.seleccion;
  const filas: FilaDocumento[] = [];

  grilla.forEach((linea) => {
    const tokens = linea.tokens;
    if (lineaNoEsItem(tokens)) return;
    const celdaRef = String(tokens[ref] ?? '').trim();
    if (!celdaRef || !/\d/.test(celdaRef)) return;

    const celdaCantidad = qty >= 0 ? String(tokens[qty] ?? '').trim() : '';
    const celdaPrecio = price >= 0 ? String(tokens[price] ?? '').trim() : '';
    const cantidad = qty >= 0 ? aNumero(celdaCantidad) : NaN;
    const precio = price >= 0 ? aNumero(celdaPrecio) : NaN;
    if (isNaN(cantidad) && isNaN(precio)) return;

    let unidad = um >= 0 ? String(tokens[um] ?? '').trim() : '';
    if (!unidad) unidad = celdaCantidad.split(/\s+/).find((parte) => esTokenUnidad(parte)) ?? '';

    const descripcion = analisis.descripcion >= 0 ? String(tokens[analisis.descripcion] ?? '').trim() : '';
    const monto = !isNaN(cantidad) && !isNaN(precio) ? cantidad * precio : NaN;

    filas.push({
      celdas: [cantidad, unidad.toUpperCase(), celdaRef, descripcion, precio, monto],
      ubicacion: `pág. ${linea.pagina}`,
    });
  });

  return filas;
}

/** Líneas que representan el formato del PDF (para guardar el perfil del proveedor). */
export function lineasParaFirma(doc: DocumentoLeido): LineaPdf[] {
  if (doc.grilla && doc.grilla.length) return doc.grilla;
  return doc.lineas ?? [];
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
    const grilla = construirGrillaPdf(lineas);
    const analisis = grilla.lineas.length ? analizarGrillaPdf(grilla) : null;
    const columnas = grilla.lineas.length ? describirColumnasPdf(grilla) : [];
    const porColumnas = analisis ? filasDesdeGrillaPdf(grilla.lineas, analisis) : [];
    const filas = porColumnas.length ? porColumnas : filasPdfAuto(lineas);

    return {
      nombre: archivo.name,
      tipo: 'pdf',
      etiquetas: ETIQUETAS_PDF_AUTO,
      filas,
      mapeo: { qty: 0, um: 1, ref: 2, desc: 3, price: 4 },
      tieneEncabezado: true,
      lineas,
      grilla: grilla.lineas.length ? grilla.lineas : undefined,
      columnas: columnas.length ? columnas : undefined,
      analisis: analisis ?? undefined,
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
  const base = doc.grilla && doc.grilla.length ? doc.grilla : doc.lineas;
  if (!base || !base.length) return doc;
  return {
    ...doc,
    manual: true,
    seleccion: sel,
    etiquetas: ETIQUETAS_PDF_MANUAL,
    filas: filasPdfManual(base, sel),
    mapeo: { ref: 0, qty: 1, price: 2, um: 3, desc: 4 },
  };
}

export function volverAAutomaticoPdf(doc: DocumentoLeido): DocumentoLeido {
  if (!doc.lineas || !doc.lineas.length) return doc;
  const porColumnas = doc.grilla && doc.analisis ? filasDesdeGrillaPdf(doc.grilla, doc.analisis) : [];
  return {
    ...doc,
    manual: false,
    seleccion: undefined,
    etiquetas: ETIQUETAS_PDF_AUTO,
    filas: porColumnas.length ? porColumnas : filasPdfAuto(doc.lineas),
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