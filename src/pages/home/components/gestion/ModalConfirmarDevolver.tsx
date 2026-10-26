import type { Expediente } from './types';
import { contarDocs } from './utils';

interface Props {
  show: boolean;
  expediente: Expediente | null;
  grupos: any[];
  cargandoInfo: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirmar: () => void;
}

/**
 * Confirmación para devolver un ticket del kanban a la bandeja de Documentación.
 */
export default function ModalConfirmarDevolver({
  show,
  expediente,
  grupos,
  cargandoInfo,
  saving,
  onClose,
  onConfirmar,
}: Props) {
  if (!show || !expediente) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 flex items-center justify-center bg-amber-100 rounded-full flex-shrink-0">
              <i className="ri-arrow-go-back-line text-amber-600 text-xl"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">¿Devolver a Documentación?</h3>
              <p className="text-sm text-gray-500 mt-1">
                El ticket <strong>{expediente.po_tiquetera}</strong> volverá a la bandeja de{' '}
                <strong>Documentación</strong> y se quitará del Kanban. Podrás volver a consolidarlo
                cuando lo necesites.
              </p>
            </div>
          </div>

          {/* Aviso visual: estructura de POs a separar */}
          {cargandoInfo ? (
            <div className="mb-4 flex items-center gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin flex-shrink-0"></div>
              <span>Analizando estructura del ticket...</span>
            </div>
          ) : grupos.length > 1 ? (
            <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <i className="ri-git-branch-line text-indigo-600 text-lg"></i>
                <p className="text-sm font-semibold text-indigo-800">
                  Este ticket se separará en {grupos.length} POs independientes
                </p>
              </div>
              <div className="space-y-2">
                {grupos.map((g: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-indigo-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700 font-medium truncate">
                        {g.po_tiquetera ?? expediente.po_tiquetera}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-3">
                      {contarDocs(g.doc ?? null)} doc(s)
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-indigo-600 mt-3 flex items-center gap-1">
                <i className="ri-file-list-3-line"></i>
                Cada PO conservará sus propios documentos asociados.
              </p>
            </div>
          ) : (
            <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2">
              <i className="ri-information-line text-gray-400 mt-0.5 flex-shrink-0"></i>
              <p className="text-xs text-gray-500">
                Este ticket volverá como <strong>una sola fila</strong> en Documentación (sin POs
                separadas).
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={saving}
              className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {saving ? 'Devolviendo...' : 'Sí, devolver'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}