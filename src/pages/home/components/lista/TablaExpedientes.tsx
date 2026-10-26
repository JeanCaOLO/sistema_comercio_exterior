// Tabla + paginación de la Lista de Expedientes.

import type { Expediente } from './types';
import { ITEMS_PER_PAGE } from './utils';
import FilaExpediente from './FilaExpediente';

interface Props {
  expedientes: Expediente[];
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  currentTime: Date;
  onPageChange: (page: number) => void;
  onSelect: (expediente: Expediente) => void;
  onHistorial: (expediente: Expediente) => void;
  onDocumentos: (expediente: Expediente) => void;
}

export default function TablaExpedientes({
  expedientes,
  filteredCount,
  currentPage,
  totalPages,
  currentTime,
  onPageChange,
  onSelect,
  onHistorial,
  onDocumentos,
}: Props) {
  const rangoInicio = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const rangoFin = Math.min(currentPage * ITEMS_PER_PAGE, filteredCount);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Tipo
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                PO/Tiquetera
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                EXP ID
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Solicitante
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Responsable
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Estado
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Prioridad
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Dificultad
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Tiempo
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Fecha Creación
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                title="Días hábiles desde la carga de la factura (se detiene al liberar)"
              >
                Días s/ Factura
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expedientes.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-6 py-12 text-center">
                  <div className="text-gray-400">
                    <i className="ri-inbox-line text-5xl mb-3"></i>
                    <p className="text-lg font-medium">No se encontraron expedientes</p>
                    <p className="text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            ) : (
              expedientes.map((expediente) => (
                <FilaExpediente
                  key={expediente.id}
                  expediente={expediente}
                  ahora={currentTime}
                  onSelect={onSelect}
                  onHistorial={onHistorial}
                  onDocumentos={onDocumentos}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredCount > ITEMS_PER_PAGE && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-gray-600">
            Página <span className="font-semibold text-teal-600">{currentPage}</span> de{' '}
            <span className="font-semibold">{totalPages}</span>
            <span className="ml-1 text-gray-400">
              ({rangoInicio}-{rangoFin} de {filteredCount})
            </span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-arrow-left-s-line"></i> Anterior
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Mostrar solo un rango de páginas cercanas
              if (
                totalPages <= 7 ||
                page === 1 ||
                page === totalPages ||
                Math.abs(page - currentPage) <= 1
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`w-8 h-8 text-sm rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
                      page === currentPage
                        ? 'bg-teal-600 text-white font-semibold'
                        : 'border border-gray-300 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                );
              }
              if (page === 2 && currentPage > 3) {
                return (
                  <span key="ellipsis-start" className="px-1 text-gray-400">
                    ...
                  </span>
                );
              }
              if (page === totalPages - 1 && currentPage < totalPages - 2) {
                return (
                  <span key="ellipsis-end" className="px-1 text-gray-400">
                    ...
                  </span>
                );
              }
              return null;
            })}

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition-colors"
            >
              Siguiente <i className="ri-arrow-right-s-line"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}