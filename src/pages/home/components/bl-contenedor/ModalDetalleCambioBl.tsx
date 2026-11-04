import { useEffect } from 'react';
import type { EventoCambioBl } from '@/lib/blContenedor';
import { formatearFechaHora } from '@/lib/etdMotivos';
import EstadoBlBadge from './EstadoBlBadge';

interface ModalDetalleCambioBlProps {
  evento: EventoCambioBl;
  onClose: () => void;
}

function Dato({ etiqueta, valor, mono = false }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{etiqueta}</p>
      <p className={`mt-1 text-sm text-gray-900 break-words ${mono ? 'font-mono' : ''}`}>
        {valor || '—'}
      </p>
    </div>
  );
}

export default function ModalDetalleCambioBl({ evento, onClose }: ModalDetalleCambioBlProps) {
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onClose]);

  const aplicados = evento.campos_aplicados || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-xl border border-gray-200 my-8">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
              <i className="ri-file-list-3-line text-lg"></i>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-gray-900 truncate">
                  PO {evento.order_number}
                </h2>
                <EstadoBlBadge estado={evento.status} size="xs" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {evento.trading_company || 'Sin compañía'} · {formatearFechaHora(evento.requested_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Cerrar"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border-2 border-teal-200 bg-teal-50 px-4 py-3 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">N° de BL</p>
              <p className="mt-1 text-sm font-mono font-bold text-teal-900 break-all">
                {evento.new_bl || '—'}
              </p>
              <p className="mt-1 text-[11px] text-teal-700">
                Antes: <span className="font-mono">{evento.previous_bl || 'sin dato'}</span>
              </p>
            </div>
            <div className="rounded-lg border-2 border-teal-200 bg-teal-50 px-4 py-3 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">N° de Contenedor</p>
              <p className="mt-1 text-sm font-mono font-bold text-teal-900 break-all">
                {evento.new_container || '—'}
              </p>
              <p className="mt-1 text-[11px] text-teal-700">
                Antes: <span className="font-mono">{evento.previous_container || 'sin dato'}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Dato etiqueta="Motivo" valor={evento.change_reason} />
            <Dato
              etiqueta="Cargado por"
              valor={evento.requested_by_name || evento.requested_by_email || '—'}
            />
            <Dato
              etiqueta="Campos aplicados"
              valor={aplicados.length > 0 ? aplicados.join(' · ') : 'Ninguno'}
            />
            <Dato etiqueta="Entorno" valor={evento.api_env === 'production' ? 'Producción' : 'QA'} />
            <Dato
              etiqueta="Tickets locales actualizados"
              valor={String(evento.expedientes_actualizados || 0)}
            />
            <Dato etiqueta="Referencia" valor={evento.id.slice(0, 8).toUpperCase()} mono />
          </div>

          {evento.other_reason_detail && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Detalle del motivo
              </p>
              <p className="mt-1 text-sm text-gray-700 break-words leading-relaxed">
                {evento.other_reason_detail}
              </p>
            </div>
          )}

          {evento.api_error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
              <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">
                  Respuesta de Raga
                </p>
                <p className="mt-1 text-sm text-red-700 break-words leading-relaxed">
                  {evento.api_error}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}