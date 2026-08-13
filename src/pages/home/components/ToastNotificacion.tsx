import {
  getIconoColor,
  getTipoLabel,
  timeAgo,
} from '@/lib/notificaciones';
import type { ToastItem } from '@/hooks/useNotificaciones';

function estilosPorCantidad(cantidad: number) {
  if (cantidad >= 4) {
    return {
      contenedor: 'w-[340px]',
      padding: 'p-3',
      gap: 'gap-2.5',
      icono: 'w-9 h-9 rounded-lg',
      iconoTam: 'text-base',
      etiqueta: 'text-[11px]',
      mensaje: 'text-[13px]',
    };
  }

  if (cantidad === 2 || cantidad === 3) {
    return {
      contenedor: 'w-[380px]',
      padding: 'p-4',
      gap: 'gap-3',
      icono: 'w-10 h-10 rounded-lg',
      iconoTam: 'text-lg',
      etiqueta: 'text-xs',
      mensaje: 'text-sm',
    };
  }

  return {
    contenedor: 'w-[420px]',
    padding: 'p-5',
    gap: 'gap-4',
    icono: 'w-12 h-12 rounded-xl',
    iconoTam: 'text-xl',
    etiqueta: 'text-xs',
    mensaje: 'text-[15px]',
  };
}

interface TarjetaToastProps {
  item: ToastItem;
  cantidad: number;
  onCerrar: (clave: string) => void;
}

function TarjetaToast({ item, cantidad, onCerrar }: TarjetaToastProps) {
  const { clave, notificacion } = item;
  const estilos = estilosPorCantidad(cantidad);

  return (
    <div
      className={`pointer-events-auto max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-700/70 rounded-xl overflow-hidden animate-toast-in ${estilos.contenedor}`}
    >
      <div className={`flex items-start ${estilos.gap} ${estilos.padding}`}>
        <div
          className={`flex items-center justify-center flex-shrink-0 ${estilos.icono} ${getIconoColor(notificacion.tipo)}`}
        >
          <i className={`${notificacion.icono} ${estilos.iconoTam}`}></i>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className={`font-semibold uppercase tracking-wider text-zinc-400 ${estilos.etiqueta}`}>
              {getTipoLabel(notificacion.tipo)}
            </span>
            <span className={`text-zinc-400 whitespace-nowrap ${estilos.etiqueta}`}>
              {timeAgo(notificacion.created_at)}
            </span>
          </div>
          <p className={`mt-1 text-zinc-100 leading-snug break-words ${estilos.mensaje}`}>
            {notificacion.mensaje}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onCerrar(clave)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
          aria-label="Cerrar notificación"
        >
          <i className="ri-close-line text-lg"></i>
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
        <TarjetaToast
          key={item.clave}
          item={item}
          cantidad={toasts.length}
          onCerrar={onCerrar}
        />
      ))}
    </div>
  );
}