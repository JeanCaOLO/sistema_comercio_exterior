import {
  PAISES_INFO,
  formatearEntero,
  formatearPct,
  type AnalisisAsignacion,
  type MetaCarga,
} from '@/lib/agenteCarga';
import { descargarExcel } from '@/lib/exportar';

interface TablaAsignacionProps {
  analisis: AnalisisAsignacion;
  periodo: string;
  meta: MetaCarga | null;
  sinAsignar: number;
  incluirSinAsignar: boolean;
  onToggleSinAsignar: () => void;
  onVerDetalle: (proveedorServicio: string, pais: string | null) => void;
  onCargarExcel: () => void;
}

export default function TablaAsignacion({
  analisis,
  periodo,
  meta,
  sinAsignar,
  incluirSinAsignar,
  onToggleSinAsignar,
  onVerDetalle,
  onCargarExcel,
}: TablaAsignacionProps) {
  const { columnas, filas, totalPorPais, pctPorPais, total } = analisis;

  const exportarTabla = () => {
    const filasExcel = filas.map((fila) => {
      const registro: Record<string, unknown> = { 'Proveedor de Servicio': fila.proveedorServicio };
      columnas.forEach((pais) => {
        registro[PAISES_INFO[pais]?.abbr || pais] = fila.porPais[pais] || 0;
      });
      registro.Total = fila.total;
      return registro;
    });

    const filaTotal: Record<string, unknown> = { 'Proveedor de Servicio': 'Total' };
    const filaPct: Record<string, unknown> = { 'Proveedor de Servicio': '% del total' };
    columnas.forEach((pais) => {
      const abbr = PAISES_INFO[pais]?.abbr || pais;
      filaTotal[abbr] = totalPorPais[pais] || 0;
      filaPct[abbr] = formatearPct(pctPorPais[pais] || 0);
    });
    filaTotal.Total = total;
    filaPct.Total = '100,0%';

    descargarExcel(`Asignacion-Carga-${periodo.replace(/\s+/g, '-')}.xlsx`, [...filasExcel, filaTotal, filaPct]);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900">
            Asignación de carga – {periodo}
          </h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            N° de PO por Proveedor de Servicio y País Destino (sin datos de TEUs en el origen).
            {' '}
            {columnas.map((pais) => `${PAISES_INFO[pais]?.abbr || pais}=${PAISES_INFO[pais]?.nombre || pais}`).join(', ')}
          </p>
          {meta && (
            <p className="text-[11px] text-gray-400 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <i className="ri-file-excel-2-line"></i>{meta.archivo}
              </span>
              <span className="text-gray-300">·</span>
              <span>Cargado el {new Date(meta.cargadoAt).toLocaleString('es-CR')}</span>
              {meta.cargadoPor && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>{meta.cargadoPor}</span>
                </>
              )}
            </p>
          )}
          {sinAsignar > 0 && (
            <button
              type="button"
              onClick={onToggleSinAsignar}
              className="mt-2.5 inline-flex items-center gap-2 text-[11px] font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${incluirSinAsignar ? 'bg-teal-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${incluirSinAsignar ? 'left-4' : 'left-0.5'}`}></span>
              </span>
              {incluirSinAsignar ? 'Incluyendo' : 'Excluyendo'} {formatearEntero(sinAsignar)} POs sin proveedor asignado
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={exportarTabla}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-download-2-line mr-1"></i>Excel
          </button>
          <button
            onClick={() => onVerDetalle('', null)}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-list-check-2 mr-1"></i>Ver POs
          </button>
          <button
            onClick={onCargarExcel}
            className="px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-upload-2-line mr-1"></i>Actualizar Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-teal-800 text-white">
              <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Proveedor de Servicio</th>
              {columnas.map((pais) => (
                <th
                  key={pais}
                  title={PAISES_INFO[pais]?.nombre || pais}
                  className="text-center font-semibold px-3 py-3 w-20 whitespace-nowrap"
                >
                  {PAISES_INFO[pais]?.abbr || pais}
                </th>
              ))}
              <th className="text-center font-semibold px-4 py-3 w-24 whitespace-nowrap bg-teal-900/40">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, index) => (
              <tr
                key={fila.proveedorServicio}
                className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'} hover:bg-teal-50/50 transition-colors`}
              >
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => onVerDetalle(fila.proveedorServicio, null)}
                    className="text-left text-gray-800 font-medium hover:text-teal-700 transition-colors cursor-pointer truncate max-w-[320px]"
                    title={`Ver las ${fila.total} POs de ${fila.proveedorServicio}`}
                  >
                    {fila.proveedorServicio}
                  </button>
                </td>
                {columnas.map((pais) => {
                  const cantidad = fila.porPais[pais] || 0;
                  return (
                    <td key={pais} className="text-center px-3 py-2.5">
                      {cantidad > 0 ? (
                        <button
                          onClick={() => onVerDetalle(fila.proveedorServicio, pais)}
                          className="min-w-[34px] px-2 py-0.5 rounded text-gray-800 font-semibold hover:bg-teal-100 hover:text-teal-800 transition-colors cursor-pointer"
                          title={`Ver POs de ${fila.proveedorServicio} en ${PAISES_INFO[pais]?.nombre || pais}`}
                        >
                          {cantidad}
                        </button>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-center px-4 py-2.5 bg-teal-50/60 font-semibold text-gray-900">
                  {fila.total}
                </td>
              </tr>
            ))}

            <tr className="bg-teal-50 border-t-2 border-teal-200">
              <td className="px-4 py-2.5 font-bold text-gray-900">Total</td>
              {columnas.map((pais) => (
                <td key={pais} className="text-center px-3 py-2.5 font-bold text-gray-900">
                  {totalPorPais[pais] || 0}
                </td>
              ))}
              <td className="text-center px-4 py-2.5 font-bold text-teal-800 bg-teal-100/70">{total}</td>
            </tr>

            <tr className="bg-gray-50">
              <td className="px-4 py-2.5 font-semibold text-teal-800">% del total</td>
              {columnas.map((pais) => (
                <td key={pais} className="text-center px-3 py-2.5 font-semibold text-teal-800 whitespace-nowrap">
                  {formatearPct(pctPorPais[pais] || 0)}
                </td>
              ))}
              <td className="text-center px-4 py-2.5 font-semibold text-teal-800 bg-teal-50">100,0%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white">
        <p className="text-[11px] text-gray-500 italic">
          Control: PO en hoja Data
        </p>
        <p className="text-sm font-semibold text-gray-700">{formatearEntero(total)}</p>
      </div>
    </div>
  );
}