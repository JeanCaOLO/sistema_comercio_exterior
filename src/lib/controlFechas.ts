import * as XLSX from 'xlsx';

// ============================================================
// CONTROL DE FECHAS NEXT
// Lee la exportación de POs Activas y reproduce el reporte de
// control de fechas: POs con contenedor y naviera sin fechas
// ETD/ETA, ETD Variable vencido, ETA Variable vencida, control
// de fechas por etapa y POs con ATA anterior a ATD.
// ============================================================

export const CAMPOS_FECHA = [
  'ETD Inicial', 'ETD Variable', 'ATD', 'ETA Inicial', 'ETA Variable', 'ATA',
] as const;

export type CampoFecha = (typeof CAMPOS_FECHA)[number];

export const CAMPOS_REGLA: CampoFecha[] = ['ETD Variable', 'ATD', 'ETA Inicial', 'ETA Variable', 'ATA'];

export interface PoControl {
  po: string;
  etapa: string;
  proveedor: string;
  naviera: string;
  contenedor: string;
  booking: string;
  fechas: Record<CampoFecha, string | null>;
}

export interface ResultadoLectura {
  filas: PoControl[];
  advertencias: string[];
  etapas: { etapa: string; total: number }[];
}

export interface OpcionesControl {
  fechaCorte: string;
  excluirReales: boolean;
  etapasExcluidas: string[];
  proveedoresExcluidos: string[];
}

export interface ItemFaltantes {
  po: PoControl;
  faltantes: CampoFecha[];
}

export interface ItemVencido {
  po: PoControl;
  dias: number;
}

export interface ItemEtapa {
  po: PoControl;
  etapaLabel: string;
  requeridas: CampoFecha[];
  faltantes: CampoFecha[];
  sobrantes: CampoFecha[];
  resultado: string;
  ok: boolean;
}

export interface ResultadoControl {
  totalLeidas: number;
  analizadas: number;
  sinContenedor: number;
  contenedorInvalido: number;
  omitidasEtapa: number;
  omitidasProveedor: number;
  fechaCorte: string;
  limite: string;
  excluirReales: boolean;
  etapasExcluidas: string[];
  proveedoresExcluidos: string[];
  faltantes: ItemFaltantes[];
  etdVencido: ItemVencido[];
  etaVencido: ItemVencido[];
  controlEtapa: ItemEtapa[];
  ataMenorAtd: ItemVencido[];
  porEtapa: { etapa: string; total: number; diferencias: number }[];
  etapasSinRegla: { etapa: string; total: number }[];
}

// ------------------------- reglas por etapa -------------------------

interface ReglaEtapa {
  clave: string;
  label: string;
  requeridas: CampoFecha[];
}

export const REGLAS_ETAPA: ReglaEtapa[] = [
  { clave: 'produccion', label: 'Producción', requeridas: [] },
  { clave: 'booking', label: 'Booking', requeridas: ['ETD Variable', 'ETA Inicial', 'ETA Variable'] },
  { clave: 'en transito', label: 'En Tránsito', requeridas: ['ETD Variable', 'ATD', 'ETA Inicial', 'ETA Variable'] },
  { clave: 'puerto', label: 'Puerto', requeridas: CAMPOS_REGLA },
  { clave: 'alm fiscal', label: 'Alm Fiscal', requeridas: CAMPOS_REGLA },
  { clave: 'recibiendo cdi', label: 'Recibiendo CDI', requeridas: CAMPOS_REGLA },
];

/** Orden en el que se presentan las etapas en todo el reporte. */
export const ORDEN_ETAPAS = ['produccion', 'booking', 'en transito', 'puerto', 'alm fiscal', 'recibiendo cdi'];

export function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function claveColumna(valor: unknown): string {
  return normalizar(valor).replace(/[^a-z0-9]+/g, ' ').trim();
}

export function rangoEtapa(etapa: string): number {
  const indice = ORDEN_ETAPAS.indexOf(normalizar(etapa));
  return indice < 0 ? ORDEN_ETAPAS.length : indice;
}

// ------------------------- fechas -------------------------

const DIA = 86400000;

