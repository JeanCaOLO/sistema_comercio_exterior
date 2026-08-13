import { useEffect, useState } from 'react';
import {
  getIconoColor,
  getTipoLabel,
  timeAgo,
} from '@/lib/notificaciones';
import type { ToastItem } from '@/hooks/useNotificaciones';

interface TarjetaToastProps {
  item: ToastItem;
  onCerrar: (clave: string) => void;
}

function TarjetaToast({ item, onCerrar }: TarjetaToastProps) {
  const [pausado, setPausado] = useState(false);
  const { clave, notificacion } = item;

  useEffect(() => {
    if (pausado) return;
    const timer = setTimeout(() => onCerrar(clave), 6000);
    return () => clearTimeout(timer);
  }, [clave, onCerrar, pausado]);

  return (
    <div
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      className="pointer-events-auto w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-gray-200 overflow-hidden animate-toast-in"
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={`w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0 ${getIconoColor(notificacion.tipo)}`}
        >
          <i className={`${notificacion.icono} text-lg`}></i>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {getTipoLabel(notificacion.tipo)}
            </span>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">
              {timeAgo(notificacion.created_at)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-800 leading-snug break-words">
            {notificacion.mensaje}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onCerrar(clave)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
          aria-label="Cerrar notificación"
        >
          <i className="ri-close-line text-base"></i>
        </button>
      </div>
    </div>
  );
}

interface ToastNotificacionesProps {
  toasts: ToastItem[];
  onCerrar: (clave: string) => void;
}

export default function ToastNotificaciones({ toasts, onCerrar }: ToastNotificacionesProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((item) => (
        <TarjetaToast key={item.clave} item={item} onCerrar={onCerrar} />
      ))}
    </div>
  );
}