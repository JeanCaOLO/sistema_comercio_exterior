import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import {
  CAMPOS_FECHA,
  CAMPOS_REGLA,
  formatearEntero,
  formatearFecha,
  type PoControl,
  type ResultadoControl,
} from './controlFechas';

// ============================================================
// Envío del reporte de Control de Fechas NEXT por correo.
// Se envía UN correo por sección del reporte (2a, 2b, 2c, 3 y 4),
// cada uno con su propio Excel adjunto y SOLO con las POs que no
// se habían reportado antes a soporte.
// ============================================================

export type ModoEnvio = 'prueba' | 'real';

export type SeccionEnvio = '2a' | '2b' | '2c' | '3' | '4';

/** Un correo por sección (todas sus POs juntas) o un correo por cada PO. */
export type AgrupacionEnvio = 'seccion' | 'po';

export interface ConfigCorreoControl {
  activo: boolean;
  modo: ModoEnvio;
  agrupacion: AgrupacionEnvio;
  de: string;
  para: string;
  cc: string;
  token: string;
  ultimaCargaEnviada: string;
}

export interface EnvioRegistro {
  id: string;
  modo: ModoEnvio;
  seccion: string;
  destinatarios: string;
  copia: string;
  asunto: string;
  adjuntoNombre: string;
  totalHallazgos: number;
  ok: boolean;
  mensaje: string;
  enviadoPor: string;
  enviadoAt: string;
}

const CLAVE_CONFIG = 'control_fechas_correo';
const CLAVE_TOKEN_DEFECTO = 'ologistics-control-fechas-2026';

export const CONFIG_CORREO_DEFECTO: ConfigCorreoControl = {
  activo: false,
  modo: 'prueba',
  agrupacion: 'seccion',
  de: 'jalvarez@ologistics.com',
  para: 'soporte@raga-x.ai',
  cc: 'erodriguez@ologistics.com, msandoval@ologistics.com',
  token: CLAVE_TOKEN_DEFECTO,
  ultimaCargaEnviada: '',
};

/** Token sugerido para el Web App de Apps Script. */
export const TOKEN_SUGERIDO = CLAVE_TOKEN_DEFECTO;

/** Corrige el correo de copia (había quedado escrito con "a" al inicio). */
function normalizarCopia(valor: string): string {
  return valor
    .replace(/aerodriguez@/gi, 'erodriguez@')
    .split(',')
    .map((correo) => correo.trim())
    .filter(Boolean)
    .join(', ');
}

function normalizarConfig(valor: unknown): ConfigCorreoControl {
  if (!valor || typeof valor !== 'object') return { ...CONFIG_CORREO_DEFECTO };
  const bruto = valor as Partial<ConfigCorreoControl>;
  return {
    activo: bruto.activo === true,
    modo: bruto.modo === 'real' ? 'real' : 'prueba',
    agrupacion: bruto.agrupacion === 'po' ? 'po' : 'seccion',
    de: bruto.de || CONFIG_CORREO_DEFECTO.de,
    para: bruto.para || CONFIG_CORREO_DEFECTO.para,
    cc: normalizarCopia(bruto.cc ?? CONFIG_CORREO_DEFECTO.cc),
    token: bruto.token || CLAVE_TOKEN_DEFECTO,
    ultimaCargaEnviada: bruto.ultimaCargaEnviada || '',
  };
}

export async function cargarConfigCorreo(): Promise<ConfigCorreoControl> {
  const { data, error } = await supabase
    .from('configuracion_sistema')
    .select('valor')
    .eq('clave', CLAVE_CONFIG)
    .maybeSingle();

  if (error) throw error;
  const fila = data as unknown as { valor: string } | null;
  if (!fila?.valor) return { ...CONFIG_CORREO_DEFECTO };

  try {
    return normalizarConfig(JSON.parse(fila.valor));
  } catch {
    return { ...CONFIG_CORREO_DEFECTO };
  }
}

export async function guardarConfigCorreo(config: ConfigCorreoControl): Promise<void> {
  const valor = JSON.stringify({ ...config, cc: normalizarCopia(config.cc) });
  const { data, error } = await supabase
    .from('configuracion_sistema')
    .select('id')
    .eq('clave', CLAVE_CONFIG)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    const { error: errorUpdate } = await supabase
      .from('configuracion_sistema')
      .update({ valor, updated_at: new Date().toISOString() })
      .eq('clave', CLAVE_CONFIG);
    if (errorUpdate) throw errorUpdate;
    return;
  }

  const { error: errorInsert } = await supabase.from('configuracion_sistema').insert({
    clave: CLAVE_CONFIG,
    valor,
    descripcion: 'Envío del reporte de Control de Fechas NEXT',
  });
  if (errorInsert) throw errorInsert;
}

// ------------------------- secciones del reporte -------------------------

export interface SeccionReporte {
  clave: SeccionEnvio;
  titulo: string;
  nota: string;
  /** N° de PO de cada hallazgo de la sección. */
  pos: string[];
}

const TITULOS: Record<SeccionEnvio, string> = {
  '2a': 'Fechas faltantes',
  '2b': 'ETD Variable vencido',
  '2c': 'ETA Variable vencida',
  '3': 'Control por etapa',
  '4': 'ATA menor a ATD',
};