function fechaAIsocalendario(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }
  if (typeof valor === 'number' && valor > 0) {
    const partes = XLSX.SSF.parse_date_code(valor);
    if (partes && partes.y) {
      return `${partes.y}-${String(partes.m).padStart(2, '0')}-${String(partes.d).padStart(2, '0')}`;
    }
    return null;
  }
  const texto = String(valor ?? '').trim();
  if (!texto || texto === '-- N/A --') return null;
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }
  const dmy = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (dmy) {
    const anio = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${anio}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parseada = new Date(texto);
  if (!Number.isNaN(parseada.getTime())) return parseada.toISOString().slice(0, 10);
  return null;
}

/** Días desde 1970-01-01 en UTC (para comparar fechas del reporte). */
function aDia(iso: string | null): number | null {
  if (!iso) return null;
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!partes) return null;
  return Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])) / DIA;
}

export function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatearEntero(valor: number): string {
  return new Intl.NumberFormat('es-CR').format(valor);
}

export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!partes) return iso;
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

function aFechaObjeto(iso: string | null): Date | null {
  if (!iso) return null;
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!partes) return null;
  return new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
}

/** '' = sin contenedor · 'ok' = válido · 'malo' = inválido */
export function estadoContenedor(valor: unknown): '' | 'ok' | 'malo' {
  const texto = String(valor ?? '').trim();
  if (!texto) return '';
  const contenedor = texto.toUpperCase();
  return /^[A-Z]{4}\d{7}$/.test(contenedor) && !contenedor.startsWith('AAAA') ? 'ok' : 'malo';
}

// ------------------------- lectura del Excel -------------------------

const COLUMNAS: Record<string, string[]> = {
  po: ['n orden de compra po', 'orden de compra po', 'numero de orden de compra', 'po'],
  etapa: ['etapa'],
  proveedor: ['proveedor'],
  naviera: ['linea naviera'],
  contenedor: ['numero de contenedor', 'contenedor'],
  booking: ['numero de booking', 'booking'],
  'etd inicial': ['etd inicial'],
  'etd variable': ['etd variable'],
  atd: ['atd'],
  'eta inicial': ['eta inicial'],
  'eta variable': ['eta variable'],
  ata: ['ata'],
};

const ETIQUETAS_COLUMNA: Record<string, string> = {
  po: 'N° Orden de Compra (PO)',
  etapa: 'Etapa',
  proveedor: 'Proveedor',
  naviera: 'Línea Naviera',
  contenedor: 'Número de Contenedor',
  booking: 'Número de Booking',
  'etd inicial': 'ETD Inicial',
  'etd variable': 'ETD Variable',
  atd: 'ATD',
  'eta inicial': 'ETA Inicial',
  'eta variable': 'ETA Variable',
  ata: 'ATA',
};

function buscarIndice(claves: string[], candidatos: string[]): number {
  for (const candidato of candidatos) {
    const exacto = claves.indexOf(candidato);
    if (exacto >= 0) return exacto;
  }
  for (const candidato of candidatos) {
    const parcial = claves.findIndex((k) => k.startsWith(candidato) || k.includes(candidato));
    if (parcial >= 0) return parcial;
  }
  return -1;
}

function buscarFilaEncabezado(filas: unknown[][]): number {
  const limite = Math.min(filas.length, 15);
  for (let i = 0; i < limite; i += 1) {
    const claves = (filas[i] || []).map(claveColumna);
    const tienePo = claves.some((c) => c.includes('orden de compra') || c === 'po');
    const tieneContenedor = claves.some((c) => c.includes('contenedor'));
    const tieneEtapa = claves.some((c) => c.includes('etapa'));
    if (tienePo && tieneContenedor && tieneEtapa) return i;
  }
  return -1;
}

