import { esFactura, esPackingList, parseDocEntries } from '@/lib/documentos';

/**
 * Set de columnas compartido entre el módulo de Documentación y el
 * Repositorio de Documentación. Sirve para que ambas tablas muestren
 * exactamente los mismos campos (homologación de la vista).
 *
 * Orden: FACT · BL · PL · CONT · TC · TLC
 */

interface PropsDocumentos {
  doc: unknown;
  blCargado?: boolean | null;
  packingListCargado?: boolean | null;
  numeroContenedor?: string | null;
  transitoCorto?: boolean | null;
  aplicaTlc?: boolean | null;
}

const Celda = ({
  activo,
  etiqueta,
  clases,
}: {
  activo: boolean;
  etiqueta: string;
  clases: string;
}) => (
  <td className="px-3 py-3 text-center whitespace-nowrap">
    {activo ? (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${clases}`}>
        {etiqueta}
      </span>
    ) : (
      <span className="text-xs text-gray-300">—</span>
    )}
  </td>
);

export function EncabezadosDocumentos() {
  const clase = 'px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap';
  return (
    <>
      <th className={clase}>Fact</th>
      <th className={clase}>BL</th>
      <th className={clase}>PL</th>
      <th className={clase}>Cont</th>
      <th className={clase}>TC</th>
      <th className={clase}>TLC</th>
    </>
  );
}

export function CeldasDocumentos({
  doc,
  blCargado,
  packingListCargado,
  numeroContenedor,
  transitoCorto,
  aplicaTlc,
}: PropsDocumentos) {
  const entradas = parseDocEntries(doc);
  const tieneFactura = entradas.some(esFactura);
  const tienePackingList = packingListCargado === true || entradas.some(esPackingList);
  const tieneContenedor = !!numeroContenedor && String(numeroContenedor).trim() !== '';

  return (
    <>
      <Celda activo={tieneFactura} etiqueta="FACT" clases="bg-rose-100 text-rose-700" />
      <Celda activo={blCargado === true} etiqueta="BL" clases="bg-blue-100 text-blue-700" />
      <Celda activo={tienePackingList} etiqueta="PL" clases="bg-teal-100 text-teal-700" />
      <Celda activo={tieneContenedor} etiqueta="CONT" clases="bg-cyan-100 text-cyan-700" />
      <Celda activo={transitoCorto === true} etiqueta="TC" clases="bg-amber-100 text-amber-700" />
      <Celda activo={aplicaTlc === true} etiqueta="TLC" clases="bg-green-100 text-green-700" />
    </>
  );
}

export const TOTAL_COLUMNAS_DOCUMENTOS = 6;

interface RequisitosProps {
  doc: unknown;
  blCargado?: boolean | null;
  packingListCargado?: boolean | null;
  numeroContenedor?: string | null;
}

/**
 * Cuenta los requisitos documentales de una PO:
 * factura · BL · packing list · contenedor
 */
export function calcularRequisitos({
  doc,
  blCargado,
  packingListCargado,
  numeroContenedor,
}: RequisitosProps) {
  const entradas = parseDocEntries(doc);
  const factura = entradas.some(esFactura);
  const bl = blCargado === true;
  const packingList = packingListCargado === true || entradas.some(esPackingList);
  const contenedor = !!numeroContenedor && String(numeroContenedor).trim() !== '';
  const lista = [factura, bl, packingList, contenedor];
  const completos = lista.filter(Boolean).length;
  return { factura, bl, packingList, contenedor, completos, total: lista.length };
}

interface SelloProps extends RequisitosProps {
  compacto?: boolean;
}

/**
 * Sello "4/4": muestra de un vistazo cuántos requisitos documentales tiene la PO.
 * Verde = 4/4 completo · ámbar = parcial · gris = sin documentos.
 */
export function SelloDocumentos({ compacto = false, ...props }: SelloProps) {
  const { completos, total } = calcularRequisitos(props);
  const completo = completos === total;
  const vacio = completos === 0;

  const clases = completo
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : vacio
    ? 'bg-gray-100 text-gray-500 border-gray-200'
    : 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold whitespace-nowrap ${clases} ${
        compacto ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      }`}
      title={`Documentación completa: ${completos} de ${total} requisitos (factura, BL, packing list, contenedor)`}
    >
      {completo && <i className="ri-checkbox-circle-fill text-[10px]"></i>}
      {completos}/{total}
    </span>
  );
}