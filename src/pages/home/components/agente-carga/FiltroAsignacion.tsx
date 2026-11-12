import { formatearEntero } from '@/lib/agenteCarga';
import {
  PERIODO_SIN_FECHA,
  etiquetaPeriodoCarga,
  formatearFechaCorta,
  type PeriodoCarga,
} from '@/lib/agenteCargaPeriodos';

export type ModoSeleccionPeriodo = 'periodo' | 'rango';

interface FiltroAsignacionProps {
  periodos: PeriodoCarga[];
  modo: ModoSeleccionPeriodo;
  periodo: string;
  desde: string;
  hasta: string;
  etiquetaSeleccion: string;
  mesesSeleccionados: number;
  onCambiarModo: (modo: ModoSeleccionPeriodo) => void;
  onSeleccionarPeriodo: (periodo: string) => void;
  onCambiarDesde: (periodo: string) => void;
  onCambiarHasta: (periodo: string) => void;
  totalPos: number;
  totalHistorico: number;
  minFecha: string | null;
  maxFecha: string | null;
  cargando: boolean;
}

export default function FiltroAsignacion({
  periodos,
  modo,
  periodo,
  desde,
  hasta,
  etiquetaSeleccion,
  mesesSeleccionados,
  onCambiarModo,
  onSeleccionarPeriodo,
  onCambiarDesde,
  onCambiarHasta,
  totalPos,
  totalHistorico,
  minFecha,
  maxFecha,
  cargando,
}: FiltroAsignacionProps) {
  const sinFecha = periodos.find((p) => p.periodo === PERIODO_SIN_FECHA);
  const reales = periodos.filter((p) => p.periodo !== PERIODO_SIN_FECHA);
  const esSinFecha = modo === 'periodo' && periodo === PERIODO_SIN_FECHA;
  const opciones = modo === 'rango' ? reales : periodos;

  const claseSelect =
    'w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed appearance-none';

  return (
    <section className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
              <i className="ri-calendar-2-line"></i>
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">Periodo de la asignación</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Consulta un mes o el acumulado de varios meses según la Fecha Asignación Agente de Carga de cada PO.
              </p>
            </div>

            <div className="flex items-center bg-gray-100 rounded-full px-1 py-1">
              <button
                type="button"
                onClick={() => onCambiarModo('periodo')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  modo === 'periodo'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Un mes
              </button>
              <button
                type="button"
                onClick={() => onCambiarModo('rango')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  modo === 'rango'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Rango de meses
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
            {modo === 'periodo' ? (
              <div className="min-w-0 w-full sm:w-[320px]">
                <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">
                  Mes
                </label>
                <div className="relative">
                  <select
                    value={periodo}
                    onChange={(e) => onSeleccionarPeriodo(e.target.value)}
                    disabled={cargando || periodos.length === 0}
                    className={`${claseSelect} pr-9`}
                  >
                    {periodos.length === 0 && <option value="">Sin periodos guardados</option>}
                    {periodos.map((p) => (
                      <option key={p.periodo} value={p.periodo}>
                        {etiquetaPeriodoCarga(p.periodo)} · {formatearEntero(p.totalPos)} POs
                      </option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                </div>
              </div>
            ) : (
              <>
                <div className="min-w-0 w-full sm:w-[240px]">
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">
                    Desde
                  </label>
                  <div className="relative">
                    <select
                      value={desde}
                      onChange={(e) => onCambiarDesde(e.target.value)}
                      disabled={cargando || reales.length === 0}
                      className={`${claseSelect} pr-9`}
                    >
                      {reales.length === 0 && <option value="">Sin periodos guardados</option>}
                      {[...reales].reverse().map((p) => (
                        <option key={p.periodo} value={p.periodo}>
                          {etiquetaPeriodoCarga(p.periodo)} · {formatearEntero(p.totalPos)} POs
                        </option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                  </div>
                </div>

                <span className="hidden sm:flex w-6 h-9 items-center justify-center text-gray-400 flex-shrink-0">
                  <i className="ri-arrow-right-line"></i>
                </span>

                <div className="min-w-0 w-full sm:w-[240px]">
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">
                    Hasta
                  </label>
                  <div className="relative">
                    <select
                      value={hasta}
                      onChange={(e) => onCambiarHasta(e.target.value)}
                      disabled={cargando || reales.length === 0}
                      className={`${claseSelect} pr-9`}
                    >
                      {reales.length === 0 && <option value="">Sin periodos guardados</option>}
                      {[...reales].reverse().map((p) => (
                        <option key={p.periodo} value={p.periodo}>
                          {etiquetaPeriodoCarga(p.periodo)} · {formatearEntero(p.totalPos)} POs
                        </option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-teal-50 text-teal-800 text-[11px] font-medium whitespace-nowrap">
                  <i className="ri-stack-line"></i>
                  {mesesSeleccionados} {mesesSeleccionados === 1 ? 'mes' : 'meses'} seleccionados
                </span>
              </>
            )}

            {cargando && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 whitespace-nowrap pb-2">
                <i className="ri-loader-4-line animate-spin"></i>Cargando detalle...
              </span>
            )}
          </div>

          {!cargando && minFecha && maxFecha && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gray-500">
              <i className="ri-calendar-check-line text-gray-400"></i>
              Asignaciones del {formatearFechaCorta(minFecha)} al {formatearFechaCorta(maxFecha)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-x-6 gap-y-2 xl:justify-end flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              {modo === 'rango' ? 'POs en el rango' : 'POs en el periodo'}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {formatearEntero(totalPos)}
              <span className="text-[11px] font-normal text-gray-400"> de {formatearEntero(totalHistorico)}</span>
            </p>
            <p className="text-[11px] text-gray-500 truncate max-w-[220px]" title={etiquetaSeleccion}>
              {etiquetaSeleccion}
            </p>
          </div>
          {sinFecha && sinFecha.totalPos > 0 && (
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Sin fecha de asignación</p>
              <p className="text-sm font-semibold text-amber-700">{formatearEntero(sinFecha.totalPos)}</p>
              <button
                type="button"
                onClick={() => {
                  onCambiarModo('periodo');
                  onSeleccionarPeriodo(PERIODO_SIN_FECHA);
                }}
                className="text-[11px] text-amber-700 underline hover:text-amber-900 transition-colors whitespace-nowrap cursor-pointer"
              >
                Ver ese grupo
              </button>
            </div>
          )}
        </div>
      </div>

      {esSinFecha && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <i className="ri-alert-line text-amber-600 mt-0.5"></i>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Estas POs no tienen Fecha Asignación Agente de Carga en el Excel, por eso no entran en ningún mes.
            Revisá esa columna en el archivo para poder ubicarlas en su periodo.
          </p>
        </div>
      )}

      {modo === 'rango' && !cargando && mesesSeleccionados === 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <i className="ri-information-line text-gray-400 mt-0.5"></i>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Elegí un mes de inicio y un mes de fin para ver el acumulado del rango.
          </p>
        </div>
      )}
    </section>
  );
}