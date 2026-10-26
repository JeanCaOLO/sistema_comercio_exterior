// Modal de historial de cambios de un expediente.

import type { Expediente } from './types';

interface Props {
  show: boolean;
  onClose: () => void;
  expediente: Expediente | null;
  historial: any[];
  cargadorNoAutorizado: boolean;
}

export default function ModalHistorialLista({
  show,
  onClose,
  expediente,
  historial,
  cargadorNoAutorizado,
}: Props) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Historial de Cambios</h3>
            <p className="text-sm text-gray-500 mt-1">
              PO: {expediente?.po_tiquetera} | EXP: {expediente?.exp_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-2xl text-gray-500"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Línea especial: quién cargó originalmente el ticket desde Carga CAA */}
          {cargadorNoAutorizado && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
              <div className="w-8 h-8 flex items-center justify-center bg-red-100 rounded-full flex-shrink-0">
                <i className="ri-error-warning-line text-red-600 text-base"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-red-700 font-bold uppercase tracking-wide">
                  ⚠️ Cargador no autorizado
                </p>
                <p className="text-sm text-gray-800 font-semibold">
                  Este ticket no fue cargado por un usuario autorizado de Carga CAA.
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Solo lchavala, smcdonald, mpaniagua y los administradores pueden cargar
                  documentos.
                </p>
              </div>
            </div>
          )}

          <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-teal-100 rounded-full flex-shrink-0">
              <i className="ri-upload-cloud-2-line text-teal-600 text-base"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-teal-700 font-medium uppercase tracking-wide">
                Origen del ticket
              </p>
              <p className="text-sm text-gray-800 font-semibold">
                Cargado por:{' '}
                {expediente?.cargador_documentos || expediente?.solicitante || 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Documentos y PO cargados desde Carga CAA</p>
            </div>
          </div>

          {historial.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay cambios registrados</p>
          ) : (
            <div className="space-y-4">
              {historial.map((cambio, index) => (
                <div
                  key={index}
                  className="border-l-4 border-teal-500 pl-4 py-2 bg-gray-50 rounded-r-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {cambio.campo_modificado}
                      </p>
                      <div className="text-xs text-gray-600 mt-1 space-y-1">
                        <div>
                          <span className="font-medium">Anterior:</span>{' '}
                          <span className="text-red-600">{cambio.valor_anterior || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium">Nuevo:</span>{' '}
                          <span className="text-green-600">{cambio.valor_nuevo}</span>
                        </div>
                      </div>
                      <p className="text-xs text-teal-600 mt-2 font-medium">
                        <i className="ri-user-line mr-1"></i>
                        Modificado por: {cambio.usuario}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                      {new Date(cambio.fecha_cambio).toLocaleString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}