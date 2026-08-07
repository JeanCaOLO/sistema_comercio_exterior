import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  obtenerNotificaciones,
  contarNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas,
  timeAgo,
  type Notificacion,
} from '../../../lib/notificaciones';

interface CampanitaNotificacionesProps {
  usuarioId: string;
  usuarioNombre: string;
}

function getIconoColor(tipo: string): string {
  switch (tipo) {
    case 'documento_agregado': return 'text-teal-600 bg-teal-100';
    case 'documento_modificado': return 'text-amber-600 bg-amber-100';
    case 'ticket_creado': return 'text-emerald-600 bg-emerald-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

function getTipoLabel(tipo: string): string {
  switch (tipo) {
    case 'documento_agregado': return 'Doc. agregado';
    case 'documento_modificado': return 'Doc. modificado';
    case 'ticket_creado': return 'Ticket creado';
    default: return tipo;
  }
}

export default function CampanitaNotificaciones({ usuarioId, usuarioNombre }: CampanitaNotificacionesProps) {
  const [abierto, setAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const cargarNotificaciones = useCallback(async () => {
    if (!usuarioId) return;
    const data = await obtenerNotificaciones(usuarioId);
    setNotificaciones(data);
  }, [usuarioId]);

  const cargarContador = useCallback(async () => {
    if (!usuarioId) return;
    const count = await contarNoLeidas(usuarioId);
    setNoLeidas(count);
  }, [usuarioId]);

  useEffect(() => {
    cargarNotificaciones();
    cargarContador();
  }, [cargarNotificaciones, cargarContador]);

  // Polling cada 30s para mantener actualizado
  useEffect(() => {
    const interval = setInterval(() => {
      cargarContador();
      if (abierto) cargarNotificaciones();
    }, 30000);
    return () => clearInterval(interval);
  }, [abierto, cargarContador, cargarNotificaciones]);

  // Cerrar al clickear afuera
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

  const handleToggle = async () => {
    if (!abierto) {
      setLoading(true);
      await cargarNotificaciones();
      setLoading(false);
    }
    setAbierto(!abierto);
  };

  const handleMarcarLeida = async (id: string) => {
    await marcarComoLeida(id);
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
    setNoLeidas((prev) => Math.max(0, prev - 1));
  };

  const handleMarcarTodas = async () => {
    await marcarTodasComoLeidas(usuarioId);
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    setNoLeidas(0);
  };

  return (
    <div className="relative">
      {/* Campanita */}
      <button
        ref={bellRef}
        type="button"
        onClick={handleToggle}
        className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
          abierto
            ? 'bg-teal-100 text-teal-700'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        title="Notificaciones"
      >
        <i className="ri-notification-3-line text-xl"></i>
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5 leading-none">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {/* Panel desplegable */}
      {abierto && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-96 max-h-[520px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Notificaciones</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}
              </p>
            </div>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={handleMarcarTodas}
                className="text-xs text-teal-600 hover:text-teal-800 font-medium cursor-pointer whitespace-nowrap"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
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
                  Cuando haya cambios en documentos o tickets, aparecerán aquí
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
                      {/* Icono */}
                      <div className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${getIconoColor(notif.tipo)}`}>
                        <i className={`${notif.icono} text-base`}></i>
                      </div>

                      {/* Contenido */}
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
                            <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[160px]" title={notif.po_tiquetera}>
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
  );
}