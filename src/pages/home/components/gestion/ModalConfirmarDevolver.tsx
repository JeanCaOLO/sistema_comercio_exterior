import { useEffect, useState } from 'react';
import type { Expediente } from './types';
import { contarDocs, getEstadoColor } from './utils';

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
 *
 * Si el ticket ya avanzó (cualquier estado distinto de "No Asignado") la
 * devolución pide una confirmación adicional: primero una casilla de
 * reconocimiento y luego un segundo paso con confirmación definitiva.
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
  const [paso, setPaso] = useState<1 | 2>(1);
  const [aceptado, setAceptado] = useState(false);

  // Reiniciar el flujo cada vez que se abre el modal para otro ticket.
  useEffect(() => {
    if (show) {
      setPaso(1);
      setAceptado(false);
    }
  }, [show, expediente?.id]);

  if (!show || !expediente) return null;

  const estadoActual = expediente.estado_expediente;
  const yaAvanzado = estadoActual !== 'No Asignado';
  const puedeContinuar = !yaAvanzado || aceptado;

  const handlePrincipal = () => {
    if (!puedeContinuar) return;
    if (yaAvanzado) {
      setPaso(2);
      return;
    }
    onConfirmar();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {paso === 1 ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 flex items-center justify-center bg-amber-100 rounded-full flex-shrink-0">
                  <i className="ri-arrow-go-back-line text-amber-600 text-xl"></i>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-900">¿Devolver a Documentación?</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    El ticket <strong>{expediente.po_tiquetera}</strong> volverá a la bandeja de{' '}
                    <strong>Documentación</strong> y se quitará del Kanban. Podrás volver a
                    consolidarlo cuando lo necesites.
                  </p>
                </div>
              </div>

              {/* Etapa actual del ticket */}
              <div className="mb-4 flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Etapa actual
                </span>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white whitespace-nowrap ${getEstadoColor(
                    estadoActual
                  )}`}
                >
                  {estadoActual}
                </span>
              </div>

              {/* Aviso reforzado: el ticket ya tiene avance */}
              {yaAvanzado && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <i className="ri-error-warning-line text-red-600 text-lg flex-shrink-0 mt-0.5"></i>
                    <div>
                      <p className="text-sm font-semibold text-red-800">
                        Este ticket ya está en proceso
                      </p>
                      <p className="text-xs text-red-700 mt-1.5 leading-relaxed">
                        Se encuentra en la etapa <strong>{estadoActual}</strong>. Al devolverlo se
                        cierra su avance en el Kanban, se reinicia su recorrido desde Documentación
                        y el cronómetro de esta etapa se detiene. Las solicitudes de cambio de ETD,
                        etapa o fechas asociadas dejarán de tener un ticket activo.
                      </p>
                    </div>
                  </div>
                  <label className="mt-3 flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={aceptado}
                      onChange={(e) => setAceptado(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <span className="text-xs text-red-800 font-medium">
                      Entiendo que el ticket ya tiene avance y aun así quiero devolverlo.
                    </span>
                  </label>
                </div>
              )}

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
                    Este ticket volverá como <strong>una sola fila</strong> en Documentación (sin
                    POs separadas).
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
                  onClick={handlePrincipal}
                  disabled={saving || !puedeContinuar}
                  className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {yaAvanzado ? 'Continuar' : saving ? 'Devolviendo...' : 'Sí, devolver'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-full flex-shrink-0">
                  <i className="ri-alert-line text-red-600 text-xl"></i>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-900">Confirmación final</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Esta es la última confirmación. La devolución no se puede deshacer desde aquí.
                  </p>
                </div>
              </div>

              <div className="mb-4 border border-red-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-2.5 border-b border-red-200">
                  <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">
                    Vas a devolver un ticket en proceso
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <span className="text-xs text-gray-500">PO / Tiquetera</span>
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {expediente.po_tiquetera}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <span className="text-xs text-gray-500">Etapa actual</span>
                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {estadoActual}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <span className="text-xs text-gray-500">Destino</span>
                    <span className="text-sm font-semibold text-teal-700 whitespace-nowrap">
                      Documentación
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <span className="text-xs text-gray-500">Responsable</span>
                    <span className="text-sm text-gray-900 truncate">
                      {expediente.responsable_creacion || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <i className="ri-time-line text-amber-600 mt-0.5 flex-shrink-0"></i>
                <p className="text-xs text-amber-800">
                  El cronómetro de la etapa <strong>{estadoActual}</strong> se cerrará y el ticket
                  volverá a contar desde Documentación.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setPaso(1)}
                  disabled={saving}
                  className="px-5 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={onConfirmar}
                  disabled={saving}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {saving ? 'Devolviendo...' : 'Sí, devolver definitivamente'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}