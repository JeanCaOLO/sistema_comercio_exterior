// Resumen visual de la cobertura de datos de embarque en los tickets que barre Raga.

import { useState } from 'react';
import type { CoberturaEmbarque } from '@/lib/ragaSync';

interface Props {
  cobertura: CoberturaEmbarque;
  cargando?: boolean;
}

interface MiniDatoProps {
  icono: string;
  etiqueta: string;
  valor: number;
  tono: 'ok' | 'alerta' | 'neutro';
  sufijo?: string;
}

const TONOS: Record<MiniDatoProps['tono'], string> = {
  ok: 'bg-teal-50 border-teal-100 text-teal-700',
  alerta: 'bg-amber-50 border-amber-100 text-amber-700',
  neutro: 'bg-gray-50 border-gray-200 text-gray-700',
};

function MiniDato({ icono, etiqueta, valor, tono, sufijo }: MiniDatoProps) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${TONOS[tono]}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          <i className={`${icono} text-xs`}></i>
        </span>
        <p className="text-[11px] font-medium truncate">{etiqueta}</p>
      </div>
      <p className="mt-1 text-lg font-bold leading-none text-gray-900">
        {valor}
        {sufijo && <span className="text-[11px] font-medium text-gray-500 ml-1">{sufijo}</span>}
      </p>
    </div>
  );
}

export default function CoberturaEmbarqueRaga({ cobertura, cargando }: Props) {
  const { total, completos, sinBl, sinContenedor, sinFechas, pendientes, porcentajeCompletos } =
    cobertura;
  const [abierto, setAbierto] = useState(true);

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/70">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="w-full flex items-center justify-between gap-3 flex-wrap px-3 py-2.5 text-left cursor-pointer rounded-lg hover:bg-gray-100/70 transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-4 h-4 flex items-center justify-center text-gray-500 flex-shrink-0">
            <i className="ri-ship-2-line text-sm"></i>
          </span>
          <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
            Cobertura de datos de embarque
          </p>
          <span className="text-[11px] text-gray-500 hidden sm:inline">
            · tickets Dropship en los estados que barre Raga
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {cargando ? (
            <span className="text-[11px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
              <i className="ri-loader-4-line animate-spin"></i> Calculando…
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-gray-700 whitespace-nowrap">
              {completos} de {total} con BL y contenedor
            </span>
          )}
          <span className="w-6 h-6 flex items-center justify-center rounded-md text-gray-500">
            <i className={abierto ? 'ri-arrow-up-s-line text-base' : 'ri-arrow-down-s-line text-base'}></i>
          </span>
        </div>
      </button>

      {abierto && (
        <div className="px-3 pb-3">
          <div className="mt-1">
            <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-500"
                style={{ width: `${total > 0 ? porcentajeCompletos : 0}%` }}
              ></div>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              {total === 0
                ? 'No hay tickets Dropship en los estados que barre la sincronización.'
                : pendientes === 0
                  ? 'Todos los tickets ya tienen N° de BL y N° de Contenedor.'
                  : `Quedan ${pendientes} ticket(s) sin N° de BL o sin N° de Contenedor para que Raga intente completar.`}
            </p>
          </div>

          <div className="mt-2.5 grid grid-cols-2 lg:grid-cols-4 gap-2">
            <MiniDato icono="ri-checkbox-circle-line" etiqueta="Completos (BL + contenedor)" valor={completos} tono="ok" />
            <MiniDato icono="ri-file-text-line" etiqueta="Sin N° de BL" valor={sinBl} tono="alerta" />
            <MiniDato icono="ri-box-3-line" etiqueta="Sin N° de Contenedor" valor={sinContenedor} tono="alerta" />
            <MiniDato icono="ri-calendar-line" etiqueta="Sin ETD o ETA Real" valor={sinFechas} tono="neutro" />
          </div>
        </div>
      )}
    </div>
  );
}