// Barra de filtros de período del Dashboard.

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
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Filtros de Período</h3>
      <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
        <i className="ri-information-line text-teal-600"></i>
        El rango se aplica según la{' '}
        <strong className="font-semibold text-gray-700">fecha de asignación</strong> de cada PO (solo
        se cuentan las POs ya asignadas).
      </p>

      {errorFiltros && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <i className="ri-error-warning-line text-red-600"></i>
          <span className="text-sm text-red-700 font-medium">{errorFiltros}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((periodo) => (
            <button
              key={periodo.clave}
              onClick={() => onSeleccionarPeriodo(periodo.clave)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                periodoActivo === periodo.clave
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {periodo.etiqueta}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => onFechaInicio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => onFechaFin(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
            />
          </div>
          <button
            onClick={onAplicar}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-filter-line mr-2"></i>
            Aplicar
          </button>
          <button
            onClick={onLimpiar}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line mr-2"></i>
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}