const NOMBRE_HOJA: Record<SeccionEnvio, string> = {
  '2a': '2a Fechas faltantes',
  '2b': '2b ETD vencido',
  '2c': '2c ETA vencida',
  '3': '3 Control por etapa',
  '4': '4 ATA menor a ATD',
};

/** Lista las POs (sin repetir) que caen en cada sección del reporte. */
export function seccionesReporte(resultado: ResultadoControl): SeccionReporte[] {
  const unicas = (lista: PoControl[]) => Array.from(new Set(lista.map((po) => po.po)));

  const diferencias = resultado.controlEtapa.filter((item) => !item.ok);

  const notas: Record<SeccionEnvio, string> = {
    '2a': 'POs con contenedor y naviera sin ETD Inicial, ETD Variable, ETA Inicial o ETA Variable.',
    '2b': `ETD Variable en ${formatearFecha(resultado.limite)} o antes${resultado.excluirReales ? ', sin ATD registrado' : ''}.`,
    '2c': `ETA Variable en ${formatearFecha(resultado.limite)} o antes${resultado.excluirReales ? ', sin ATA registrada' : ''}.`,
    '3': 'POs cuyas fechas no corresponden a las requeridas para su etapa.',
    '4': 'Arribo real anterior al zarpe real.',
  };

  const base: { clave: SeccionEnvio; pos: string[] }[] = [
    { clave: '2a', pos: unicas(resultado.faltantes.map((item) => item.po)) },
    { clave: '2b', pos: unicas(resultado.etdVencido.map((item) => item.po)) },
    { clave: '2c', pos: unicas(resultado.etaVencido.map((item) => item.po)) },
    { clave: '3', pos: unicas(diferencias.map((item) => item.po)) },
    { clave: '4', pos: unicas(resultado.ataMenorAtd.map((item) => item.po)) },
  ];

  return base.map((item) => ({
    clave: item.clave,
    titulo: TITULOS[item.clave],
    nota: notas[item.clave],
    pos: item.pos,
  }));
}

export function contarHallazgos(resultado: ResultadoControl): Record<SeccionEnvio, number> & { total: number } {
  const secciones = seccionesReporte(resultado);
  const buscar = (clave: SeccionEnvio) => secciones.find((s) => s.clave === clave)?.pos.length || 0;
  const faltantes = buscar('2a');
  const etdVencido = buscar('2b');
  const etaVencido = buscar('2c');
  const controlEtapa = buscar('3');
  const ataMenorAtd = buscar('4');
  return {
    '2a': faltantes,
    '2b': etdVencido,
    '2c': etaVencido,
    '3': controlEtapa,
    '4': ataMenorAtd,
    faltantes,
    etdVencido,
    etaVencido,
    controlEtapa,
    ataMenorAtd,
    total: faltantes + etdVencido + etaVencido + controlEtapa + ataMenorAtd,
  };
}

// ------------------------- Excel adjunto por sección -------------------------

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ENCABEZADO_BASE = [
  'Etapa',
  'N° Orden de Compra (PO)',
  'Proveedor',
  'Línea Naviera',
  'Número de Contenedor',
  'Número de Booking',
];

const COLUMNAS_FECHA_ADJUNTO = [6, 7, 8, 9, 10, 11];

function fechaCelda(iso: string | null): Date | null {
  if (!iso) return null;
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!partes) return null;
  return new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
}

function filaConFechas(po: PoControl): (string | Date | null)[] {
  return [
    po.etapa,
    po.po,
    po.proveedor,
    po.naviera,
    po.contenedor,
    po.booking,
    ...CAMPOS_FECHA.map((campo) => fechaCelda(po.fechas[campo])),
  ];
}

function hojaConFechas(
  filas: (string | number | Date | null)[][],
  columnasFecha: number[] = COLUMNAS_FECHA_ADJUNTO
): XLSX.WorkSheet {
  const hoja = XLSX.utils.aoa_to_sheet(filas, { cellDates: true });
  columnasFecha.forEach((columna) => {
    for (let fila = 0; fila < filas.length; fila += 1) {
      const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: columna })];
      if (celda && celda.t === 'd') celda.z = 'dd/mm/yyyy';
    }
  });
  return hoja;
}

type FilaAdjunto = (string | number | Date | null)[];

