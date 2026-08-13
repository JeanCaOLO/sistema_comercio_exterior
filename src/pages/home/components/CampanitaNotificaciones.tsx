import { useState, useEffect, useRef } from 'react';
import { useNotificaciones } from '@/hooks/useNotificaciones';
import { getIconoColor, getTipoLabel, timeAgo } from '@/lib/notificaciones';
import ToastNotificaciones from './ToastNotificacion';

interface CampanitaNotificacionesProps {
  usuarioId: string;
  usuarioNombre: string;
}

export default function CampanitaNotificaciones({ usuarioId, usuarioNombre }: CampanitaNotificacionesProps) {
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const {
    notificaciones,
    noLeidas,
    cargando,
    toasts,
    cerrarToast,
    marcarLeida,
    marcarTodasLeidas,
  } = useNotificaciones(usuarioId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    };
    if (abierto) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [abierto]);

  const handleMarcarLeida = async (id: string) => {
    await marcarLeida(id);
  };

  return (
    <>
      <div className="relative">
        {/* Campanita más grande y visible */}
        <button
          ref={bellRef}
          type="button"
          onClick={() => setAbierto((prev) => !prev)}
          className={`relative w-12 h-12 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
            abierto
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100 hover:border-teal-200'
          }`}
          title="Notificaciones"
        >
          <i className="ri-notification-3-line text-2xl"></i>
          {noLeidas > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full leading-none border-2 border-white">
              {noLeidas > 99 ? '99+' : noLeidas}
            </span>
          )}
        </button>

        {/* Panel con el historial */}
        {abierto && (
          <div
            ref={panelRef}
            className="absolute right-0 top-full mt-3 w-[400px] max-h-[560px] bg-white rounded-xl border border-gray-200 z-50 overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Notificaciones</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}
                </p>
              </div>
              {noLeidas > 0 && (
                <button
                  type="button"
                  onClick={marcarTodasLeidas}
                  className="text-xs text-teal-600 hover:text-teal-800 font-medium cursor-pointer whitespace-nowrap"
                >
                  Marcar todas leídas
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {cargando && notificaciones.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-teal-600 rounded-full animate-spin"></div>
                </div>
              ) : notificaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full mb-3">
                    <i className="ri-notification-off-line text-2xl text-gray-400"></i>
                  </div>
                  <p className="text-sm font-medium text-gray-500">Sin notificaciones</p>
                  <p className="text-xs text-gray-400 mt-1 text-center">
                    Aquí se guardará el historial de cambios en documentos y tickets
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notificaciones.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleMarcarLeida(notif.id)}
                      className={`px-5 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 ${
                        !notif.leida ? 'bg-teal-50/60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${getIconoColor(notif.tipo)}`}
                        >
                          <i className={`${notif.icono} text-base`}></i>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {!notif.leida && (
                              <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0"></span>
                            )}
                            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                              {getTipoLabel(notif.tipo)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 leading-snug">{notif.mensaje}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-gray-400">{timeAgo(notif.created_at)}</span>
                            {notif.po_tiquetera && (
                              <span
                                className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[160px]"
                                title={notif.po_tiquetera}
                              >
                                {notif.po_tiquetera.length > 20
                                  ? notif.po_tiquetera.substring(0, 20) + '...'
                                  : notif.po_tiquetera}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toasts flotantes en la esquina inferior derecha */}
      <ToastNotificaciones toasts={toasts} onCerrar={cerrarToast} />
    </>
  );
}