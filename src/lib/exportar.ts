import * as XLSX from 'xlsx';

// Genera y descarga un archivo Excel (.xlsx) real a partir de una lista de objetos.
// Cada objeto representa una fila; las claves se usan como encabezados de columna.
export const descargarExcel = (nombreArchivo: string, filas: Record<string, unknown>[]) => {
  if (!filas || filas.length === 0) return;

  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Reporte');
  XLSX.writeFile(libro, nombreArchivo);
};