/** Arma las filas de una sección, dejando solo las POs incluidas. */
function filasDeSeccion(
  clave: SeccionEnvio,
  resultado: ResultadoControl,
  incluidas: Set<string>
): { filas: FilaAdjunto[]; encabezado: FilaAdjunto } {
  if (clave === '2a') {
    return {
      encabezado: [...ENCABEZADO_BASE, ...CAMPOS_FECHA, 'Campos faltantes'],
      filas: resultado.faltantes
        .filter((item) => incluidas.has(item.po.po))
        .map((item) => [...filaConFechas(item.po), item.faltantes.join(', ')]),
    };
  }

  if (clave === '2b' || clave === '2c' || clave === '4') {
    const lista =
      clave === '2b' ? resultado.etdVencido : clave === '2c' ? resultado.etaVencido : resultado.ataMenorAtd;
    return {
      encabezado: [...ENCABEZADO_BASE, ...CAMPOS_FECHA, clave === '4' ? 'Días (ATD − ATA)' : 'Días de vencido'],
      filas: lista.filter((item) => incluidas.has(item.po.po)).map((item) => [...filaConFechas(item.po), item.dias]),
    };
  }

  return {
    encabezado: [
      'Etapa',
      'N° Orden de Compra (PO)',
      'Proveedor',
      'Línea Naviera',
      'Número de Contenedor',
      ...CAMPOS_REGLA,
      'Fechas esperadas para la etapa',
      'Resultado',
      'Fechas faltantes',
      'Fechas de más',
    ],
    filas: resultado.controlEtapa
      .filter((item) => !item.ok && incluidas.has(item.po.po))
      .map((item) => [
        item.po.etapa,
        item.po.po,
        item.po.proveedor,
        item.po.naviera,
        item.po.contenedor,
        ...CAMPOS_REGLA.map((campo) => fechaCelda(item.po.fechas[campo])),
        item.requeridas.length > 0
          ? item.requeridas.join(', ') +
            (item.etapaLabel === 'Booking' ? ' (ETD Variable opcional mientras no tenga naviera)' : '')
          : 'Ninguna',
        item.resultado,
        item.faltantes.join(', '),
        item.sobrantes.join(', '),
      ]),
  };
}

export interface AdjuntoCorreo {
  nombre: string;
  mime: string;
  base64: string;
  totalFilas: number;
}

/** Excel con una sola hoja: la sección a reportar. */
export function construirAdjuntoSeccion(
  seccion: SeccionReporte,
  resultado: ResultadoControl,
  archivo: string,
  incluidas: Set<string>,
  yaEnviadas: number
): AdjuntoCorreo {
  const libro = XLSX.utils.book_new();
  const { encabezado, filas } = filasDeSeccion(seccion.clave, resultado, incluidas);

  const contenido: FilaAdjunto[][] = [
    [`Control de fechas NEXT — ${seccion.clave} · ${seccion.titulo}`],
    [`Archivo: ${archivo} · Corte: ${formatearFecha(resultado.fechaCorte)} · Vencido = fecha ≤ ${formatearFecha(resultado.limite)}`],
    [
      `POs nuevas en este correo: ${formatearEntero(filas.length)} · Ya reportadas antes: ${formatearEntero(yaEnviadas)}`,
    ],
    [],
    encabezado,
    ...filas,
  ];

  XLSX.utils.book_append_sheet(
    libro,
    hojaConFechas(contenido, seccion.clave === '3' ? [5, 6, 7, 8, 9] : COLUMNAS_FECHA_ADJUNTO),
    NOMBRE_HOJA[seccion.clave]
  );

  const base64 = XLSX.write(libro, { type: 'base64', bookType: 'xlsx' }) as string;
  const limpio = archivo.replace(/\.xlsx?$/i, '').replace(/[^\w.-]+/g, '_');

  return {
    nombre: `Control-fechas-NEXT_${seccion.clave}_${limpio}_${resultado.fechaCorte}.xlsx`,
    mime: MIME_XLSX,
    base64,
    totalFilas: filas.length,
  };
}

// ------------------------- cuerpo del correo por sección -------------------------

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface CuerpoSeccion {
  asunto: string;
  html: string;
  texto: string;
}

