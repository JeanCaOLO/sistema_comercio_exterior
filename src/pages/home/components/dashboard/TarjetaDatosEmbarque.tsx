// Indicador de cobertura de datos de embarque en los tickets Dropship del período.

import type { DatosEmbarqueDropship } from './types';

interface Props {
  datos: DatosEmbarqueDropship;
  totalDetalle: number;
  onVerDetalle: () => void;
}

interface DatoProps {
  icono: string;
  etiqueta: string;
  valor: number;
  color: string;
  fondo: string;
}

function Dato({ icono, etiqueta, valor, color, fondo }: DatoProps) {
  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`w-6 h-6 flex items-center justify-center rounded-md ${fondo} flex-shrink-0`}>
          <i className={`${icono} text-xs ${color}`}></i>
        </span>
        <p className="text-[11px] font-medium text-gray-600 truncate">{etiqueta}</p>
      </div>
      <p className="mt-1.5 text-xl font-bold text-gray-900 leading-none">{valor}</p>
    </div>
  );
}

export default function TarjetaDatosEmbarque({ datos, totalDetalle, onVerDetalle }: Props) {
  const { total, completos, sinDatos, sinBl, sinContenedor, sinFechas, porcentajeSinDatos, porcentajeCompletos } =
    datos;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100 text-slate-700 flex-shrink-0">
            <i className="ri-ship-2-line text-xl"></i>
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900">Cobertura de datos de embarque</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Tickets Dropship del período que todavía no tienen N° de BL o N° de Contenedor
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onVerDetalle}
          disabled={totalDetalle === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <i className="ri-list-check-2"></i>
          Ver tickets pendientes
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
            Sin datos de embarque
          </p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-4xl font-bold text-amber-700 leading-none">{porcentajeSinDatos}%</span>
            <span className="text-xs font-medium text-amber-700">
              {sinDatos} de {total}
            </span>
          </div>
          <div className="mt-3">
            <div className="h-1.5 w-full rounded-full bg-amber-200/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-500"
                style={{ width: `${total > 0 ? porcentajeCompletos : 0}%` }}
              ></div>
            </div>
            <p className="mt-1.5 text-[11px] text-amber-800">
              {total === 0
                ? 'Sin tickets Dropship en el período.'
                : `${completos} ticket(s) con BL y contenedor completos.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
          <Dato
            icono="ri-checkbox-circle-line"
            etiqueta="Completos (BL + contenedor)"
            valor={completos}
            color="text-teal-600"
            fondo="bg-teal-50"
          />
          <Dato
            icono="ri-file-text-line"
            etiqueta="Sin N° de BL"
            valor={sinBl}
            color="text-amber-600"
            fondo="bg-amber-50"
          />
          <Dato
            icono="ri-box-3-line"
            etiqueta="Sin N° de Contenedor"
            valor={sinContenedor}
            color="text-amber-600"
            fondo="bg-amber-50"
          />
          <Dato
            icono="ri-calendar-line"
            etiqueta="Sin ETD o ETA Real"
            valor={sinFechas}
            color="text-slate-600"
            fondo="bg-slate-100"
          />
        </div>
      </div>
    </div>
  );
}