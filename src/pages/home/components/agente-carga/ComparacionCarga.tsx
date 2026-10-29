import { useMemo, useState } from 'react';
import { PAISES_INFO, formatearEntero, type AnalisisComparativo } from '@/lib/agenteCarga';
import { descargarExcel } from '@/lib/exportar';

interface ComparacionCargaProps {
  comparativo: AnalisisComparativo;
  periodoActual: string;
  onVerDetalle: (proveedorServicio: string, pais: string | null) => void;
}

function conSigno(valor: number): string {
  if (valor === 0) return '0';
  return valor > 0 ? `+${valor}` : `−${Math.abs(valor)}`;
}

function colorDelta(valor: number): string {
  if (valor === 0) return 'text-gray-400';
  return valor > 0 ? 'text-emerald-600' : 'text-amber-600';
}

export default function ComparacionCarga({ comparativo, periodoActual, onVerDetalle }: ComparacionCargaProps) {
  const [soloCambios, setSoloCambios] = useState(true);

  const visibles = useMemo(
    () => (soloCambios ? comparativo.filas.filter((f) => f.cambioAbsoluto > 0) : comparativo.filas),
    [comparativo.filas, soloCambios]
  );

  const resumen = [
    {
      titulo: 'Variación total de POs',
      valor: conSigno(comparativo.deltaTotal),
      detalle: `${formatearEntero(comparativo.totalActual)} ahora · ${formatearEntero(comparativo.totalAnterior)} antes`,
      icono: comparativo.deltaTotal >= 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line',
      clase: comparativo.deltaTotal === 0 ? 'bg-gray-100 text-gray-600' : comparativo.deltaTotal > 0
        ? 'bg-emerald-50 text-emerald-600'
        : 'bg-amber-50 text-amber-600',
      color: comparativo.deltaTotal === 0 ? 'text-gray-900' : comparativo.deltaTotal > 0
        ? 'text-emerald-700'
        : 'text-amber-700',
    },
    {
      titulo: 'Proveedores con movimiento',
      valor: formatearEntero(comparativo.proveedoresConCambio),
      detalle: `de ${formatearEntero(comparativo.filas.length)} proveedores`,
      icono: 'ri-swap-line',
      clase: 'bg-teal-50 text-teal-600',
      color: 'text-gray-900',
    },
    {
      titulo: 'Altas y bajas',
      valor: `${comparativo.proveedoresNuevos} / ${comparativo.proveedoresRemovidos}`,
      detalle: 'proveedores nuevos / que salieron',
      icono: 'ri-user-add-line',
      clase: 'bg-gray-100 text-gray-600',
      color: 'text-gray-900',
    },
    {
      titulo: 'Países con cambios',
      valor: formatearEntero(comparativo.paisesConCambio),
      detalle: `de ${formatearEntero(comparativo.columnas.length)} países con carga`,
      icono: 'ri-earth-line',
      clase: 'bg-amber-50 text-amber-600',
      color: 'text-gray-900',
    },
  ];

  const exportar = () => {
    const filasExcel = visibles.map((fila) => {
      const registro: Record<string, unknown> = { 'Proveedor de Servicio': fila.proveedorServicio };
      comparativo.columnas.forEach((pais) => {
        const abbr = PAISES_INFO[pais]?.abbr || pais;
        registro[abbr] = fila.actualPorPais[pais] || 0;
        registro[`Δ ${abbr}`] = fila.deltaPorPais[pais] ?? 0;
      });
      registro['Total actual'] = fila.actualTotal;
      registro['Total anterior'] = fila.anteriorTotal;
      registro['Δ Total'] = fila.deltaTotal;
      registro.Situacion = fila.esNuevo ? 'Nuevo' : fila.esRemovido ? 'Salió' : fila.cambioAbsoluto > 0 ? 'Movimiento' : 'Sin cambios';
      return registro;
    });

    descargarExcel(
      `Comparacion-Carga-${periodoActual.replace(/\s+/g, '-')}.xlsx`,
      filasExcel
    );
  };

  if (!comparativo.tieneAnterior) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 flex-shrink-0">
            <i className="ri-arrow-left-right-line text-lg"></i>
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Comparación con la carga anterior</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              Todavía no hay una carga previa guardada para comparar. En cuanto subas el próximo Excel, acá vas a ver
              cómo se movió cada proveedor de servicio entre países respecto a esta carga.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
              <i className="ri-arrow-left-right-line"></i>
            </span>
            <h3 className="text-base font-bold text-gray-900">Comparación con la carga anterior</h3>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed max-w-2xl">
            Movimiento de cada Proveedor de Servicio entre países respecto a la carga anterior
            {comparativo.metaAnterior ? (
              <>
                {' '}(<span className="font-medium text-gray-700">{comparativo.metaAnterior.archivo}</span> del{' '}
                {new Date(comparativo.metaAnterior.cargadoAt).toLocaleDateString('es-CR')}).
              </>
            ) : (
              '.'
            )}
            {' '}El número es la carga actual y la etiqueta de color es la diferencia.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={() => setSoloCambios((v) => !v)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
              soloCambios
                ? 'border-teal-300 bg-teal-50 text-teal-800'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <i className={`${soloCambios ? 'ri-filter-line' : 'ri-filter-off-line'} mr-1`}></i>
            {soloCambios ? 'Solo con cambios' : 'Todos los proveedores'}
          </button>
          <button
            onClick={exportar}
            disabled={visibles.length === 0}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line mr-1"></i>Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 px-5 py-4 bg-gray-50/60 border-b border-gray-100">
        {resumen.map((item) => (
          <div key={item.titulo} className="flex items-start gap-2.5 min-w-0">
            <span className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${item.clase}`}>
              <i className={`${item.icono} text-sm`}></i>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 truncate">{item.titulo}</p>
              <p className={`text-xl font-bold leading-tight ${item.color}`}>{item.valor}</p>
              <p className="text-[11px] text-gray-500 leading-snug truncate" title={item.detalle}>{item.detalle}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Proveedor de Servicio</th>
              {comparativo.columnas.map((pais) => (
                <th
                  key={pais}
                  title={PAISES_INFO[pais]?.nombre || pais}
                  className="text-center font-semibold px-3 py-2.5 w-24 whitespace-nowrap"
                >
                  {PAISES_INFO[pais]?.abbr || pais}
                </th>
              ))}
              <th className="text-center font-semibold px-4 py-2.5 w-28 whitespace-nowrap">Total</th>
              <th className="text-center font-semibold px-4 py-2.5 w-28 whitespace-nowrap">Situación</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila, index) => (
              <tr
                key={fila.proveedorServicio}
                className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'} hover:bg-teal-50/40 transition-colors`}
              >
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => onVerDetalle(fila.proveedorServicio, null)}
                    disabled={fila.actualTotal === 0}
                    className="text-left text-gray-800 font-medium hover:text-teal-700 transition-colors cursor-pointer truncate max-w-[300px] disabled:text-gray-400 disabled:cursor-default"
                    title={`Ver las ${fila.actualTotal} POs actuales de ${fila.proveedorServicio}`}
                  >
                    {fila.proveedorServicio}
                  </button>
                </td>

                {comparativo.columnas.map((pais) => {
                  const actual = fila.actualPorPais[pais] || 0;
                  const antes = fila.anteriorPorPais[pais] || 0;
                  const delta = fila.deltaPorPais[pais] ?? 0;
                  if (actual === 0 && antes === 0) {
                    return (
                      <td key={pais} className="text-center px-3 py-2.5 text-gray-300">-</td>
                    );
                  }
                  return (
                    <td key={pais} className="text-center px-3 py-2.5">
                      <div className="flex flex-col items-center leading-none gap-1">
                        <span className={`font-semibold ${actual > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                          {actual}
                        </span>
                        {delta !== 0 && (
                          <span
                            className={`text-[10px] font-semibold ${colorDelta(delta)}`}
                            title={`Antes ${antes} · ahora ${actual}`}
                          >
                            {conSigno(delta)}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}

                <td className="text-center px-4 py-2.5 bg-teal-50/50">
                  <div className="flex flex-col items-center leading-none gap-1">
                    <span className="font-bold text-gray-900">{fila.actualTotal}</span>
                    {fila.deltaTotal !== 0 && (
                      <span className={`text-[10px] font-semibold ${colorDelta(fila.deltaTotal)}`}>
                        {conSigno(fila.deltaTotal)}
                      </span>
                    )}
                  </div>
                </td>

                <td className="text-center px-4 py-2.5">
                  {fila.esNuevo ? (
                    <span className="inline-flex items-center rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-1.5 py-0.5 whitespace-nowrap">
                      Nuevo
                    </span>
                  ) : fila.esRemovido ? (
                    <span className="inline-flex items-center rounded bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 whitespace-nowrap">
                      Salió
                    </span>
                  ) : fila.cambioAbsoluto > 0 ? (
                    <span className="inline-flex items-center rounded bg-teal-100 text-teal-800 text-[10px] font-semibold px-1.5 py-0.5 whitespace-nowrap">
                      Movimiento
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded bg-gray-100 text-gray-600 text-[10px] font-semibold px-1.5 py-0.5 whitespace-nowrap">
                      Sin cambios
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {visibles.length === 0 && (
              <tr>
                <td colSpan={comparativo.columnas.length + 3} className="px-4 py-12 text-center text-gray-400">
                  <i className="ri-checkbox-circle-line text-3xl mb-2 block text-teal-500"></i>
                  Ningún proveedor se movió entre países respecto a la carga anterior.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td className="px-4 py-2.5 font-bold text-gray-900">Total</td>
              {comparativo.columnas.map((pais) => {
                const actual = comparativo.filas.reduce((acc, f) => acc + (f.actualPorPais[pais] || 0), 0);
                const antes = comparativo.filas.reduce((acc, f) => acc + (f.anteriorPorPais[pais] || 0), 0);
                const delta = actual - antes;
                return (
                  <td key={pais} className="text-center px-3 py-2.5">
                    <div className="flex flex-col items-center leading-none gap-1">
                      <span className="font-bold text-gray-900">{actual}</span>
                      {delta !== 0 && (
                        <span className={`text-[10px] font-semibold ${colorDelta(delta)}`}>{conSigno(delta)}</span>
                      )}
                    </div>
                  </td>
                );
              })}
              <td className="text-center px-4 py-2.5 bg-teal-100/60">
                <div className="flex flex-col items-center leading-none gap-1">
                  <span className="font-bold text-teal-900">{comparativo.totalActual}</span>
                  {comparativo.deltaTotal !== 0 && (
                    <span className={`text-[10px] font-semibold ${colorDelta(comparativo.deltaTotal)}`}>
                      {conSigno(comparativo.deltaTotal)}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white">
        <p className="text-[11px] text-gray-500 italic">
          El número superior es la carga actual; el valor en color es la diferencia contra la carga anterior.
        </p>
        <p className="text-[11px] text-gray-500 whitespace-nowrap">
          {formatearEntero(comparativo.totalAnterior)} → {formatearEntero(comparativo.totalActual)} POs
        </p>
      </div>
    </div>
  );
}