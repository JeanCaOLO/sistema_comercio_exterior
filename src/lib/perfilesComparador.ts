import { esNumero, type LineaPdf, type MapeoColumnas, type SeleccionPdf } from '@/lib/comparadorDocumentos';

// ============================================================
// PERFILES DE COLUMNAS POR PROVEEDOR
// Guarda cómo se leen las columnas de un proveedor (referencia,
// bultos, precio, unidad) para que su próxima factura se lea sola,
// tanto si llega en PDF como en Excel con formatos distintos.
// Se guarda en el navegador del usuario (localStorage).
// ============================================================

export type TipoPerfil = 'pdf' | 'excel';

export interface PerfilColumnas {
  id: string;
  proveedor: string;
  tipo: TipoPerfil;
  firma: string;
  /** Solo perfiles de PDF. */
  seleccion?: SeleccionPdf;
  /** Solo perfiles de Excel. */
  mapeo?: MapeoColumnas;
  /** Nombres de columna del Excel, para reconocer el formato en otro archivo. */
  etiquetas?: string[];
  /** Perfiles de PDF leídos con las columnas reales (por posición). */
  rejilla?: boolean;
  creado: string;
}

export type DatosPerfil =
  | { tipo: 'pdf'; seleccion: SeleccionPdf; rejilla?: boolean }
  | { tipo: 'excel'; mapeo: MapeoColumnas; etiquetas: string[] };

const CLAVE = 'comparador_documentos_perfiles_v1';

const sinAcentos = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const soloAlfanumerico = (texto: string) => sinAcentos(texto).replace(/[^a-z0-9]/g, '');

/**
 * Huella del formato del PDF: para cada columna dice si es
 * numérica (N), alfanumérica (D), mixta (m) o texto (T).
 * Mismo proveedor + mismo formato = misma huella.
 */
export function firmarLayoutPdf(lineas: LineaPdf[]): string {
  const utiles = lineas.filter((linea) => linea.tokens.length >= 3).slice(0, 60);
  if (!utiles.length) return '';
  const total = Math.min(12, Math.max(...utiles.map((linea) => linea.tokens.length)));
  const tipos: string[] = [];
  for (let c = 0; c < total; c += 1) {
    const valores = utiles.map((linea) => linea.tokens[c]).filter((valor) => valor !== undefined && valor !== '');
    if (!valores.length) {
      tipos.push('-');
    } else {
      const numericos = valores.filter((valor) => esNumero(valor)).length / valores.length;
      const conDigito = valores.filter((valor) => /\d/.test(valor)).length / valores.length;
      if (numericos >= 0.8) tipos.push('N');
      else if (conDigito >= 0.6) tipos.push('D');
      else if (numericos > 0.2) tipos.push('m');
      else tipos.push('T');
    }
  }
  return tipos.join('');
}

/** Huella del formato de un Excel: nombres de columna normalizados. */
export function firmarLayoutExcel(etiquetas: string[]): string {
  return etiquetas
    .map((etiqueta) => soloAlfanumerico(etiqueta))
    .filter(Boolean)
    .join('|');
}

export function leerPerfilesComparador(): PerfilColumnas[] {
  try {
    const bruto = window.localStorage.getItem(CLAVE);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((perfil: PerfilColumnas) => perfil && typeof perfil.id === 'string' && typeof perfil.proveedor === 'string')
      .map((perfil: PerfilColumnas) => ({
        ...perfil,
        tipo: perfil.tipo === 'excel' ? 'excel' : 'pdf',
      }))
      .filter((perfil: PerfilColumnas) =>
        perfil.tipo === 'excel'
          ? !!perfil.mapeo && typeof perfil.mapeo.ref === 'number'
          : !!perfil.seleccion && typeof perfil.seleccion.ref === 'number',
      );
  } catch {
    return [];
  }
}

function escribirPerfiles(perfiles: PerfilColumnas[]): PerfilColumnas[] {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(perfiles));
  } catch {
    // Sin espacio o modo privado: se mantiene en memoria.
  }
  return perfiles;
}

/**
 * Guarda (o reemplaza) el perfil del proveedor para el tipo de documento y
 * devuelve la lista actualizada. El mismo proveedor puede tener un perfil de
 * PDF y otro de Excel.
 */
