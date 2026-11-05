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

// Genera un archivo Excel con varias pestañas. Cada pestaña recibe su nombre y sus filas.
export const descargarExcelHojas = (
  nombreArchivo: string,
  hojas: { nombre: string; filas: Record<string, unknown>[] }[]
) => {
  const hojasValidas = hojas.filter((hoja) => hoja.filas && hoja.filas.length > 0);
  if (hojasValidas.length === 0) return;

  const libro = XLSX.utils.book_new();
  hojasValidas.forEach((hoja) => {
    const worksheet = XLSX.utils.json_to_sheet(hoja.filas);
    XLSX.utils.book_append_sheet(libro, worksheet, hoja.nombre.slice(0, 31));
  });
  XLSX.writeFile(libro, nombreArchivo);
};