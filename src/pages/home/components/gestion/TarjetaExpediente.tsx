import { memo } from 'react';
import { formatearFecha } from '@/lib/fechas';
import type { Expediente } from './types';
import { formatearTiempo, getDificultadColor, getPrioridadColor } from './utils';

interface Props {
  expediente: Expediente;
  tiempo: { minutos: number; dias: number };
  esFinalizado: boolean;
  onAbrir: (expediente: Expediente) => void;
  onHistorial: (expediente: Expediente) => void;
  onDocumentos: (expediente: Expediente) => void;
  onDragStart: (e: React.DragEvent, expediente: Expediente) => void;
}

/**
 * Tarjeta individual del kanban. Memoizada para no re-renderizar todas las
 * tarjetas cuando cambia una sola columna o el reloj.
 */
function TarjetaExpediente({
  expediente,
  tiempo,
  esFinalizado,
  onAbrir,
  onHistorial,
  onDocumentos,
  onDragStart,
}: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, expediente)}
      onClick={() => onAbrir(expediente)}
      className="bg-white rounded-lg border border-gray-200 p-4 cursor-move hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 text-sm mb-1">{expediente.po_tiquetera}</h4>
          <p className="text-xs text-gray-500">{expediente.exp_id}</p>
          {expediente.tipo_modulo === 'zf' && expediente.recibo_delzof_fecha && (
            <p
              className="text-[11px] text-amber-700 font-medium mt-0.5 whitespace-nowrap"
              title={`Recibo de Delzof${
                expediente.recibo_delzof_numero ? ': ' + expediente.recibo_delzof_numero : ''
              }`}
            >
              <i className="ri-receipt-line mr-1"></i>
              Delzof {formatearFecha(expediente.recibo_delzof_fecha)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {expediente.prioridad_urgente && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
              URGENTE
            </span>
          )}
          {expediente.transito_corto && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              TC
            </span>
          )}
          {expediente.ok_pais && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
              ✓ OK País
            </span>
          )}
          {expediente.bl_cargado && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              BL
            </span>
          )}
          {expediente.packing_list_cargado && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-teal-100 text-teal-700 border border-teal-200">
              PL
            </span>
          )}
          {expediente.aplica_tlc && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
              TLC
            </span>
          )}
          {expediente.mcg && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
              MCG
            </span>
          )}
          {expediente.finiquito && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
              Finiquito
            </span>
          )}
          {expediente.incidente && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
              ⚠ Incidente
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <i className="ri-user-line"></i>
          <span>{expediente.solicitante}</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium min-w-[70px]">Prioridad:</span>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full border ${getPrioridadColor(
                expediente.prioridad,
                expediente.prioridad_urgente
              )}`}
            >
              {expediente.prioridad}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium min-w-[70px]">Dificultad:</span>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${getDificultadColor(
                expediente.dificultad
              )}`}
            >
              {expediente.dificultad}
            </span>
          </div>
        </div>

        <div className="text-xs bg-gray-50 rounded p-2 border border-gray-200">
          <div className={`font-medium ${esFinalizado ? 'text-green-700' : 'text-blue-700'}`}>
            ⏱️ {formatearTiempo(tiempo.minutos)}
          </div>
          <div className={`${esFinalizado ? 'text-green-600' : 'text-blue-600'}`}>
            📅 {tiempo.dias} días hábiles
          </div>
          {!esFinalizado && <div className="text-gray-400 mt-1">🔄 En curso...</div>}
          {esFinalizado && <div className="text-green-500 mt-1">✅ Finalizado</div>}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onHistorial(expediente);
          }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
          title="Ver historial"
        >
          <i className="ri-history-line text-sm"></i>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDocumentos(expediente);
          }}
          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition-colors cursor-pointer"
          title="Ver documentos"
        >
          <i className="ri-file-list-line text-sm"></i>
        </button>
      </div>
    </div>
  );
}

export default memo(TarjetaExpediente);