export function guardarPerfilComparador(
  proveedor: string,
  firma: string,
  datos: DatosPerfil,
): PerfilColumnas[] {
  const nombre = proveedor.trim();
  if (!nombre) return leerPerfilesComparador();
  const perfiles = leerPerfilesComparador();
  const clave = sinAcentos(nombre);
  const existente = perfiles.find(
    (perfil) => sinAcentos(perfil.proveedor) === clave && perfil.tipo === datos.tipo,
  );
  const base: PerfilColumnas = {
    id: existente ? existente.id : `perfil-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    proveedor: nombre,
    tipo: datos.tipo,
    firma,
    creado: new Date().toISOString(),
  };
  const perfil: PerfilColumnas = datos.tipo === 'pdf'
    ? { ...base, seleccion: datos.seleccion, rejilla: datos.rejilla === true }
    : { ...base, mapeo: datos.mapeo, etiquetas: datos.etiquetas };

  const lista = existente
    ? perfiles.map((item) => (item.id === existente.id ? perfil : item))
    : [...perfiles, perfil];
  return escribirPerfiles(lista);
}

export function eliminarPerfilComparador(id: string): PerfilColumnas[] {
  return escribirPerfiles(leerPerfilesComparador().filter((perfil) => perfil.id !== id));
}

function porNombreArchivo(nombreArchivo: string, perfiles: PerfilColumnas[]): PerfilColumnas | null {
  const archivo = sinAcentos(nombreArchivo.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  let mejor: PerfilColumnas | null = null;
  perfiles.forEach((perfil) => {
    const clave = sinAcentos(perfil.proveedor);
    if (clave.length >= 3 && archivo.includes(clave)) {
      if (!mejor || clave.length > sinAcentos(mejor.proveedor).length) mejor = perfil;
    }
  });
  return mejor;
}

/** Busca un perfil que corresponda a este PDF: primero por formato, luego por nombre del archivo. */
export function buscarPerfilComparador(
  lineas: LineaPdf[],
  nombreArchivo: string,
  perfiles: PerfilColumnas[],
): PerfilColumnas | null {
  // Solo los perfiles nuevos: las columnas de PDF ahora se miden por posición,
  // así que una selección vieja (por orden de palabras) ya no significa lo mismo.
  const dePdf = perfiles.filter((perfil) => perfil.tipo === 'pdf' && perfil.seleccion && perfil.rejilla);
  if (!dePdf.length) return null;
  const firma = firmarLayoutPdf(lineas);
  if (firma) {
    const porFormato = dePdf.find((perfil) => perfil.firma === firma);
    if (porFormato) return porFormato;
    // Si el formato cambió, no se aplica a ciegas un mapeo viejo: es mejor que
    // el usuario confirme las columnas otra vez antes de comparar mal los datos.
    return dePdf.find((perfil) => !perfil.firma) ?? null;
  }
  return porNombreArchivo(nombreArchivo, dePdf);
}

/**
 * Busca un perfil de Excel: primero por los nombres de columna, luego por el
 * nombre del archivo. Devuelve el perfil y qué tan parecido es el formato.
 */
export function buscarPerfilExcel(
  etiquetas: string[],
  nombreArchivo: string,
  perfiles: PerfilColumnas[],
): { perfil: PerfilColumnas; exacto: boolean } | null {
  const deExcel = perfiles.filter((perfil) => perfil.tipo === 'excel' && perfil.mapeo);
  if (!deExcel.length) return null;

  const firma = firmarLayoutExcel(etiquetas);
  if (firma) {
    const exacto = deExcel.find((perfil) => perfil.firma === firma);
    if (exacto) return { perfil: exacto, exacto: true };
  }

  const actuales = etiquetas.map(soloAlfanumerico).filter(Boolean);
  let mejor: PerfilColumnas | null = null;
  let mejorPuntaje = 0;
  deExcel.forEach((perfil) => {
    const guardadas = (perfil.etiquetas || []).map(soloAlfanumerico).filter(Boolean);
    if (!guardadas.length || !actuales.length) return;
    const coincidencias = guardadas.filter((etiqueta) => actuales.includes(etiqueta)).length;
    const puntaje = coincidencias / Math.max(guardadas.length, actuales.length);
    if (puntaje >= 0.6 && puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = perfil;
    }
  });
  if (mejor) return { perfil: mejor, exacto: false };

  const porNombre = porNombreArchivo(nombreArchivo, deExcel);
  return porNombre ? { perfil: porNombre, exacto: false } : null;
}