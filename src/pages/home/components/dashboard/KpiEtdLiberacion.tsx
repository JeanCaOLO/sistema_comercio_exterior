// KPI · Liberado dentro de ETD + 3 días hábiles (solo Dropship).

import { useMemo, useState } from 'react';
import PanelIndicador, { BadgeIndicador } from '@/pages/home/components/PanelIndicador';
import TarjetaDesglose from '@/pages/home/components/TarjetaDesglose';
import { formatearFechaCorta } from '@/lib/fechas';
import { descargarExcel } from '@/lib/exportar';
import type { ResultadoEtdLiberacion } from '@/lib/kpisDropship';

interface Props {
  resultado: ResultadoEtdLiberacion;
  metaDias: number;
}

type FiltroDetalle = 'todas' | 'cumplen' | 'fuera';

export default function KpiEtdLiberacion({ resultado, metaDias }: Props) {
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDetalle>('todas');

  const sinDatos = resultado.total === 0;

  const tono = sinDatos
    ? 'gray'
    : resultado.porcentaje >= 80
      ? 'teal'
      : resultado.porcentaje >= 50
        ? 'amber'
        : 'red';

  const colorPct =
    tono === 'teal'
      ? 'text-teal-600'
      : tono === 'amber'
        ? 'text-amber-600'
        : tono === 'gray'
          ? 'text-gray-400'
          : 'text-red-600';

  const colorBarra =
    tono === 'teal' ? 'bg-teal-500' : tono === 'amber' ? 'bg-amber-500' : 'bg-red-500';

  const badge: BadgeIndicador | null = sinDatos
    ? null
    : resultado.noCumplen > 0
      ? {
          tono: 'alerta',
          texto: `${resultado.noCumplen} PO${resultado.noCumplen !== 1 ? 's' : ''} liberada${resultado.noCumplen !== 1 ? 's' : ''} tarde`,
          subtexto: `Debían liberarse dentro de ETD + ${metaDias} días hábiles`
        }
      : { tono: 'ok', texto: 'Todo en orden', subtexto: `100% dentro de ETD + ${metaDias} días` };

  const filasFiltradas = useMemo(() => {
    if (filtro === 'cumplen') return resultado.filas.filter((f) => f.cumpleMeta);
    if (filtro === 'fuera') return resultado.filas.filter((f) => !f.cumpleMeta);
    return resultado.filas;
  }, [filtro, resultado.filas]);

  const descargar = () => {
    const filas = filasFiltradas.map((f) => ({
      'PO/Tiquetera': f.po_tiquetera,
      'EXP ID': f.exp_id || '-',
      Solicitante: f.solicitante || '—',
      Estado: f.estado_expediente,
      ETD: formatearFechaCorta(f.etd),
      [`Fecha límite (ETD + ${metaDias} hábiles)`]: formatearFechaCorta(f.fechaLimite),
      'Liberado': formatearFechaCorta(f.fechaLiberacion),
      'Días hábiles (ETD → Liberado)': f.dias,
      'Días excedidos': f.diasExcedidos,
      [`Cumple meta (≤ ${metaDias} días)`]: f.cumpleMeta ? 'Sí' : 'No'
    }));

    descargarExcel(
      `reporte-etd-liberado-${new Date().toISOString().split('T')[0]}.xlsx`,
      filas
    );
  };

  const abrirConFiltro = (nuevo: FiltroDetalle) => {
    setFiltro(nuevo);
    setDetalleAbierto(true);
  };

  return (
    <>
      <PanelIndicador
        icono="ri-ship-line"
        tono={tono}
        titulo={`Liberado dentro de ETD + ${metaDias} días hábiles`}
        meta={
          <>
            Cada PO Dropship debe llegar al estado <strong>Liberado</strong> a más tardar{' '}
            <strong>{metaDias} días hábiles después de su ETD</strong>. Si se libera el mismo día
            del ETD o antes, cumple.
          </>
        }
        badge={badge}
        accion={{
          texto: 'Ver detalle de POs',
          icono: 'ri-file-chart-line',
          onClick: () => setDetalleAbierto(true),
          disabled: sinDatos
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <TarjetaDesglose
            etiqueta="Cumplimiento del Plazo"
            valor={sinDatos ? '—' : resultado.porcentaje}
            sufijo={sinDatos ? undefined : '%'}
            valorClass={colorPct}
            barra={sinDatos ? null : { porcentaje: resultado.porcentaje, colorClass: colorBarra }}
            footer={`${resultado.total} PO${resultado.total !== 1 ? 's' : ''} evaluadas`}
          />

          <TarjetaDesglose
            etiqueta="Liberadas a Tiempo"
            valor={resultado.cumplen}
            sufijo="PO"
            valorClass="text-teal-600"
            linea={{
              icono: 'ri-checkbox-circle-fill',
              texto: `≤ ${metaDias} días hábiles desde el ETD`,
              colorClass: 'text-teal-700'
            }}
            footer="Dentro del plazo máximo"
          />

          <TarjetaDesglose
            etiqueta="Liberadas Tarde"
            valor={resultado.noCumplen}
            sufijo="PO"
            valorClass={resultado.noCumplen > 0 ? 'text-red-600' : 'text-gray-400'}
            linea={{
              icono: 'ri-error-warning-fill',
              texto: `> ${metaDias} días hábiles desde el ETD`,
              colorClass: resultado.noCumplen > 0 ? 'text-red-700' : 'text-gray-400'
            }}
            nota="Haz clic para ver el detalle"
            resaltado={resultado.noCumplen > 0}
            onClick={() => abrirConFiltro('fuera')}
          />

          <TarjetaDesglose
            etiqueta="Días Hábiles Promedio"
            valor={sinDatos ? '—' : resultado.promedio}
            sufijo={sinDatos ? undefined : 'días'}
            valorClass="text-gray-800"
            barra={
              sinDatos
                ? null
                : {
                    porcentaje: resultado.porcentajeMeta,
                    colorClass:
                      tono === 'red' ? 'bg-red-400' : tono === 'amber' ? 'bg-amber-400' : 'bg-teal-400'
                  }
            }
            linea={{
              icono: 'ri-bar-chart-box-line',
              texto: `Equivale al ${sinDatos ? 0 : resultado.porcentajeMeta}% del plazo (${metaDias} días)`,
              colorClass: 'text-gray-600'
            }}
            footer={
              resultado.pendientes > 0
                ? `${resultado.pendientes} PO${resultado.pendientes !== 1 ? 's' : ''} con ETD aún sin liberar`
                : 'Todas las POs con ETD ya se liberaron'
            }
          />
        </div>

        {resultado.sinEtd > 0 && (
          <div className="mt-4 flex items-start gap-2 bg-white/70 border border-gray-200 rounded-lg px-4 py-3">
            <i className="ri-information-line text-gray-500 text-lg flex-shrink-0"></i>
            <p className="text-xs text-gray-600">
              {resultado.sinEtd} PO{resultado.sinEtd !== 1 ? 's' : ''} Dropship sin ETD cargado
              quedan fuera del cálculo. Al cargarles el ETD entran al indicador automáticamente.
            </p>
          </div>
        )}
      </PanelIndicador>

      {detalleAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Detalle ETD → Liberado
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Días hábiles entre el ETD y la llegada real a Liberación (meta: ≤ {metaDias} días)
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.total}</p>
                  <p className="text-xs text-gray-500">POs evaluadas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-600">{resultado.cumplen}</p>
                  <p className="text-xs text-gray-500">A tiempo</p>
                </div>
                <div className="text-center">
                  <p
                    className={`text-2xl font-bold ${
                      resultado.noCumplen > 0 ? 'text-red-600' : 'text-gray-400'
                    }`}
                  >
                    {resultado.noCumplen}
                  </p>
                  <p className="text-xs text-gray-500">Tarde</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.promedio} días</p>
                  <p className="text-xs text-gray-500">Promedio (ETD → Liberado)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{resultado.pendientes}</p>
                  <p className="text-xs text-gray-500">Con ETD sin liberar</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-medium text-gray-600">Filtrar:</span>
              <div className="flex gap-2">
                {(['todas', 'cumplen', 'fuera'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      filtro === f
                        ? f === 'fuera'
                          ? 'bg-red-500 text-white'
                          : f === 'cumplen'
                            ? 'bg-teal-600 text-white'
                            : 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'todas'
                      ? `Todas (${resultado.total})`
                      : f === 'cumplen'
                        ? `A tiempo (${resultado.cumplen})`
                        : `Tarde (${resultado.noCumplen})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / Tiquetera</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">EXP ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Solicitante</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">ETD</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Límite</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Liberado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Cumple</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filasFiltradas.map((fila) => (
                    <tr
                      key={fila.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        !fila.cumpleMeta ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {fila.po_tiquetera}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {fila.exp_id || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {fila.solicitante || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-full whitespace-nowrap">
                          {fila.estado_expediente}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatearFechaCorta(fila.etd)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatearFechaCorta(fila.fechaLimite)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatearFechaCorta(fila.fechaLiberacion)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-bold ${
                            fila.cumpleMeta ? 'text-teal-700' : 'text-red-600'
                          }`}
                        >
                          {fila.dias}
                        </span>
                        {fila.diasExcedidos > 0 && (
                          <span className="block text-[10px] text-red-500">
                            +{fila.diasExcedidos} de más
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {fila.cumpleMeta ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full whitespace-nowrap">
                            <i className="ri-checkbox-circle-fill"></i> Cumple
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
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
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