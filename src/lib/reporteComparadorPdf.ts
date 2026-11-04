import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Estado, ResultadoComparacion } from '@/lib/comparadorDocumentos';
import { formatearMonto, formatearNumero } from '@/lib/comparadorDocumentos';

// ============================================================
// REPORTE EN PDF DEL COMPARADOR DE DOCUMENTOS
// Genera un PDF con el resumen, cada hallazgo y la comparación
// completa, pensado para enviárselo al proveedor.
// ============================================================

export interface ReportePdfParams {
  resultado: ResultadoComparacion;
  factura: string;
  po: string;
  proveedor?: string;
  mensaje?: string;
  nombreArchivo?: string;
  /** Máximo de filas de la comparación completa dentro del PDF. */
  limiteDetalle?: number;
}

const TEAL: [number, number, number] = [13, 148, 136];
const GRIS: [number, number, number] = [71, 85, 105];
const MARGEN = 40;

const NOMBRE_ESTADO: Record<Estado, string> = {
  soloA: 'Solo en factura',
  soloB: 'Solo en PO',
  qty: 'Bultos distintos',
  uni: 'Unidad distinta',
  pre: 'Precio distinto',
};

const textoEstado = (fila: { estados: Estado[] }) =>
  fila.estados.length ? fila.estados.map((estado) => NOMBRE_ESTADO[estado]).join(', ') : 'OK';

const finalY = (doc: jsPDF, respaldo: number): number =>
  ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? respaldo) + 16;

function limpiarNombre(valor: string): string {
  return valor
    .replace(/\.(xlsx|xls|csv|pdf)$/i, '')
    .replace(/[^\w\-. ]/g, '')
    .trim();
}

/** Nombre del archivo PDF que se descarga. */
export function nombreReportePdf(params: ReportePdfParams): string {
  const base = limpiarNombre(params.nombreArchivo || params.factura || 'comparacion') || 'comparacion';
  return `${base.replace(/\.[^.]+$/, '')}-comparacion.pdf`;
}

/** Construye el documento PDF completo. */
export function construirReportePdf(params: ReportePdfParams): jsPDF {
  const { resultado, factura, po, proveedor, mensaje, limiteDetalle = 600 } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const contenido = ancho - MARGEN * 2;
  const fecha = new Date().toLocaleString('es-CR');
  let y = MARGEN;

  // ---- Encabezado ----
  doc.setFillColor(240, 253, 250);
  doc.rect(MARGEN, y, contenido, 78, 'F');
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(MARGEN, y, 4, 78, 'F');

  doc.setTextColor(15, 118, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Comparación de factura vs PO', MARGEN + 16, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
  doc.text(`Factura de proveedor: ${factura || '—'}`, MARGEN + 16, y + 42);
  doc.text(`PO de Siglo: ${po || '—'}`, MARGEN + 16, y + 55);
  doc.text(`Generado: ${fecha}`, MARGEN + 16, y + 68);
  if (proveedor) {
    doc.text(`Proveedor: ${proveedor}`, MARGEN + contenido - 8, y + 42, { align: 'right' });
  }
  y += 94;

  // ---- Mensaje al proveedor ----
  if (mensaje && mensaje.trim()) {
    const lineas = doc.splitTextToSize(mensaje.trim(), contenido - 20) as string[];
    const altura = lineas.length * 11 + 18;
    doc.setFillColor(248, 250, 252);
    doc.rect(MARGEN, y, contenido, altura, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    doc.text(lineas, MARGEN + 10, y + 14);
    y += altura + 14;
  }

  // ---- Resumen ----
  const resumen: (string | number)[][] = [
    ['Referencias en la factura de proveedor', resultado.refsA],
    ['Referencias en el PO de Siglo', resultado.refsB],
    ['Referencias en ambos documentos', resultado.conteo.ambos],
    ['Solo en la factura de proveedor', resultado.conteo.soloA],
    ['Solo en el PO de Siglo', resultado.conteo.soloB],
    ['Referencias con diferencias', resultado.conteo.dif],
    ['Referencias sin diferencias', resultado.conteo.ok],
    ['Bultos distintos', resultado.conteo.qty],
    ['Unidad distinta', resultado.conteo.uni],
    ['Precio unitario distinto', resultado.conteo.pre],
    ['Referencias repetidas', resultado.conteo.rep],
  ];
  if (resultado.comparaCantidad && resultado.comparaPrecio) {
    resumen.push(['Total factura de proveedor', formatearMonto(resultado.totalA)]);
    resumen.push(['Total PO de Siglo', formatearMonto(resultado.totalB)]);
    resumen.push(['Diferencia de monto (PO − factura)', formatearMonto(resultado.totalB - resultado.totalA)]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Resumen', 'Valor']],
    body: resumen,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: { fillColor: TEAL, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: MARGEN, right: MARGEN },
  });
  y = finalY(doc, y);

  // ---- Hallazgos por sección ----
  if (resultado.secciones.length) {
    if (y > alto - 120) {
      doc.addPage();
      y = MARGEN;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Hallazgos', MARGEN, y);
    y += 16;

    resultado.secciones.forEach((seccion) => {
      if (y > alto - 120) {
        doc.addPage();
        y = MARGEN;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 118, 110);
      const titulo = doc.splitTextToSize(seccion.titulo, contenido) as string[];
      doc.text(titulo, MARGEN, y);
      y += titulo.length * 11 + 6;

      autoTable(doc, {
        startY: y,
        head: [seccion.encabezados],
        body: seccion.filas.map((fila) => fila.map((valor) => String(valor ?? ''))),
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 3, textColor: [30, 41, 59], overflow: 'linebreak' },
        headStyles: { fillColor: [226, 232, 240], textColor: [30, 41, 59], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: MARGEN, right: MARGEN },
      });
      y = finalY(doc, y);
    });
  }

  // ---- Comparación completa ----
  if (resultado.filas.length) {
    doc.addPage();
    y = MARGEN;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Comparación completa', MARGEN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    const nota = resultado.filas.length > limiteDetalle
      ? `Se muestran las primeras ${limiteDetalle} de ${resultado.filas.length} referencias. El detalle completo está en el Excel.`
      : `${resultado.filas.length} referencias comparadas.`;
    doc.text(nota, MARGEN, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      head: [[
        'Referencia', 'Descripción', 'Estado', 'Bultos F', 'Bultos PO',
        'Precio F', 'Precio PO', 'Monto F', 'Monto PO', 'Dif. monto',
      ]],
      body: resultado.filas.slice(0, limiteDetalle).map((fila) => [
        fila.ref,
        fila.descripcion,
        textoEstado(fila) + (fila.na > 1 || fila.nb > 1 ? ' (repetida)' : ''),
        formatearNumero(fila.qa),
        formatearNumero(fila.qb),
        formatearMonto(fila.pa),
        formatearMonto(fila.pb),
        formatearMonto(fila.ma),
        formatearMonto(fila.mb),
        isNaN(fila.ma) || isNaN(fila.mb) ? '' : formatearMonto(fila.mb - fila.ma),
      ]),
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 2.5, overflow: 'linebreak', textColor: [30, 41, 59] },
      headStyles: { fillColor: TEAL, textColor: 255, fontStyle: 'bold', fontSize: 6.2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 58 },
        1: { cellWidth: 130 },
        2: { cellWidth: 62 },
        3: { cellWidth: 40, halign: 'right' },
        4: { cellWidth: 40, halign: 'right' },
        5: { cellWidth: 44, halign: 'right' },
        6: { cellWidth: 44, halign: 'right' },
        7: { cellWidth: 48, halign: 'right' },
        8: { cellWidth: 48, halign: 'right' },
        9: { cellWidth: 46, halign: 'right' },
      },
      margin: { left: MARGEN, right: MARGEN },
    });
  }

  // ---- Pie de página ----
  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Comparador de Documentos · Gestión de Comercio Exterior', MARGEN, alto - 22);
    doc.text(`Página ${pagina} de ${total}`, ancho - MARGEN, alto - 22, { align: 'right' });
  }

  return doc;
}

