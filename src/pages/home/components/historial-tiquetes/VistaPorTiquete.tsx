import { useState } from 'react';
import type { TiqueteHistorial } from './types';
import { etiquetaModulo, fechaHora, formatearMinutos } from './utils';
import LineaTiempo from './LineaTiempo';
import RutaEstados from './RutaEstados';

interface Props {
  tiquetes: TiqueteHistorial[];
}

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

  const alternar = (id: string) => setAbiertos((prev) => ({ ...prev, [id]: !prev[id] }));

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

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-100 whitespace-nowrap">
                    <i className="ri-route-line"></i>
                    {tiquete.estadosRecorridos} estados recorridos
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-100 whitespace-nowrap">
                    <i className="ri-timer-line"></i>
                    Ciclo: {formatearMinutos(tiquete.minutosCiclo)}
                  </span>
                  {tiquete.minutosEstadoActual !== null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-100 whitespace-nowrap">
                      <i className="ri-map-pin-2-line"></i>
                      En {tiquete.estadoActual}: {formatearMinutos(tiquete.minutosEstadoActual)}
                    </span>
                  )}
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
              <div className="border-t border-gray-100 p-4 bg-gray-50/60 space-y-3">
                <RutaEstados
                  ruta={tiquete.ruta}
                  estadoActual={tiquete.estadoActual}
                  minutosCiclo={tiquete.minutosCiclo}
                  estadosRecorridos={tiquete.estadosRecorridos}
                  totalCambiosEstado={tiquete.totalCambiosEstado}
                />
                <LineaTiempo tiquete={tiquete} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}