export function construirCuerpoSeccion(
  seccion: SeccionReporte,
  resultado: ResultadoControl,
  archivo: string,
  nuevas: number,
  yaEnviadas: number,
  modo: ModoEnvio
): CuerpoSeccion {
  const corte = formatearFecha(resultado.fechaCorte);
  const n = formatearEntero;

  const asunto =
    `Control de Fechas NEXT · ${seccion.clave} ${seccion.titulo} · ${n(nuevas)} POs nuevas · corte ${corte}` +
    `${modo === 'prueba' ? ' [PRUEBA]' : ''}`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Ologistics · Control de Fechas NEXT</p>
        <h1 style="margin:6px 0 0;font-size:19px;color:#0f172a;">${seccion.clave} · ${escapar(seccion.titulo)}</h1>
        <p style="margin:6px 0 0;font-size:13px;color:#475569;">Corte al ${corte} · archivo ${escapar(archivo)}</p>
      </div>
      <div style="padding:18px 24px;">
        ${modo === 'prueba' ? '<p style="margin:0 0 14px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;">Envío de PRUEBA: este correo solo se entregó al remitente. El destinatario real (soporte@raga-x.ai) todavía no recibe nada.</p>' : ''}
        <p style="margin:0 0 12px;font-size:13px;color:#334155;line-height:1.6;">
          Se adjunta el Excel con el detalle de las POs de esta sección que <strong>todavía no se habían reportado</strong> a soporte.
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tbody>
            <tr>
              <td style="padding:9px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#475569;">POs nuevas en este correo</td>
              <td style="padding:9px 12px;border-bottom:1px solid #eef2f7;font-size:15px;font-weight:700;color:#0f172a;text-align:right;">${n(nuevas)}</td>
            </tr>
            <tr>
              <td style="padding:9px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#475569;">POs ya reportadas en envíos anteriores</td>
              <td style="padding:9px 12px;border-bottom:1px solid #eef2f7;font-size:15px;font-weight:700;color:#64748b;text-align:right;">${n(yaEnviadas)}</td>
            </tr>
            <tr>
              <td style="padding:9px 12px;font-size:12px;color:#475569;">Total de POs en la sección</td>
              <td style="padding:9px 12px;font-size:13px;font-weight:600;color:#0f172a;text-align:right;">${n(nuevas + yaEnviadas)}</td>
            </tr>
          </tbody>
        </table>
        <p style="margin:14px 0 0;font-size:12px;color:#475569;line-height:1.6;">${escapar(seccion.nota)}</p>
        <p style="margin:14px 0 0;font-size:12px;color:#475569;line-height:1.6;">
          POs analizadas: ${n(resultado.analizadas)} de ${n(resultado.totalLeidas)}. No se consideran las POs sin contenedor (${n(resultado.sinContenedor)}) ni con contenedor inválido (${n(resultado.contenedorInvalido)}).
          ${resultado.etapasExcluidas.length > 0 ? ` Etapas excluidas: ${escapar(resultado.etapasExcluidas.join(', '))}.` : ''}
          ${resultado.proveedoresExcluidos.length > 0 ? ` Proveedores excluidos: ${escapar(resultado.proveedoresExcluidos.join('; '))}.` : ''}
        </p>
      </div>
      <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">Generado automáticamente por el módulo Control de Fechas NEXT · Ologistics.</p>
      </div>
    </div>
  </div>`;

  const texto = [
    `Control de Fechas NEXT — ${seccion.clave} · ${seccion.titulo}`,
    `Corte ${corte} · Archivo: ${archivo}`,
    '',
    `POs nuevas en este correo: ${n(nuevas)}`,
    `POs ya reportadas antes: ${n(yaEnviadas)}`,
    `Total de la sección: ${n(nuevas + yaEnviadas)}`,
    '',
    seccion.nota,
    '',
    'El detalle por PO está en el Excel adjunto.',
  ].join('\n');

  return { asunto, html, texto };
}

// ------------------------- correo individual por PO -------------------------

export interface DetalleCasoPo {
  explicacion: string;
  etiquetas: { etiqueta: string; valor: string }[];
}

function datosGeneralesPo(po: PoControl): { etiqueta: string; valor: string }[] {
  return [
    { etiqueta: 'Etapa', valor: po.etapa || '—' },
    { etiqueta: 'N° Orden de Compra (PO)', valor: po.po },
    { etiqueta: 'Proveedor', valor: po.proveedor || '—' },
    { etiqueta: 'Línea Naviera', valor: po.naviera || '—' },
    { etiqueta: 'Número de Contenedor', valor: po.contenedor || '—' },
    { etiqueta: 'Número de Booking', valor: po.booking || '—' },
  ];
}

function fechasPo(po: PoControl): { etiqueta: string; valor: string }[] {
  return CAMPOS_FECHA.map((campo) => ({
    etiqueta: campo,
    valor: formatearFecha(po.fechas[campo]) || 'Sin fecha',
  }));
}

/** Explica, en una frase, por qué esa PO cayó en la sección. */
function explicarCasoPo(clave: SeccionEnvio, resultado: ResultadoControl, po: PoControl): string {
  const limite = formatearFecha(resultado.limite);

  if (clave === '2a') {
    const item = resultado.faltantes.find((fila) => fila.po.po === po.po);
    const campos = item && item.faltantes.length > 0 ? item.faltantes.join(', ') : 'fechas ETD/ETA';
    return `La PO tiene contenedor y línea naviera asignados, pero le falta registrar estas fechas: ${campos}. ` +
      'Mientras falten, no se puede controlar el tránsito del contenedor.';
  }

  if (clave === '2b') {
    const item = resultado.etdVencido.find((fila) => fila.po.po === po.po);
    const dias = item ? item.dias : 0;
    const fecha = formatearFecha(po.fechas['ETD Variable']);
    return `El ETD Variable (${fecha || 'sin fecha'}) ya venció: es igual o anterior al ${limite}. ` +
      `Lleva ${dias} día(s) de atraso al corte, así que el zarpe estimado ya no se está cumpliendo.` +
      (resultado.excluirReales ? ' Además no tiene ATD registrado.' : '');
  }

  if (clave === '2c') {
    const item = resultado.etaVencido.find((fila) => fila.po.po === po.po);
    const dias = item ? item.dias : 0;
    const fecha = formatearFecha(po.fechas['ETA Variable']);
    return `El ETA Variable (${fecha || 'sin fecha'}) ya venció: es igual o anterior al ${limite}. ` +
      `Lleva ${dias} día(s) de atraso al corte y el arribo estimado no se cumplió.` +
      (resultado.excluirReales ? ' Además no tiene ATA registrada.' : '');
  }

  if (clave === '3') {
    const item = resultado.controlEtapa.find((fila) => !fila.ok && fila.po.po === po.po);
    if (!item) {
      return 'Las fechas de la PO no corresponden a las requeridas para su etapa.';
    }
    const partes: string[] = [];
    if (item.faltantes.length > 0) partes.push(`faltan ${item.faltantes.join(', ')}`);
    if (item.sobrantes.length > 0) partes.push(`sobran ${item.sobrantes.join(', ')}`);
    const requeridas = item.requeridas.length > 0 ? item.requeridas.join(', ') : 'ninguna fecha';
    return `La PO está en la etapa ${item.etapaLabel}, donde se esperan estas fechas: ${requeridas}. ` +
      `Según la data, ${partes.join(' y ') || 'las fechas no cuadran con la etapa'}. ` +
      'Hay que corregir las fechas para que coincidan con la etapa real del contenedor.';
  }

  const item = resultado.ataMenorAtd.find((fila) => fila.po.po === po.po);
  const dias = item ? item.dias : 0;
  const ata = formatearFecha(po.fechas.ATA);
  const atd = formatearFecha(po.fechas.ATD);
  return `El ATA (${ata || 'sin fecha'}) es anterior al ATD (${atd || 'sin fecha'}) por ${dias} día(s). ` +
    'El arribo real no puede ser previo al zarpe real, así que una de las dos fechas está mal registrada.';
}

export function detalleCasoPo(
  seccion: SeccionReporte,
  resultado: ResultadoControl,
  po: PoControl
): DetalleCasoPo {
  return {
    explicacion: explicarCasoPo(seccion.clave, resultado, po),
    etiquetas: [...datosGeneralesPo(po), ...fechasPo(po)],
  };
}

/** Excel de una sola fila: la línea exacta de esa PO en la sección. */
export function construirAdjuntoPo(
  seccion: SeccionReporte,
  resultado: ResultadoControl,
  archivo: string,
  po: string
): AdjuntoCorreo {
  const libro = XLSX.utils.book_new();
  const { encabezado, filas } = filasDeSeccion(seccion.clave, resultado, new Set([po]));

  const contenido: FilaAdjunto[][] = [
    [`Control de fechas NEXT — ${seccion.clave} · ${seccion.titulo}`],
    [`PO: ${po}`],
    [
      `Archivo: ${archivo} · Corte: ${formatearFecha(resultado.fechaCorte)} · Vencido = fecha ≤ ${formatearFecha(
        resultado.limite
      )}`,
    ],
    [],
    encabezado,
    ...filas,
  ];

  XLSX.utils.book_append_sheet(
    libro,
    hojaConFechas(contenido, seccion.clave === '3' ? [5, 6, 7, 8, 9] : COLUMNAS_FECHA_ADJUNTO),
    NOMBRE_HOJA[seccion.clave]
  );

  const base64 = XLSX.write(libro, { type: 'base64', bookType: 'xlsx' }) as string;
  const limpioArchivo = archivo.replace(/\.xlsx?$/i, '').replace(/[^\w.-]+/g, '_');
  const limpioPo = po.replace(/[^\w.-]+/g, '_');

  return {
    nombre: `Control-fechas-NEXT_${seccion.clave}_PO_${limpioPo}_${limpioArchivo}_${resultado.fechaCorte}.xlsx`,
    mime: MIME_XLSX,
    base64,
    totalFilas: filas.length,
  };
}

export function construirCuerpoPo(
  seccion: SeccionReporte,
  resultado: ResultadoControl,
  archivo: string,
  po: PoControl,
  modo: ModoEnvio
): CuerpoSeccion {
  const corte = formatearFecha(resultado.fechaCorte);
  const caso = detalleCasoPo(seccion, resultado, po);

  const asunto =
    `Control de Fechas NEXT · ${seccion.clave} ${seccion.titulo} · PO ${po.po} · corte ${corte}` +
    `${modo === 'prueba' ? ' [PRUEBA]' : ''}`;

  const filasHtml = caso.etiquetas
    .map(
      (fila) =>
        `<tr><td style="padding:7px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#475569;">${escapar(
          fila.etiqueta
        )}</td><td style="padding:7px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#0f172a;text-align:right;font-weight:600;">${escapar(
          fila.valor
        )}</td></tr>`
    )
    .join('');

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Ologistics · Control de Fechas NEXT</p>
        <h1 style="margin:6px 0 0;font-size:19px;color:#0f172a;">${seccion.clave} · ${escapar(seccion.titulo)}</h1>
        <p style="margin:6px 0 0;font-size:13px;color:#475569;">PO <strong>${escapar(po.po)}</strong> · corte ${corte}</p>
      </div>
      <div style="padding:18px 24px;">
        ${modo === 'prueba' ? '<p style="margin:0 0 14px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;">Envío de PRUEBA: este correo solo se entregó al remitente.</p>' : ''}
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;">Caso</p>
        <div style="padding:12px 14px;border-left:3px solid #0f766e;background:#f0fdfa;border-radius:6px;">
          <p style="margin:0;font-size:13px;color:#134e4a;line-height:1.65;">${escapar(caso.explicacion)}</p>
        </div>
        <p style="margin:18px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;">Datos de la PO</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tbody>${filasHtml}</tbody>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#475569;line-height:1.6;">
          Se adjunta el Excel con la línea de esta PO. ${escapar(seccion.nota)}
        </p>
      </div>
      <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">Generado automáticamente por el módulo Control de Fechas NEXT · Ologistics.</p>
      </div>
    </div>
  </div>`;

  const texto = [
    `Control de Fechas NEXT — ${seccion.clave} · ${seccion.titulo}`,
    `PO: ${po.po} · Corte ${corte} · Archivo: ${archivo}`,
    '',
    'Caso:',
    caso.explicacion,
    '',
    ...caso.etiquetas.map((fila) => `${fila.etiqueta}: ${fila.valor}`),
    '',
    'El detalle está en el Excel adjunto.',
  ].join('\n');

  return { asunto, html, texto };
}

