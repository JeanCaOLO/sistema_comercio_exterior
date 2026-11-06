import FiltroFechas from '@/pages/home/components/FiltroFechas';
import type { FiltrosHistorial } from './types';
import { etiquetaModulo } from './utils';

interface Props {
  filtros: FiltrosHistorial;
  opciones: { campos: string[]; usuarios: string[]; estados: string[] };
  activos: number;
  onCambiar: (parcial: Partial<FiltrosHistorial>) => void;
  onLimpiar: () => void;
}

const claseSelect =
  'w-full sm:w-auto min-w-0 box-border px-3 py-2 pr-8 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer';

export default function FiltrosHistorialTiquetes({
  filtros,
  opciones,
  activos,
  onCambiar,
  onLimpiar,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="relative w-full mb-3">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
        <input
          type="text"
          value={filtros.busqueda}
          onChange={(e) => onCambiar({ busqueda: e.target.value })}
          placeholder="Buscar por PO, EXP, solicitante, usuario, campo o valor del cambio..."
          className="w-full box-border pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
        />
        {filtros.busqueda && (
          <button
            type="button"
            onClick={() => onCambiar({ busqueda: '' })}
            title="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <i className="ri-close-line"></i>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['todos', 'dropship', 'zf'] as const).map((modulo) => (
            <button
              key={modulo}
              type="button"
              onClick={() => onCambiar({ modulo })}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filtros.modulo === modulo
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {modulo === 'todos' ? 'Todos' : etiquetaModulo(modulo)}
            </button>
          ))}
        </div>

        <select
          value={filtros.campo}
          onChange={(e) => onCambiar({ campo: e.target.value })}
          title="Filtrar por campo modificado"
          className={claseSelect}
        >
          <option value="todos">Todos los campos</option>
          {opciones.campos.map((campo) => (
            <option key={campo} value={campo}>
              {campo}
            </option>
          ))}
        </select>

        <select
          value={filtros.usuario}
          onChange={(e) => onCambiar({ usuario: e.target.value })}
          title="Filtrar por usuario que hizo el cambio"
          className={claseSelect}
        >
          <option value="todos">Todos los usuarios</option>
          {opciones.usuarios.map((usuario) => (
            <option key={usuario} value={usuario}>
              {usuario}
            </option>
          ))}
        </select>

        <select
          value={filtros.estado}
          onChange={(e) => onCambiar({ estado: e.target.value })}
          title="Filtrar por estado actual del tíquete"
          className={claseSelect}
        >
          <option value="todos">Todos los estados</option>
          {opciones.estados.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
        <FiltroFechas
          inicio={filtros.fechaInicio}
          fin={filtros.fechaFin}
          onChange={(fechaInicio, fechaFin) => onCambiar({ fechaInicio, fechaFin })}
        />

        <div className="ml-auto flex items-center gap-3">
          {activos > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-1 whitespace-nowrap">
              <i className="ri-filter-3-line"></i>
              {activos} filtro{activos === 1 ? '' : 's'} activo{activos === 1 ? '' : 's'}
            </span>
          )}
          <button
            type="button"
            onClick={onLimpiar}
            disabled={activos === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-filter-off-line"></i>
            Limpiar filtros
          </button>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-2">
        Las fechas filtran por la fecha del movimiento registrado. Sin fechas, se incluyen todos los tíquetes,
        incluso los más antiguos.
      </p>
    </div>
  );
}