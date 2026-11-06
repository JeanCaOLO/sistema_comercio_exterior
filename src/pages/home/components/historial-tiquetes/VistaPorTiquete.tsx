import { useState } from 'react';
import type { TiqueteHistorial } from './types';
import { etiquetaModulo, fechaHora, texto } from './utils';

interface Props {
  tiquetes: TiqueteHistorial[];
}

const LIMITE_VISIBLE = 12;

const chipModulo = (modulo: string): string =>
  modulo === 'dropship'
    ? 'bg-sky-100 text-sky-800'
    : modulo === 'zf'
    ? 'bg-violet-100 text-violet-800'
    : 'bg-gray-100 text-gray-700';

const colorAntiguedad = (dias: number | null): string => {
  if (dias === null) return 'bg-gray-100 text-gray-600';
  if (dias > 30) return 'bg-red-100 text-red-800';
  if (dias > 7) return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
};

export default function VistaPorTiquete({ tiquetes }: Props) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [verTodo, setVerTodo] = useState<Record<string, boolean>>({});

  const alternar = (id: string) =>
    setAbiertos((prev) => ({ ...prev, [id]: !prev[id] }));

  if (tiquetes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
        <i className="ri-history-line text-4xl text-gray-300"></i>
        <p className="text-sm text-gray-500 mt-2">No hay tíquetes con los filtros seleccionados</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tiquetes.map((tiquete) => {
        const abierto = Boolean(abiertos[tiquete.expedienteId]);
        const mostrarTodo = Boolean(verTodo[tiquete.expedienteId]);
        const visibles = mostrarTodo
          ? tiquete.movimientos
          : tiquete.movimientos.slice(0, LIMITE_VISIBLE);
        const ocultos = tiquete.movimientos.length - visibles.length;

        return (
          <div
            key={tiquete.expedienteId}
            className={`bg-white rounded-xl border overflow-hidden transition-colors ${
              abierto ? 'border-teal-300 shadow-sm' : 'border-gray-200'
            }`}
          >
            <button
              type="button"
              onClick={() => alternar(tiquete.expedienteId)}
              className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 flex-shrink-0 mt-0.5">
                <i className={abierto ? 'ri-subtract-line' : 'ri-add-line'}></i>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                    {tiquete.po}
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    EXP {tiquete.expId}
                  </span>
                  {tiquete.modulo && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${chipModulo(
                        tiquete.modulo
                      )}`}
                    >
                      {etiquetaModulo(tiquete.modulo)}
                    </span>
                  )}
                  {tiquete.urgente && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 whitespace-nowrap">
                      URGENTE
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                    {tiquete.estadoActual}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                  <span className="whitespace-nowrap">
                    <i className="ri-user-line mr-1"></i>
                    {tiquete.responsable}
                  </span>
                  <span className="whitespace-nowrap">
                    <i className="ri-shake-hands-line mr-1"></i>
                    {tiquete.solicitante}
                  </span>
                  <span className="whitespace-nowrap">
                    <i className="ri-calendar-line mr-1"></i>
                    Solicitud: {tiquete.fechaSolicitud ? fechaHora(tiquete.fechaSolicitud) : '—'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 whitespace-nowrap">
                  <i className="ri-history-line text-teal-600"></i>
                  {tiquete.totalMovimientos} movimiento{tiquete.totalMovimientos === 1 ? '' : 's'}
                </span>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  Último: {fechaHora(tiquete.ultimoCambio)}
                </span>
                {tiquete.diasSinMovimiento !== null && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${colorAntiguedad(
                      tiquete.diasSinMovimiento
                    )}`}
                  >
                    {tiquete.diasSinMovimiento === 0
                      ? 'Movimiento hoy'
                      : `${tiquete.diasSinMovimiento} d sin movimiento`}
                  </span>
                )}
              </div>
            </button>

            {abierto && (
              <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/60">
                {tiquete.movimientos.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <i className="ri-information-line text-gray-400"></i>
                    Este tíquete no tiene movimientos registrados en el historial.
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {visibles.map((mov, index) => (
                        <div
                          key={mov.id || `${tiquete.expedienteId}-${index}`}
                          className="relative pl-6"
                        >
                          <span className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-teal-500 ring-4 ring-teal-100"></span>
                          {index < visibles.length - 1 && (
                            <span className="absolute left-[4px] top-5 bottom-[-14px] w-px bg-teal-200"></span>
                          )}

                          <div className="bg-white border border-gray-200 rounded-lg px-3.5 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-100 whitespace-nowrap">
                                  {mov.campoModificado}
                                </span>
                                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                                  <i className="ri-time-line mr-1"></i>
                                  {fechaHora(mov.fechaCambio)}
                                </span>
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
                        onClick={() =>
                          setVerTodo((prev) => ({ ...prev, [tiquete.expedienteId]: true }))
                        }
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-arrow-down-s-line"></i>
                        Ver {ocultos} movimiento{ocultos === 1 ? '' : 's'} más
                      </button>
                    )}

                    {mostrarTodo && tiquete.movimientos.length > LIMITE_VISIBLE && (
                      <button
                        type="button"
                        onClick={() =>
                          setVerTodo((prev) => ({ ...prev, [tiquete.expedienteId]: false }))
                        }
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-arrow-up-s-line"></i>
                        Ocultar movimientos
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}