// ------------------------- control de POs ya enviadas -------------------------

const TAMANO_PAGINA = 1000;

export type MapaEnviadas = Record<SeccionEnvio, Set<string>>;

function mapaVacio(): MapaEnviadas {
  return { '2a': new Set(), '2b': new Set(), '2c': new Set(), '3': new Set(), '4': new Set() };
}

/** POs que ya fueron reportadas a soporte, agrupadas por sección. */
export async function cargarPosEnviadas(): Promise<MapaEnviadas> {
  const mapa = mapaVacio();
  let desde = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('control_fechas_pos_enviadas')
      .select('seccion, po')
      .order('seccion', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) throw error;
    const lote = (data || []) as unknown as { seccion: string; po: string }[];
    lote.forEach((fila) => {
      const clave = fila.seccion as SeccionEnvio;
      if (mapa[clave]) mapa[clave].add(fila.po);
    });
    if (lote.length < TAMANO_PAGINA) break;
    desde += TAMANO_PAGINA;
  }

  return mapa;
}

// ------------------------- cola de envío -------------------------

export interface CorreoEnCola {
  id: string;
  seccion: string;
  modo: ModoEnvio;
  destinatarios: string;
  copia: string;
  asunto: string;
  adjuntoNombre: string;
  totalPos: number;
  estado: 'pendiente' | 'enviado' | 'error';
  mensaje: string;
  creadoAt: string;
}

