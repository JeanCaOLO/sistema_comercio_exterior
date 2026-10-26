import { useState } from 'react';
import type { Expediente } from './types';
import ColumnaKanban from './ColumnaKanban';

interface Props {
  estados: string[];
  searchTerm: string;
  getExpedientesPorEstado: (estado: string) => Expediente[];
  calcularTiempoTranscurrido: (expediente: Expediente) => { minutos: number; dias: number };
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, estado: string) => void;
  onDragStart: (e: React.DragEvent, expediente: Expediente) => void;
  onAbrir: (expediente: Expediente) => void;
  onHistorial: (expediente: Expediente) => void;
  onDocumentos: (expediente: Expediente) => void;
}

/**
 * Tablero kanban completo. Mantiene localmente qué columnas están expandidas
 * para no recargar el componente principal.
 */
export default function TableroKanban({
  estados,
  searchTerm,
  getExpedientesPorEstado,
  calcularTiempoTranscurrido,
  onDragOver,
  onDrop,
  onDragStart,
  onAbrir,
  onHistorial,
  onDocumentos,
}: Props) {
  const [columnasExpandidas, setColumnasExpandidas] = useState<Set<string>>(new Set());
  const buscando = searchTerm.trim().length > 0;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {estados.map((estado) => (
        <ColumnaKanban
          key={estado}
          estado={estado}
          expedientes={getExpedientesPorEstado(estado)}
          buscando={buscando}
          expandida={columnasExpandidas.has(estado)}
          onExpandir={() => setColumnasExpandidas((prev) => new Set(prev).add(estado))}
          onColapsar={() =>
            setColumnasExpandidas((prev) => {
              const next = new Set(prev);
              next.delete(estado);
              return next;
            })
          }
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragStart={onDragStart}
          onAbrir={onAbrir}
          onHistorial={onHistorial}
          onDocumentos={onDocumentos}
          calcularTiempo={calcularTiempoTranscurrido}
        />
      ))}
    </div>
  );
}