/** Lee el Excel de POs Activas y devuelve las filas listas para analizar. */
export async function leerArchivoControl(archivo: File): Promise<ResultadoLectura> {
  const buffer = await archivo.arrayBuffer();
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true });

  let elegida: { nombre: string; encabezados: string[]; filas: unknown[][] } | null = null;

  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    if (!hoja) continue;
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: '' });
    const indice = buscarFilaEncabezado(filas);
    if (indice >= 0) {
      elegida = {
        nombre,
        encabezados: (filas[indice] || []).map((c) => String(c ?? '')),
        filas: filas.slice(indice + 1),
      };
      break;
    }
  }

  if (!elegida) {
    throw new Error(
      'No encontré la estructura esperada en el archivo. Debe tener las columnas Etapa, N° Orden de Compra (PO), Número de Contenedor y las fechas ETD/ETA.'
    );
  }

  const claves = elegida.encabezados.map(claveColumna);
  const indices: Record<string, number> = {};
  Object.entries(COLUMNAS).forEach(([campo, candidatos]) => {
    indices[campo] = buscarIndice(claves, candidatos);
  });

  const faltantes = Object.keys(COLUMNAS)
    .filter((campo) => indices[campo] < 0)
    .map((campo) => ETIQUETAS_COLUMNA[campo] || campo);

  if (faltantes.length > 0) {
    throw new Error(`No encontré estas columnas en la primera fila: ${faltantes.join(', ')}.`);
  }

  const texto = (fila: unknown[], campo: string): string => {
    const indice = indices[campo];
    if (indice === undefined || indice < 0) return '';
    return String(fila[indice] ?? '').trim();
  };

  const filas: PoControl[] = [];
  let contenedorInvalido = 0;

  elegida.filas.forEach((fila) => {
    if (!Array.isArray(fila)) return;
    const po = texto(fila, 'po');
    const etapa = texto(fila, 'etapa');
    if (!po && !etapa) return;

    const fechas = {} as Record<CampoFecha, string | null>;
    CAMPOS_FECHA.forEach((campo) => {
      const indice = indices[normalizar(campo)];
      fechas[campo] = indice >= 0 ? fechaAIsocalendario(fila[indice]) : null;
    });

    const contenedor = texto(fila, 'contenedor');
    if (estadoContenedor(contenedor) === 'malo') contenedorInvalido += 1;

    filas.push({
      po: po || '(sin PO)',
      etapa,
      proveedor: texto(fila, 'proveedor'),
      naviera: texto(fila, 'naviera'),
      contenedor,
      booking: texto(fila, 'booking'),
      fechas,
    });
  });

  if (filas.length === 0) {
    throw new Error('El archivo se leyó pero no contiene POs para analizar.');
  }

  const conteo = new Map<string, number>();
  filas.forEach((f) => {
    const etiqueta = f.etapa || '(vacía)';
    conteo.set(etiqueta, (conteo.get(etiqueta) || 0) + 1);
  });
  const etapas = Array.from(conteo.entries())
    .map(([etapa, total]) => ({ etapa, total }))
    .sort((a, b) => rangoEtapa(a.etapa) - rangoEtapa(b.etapa) || a.etapa.localeCompare(b.etapa));

  const advertencias: string[] = [];
  if (elegida.nombre !== 'POs Activas') {
    advertencias.push(`La hoja usada fue "${elegida.nombre}".`);
  }
  if (contenedorInvalido > 0) {
    advertencias.push(
      `${contenedorInvalido} POs tienen contenedor inválido (no tiene 4 letras + 7 números o empieza con AAAA) y no se analizan.`
    );
  }

  return { filas, advertencias, etapas };
}

// ------------------------- análisis -------------------------

function ordenarPorEtapa<T extends { po: PoControl }>(lista: T[]): T[] {
  return lista.sort(
    (a, b) => rangoEtapa(a.po.etapa) - rangoEtapa(b.po.etapa) || normalizar(a.po.etapa).localeCompare(normalizar(b.po.etapa))
  );
}

