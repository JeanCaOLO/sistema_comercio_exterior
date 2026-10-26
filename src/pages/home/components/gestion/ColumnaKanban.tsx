import { memo } from 'react';
import { LIMITE_TARJETAS_POR_COLUMNA, type Expediente } from './types';
import { getEstadoColor } from './utils';
import TarjetaExpediente from './TarjetaExpediente';

interface Props {
  estado: string;
  expedientes: Expediente[];
  buscando: boolean;
  expandida: boolean;
  onExpandir: () => void;
  onColapsar: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, estado: string) => void;
  onDragStart: (e: React.DragEvent, expediente: Expediente) => void;
  onAbrir: (expediente: Expediente) => void;
  onHistorial: (expediente: Expediente) => void;
  onDocumentos: (expediente: Expediente) => void;
  calcularTiempo: (expediente: Expediente) => { minutos: number; dias: number };
}

/**
 * Columna del kanban. Solo pinta las primeras 10 tarjetas por rendimiento;
 * el encabezado siempre muestra el total real de la columna.
 */
function ColumnaKanban({
  estado,
  expedientes,
  buscando,
  expandida,
  onExpandir,
  onColapsar,
  onDragOver,
  onDrop,
  onDragStart,
  onAbrir,
  onHistorial,
  onDocumentos,
  calcularTiempo,
}: Props) {
  const visibles =
    expandida || buscando ? expedientes : expedientes.slice(0, LIMITE_TARJETAS_POR_COLUMNA);
  const ocultos = expedientes.length - visibles.length;

  return (
    <div
      className="flex-shrink-0 w-80 bg-gray-50 rounded-xl border border-gray-200"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, estado)}
    >
      <div
        className={`${getEstadoColor(
          estado
        )} text-white px-4 py-3 rounded-t-xl flex items-center justify-between`}
      >
        <h3 className="font-semibold text-sm">{estado}</h3>
        <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-bold">
          {expedientes.length}
        </span>
      </div>

      <div className="p-3 space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto">
        {visibles.map((expediente) => {
          const esFinalizado =
            expediente.tipo_modulo === 'dropship'
              ? expediente.estado_expediente === 'Notificado' ||
                expediente.estado_expediente === 'Visto Listo'
              : expediente.estado_expediente === 'Completado';

          return (
            <TarjetaExpediente
              key={expediente.id}
              expediente={expediente}
              tiempo={calcularTiempo(expediente)}
              esFinalizado={esFinalizado}
              onAbrir={onAbrir}
              onHistorial={onHistorial}
              onDocumentos={onDocumentos}
              onDragStart={onDragStart}
            />
          );
        })}

        {expedientes.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <i className="ri-inbox-line text-3xl mb-2"></i>
            <p>Sin expedientes</p>
          </div>
        )}

        {ocultos > 0 && (
          <button
            type="button"
            onClick={onExpandir}
            className="w-full py-2.5 rounded-lg border border-dashed border-gray-300 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-100 hover:border-gray-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line mr-1"></i>
            Mostrar {ocultos} más ({expedientes.length} en total)
          </button>
        )}

        {expandida && !buscando && expedientes.length > LIMITE_TARJETAS_POR_COLUMNA && (
          <button
            type="button"
            onClick={onColapsar}
            className="w-full py-2 rounded-lg text-gray-500 text-[11px] font-medium hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-collapse-vertical-line mr-1"></i>
            Ver solo los primeros {LIMITE_TARJETAS_POR_COLUMNA}
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(ColumnaKanban);