import { useMemo, useState } from 'react';
import PanelIndicador, { BadgeIndicador } from '@/pages/home/components/PanelIndicador';
import TarjetaDesglose from '@/pages/home/components/TarjetaDesglose';
import { formatearFechaCorta } from '@/lib/fechas';
import { descargarExcel } from '@/lib/exportar';
import type { ResultadoEta15 } from '@/lib/kpisDropship';

interface KpiLiberadoEta15Props {
  resultado: ResultadoEta15;
  diasAntesEta: number;
}

type FiltroDetalle = 'todas' | 'tarde' | 'tiempo';

export default function KpiLiberadoEta15({ resultado, diasAntesEta }: KpiLiberadoEta15Props) {
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDetalle>('tarde');

  const sinDatos = resultado.total === 0;

  const tono = sinDatos ? 'gray' : resultado.porcentajeTarde === 0 ? 'teal' : resultado.porcentajeTarde <= 20 ? 'amber' : 'red';

  const badge: BadgeIndicador | null = sinDatos
    ? null
    : resultado.tarde > 0
    ? {
        tono: 'alerta',
        texto: `${resultado.tarde} PO${resultado.tarde !== 1 ? 's' : ''} liberada${resultado.tarde !== 1 ? 's' : ''} tarde`,
        subtexto: `Después de ETA − ${diasAntesEta} días`
      }
    : { tono: 'ok', texto: 'Todo en orden', subtexto: `Todas liberadas antes de ETA − ${diasAntesEta}` };

  const filasFiltradas = useMemo(() => {
    if (filtro === 'tarde') return resultado.filas.filter((f) => !f.cumpleMeta);
    if (filtro === 'tiempo') return resultado.filas.filter((f) => f.cumpleMeta);
    return resultado.filas;
  }, [filtro, resultado.filas]);

  const descargar = () => {
    const filas = filasFiltradas.map((f) => ({
      'PO/Tiquetera': f.po_tiquetera,
      'EXP ID': f.exp_id || '-',
      'Solicitante': f.solicitante,
      'Estado': f.estado_expediente,
      'ETA Real': formatearFechaCorta(f.etaReal),
      [`ETA − ${diasAntesEta} días`]: formatearFechaCorta(f.etaLimite),
      'Fecha Liberación': formatearFechaCorta(f.fechaLiberacion),
      'Días de atraso': f.diasAtraso,
      'Resultado': f.cumpleMeta ? `Liberado antes de ETA − ${diasAntesEta}` : `Liberado después de ETA − ${diasAntesEta}`
    }));
    descargarExcel(`reporte-liberado-eta-${diasAntesEta}-${new Date().toISOString().split('T')[0]}.xlsx`, filas);
  };

  return (
    <>
      <PanelIndicador
        icono="ri-alarm-warning-line"
        tono={tono}
        titulo={`Liberado después de ETA − ${diasAntesEta} días`}
        meta={<>POs Dropship que llegaron a <strong>Liberado</strong> después de su ETA Real menos {diasAntesEta} días</>}
        badge={badge}
        accion={{
          texto: 'Ver cuáles son',
          icono: 'ri-list-check-2',
          onClick: () => { setFiltro('tarde'); setDetalleAbierto(true); },
          disabled: sinDatos
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <TarjetaDesglose
            etiqueta={`Liberadas tarde (después de ETA − ${diasAntesEta})`}
            valor={resultado.tarde}
            sufijo="PO"
            valorClass={resultado.tarde > 0 ? 'text-red-600' : 'text-gray-400'}
            barra={{ porcentaje: resultado.porcentajeTarde, colorClass: 'bg-red-500' }}
            footer={`${resultado.porcentajeTarde}% de ${resultado.total} POs evaluadas`}
            resaltado={resultado.tarde > 0}
            onClick={() => { setFiltro('tarde'); setDetalleAbierto(true); }}
          />

          <TarjetaDesglose
            etiqueta={`Liberadas en tiempo (antes de ETA − ${diasAntesEta})`}
            valor={resultado.enTiempo}
            sufijo="PO"
            valorClass="text-teal-600"
            linea={{ icono: 'ri-checkbox-circle-fill', texto: 'Dentro del plazo esperado', colorClass: 'text-teal-700' }}
            footer={`${resultado.total} POs con ETA y liberación registradas`}
          />

          <TarjetaDesglose
            etiqueta="Atraso Promedio"
            valor={resultado.atrasoPromedio}
            sufijo="días"
            valorClass={resultado.atrasoPromedio > 0 ? 'text-amber-600' : 'text-gray-400'}
            linea={{ icono: 'ri-time-line', texto: `Días después de ETA − ${diasAntesEta}`, colorClass: 'text-gray-600' }}
            footer="Solo considera las POs liberadas tarde"
          />

          <TarjetaDesglose
            etiqueta="Sin ETA Real"
            valor={resultado.sinEta}
            sufijo="PO"
            valorClass={resultado.sinEta > 0 ? 'text-amber-600' : 'text-gray-400'}
            linea={{ icono: 'ri-calendar-line', texto: 'No se pueden evaluar', colorClass: resultado.sinEta > 0 ? 'text-amber-700' : 'text-gray-400' }}
            footer="Requieren ETA Real para entrar al indicador"
          />
        </div>
      </PanelIndicador>

      {detalleAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Detalle Liberado después de ETA − {diasAntesEta}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  POs Dropship con fecha de liberación posterior a su ETA Real menos {diasAntesEta} días
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={descargar}
                  disabled={filasFiltradas.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-download-2-line"></i>
                  Descargar Excel
                </button>
                <button
                  onClick={() => setDetalleAbierto(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl text-gray-500"></i>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.total}</p>
                  <p className="text-xs text-gray-500">POs evaluadas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-600">{resultado.enTiempo}</p>
                  <p className="text-xs text-gray-500">En tiempo</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${resultado.tarde > 0 ? 'text-red-600' : 'text-gray-400'}`}>{resultado.tarde}</p>
                  <p className="text-xs text-gray-500">Liberadas tarde</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.atrasoPromedio} días</p>
                  <p className="text-xs text-gray-500">Atraso promedio</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-medium text-gray-600">Filtrar:</span>
              <div className="flex gap-2">
                {(['todas', 'tarde', 'tiempo'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      filtro === f
                        ? f === 'tarde' ? 'bg-red-500 text-white' : f === 'tiempo' ? 'bg-teal-600 text-white' : 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'todas'
                      ? `Todas (${resultado.total})`
                      : f === 'tarde'
                      ? `Liberadas tarde (${resultado.tarde})`
                      : `En tiempo (${resultado.enTiempo})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / Tiquetera</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">EXP ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Solicitante</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">ETA Real</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">ETA − {diasAntesEta}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Liberado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Atraso</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filasFiltradas.map((fila) => (
                    <tr key={fila.id} className={`hover:bg-gray-50 transition-colors ${!fila.cumpleMeta ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{fila.po_tiquetera}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fila.exp_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fila.solicitante || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatearFechaCorta(fila.etaReal)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatearFechaCorta(fila.etaLimite)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatearFechaCorta(fila.fechaLiberacion)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${fila.cumpleMeta ? 'text-teal-700' : 'text-red-600'}`}>
                          {fila.cumpleMeta ? '—' : `${fila.diasAtraso} d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {fila.cumpleMeta ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full whitespace-nowrap">
                            <i className="ri-checkbox-circle-fill"></i> En tiempo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full whitespace-nowrap">
                            <i className="ri-alarm-warning-fill"></i> Tarde
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                        <i className="ri-inbox-line text-4xl mb-2"></i>
                        <p className="text-sm">No hay POs para mostrar</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}