/** Correos que están esperando a que el script de Google los envíe. */
export async function cargarCola(limite = 20): Promise<CorreoEnCola[]> {
  const { data, error } = await supabase
    .from('control_fechas_cola_correos')
    .select('id, seccion, modo, para, asunto, adjunto_nombre, total_pos, estado, error, creado_at')
    .order('creado_at', { ascending: false })
    .limit(limite);

  if (error) throw error;

  return ((data || []) as unknown as {
    id: string;
    seccion: string;
    modo: string;
    para: string | null;
    asunto: string | null;
    adjunto_nombre: string | null;
    total_pos: number | null;
    estado: string;
    error: string | null;
    creado_at: string;
  }[]).map((fila) => ({
    id: fila.id,
    seccion: fila.seccion,
    modo: fila.modo === 'real' ? 'real' : 'prueba',
    destinatarios: fila.para || '',
    copia: '',
    asunto: fila.asunto || '',
    adjuntoNombre: fila.adjunto_nombre || '',
    totalPos: Number(fila.total_pos) || 0,
    estado: fila.estado === 'enviado' ? 'enviado' : fila.estado === 'error' ? 'error' : 'pendiente',
    mensaje: fila.error || '',
    creadoAt: fila.creado_at,
  }));
}

interface ColaPendiente {
  /** Secciones que ya tienen un correo pendiente para esta carga. */
  secciones: Set<string>;
  /** Claves `seccion::po` que ya están esperando en la cola. */
  pos: Set<string>;
}

/** Lo que ya está esperando en la cola para esta carga, por sección y por PO. */
async function cargarColaPendiente(cargaId: string): Promise<ColaPendiente> {
  const vacio: ColaPendiente = { secciones: new Set(), pos: new Set() };
  if (!cargaId) return vacio;

  const { data, error } = await supabase
    .from('control_fechas_cola_correos')
    .select('seccion, pos')
    .eq('estado', 'pendiente')
    .eq('carga_id', cargaId)
    .limit(TAMANO_PAGINA);

  if (error) throw error;

  const filas = (data || []) as unknown as { seccion: string; pos: unknown }[];
  const resultado: ColaPendiente = { secciones: new Set(), pos: new Set() };

  filas.forEach((fila) => {
    resultado.secciones.add(fila.seccion);
    let lista: unknown = fila.pos;
    if (typeof lista === 'string') {
      try {
        lista = JSON.parse(lista);
      } catch {
        lista = [];
      }
    }
    if (Array.isArray(lista)) {
      lista.forEach((po) => {
        if (typeof po === 'string') resultado.pos.add(`${fila.seccion}::${po}`);
      });
    }
  });

  return resultado;
}

/** Devuelve la fila de la PO (con sus fechas) dentro de una sección. */
function buscarPoEnSeccion(clave: SeccionEnvio, resultado: ResultadoControl, numeroPo: string): PoControl | null {
  if (clave === '2a') return resultado.faltantes.find((item) => item.po.po === numeroPo)?.po ?? null;
  if (clave === '2b') return resultado.etdVencido.find((item) => item.po.po === numeroPo)?.po ?? null;
  if (clave === '2c') return resultado.etaVencido.find((item) => item.po.po === numeroPo)?.po ?? null;
  if (clave === '3') {
    return resultado.controlEtapa.find((item) => !item.ok && item.po.po === numeroPo)?.po ?? null;
  }
  return resultado.ataMenorAtd.find((item) => item.po.po === numeroPo)?.po ?? null;
}

/** Saca un correo de la cola para que no se envíe. */
export async function descartarCorreoCola(id: string): Promise<void> {
  const { error } = await supabase.from('control_fechas_cola_correos').delete().eq('id', id);
  if (error) throw error;
}