export function analizarControl(filas: PoControl[], opciones: OpcionesControl): ResultadoControl {
  const diaCorte = aDia(opciones.fechaCorte) ?? aDia(hoyIso()) ?? 0;
  const limiteDia = diaCorte - 2;
  const limiteIso = new Date(limiteDia * DIA).toISOString().slice(0, 10);
  const excluidasEtapa = new Set(opciones.etapasExcluidas.map(normalizar));
  const excluidosProveedor = new Set(opciones.proveedoresExcluidos.map(normalizar).filter(Boolean));

  const faltantes: ItemFaltantes[] = [];
  const etdVencido: ItemVencido[] = [];
  const etaVencido: ItemVencido[] = [];
  const controlEtapa: ItemEtapa[] = [];
  const ataMenorAtd: ItemVencido[] = [];
  const conteoEtapa = new Map<string, { total: number; diferencias: number }>();
  const sinRegla = new Map<string, number>();

  let sinContenedor = 0;
  let contenedorInvalido = 0;
  let omitidasEtapa = 0;
  let omitidasProveedor = 0;

  filas.forEach((po) => {
    const claveEtapa = normalizar(po.etapa);
    if (excluidasEtapa.has(claveEtapa)) {
      omitidasEtapa += 1;
      return;
    }
    if (excluidosProveedor.has(normalizar(po.proveedor))) {
      omitidasProveedor += 1;
      return;
    }

    const estado = estadoContenedor(po.contenedor);
    if (estado === 'malo') {
      contenedorInvalido += 1;
      return;
    }
    if (estado === '') {
      sinContenedor += 1;
      return;
    }

    const tieneNaviera = po.naviera.trim() !== '';

    // a) contenedor + naviera con alguna fecha ETD/ETA faltante
    if (tieneNaviera) {
      const requeridas: CampoFecha[] = ['ETD Inicial', 'ETD Variable', 'ETA Inicial', 'ETA Variable'];
      const faltan = requeridas.filter((campo) => !po.fechas[campo]);
      if (faltan.length > 0) faltantes.push({ po, faltantes: faltan });
    }

    // b) ETD Variable vencido (≤ hoy − 2)
    const diaEtd = aDia(po.fechas['ETD Variable']);
    if (diaEtd !== null && diaEtd <= limiteDia && !(opciones.excluirReales && aDia(po.fechas.ATD) !== null)) {
      etdVencido.push({ po, dias: diaCorte - diaEtd });
    }

    // c) ETA Variable vencida (≤ hoy − 2)
    const diaEta = aDia(po.fechas['ETA Variable']);
    if (diaEta !== null && diaEta <= limiteDia && !(opciones.excluirReales && aDia(po.fechas.ATA) !== null)) {
      etaVencido.push({ po, dias: diaCorte - diaEta });
    }

    // d) ATA anterior a ATD
    const diaAtd = aDia(po.fechas.ATD);
    const diaAta = aDia(po.fechas.ATA);
    if (diaAtd !== null && diaAta !== null && diaAta < diaAtd) {
      ataMenorAtd.push({ po, dias: diaAtd - diaAta });
    }

    // e) control de fechas por etapa
    const regla = REGLAS_ETAPA.find((r) => r.clave === claveEtapa);
    if (!regla) {
      const etiqueta = po.etapa || '(vacía)';
      sinRegla.set(etiqueta, (sinRegla.get(etiqueta) || 0) + 1);
      return;
    }

    const presentes = CAMPOS_REGLA.filter((campo) => po.fechas[campo]);
    const bookingSinNaviera = claveEtapa === 'booking' && !tieneNaviera;
    const faltanEtapa = regla.requeridas.filter(
      (campo) => !po.fechas[campo] && !(bookingSinNaviera && campo === 'ETD Variable')
    );
    const sobranEtapa = presentes.filter((campo) => !regla.requeridas.includes(campo));
    const ok = faltanEtapa.length === 0 && sobranEtapa.length === 0;

    const partes: string[] = [];
    if (faltanEtapa.length > 0) partes.push(`Falta: ${faltanEtapa.join(', ')}`);
    if (sobranEtapa.length > 0) partes.push(`Sobra: ${sobranEtapa.join(', ')}`);

    const acumulado = conteoEtapa.get(regla.label) || { total: 0, diferencias: 0 };
    acumulado.total += 1;
    if (!ok) acumulado.diferencias += 1;
    conteoEtapa.set(regla.label, acumulado);

    controlEtapa.push({
      po,
      etapaLabel: regla.label,
      requeridas: regla.requeridas,
      faltantes: faltanEtapa,
      sobrantes: sobranEtapa,
      resultado: ok ? 'OK' : partes.join(' | '),
      ok,
    });
  });

  ordenarPorEtapa(faltantes);
  ordenarPorEtapa(etdVencido).sort((a, b) => rangoEtapa(a.po.etapa) - rangoEtapa(b.po.etapa) || b.dias - a.dias);
  ordenarPorEtapa(etaVencido).sort((a, b) => rangoEtapa(a.po.etapa) - rangoEtapa(b.po.etapa) || b.dias - a.dias);
  controlEtapa.sort(
    (a, b) => rangoEtapa(a.po.etapa) - rangoEtapa(b.po.etapa) || Number(a.ok) - Number(b.ok)
  );
  ataMenorAtd.sort((a, b) => rangoEtapa(a.po.etapa) - rangoEtapa(b.po.etapa) || b.dias - a.dias);

  const porEtapa = Array.from(conteoEtapa.entries())
    .map(([etapa, valor]) => ({ etapa, total: valor.total, diferencias: valor.diferencias }))
    .sort((a, b) => ORDEN_ETAPAS.indexOf(normalizar(a.etapa)) - ORDEN_ETAPAS.indexOf(normalizar(b.etapa)));

  const etapasSinRegla = Array.from(sinRegla.entries())
    .map(([etapa, total]) => ({ etapa, total }))
    .sort((a, b) => b.total - a.total);

  return {
    totalLeidas: filas.length,
    analizadas: filas.length - sinContenedor - contenedorInvalido - omitidasEtapa - omitidasProveedor,
    sinContenedor,
    contenedorInvalido,
    omitidasEtapa,
    omitidasProveedor,
    fechaCorte: opciones.fechaCorte,
    limite: limiteIso,
    excluirReales: opciones.excluirReales,
    etapasExcluidas: opciones.etapasExcluidas,
    proveedoresExcluidos: opciones.proveedoresExcluidos,
    faltantes,
    etdVencido,
    etaVencido,
    controlEtapa,
    ataMenorAtd,
    porEtapa,
    etapasSinRegla,
  };
}

