// Barra de filtros de período del Dashboard (compacta, integrada al header).

import { PERIODOS } from './utils';

interface Props {
  fechaInicio: string;
  fechaFin: string;
  periodoActivo: string;
  errorFiltros: string;
  onFechaInicio: (valor: string) => void;
  onFechaFin: (valor: string) => void;
  onSeleccionarPeriodo: (periodo: string) => void;
  onAplicar: () => void;
  onLimpiar: () => void;
}

const inputFecha =
  'h-9 px-2.5 border border-gray-200 rounded-md bg-white text-sm text-gray-700 outline-none cursor-pointer focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

export default function FiltrosPeriodo({
  fechaInicio,
  fechaFin,
  periodoActivo,
  errorFiltros,
  onFechaInicio,
  onFechaFin,
  onSeleccionarPeriodo,
  onAplicar,
  onLimpiar,
}: Props) {
  return (
    <div className="mb-6">
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <i className="ri-calendar-2-line text-base"></i>
            </span>
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Período
              </p>
              <p className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                Rango de análisis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 flex-wrap">
            {PERIODOS.map((periodo) => (
              <button
                key={periodo.clave}
                onClick={() => onSeleccionarPeriodo(periodo.clave)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  periodoActivo === periodo.clave
                    ? 'bg-white text-teal-700 border border-teal-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {periodo.etiqueta}
              </button>
            ))}
          </div>

          <div className="hidden xl:block h-8 w-px bg-gray-200"></div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => onFechaInicio(e.target.value)}
              aria-label="Fecha inicio"
              className={inputFecha}
            />
            <i className="ri-arrow-right-line text-gray-400 text-sm"></i>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => onFechaFin(e.target.value)}
              aria-label="Fecha fin"
              className={inputFecha}
            />
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={onAplicar}
              className="h-9 px-4 flex items-center gap-1.5 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-filter-3-line text-base"></i>
              Aplicar
            </button>
            <button
              onClick={onLimpiar}
              title="Restablecer al mes actual"
              aria-label="Restablecer al mes actual"
              className="h-9 w-9 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <i className="ri-refresh-line text-base"></i>
            </button>
          </div>
        </div>

        {errorFiltros && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-2">
            <i className="ri-error-warning-line text-red-600 text-sm"></i>
            <span className="text-xs text-red-700 font-medium">{errorFiltros}</span>
          </div>
        )}

        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-gray-500 leading-relaxed">
          <i className="ri-information-line text-teal-600 mt-px"></i>
          <span>
            El rango se aplica según la{' '}
            <span className="font-medium text-gray-700">fecha de asignación</span> de cada PO (solo
            se cuentan las POs ya asignadas).
          </span>
        </p>
      </div>
    </div>
  );
}