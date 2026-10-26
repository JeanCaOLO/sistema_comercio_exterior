import type { RutaLogistica } from '@/lib/rutas';
import MultiSelectFiltro from '@/pages/home/components/MultiSelectFiltro';
import type { TipoModulo } from './types';

interface Props {
  tipoModulo: TipoModulo;
  searchTerm: string;
  onSearchChange: (valor: string) => void;
  filterPersona: string;
  onPersonaChange: (valor: string) => void;
  filterPrioridad: string;
  onPrioridadChange: (valor: string) => void;
  filterRutas: string[];
  onRutasChange: (valor: string[]) => void;
  todasPersonas: string[];
  rutas: RutaLogistica[];
  totalResultados: number;
  onLimpiar: () => void;
}

/**
 * Barra de filtros del tablero de Gestión.
 */
export default function FiltrosGestion({
  tipoModulo,
  searchTerm,
  onSearchChange,
  filterPersona,
  onPersonaChange,
  filterPrioridad,
  onPrioridadChange,
  filterRutas,
  onRutasChange,
  todasPersonas,
  rutas,
  totalResultados,
  onLimpiar,
}: Props) {
  const hayFiltros =
    searchTerm !== '' ||
    filterPersona !== 'Todos' ||
    filterPrioridad !== 'Todos' ||
    filterRutas.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div
        className={`grid grid-cols-1 gap-4 ${
          tipoModulo === 'dropship' ? 'md:grid-cols-4' : 'md:grid-cols-3'
        }`}
      >
        <div>
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
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-circle-line text-sm"></i>
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {tipoModulo === 'dropship' ? 'Solicitante' : 'Persona'}
          </label>
          <select
            value={filterPersona}
            onChange={(e) => onPersonaChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
          >
            <option value="Todos">Todos</option>
            {todasPersonas.map((persona) => (
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

        {tipoModulo === 'dropship' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ruta Logística</label>
            <MultiSelectFiltro
              opciones={rutas
                .filter((r) => r.modulo === 'dropship')
                .map((ruta) => ({ value: ruta.key, label: ruta.label }))}
              seleccionados={filterRutas}
              onChange={onRutasChange}
              placeholder="Todas las rutas"
              icono="ri-route-line"
            />
          </div>
        )}
      </div>

      {hayFiltros && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Mostrando <span className="font-semibold text-teal-600">{totalResultados}</span>{' '}
            expediente(s) con los filtros activos
          </p>
          <button
            type="button"
            onClick={onLimpiar}
            className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-filter-off-line"></i>
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}