// ------------------------- resumen -------------------------

function contarPorEtapa<T extends { po: PoControl }>(lista: T[]): { etapa: string; total: number }[] {
  const mapa = new Map<string, number>();
  lista.forEach((item) => {
    const etiqueta = item.po.etapa || '(vacía)';
    mapa.set(etiqueta, (mapa.get(etiqueta) || 0) + 1);
  });
  return Array.from(mapa.entries())
    .map(([etapa, total]) => ({ etapa, total }))
    .sort((a, b) => rangoEtapa(a.etapa) - rangoEtapa(b.etapa));
}

export function construirResumen(resultado: ResultadoControl): string {
  const numero = (valor: number) => new Intl.NumberFormat('es-CR').format(valor);
  const lineas: string[] = [];

  lineas.push(`Control de fechas NEXT — corte ${formatearFecha(resultado.fechaCorte)}`);
  lineas.push(`POs analizadas: ${numero(resultado.analizadas)} de ${numero(resultado.totalLeidas)}`);

  const excluidas = [
    `${numero(resultado.sinContenedor)} sin contenedor`,
    `${numero(resultado.contenedorInvalido)} con contenedor inválido`,
  ];
  if (resultado.etapasExcluidas.length > 0) {
    excluidas.push(`etapas excluidas: ${resultado.etapasExcluidas.join(', ')} (${numero(resultado.omitidasEtapa)})`);
  }
  if (resultado.proveedoresExcluidos.length > 0) {
    excluidas.push(`proveedores excluidos: ${resultado.proveedoresExcluidos.join('; ')} (${numero(resultado.omitidasProveedor)})`);
  }
  lineas.push(`No consideradas: ${excluidas.join(' · ')}`);
  lineas.push('');

  const seccion = (titulo: string, lista: { po: PoControl }[], extra?: string[]) => {
    lineas.push(`${titulo}: ${numero(lista.length)}`);
    contarPorEtapa(lista).forEach((fila) => lineas.push(`   • ${fila.etapa}: ${numero(fila.total)}`));
    (extra || []).forEach((texto) => lineas.push(`   ${texto}`));
  };

  const faltantesPorCampo = new Map<string, number>();
  resultado.faltantes.forEach((item) => {
    item.faltantes.forEach((campo) => faltantesPorCampo.set(campo, (faltantesPorCampo.get(campo) || 0) + 1));
  });
  const campos = Array.from(faltantesPorCampo.entries()).sort((a, b) => b[1] - a[1]);

  seccion(
    '1. POs con contenedor y naviera sin alguna fecha ETD/ETA',
    resultado.faltantes,
    campos.length > 0
      ? [`Campos que faltan: ${campos.map(([campo, total]) => `${campo} (${numero(total)})`).join(', ')}`]
      : undefined
  );
  lineas.push('');

  const mayorAtraso = (lista: ItemVencido[]) => (lista.length ? Math.max(...lista.map((i) => i.dias)) : 0);

  seccion(
    `2. POs con ETD Variable vencido (al ${formatearFecha(resultado.limite)} o antes${resultado.excluirReales ? ', sin ATD' : ''})`,
    resultado.etdVencido,
    resultado.etdVencido.length > 0 ? [`Mayor atraso: ${mayorAtraso(resultado.etdVencido)} días`] : undefined
  );
  lineas.push('');

  seccion(
    `3. POs con ETA Variable vencida (al ${formatearFecha(resultado.limite)} o antes${resultado.excluirReales ? ', sin ATA' : ''})`,
    resultado.etaVencido,
    resultado.etaVencido.length > 0 ? [`Mayor atraso: ${mayorAtraso(resultado.etaVencido)} días`] : undefined
  );
  lineas.push('');

  const diferencias = resultado.controlEtapa.filter((item) => !item.ok);
  lineas.push(`4. POs con fechas que no corresponden a su etapa: ${numero(diferencias.length)} de ${numero(resultado.controlEtapa.length)}`);
  resultado.porEtapa.forEach((fila) => {
    if (!fila.diferencias) return;
    const detalle = new Map<string, number>();
    diferencias
      .filter((item) => item.etapaLabel === fila.etapa)
      .forEach((item) => detalle.set(item.resultado, (detalle.get(item.resultado) || 0) + 1));
    const top = Array.from(detalle.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([resultadoTexto, total]) => `${resultadoTexto} (${numero(total)})`)
      .join('; ');
    lineas.push(`   • ${fila.etapa}: ${numero(fila.diferencias)} de ${numero(fila.total)} — ${top}`);
  });
  const sinHallazgos = resultado.porEtapa.filter((fila) => !fila.diferencias && fila.total > 0).map((fila) => fila.etapa);
  if (sinHallazgos.length > 0) lineas.push(`   • Sin hallazgos: ${sinHallazgos.join(', ')}`);
  lineas.push('');

  seccion(
    '5. POs con ATA anterior a ATD (arribo real antes del zarpe real)',
    resultado.ataMenorAtd,
    resultado.ataMenorAtd.length > 0 ? [`Mayor diferencia: ${mayorAtraso(resultado.ataMenorAtd)} días`] : undefined
  );
  lineas.push('');
  lineas.push('El detalle por PO está en el Excel exportado.');

  return lineas.join('\n');
}

