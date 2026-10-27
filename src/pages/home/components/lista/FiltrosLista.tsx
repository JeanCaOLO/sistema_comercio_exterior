// Barra de filtros + resumen de resultados de la Lista de Expedientes.

import { ITEMS_PER_PAGE, OPCIONES_DIAS_FACTURA, TODOS_ESTADOS, describirFiltroDiasFactura } from './utils';

interface Props {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterTipoModulo: string;
  onTipoModuloChange: (value: string) => void;
  filterPersona: string;
  onPersonaChange: (value: string) => void;
  personas: string[];
  filterPrioridad: string;
  onPrioridadChange: (value: string) => void;
  filterEstado: string;
  onEstadoChange: (value: string) => void;
  filterDiasFactura: string;
  onDiasFacturaChange: (value: string) => void;
  diasFacturaMin: number;
  onDiasFacturaMinChange: (value: number) => void;
  filteredCount: number;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hayFiltros: boolean;
}

export default function FiltrosLista({
  searchTerm,
  onSearchChange,
  filterTipoModulo,
  onTipoModuloChange,
  filterPersona,
  onPersonaChange,
  personas,
  filterPrioridad,
  onPrioridadChange,
  filterEstado,
  onEstadoChange,
  filterDiasFactura,
  onDiasFacturaChange,
  diasFacturaMin,
  onDiasFacturaMinChange,
  filteredCount,
  totalCount,
  currentPage,
  totalPages,
  hayFiltros,
}: Props) {
  const rangoInicio = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const rangoFin = Math.min(currentPage * ITEMS_PER_PAGE, filteredCount);
  const mostrarRango = filteredCount > ITEMS_PER_PAGE && totalPages > 1;
  const diasFacturaActivo = describirFiltroDiasFactura(filterDiasFactura, diasFacturaMin);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="md:col-span-3 xl:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="PO, N° de factura, EXP ID, Solicitante, Responsable..."
              className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-circle-line text-sm"></i>
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Módulo</label>
          <select
            value={filterTipoModulo}
            onChange={(e) => onTipoModuloChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
          >
            <option value="Todos">Todos</option>
            <option value="dropship">Dropship</option>
            <option value="zf">ZF</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Persona Asignada</label>
          <select
            value={filterPersona}
            onChange={(e) => onPersonaChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
          >
            <option value="Todos">Todos</option>
            {personas.map((persona) => (
              <option key={persona} value={persona}>
                {persona}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Prioridad</label>
          <select
            value={filterPrioridad}
            onChange={(e) => onPrioridadChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
          >
            <option value="Todos">Todos</option>
            <option value="Urgente">Urgente</option>
            <option value="Alta">Alta</option>
            <option value="Media">Media</option>
            <option value="Baja">Baja</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
          <select
            value={filterEstado}
            onChange={(e) => onEstadoChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
          >
            <option value="Todos">Todos</option>
            {TODOS_ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-2"
            title="Días hábiles transcurridos desde la carga de la factura. En expedientes cerrados el reloj se detiene en la liberación."
          >
            Días s/ Factura
            <i className="ri-information-line text-gray-400 text-xs"></i>
          </label>
          <div className="flex items-center gap-2">
            <select
              value={filterDiasFactura}
              onChange={(e) => onDiasFacturaChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
            >
              {OPCIONES_DIAS_FACTURA.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
            {filterDiasFactura === 'custom' && (
              <div className="relative w-24 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={diasFacturaMin}
                  onChange={(e) => {
                    const valor = Number(e.target.value);
                    onDiasFacturaMinChange(Number.isFinite(valor) ? Math.min(365, Math.max(1, valor)) : 1);
                  }}
                  className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  aria-label="Días mínimos desde la carga de factura"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">
                  d
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-gray-600">
          Mostrando{' '}
          <span className="font-semibold text-teal-600">
            {mostrarRango ? `${rangoInicio}-${rangoFin} de` : ''}
          </span>{' '}
          <span className="font-semibold">{filteredCount}</span> expedientes de{' '}
          <span className="font-semibold">{totalCount}</span> totales
          {!hayFiltros && totalCount > ITEMS_PER_PAGE && (
            <span className="ml-2 text-gray-400">({ITEMS_PER_PAGE} por página)</span>
          )}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {diasFacturaActivo && (
            <button
              onClick={() => onDiasFacturaChange('Todos')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
              title="Quitar este filtro"
            >
              <i className="ri-timer-line"></i>
              {diasFacturaActivo}
              <i className="ri-close-line"></i>
            </button>
          )}
          {hayFiltros && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-medium text-teal-700">
              <i className="ri-filter-3-line"></i>
              Filtros activos
            </span>
          )}
        </div>
      </div>
    </div>
  );
}