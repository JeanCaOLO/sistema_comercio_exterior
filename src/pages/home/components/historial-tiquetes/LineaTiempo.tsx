import { useState } from 'react';
import type { TiqueteHistorial } from './types';
import { fechaHora, formatearMinutos, texto } from './utils';

interface Props {
  tiquete: TiqueteHistorial;
}

const LIMITE_VISIBLE = 12;

export default function LineaTiempo({ tiquete }: Props) {
  const [verTodo, setVerTodo] = useState(false);

  if (tiquete.movimientos.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-5">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <i className="ri-information-line text-gray-400"></i>
          Este tíquete no tiene movimientos registrados en el historial.
        </div>
      </div>
    );
  }

  const visibles = verTodo ? tiquete.movimientos : tiquete.movimientos.slice(0, LIMITE_VISIBLE);
  const ocultos = tiquete.movimientos.length - visibles.length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 bg-gray-50/70">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 text-gray-700">
            <i className="ri-history-line text-sm"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Historial completo de movimientos</p>
            <p className="text-[11px] text-gray-500">
              Todos los cambios del tíquete, del más reciente al más antiguo, con el tiempo entre cada uno
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-[11px] font-semibold text-gray-700 whitespace-nowrap">
          <i className="ri-list-check-2"></i>
          {tiquete.movimientos.length} movimiento{tiquete.movimientos.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="px-4 py-4">
        <div className="space-y-3">
          {visibles.map((mov, index) => (
            <div key={mov.id || `${tiquete.expedienteId}-${index}`} className="relative pl-6">
              <span
                className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ${
                  mov.esCambioEstado
                    ? 'bg-amber-500 ring-amber-100'
                    : 'bg-teal-500 ring-teal-100'
                }`}
              ></span>
              {index < visibles.length - 1 && (
                <span className="absolute left-[4px] top-5 bottom-[-14px] w-px bg-gray-200"></span>
              )}

              <div
                className={`border rounded-lg px-3.5 py-3 ${
                  mov.esCambioEstado ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${
                        mov.esCambioEstado
                          ? 'bg-amber-100 text-amber-900 border-amber-200'
                          : 'bg-teal-50 text-teal-800 border-teal-100'
                      }`}
                    >
                      {mov.esCambioEstado && <i className="ri-route-line mr-1"></i>}
                      {mov.campoModificado}
                    </span>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap">
                      <i className="ri-time-line mr-1"></i>
                      {fechaHora(mov.fechaCambio)}
                    </span>
                    {mov.minutosDesdeAnterior !== null && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-800 border border-sky-100 whitespace-nowrap">
                        <i className="ri-timer-flash-line mr-1"></i>
                        +{formatearMinutos(mov.minutosDesdeAnterior)} desde el anterior
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-600 whitespace-nowrap">
                    <i className="ri-user-line mr-1"></i>
                    {mov.usuario}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 border border-red-100 break-all">
                    <span className="font-medium">Anterior:</span>{' '}
                    {texto(mov.valorAnterior) || 'N/A'}
                  </span>
                  <i className="ri-arrow-right-line text-gray-400 flex-shrink-0"></i>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 break-all">
                    <span className="font-medium">Nuevo:</span>{' '}
                    {texto(mov.valorNuevo) || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {ocultos > 0 && (
          <button
            type="button"
            onClick={() => setVerTodo(true)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-down-s-line"></i>
            Ver {ocultos} movimiento{ocultos === 1 ? '' : 's'} más
          </button>
        )}

        {verTodo && tiquete.movimientos.length > LIMITE_VISIBLE && (
          <button
            type="button"
            onClick={() => setVerTodo(false)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-up-s-line"></i>
            Ocultar movimientos
          </button>
        )}
      </div>
    </div>
  );
}