// ------------------------- exportación -------------------------

const ENCABEZADO_BASE = ['Etapa', 'N° Orden de Compra (PO)', 'Proveedor', 'Línea Naviera', 'Número de Contenedor', 'Número de Booking'];

function filaBase(po: PoControl): (string | Date | null)[] {
  return [
    po.etapa,
    po.po,
    po.proveedor,
    po.naviera,
    po.contenedor,
    po.booking,
    ...CAMPOS_FECHA.map((campo) => aFechaObjeto(po.fechas[campo])),
  ];
}

const COLUMNAS_FECHA_BASE = [6, 7, 8, 9, 10, 11];

function hojaConFechas(filas: (string | number | Date | null)[][], columnasFecha: number[]): XLSX.WorkSheet {
  const hoja = XLSX.utils.aoa_to_sheet(filas, { cellDates: true });
  columnasFecha.forEach((columna) => {
    for (let fila = 0; fila < filas.length; fila += 1) {
      const direccion = XLSX.utils.encode_cell({ r: fila, c: columna });
      const celda = hoja[direccion];
      if (celda && celda.t === 'd') celda.z = 'dd/mm/yyyy';
    }
  });
  return hoja;
}

/** Genera y descarga el reporte en Excel con cuatro hojas. */
export function exportarReporteControl(
  resultado: ResultadoControl,
  todas: PoControl[],
  nombreArchivo: string
): void {
  const libro = XLSX.utils.book_new();

  // Hoja 1: data completa
  const data: (string | number | Date | null)[][] = [
    ['Control de fechas NEXT', `Archivo: ${nombreArchivo}`, `Corte: ${formatearFecha(resultado.fechaCorte)}`],
    ENCABEZADO_BASE.concat(CAMPOS_FECHA as unknown as string[]),
    ...todas.map((po) => filaBase(po)),
  ];
  XLSX.utils.book_append_sheet(libro, hojaConFechas(data, COLUMNAS_FECHA_BASE), 'Data');

  // Hoja 2: hallazgos ETD/ETA
  const hallazgos: (string | number | Date | null)[][] = [
    ['Control de fechas NEXT — hallazgos ETD/ETA'],
    [`Archivo: ${nombreArchivo} · Fecha de corte: ${formatearFecha(resultado.fechaCorte)} · Vencido = fecha ≤ ${formatearFecha(resultado.limite)} (hoy − 2 días)`],
    [`No se consideran ${resultado.sinContenedor} POs sin contenedor ni ${resultado.contenedorInvalido} POs con contenedor inválido` +
      (resultado.etapasExcluidas.length ? ` · Etapas excluidas: ${resultado.etapasExcluidas.join(', ')}` : '') +
      (resultado.proveedoresExcluidos.length ? ` · Proveedores excluidos: ${resultado.proveedoresExcluidos.join('; ')}` : '')],
    [],
    [`a. POs con contenedor y naviera sin alguna fecha ETD/ETA — ${resultado.faltantes.length}`],
    [...ENCABEZADO_BASE, ...CAMPOS_FECHA, 'Campos faltantes'],
    ...resultado.faltantes.map((item) => [...filaBase(item.po), item.faltantes.join(', ')]),
    [],
    [`b. POs con ETD Variable vencido (≤ ${formatearFecha(resultado.limite)}) — ${resultado.etdVencido.length}`],
    [...ENCABEZADO_BASE, ...CAMPOS_FECHA, 'Días de vencido'],
    ...resultado.etdVencido.map((item) => [...filaBase(item.po), item.dias]),
    [],
    [`c. POs con ETA Variable vencida (≤ ${formatearFecha(resultado.limite)}) — ${resultado.etaVencido.length}`],
    [...ENCABEZADO_BASE, ...CAMPOS_FECHA, 'Días de vencido'],
    ...resultado.etaVencido.map((item) => [...filaBase(item.po), item.dias]),
  ];
  XLSX.utils.book_append_sheet(libro, hojaConFechas(hallazgos, COLUMNAS_FECHA_BASE), 'Hallazgos ETD-ETA');

  // Hoja 3: control por etapa
  const etapa: (string | number | Date | null)[][] = [
    ['Etapa', 'N° Orden de Compra (PO)', 'Proveedor', 'Línea Naviera', 'Número de Contenedor', ...CAMPOS_REGLA, 'Fechas esperadas para la etapa', 'Resultado', 'Fechas faltantes', 'Fechas de más'],
    ...resultado.controlEtapa
      .filter((item) => !item.ok)
      .map((item) => [
        item.po.etapa,
        item.po.po,
        item.po.proveedor,
        item.po.naviera,
        item.po.contenedor,
        ...CAMPOS_REGLA.map((campo) => aFechaObjeto(item.po.fechas[campo])),
        item.requeridas.length > 0
          ? item.requeridas.join(', ') + (item.etapaLabel === 'Booking' ? ' (ETD Variable opcional mientras no tenga naviera)' : '')
          : 'Ninguna',
        item.resultado,
        item.faltantes.join(', '),
        item.sobrantes.join(', '),
      ]),
  ];
  XLSX.utils.book_append_sheet(libro, hojaConFechas(etapa, [5, 6, 7, 8, 9]), 'Control por etapa');

  // Hoja 4: ATA menor a ATD
  const ata: (string | number | Date | null)[][] = [
    [...ENCABEZADO_BASE, ...CAMPOS_FECHA, 'Días (ATD − ATA)'],
    ...resultado.ataMenorAtd.map((item) => [...filaBase(item.po), item.dias]),
  ];
  XLSX.utils.book_append_sheet(libro, hojaConFechas(ata, COLUMNAS_FECHA_BASE), 'ATA menor a ATD');

  // Hoja 5: resumen
  const resumen: (string | number | Date | null)[][] = construirResumen(resultado)
    .split('\n')
    .map((linea) => [linea]);
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');

  const limpio = nombreArchivo.replace(/\.xlsx?$/i, '').replace(/[^\w.-]+/g, '_');
  XLSX.writeFile(libro, `Control-fechas-NEXT_${limpio}_${resultado.fechaCorte}.xlsx`);
}