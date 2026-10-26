// Fila memoizada de la tabla de expedientes (evita repintar toda la tabla).

import { memo } from 'react';
import type { Expediente } from './types';
import {
  calcularDiasDesdeCargaFactura,
  calcularTiempoTranscurrido,
  esEstadoFinal,
  formatearTiempo,
  getDificultadColor,
  getEstadoColor,
  getPrioridadColor,
  getTipoColor,
  nombreTipo,
} from './utils';

interface Props {
  expediente: Expediente;
  ahora: Date;
  onSelect: (expediente: Expediente) => void;
  onHistorial: (expediente: Expediente) => void;
  onDocumentos: (expediente: Expediente) => void;
}

const colorDiasFactura = (dias: number): string => {
  if (dias < 3) return 'bg-teal-50 text-teal-700';
  if (dias <= 5) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
};

function FilaExpediente({ expediente, ahora, onSelect, onHistorial, onDocumentos }: Props) {
  const tiempoTranscurrido = calcularTiempoTranscurrido(expediente, ahora);
  const finalizado = esEstadoFinal(expediente);
  const diasFactura = calcularDiasDesdeCargaFactura(expediente, ahora);

  return (
    <tr
      onClick={() => onSelect(expediente)}
      className="hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTipoColor(
            expediente.tipo_modulo
          )}`}
        >
          {nombreTipo(expediente.tipo_modulo)}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">{expediente.po_tiquetera}</div>
        <div className="text-xs text-gray-500">{expediente.tipo_po}</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{expediente.exp_id}</td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{expediente.solicitante}</td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
        {expediente.responsable_creacion}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEstadoColor(
            expediente.estado_expediente
          )}`}
        >
          {expediente.estado_expediente}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPrioridadColor(
            expediente.prioridad,
            expediente.prioridad_urgente
          )}`}
        >
          {expediente.prioridad_urgente ? 'URGENTE' : expediente.prioridad}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDificultadColor(
            expediente.dificultad
          )}`}
        >
          {expediente.dificultad}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="text-xs">
          <div className={`font-medium ${finalizado ? 'text-green-700' : 'text-blue-700'}`}>
            ⏱️ {formatearTiempo(tiempoTranscurrido.minutos)}
          </div>
          <div className={`${finalizado ? 'text-green-600' : 'text-blue-600'}`}>
            📅 {tiempoTranscurrido.dias} días
          </div>
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
        {new Date(expediente.created_at).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        {diasFactura ? (
          <div
            className="flex items-center gap-1.5"
            title={`Factura cargada el ${new Date(diasFactura.fechaCarga).toLocaleDateString('es-ES')}`}
          >
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${colorDiasFactura(
                diasFactura.dias
              )}`}
            >
              {diasFactura.dias} {diasFactura.dias === 1 ? 'día' : 'días'}
            </span>
            {diasFactura.enCurso && (
              <span className="text-[10px] uppercase tracking-wide text-gray-400">en curso</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHistorial(expediente);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
            title="Ver historial"
          >
            <i className="ri-history-line text-base"></i>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDocumentos(expediente);
            }}
            className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition-colors cursor-pointer"
            title="Ver documentos"
          >
            <i className="ri-file-list-line text-base"></i>
          </button>
        </div>
      </td>
    </tr>
  );
}

export default memo(FilaExpediente);