/** Genera y descarga el PDF del reporte. */
export function descargarReportePdf(params: ReportePdfParams): string {
  const doc = construirReportePdf(params);
  const nombre = nombreReportePdf(params);
  doc.save(nombre);
  return nombre;
}

/** Asunto y cuerpo listos para el correo al proveedor. */
export function textoCorreoProveedor(params: ReportePdfParams): { asunto: string; cuerpo: string } {
  const { resultado, factura, proveedor } = params;
  const asunto = `Diferencias entre su factura y nuestro pedido${proveedor ? ` · ${proveedor}` : ''}`;
  const lineas: string[] = [];
  lineas.push('Buen día,');
  lineas.push('');
  if (params.mensaje && params.mensaje.trim()) {
    lineas.push(params.mensaje.trim());
    lineas.push('');
  }
  lineas.push(`Adjuntamos el detalle de la comparación de la factura${factura ? ` «${factura}»` : ''} contra nuestro pedido.`);
  lineas.push('');
  lineas.push('Resumen:');
  lineas.push(`- Referencias en su factura: ${resultado.refsA}`);
  lineas.push(`- Referencias en nuestro pedido: ${resultado.refsB}`);
  if (resultado.conteo.soloA) lineas.push(`- Solo en su factura: ${resultado.conteo.soloA}`);
  if (resultado.conteo.soloB) lineas.push(`- Solo en nuestro pedido: ${resultado.conteo.soloB}`);
  if (resultado.conteo.qty) lineas.push(`- Con bultos distintos: ${resultado.conteo.qty}`);
  if (resultado.conteo.uni) lineas.push(`- Con unidad distinta: ${resultado.conteo.uni}`);
  if (resultado.conteo.pre) lineas.push(`- Con precio unitario distinto: ${resultado.conteo.pre}`);
  if (resultado.comparaCantidad && resultado.comparaPrecio) {
    lineas.push(`- Diferencia de monto (nuestro pedido − su factura): ${formatearMonto(resultado.totalB - resultado.totalA)}`);
  }
  lineas.push('');
  lineas.push('Quedamos atentos a su confirmación.');
  lineas.push('');
  lineas.push('Saludos,');
  return { asunto, cuerpo: lineas.join('\n') };
}