export interface EnvioParams {
  config: ConfigCorreoControl;
  resultado: ResultadoControl;
  archivo: string;
  cargaId: string;
  usuario: string;
}

export interface ResultadoSeccionEnvio {
  clave: SeccionEnvio;
  titulo: string;
  total: number;
  yaEnviadas: number;
  nuevas: number;
  enviado: boolean;
  ok: boolean;
  mensaje: string;
  adjunto: string;
}

export interface ResultadoEnvio {
  ok: boolean;
  mensaje: string;
  destinatarios: string;
  copia: string;
  correos: number;
  secciones: ResultadoSeccionEnvio[];
}

export interface PrevisualizacionSeccion {
  clave: SeccionEnvio;
  titulo: string;
  total: number;
  yaEnviadas: number;
  nuevas: number;
}

/** Lo que se enviaría: por sección, cuántas POs son nuevas. */
export function previsualizarEnvio(
  resultado: ResultadoControl,
  enviadas: MapaEnviadas | null
): PrevisualizacionSeccion[] {
  return seccionesReporte(resultado).map((seccion) => {
    const set = enviadas?.[seccion.clave] || new Set<string>();
    const nuevas = seccion.pos.filter((po) => !set.has(po)).length;
    return {
      clave: seccion.clave,
      titulo: seccion.titulo,
      total: seccion.pos.length,
      yaEnviadas: seccion.pos.length - nuevas,
      nuevas,
    };
  });
}

