import type { FiltroRapido, ModuloDestino } from '@/pages/home/components/documentacion/types';

interface BarraFiltrosDocumentacionProps {
  searchPO: string;
  onSearchChange: (valor: string) => void;
  filtroRuta: string;
  onRutaChange: (valor: string) => void;
  rutasDisponibles: string[];
  filtroRapido: FiltroRapido;
  onFiltroRapidoChange: (valor: FiltroRapido) => void;
  targetModulo: ModuloDestino;
  onModuloChange: (valor: ModuloDestino) => void;
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
  hayFiltrosActivos: boolean;
  pagina: number;
  totalPaginas: number;
  puedeEliminar: boolean;
  onEliminar: () => void;
  onGenerar: () => void;
  generando: boolean;
}

const OPCIONES_RAPIDAS = [
  { key: 'todos', label: 'Todos', icono: 'ri-list-check' },
  { key: 'con-factura', label: 'Solo con factura', icono: 'ri-bill-line' },
  { key: 'con-contenedor', label: 'Con contenedor', icono: 'ri-truck-line' },
  { key: 'sin-packing', label: 'Sin packing list', icono: 'ri-file-warning-line' },
] as const;

const BarraFiltrosDocumentacion = ({
  searchPO,
  onSearchChange,
  filtroRuta,
  onRutaChange,
  rutasDisponibles,
  filtroRapido,
  onFiltroRapidoChange,
  targetModulo,
  onModuloChange,
  selectedCount,
  filteredCount,
  totalCount,
  hayFiltrosActivos,
  pagina,
  totalPaginas,
  puedeEliminar,
  onEliminar,
  onGenerar,
  generando,
}: BarraFiltrosDocumentacionProps) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-4">
    {/* Buscador */}
    <div className="relative flex-1 min-w-[260px] max-w-md">
      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
      <input
        type="text"
        value={searchPO}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por PO, solicitante o responsable..."
        className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
      />
      {searchPO && (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full cursor-pointer"
        >
          <i className="ri-close-line text-sm"></i>
        </button>
      )}
    </div>

    {/* Ruta logística */}
    <div className="relative min-w-[220px]">
      <select
        value={filtroRuta}
        onChange={(e) => onRutaChange(e.target.value)}
        className="w-full pl-3 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent appearance-none bg-white cursor-pointer"
      >
        <option value="">Todas las rutas</option>
        {rutasDisponibles.map((ruta) => (
          <option key={ruta} value={ruta}>{ruta}</option>
        ))}
      </select>
      <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"></i>
    </div>

    {/* Filtros rápidos de completitud */}
    <div className="flex items-center gap-2 flex-wrap">
      {OPCIONES_RAPIDAS.map((opcion) => (
        <button
          key={opcion.key}
          type="button"
          onClick={() => onFiltroRapidoChange(opcion.key)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
            filtroRapido === opcion.key
              ? 'bg-amber-600 border-amber-600 text-white'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <i className={`${opcion.icono} text-sm`}></i>
          {opcion.label}
        </button>
      ))}
    </div>

    {/* Módulo destino */}
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Enviar a:</span>
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => onModuloChange('dropship')}
          className={`px-4 py-2 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            targetModulo === 'dropship' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <i className="ri-ship-line mr-1.5"></i>
          Dropship
        </button>
        <button
          type="button"
          onClick={() => onModuloChange('zf')}
          className={`px-4 py-2 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            targetModulo === 'zf' ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <i className="ri-building-line mr-1.5"></i>
          ZF
        </button>
      </div>
    </div>

    <div className="flex-1"></div>

    {/* Contador */}
    <span className="text-sm text-gray-500 whitespace-nowrap">
      <span className="font-bold text-amber-600">{selectedCount}</span> de {filteredCount} seleccionado(s)
      {hayFiltrosActivos && filteredCount !== totalCount && (
        <span className="text-gray-400 ml-1">(filtrado de {totalCount})</span>
      )}
      <span className="text-gray-400 mx-1">|</span>
      <span className="text-gray-500">Pág. {pagina} de {Math.max(1, totalPaginas)}</span>
    </span>

    {puedeEliminar && (
      <button
        type="button"
        onClick={onEliminar}
        disabled={selectedCount === 0}
        className="px-4 py-2 text-red-600 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        <i className="ri-delete-bin-line mr-1.5"></i>
        Eliminar
      </button>
    )}

    <button
      type="button"
      onClick={onGenerar}
      disabled={selectedCount === 0 || generando}
      className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${
        targetModulo === 'dropship' ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-sky-600 text-white hover:bg-sky-700'
      }`}
    >
      {generando ? (
        <>
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0"></div>
          Generando...
        </>
      ) : (
        <>
          <i className="ri-send-plane-line"></i>
          Consolidar en 1 Ticket ({selectedCount} filas)
        </>
      )}
    </button>
  </div>
);

export default BarraFiltrosDocumentacion;