export async function enviarReporteControl({
  config,
  resultado,
  archivo,
  cargaId,
  usuario,
}: EnvioParams): Promise<ResultadoEnvio> {
  const destino =
    config.modo === 'prueba'
      ? { para: config.de.trim(), cc: '' }
      : { para: config.para.trim(), cc: normalizarCopia(config.cc) };

  const secciones = seccionesReporte(resultado);
  const resultados: ResultadoSeccionEnvio[] = [];

  let enviadas: MapaEnviadas = mapaVacio();
  try {
    enviadas = await cargarPosEnviadas();
  } catch {
    enviadas = mapaVacio();
  }

  let colaPendiente: ColaPendiente = { secciones: new Set(), pos: new Set() };
  try {
    colaPendiente = await cargarColaPendiente(cargaId);
  } catch {
    colaPendiente = { secciones: new Set(), pos: new Set() };
  }

  let correos = 0;
  let huboError = false;

  const insertarEnCola = async (datos: {
    seccion: SeccionEnvio;
    asunto: string;
    html: string;
    texto: string;
    adjunto: AdjuntoCorreo;
    pos: string[];
  }): Promise<void> => {
    if (!destino.para) {
      throw new Error('Falta el destinatario del correo.');
    }

    const { error } = await supabase.from('control_fechas_cola_correos').insert({
      carga_id: cargaId || null,
      seccion: datos.seccion,
      modo: config.modo,
      remitente: config.de.trim(),
      para: destino.para,
      cc: destino.cc || null,
      asunto: datos.asunto,
      cuerpo_html: datos.html,
      cuerpo_texto: datos.texto,
      adjunto_nombre: datos.adjunto.nombre,
      adjunto_mime: datos.adjunto.mime,
      adjunto_base64: datos.adjunto.base64,
      pos: datos.pos,
      total_pos: datos.pos.length,
      estado: 'pendiente',
      creado_por: usuario || null,
    });

    if (error) throw new Error(`No se pudo poner el correo en la cola: ${error.message}`);
  };

  for (const seccion of secciones) {
    if (config.agrupacion === 'po') {
      const setEnviadas = enviadas[seccion.clave] || new Set<string>();
      const nuevas = seccion.pos.filter((po) => !setEnviadas.has(po));
      const yaEnviadas = seccion.pos.length - nuevas.length;

      if (nuevas.length === 0) {
        resultados.push({
          clave: seccion.clave,
          titulo: seccion.titulo,
          total: seccion.pos.length,
          yaEnviadas,
          nuevas: 0,
          enviado: false,
          ok: true,
          mensaje:
            seccion.pos.length === 0
              ? 'La sección no tiene hallazgos.'
              : 'Todas las POs de esta sección ya se habían reportado a soporte.',
          adjunto: '',
        });
        continue;
      }

      let enCola = 0;
      let omitidasCola = 0;
      let fallos = 0;
      let primerError = '';

      for (const numeroPo of nuevas) {
        if (colaPendiente.pos.has(`${seccion.clave}::${numeroPo}`)) {
          omitidasCola += 1;
          continue;
        }

        const po = buscarPoEnSeccion(seccion.clave, resultado, numeroPo);
        if (!po) continue;

        const cuerpo = construirCuerpoPo(seccion, resultado, archivo, po, config.modo);
        const adjunto = construirAdjuntoPo(seccion, resultado, archivo, numeroPo);

        try {
          await insertarEnCola({
            seccion: seccion.clave,
            asunto: cuerpo.asunto,
            html: cuerpo.html,
            texto: cuerpo.texto,
            adjunto,
            pos: [numeroPo],
          });
          enCola += 1;
          correos += 1;
        } catch (err) {
          fallos += 1;
          if (!primerError) {
            primerError = err instanceof Error ? err.message : 'Error desconocido al preparar el correo.';
          }
          huboError = true;
        }
      }

      resultados.push({
        clave: seccion.clave,
        titulo: seccion.titulo,
        total: seccion.pos.length,
        yaEnviadas,
        nuevas: enCola,
        enviado: enCola > 0 || fallos > 0,
        ok: fallos === 0,
        mensaje:
          fallos > 0
            ? `${fallos} correo(s) no se pudieron preparar. ${primerError}`
            : omitidasCola > 0
              ? `${enCola} correo(s) en cola · ${omitidasCola} PO(s) ya estaban esperando en la cola.`
              : `${enCola} correo(s) en cola, uno por cada PO.`,
        adjunto: `${enCola} correo${enCola === 1 ? '' : 's'} · 1 PO cada uno`,
      });
      continue;
    }

    const setEnviadas = enviadas[seccion.clave] || new Set<string>();
    const nuevas = seccion.pos.filter((po) => !setEnviadas.has(po));
    const yaEnviadas = seccion.pos.length - nuevas.length;

    if (nuevas.length === 0) {
      resultados.push({
        clave: seccion.clave,
        titulo: seccion.titulo,
        total: seccion.pos.length,
        yaEnviadas,
        nuevas: 0,
        enviado: false,
        ok: true,
        mensaje:
          seccion.pos.length === 0
            ? 'La sección no tiene hallazgos.'
            : 'Todas las POs de esta sección ya se habían reportado a soporte.',
        adjunto: '',
      });
      continue;
    }

    if (colaPendiente.secciones.has(seccion.clave)) {
      resultados.push({
        clave: seccion.clave,
        titulo: seccion.titulo,
        total: seccion.pos.length,
        yaEnviadas,
        nuevas: 0,
        enviado: false,
        ok: true,
        mensaje: 'Esta sección ya está en la cola, esperando la corrida de las 8:00 a. m.',
        adjunto: '',
      });
      continue;
    }

    const incluidas = new Set(nuevas);
    const adjunto = construirAdjuntoSeccion(seccion, resultado, archivo, incluidas, yaEnviadas);
    const cuerpo = construirCuerpoSeccion(seccion, resultado, archivo, nuevas.length, yaEnviadas, config.modo);

    let ok = false;
    let mensaje = '';

    try {
      await insertarEnCola({
        seccion: seccion.clave,
        asunto: cuerpo.asunto,
        html: cuerpo.html,
        texto: cuerpo.texto,
        adjunto,
        pos: nuevas,
      });
      ok = true;
      mensaje = 'En cola: sale en la próxima corrida (lunes a viernes, 8:00 a. m.).';
      correos += 1;
    } catch (err) {
      mensaje = err instanceof Error ? err.message : 'Error desconocido al preparar el correo.';
      huboError = true;
    }

    resultados.push({
      clave: seccion.clave,
      titulo: seccion.titulo,
      total: seccion.pos.length,
      yaEnviadas,
      nuevas: nuevas.length,
      enviado: true,
      ok,
      mensaje,
      adjunto: adjunto.nombre,
    });
  }

  let mensaje: string;
  if (correos === 0) {
    mensaje = huboError
      ? 'No se pudo preparar ningún correo. Revisá el detalle por sección.'
      : 'No hay nada nuevo para reportar: las POs ya están en la cola o ya se enviaron a soporte.';
  } else if (huboError) {
    mensaje = `Se pusieron ${correos} correos en la cola. Algunas secciones fallaron, revisá el detalle.`;
  } else {
    mensaje = `Se pusieron ${correos} correos en la cola con sus adjuntos. Salen solos en la próxima corrida (lunes a viernes, 8:00 a. m. hora Costa Rica).`;
  }

  return {
    ok: !huboError,
    mensaje,
    destinatarios: destino.para,
    copia: destino.cc,
    correos,
    secciones: resultados,
  };
}

export async function cargarEnvios(limite = 10): Promise<EnvioRegistro[]> {
  const { data, error } = await supabase
    .from('control_fechas_envios')
    .select('id, modo, seccion, destinatarios, copia, asunto, adjunto_nombre, total_hallazgos, ok, mensaje, enviado_por, enviado_at')
    .order('enviado_at', { ascending: false })
    .limit(limite);

  if (error) throw error;

  return ((data || []) as unknown as {
    id: string;
    modo: string;
    seccion: string | null;
    destinatarios: string | null;
    copia: string | null;
    asunto: string | null;
    adjunto_nombre: string | null;
    total_hallazgos: number | null;
    ok: boolean;
    mensaje: string | null;
    enviado_por: string | null;
    enviado_at: string;
  }[]).map((fila) => ({
    id: fila.id,
    modo: fila.modo === 'real' ? 'real' : 'prueba',
    seccion: fila.seccion || '—',
    destinatarios: fila.destinatarios || '',
    copia: fila.copia || '',
    asunto: fila.asunto || '',
    adjuntoNombre: fila.adjunto_nombre || '',
    totalHallazgos: Number(fila.total_hallazgos) || 0,
    ok: fila.ok === true,
    mensaje: fila.mensaje || '',
    enviadoPor: fila.enviado_por || '',
    enviadoAt: fila.enviado_at,
  }));
}