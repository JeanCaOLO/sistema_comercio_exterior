// KPI · Indicador de Duración Mínima de Expedientes (carga de factura → liberación).
// Se muestra como MEDIDOR (gauge) para leer el cumplimiento de un vistazo.

import type { KpiDuracion } from './types';

interface Props {
  kpi: KpiDuracion;
  onVerReporte: () => void;
  onVerNoCumplen: () => void;
}

interface MedidorProps {
  porcentaje: number;
  color: string;
  etiqueta: string;
  vacio: boolean;
}

const RADIO = 124;
const TRAZO = 32;

function MedidorCumplimiento({ porcentaje, color, etiqueta, vacio }: MedidorProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(porcentaje) ? porcentaje : 0));
  const angulo = -90 + (pct * 180) / 100;
  const barrido = pct * 1.8; // 180deg equivalen al 100%
  const rad = (angulo * Math.PI) / 180;
  const marcadorX = RADIO * Math.sin(rad);
  const marcadorY = RADIO * Math.cos(rad);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[280px] h-[150px]" style={{ overflow: 'hidden' }}>
        {/* Pista + arco de valor */}
        <div
          className="absolute left-0 bottom-0 w-[280px] h-[280px] rounded-full"
          style={{
            background: `conic-gradient(from 270deg, ${color} 0deg ${barrido}deg, #e5e7eb ${barrido}deg 180deg, transparent 180deg 360deg)`
          }}
        ></div>

        {/* Hueco interior (dona) */}
        <div
          className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 rounded-full bg-white"
          style={{ width: 280 - TRAZO * 2, height: 280 - TRAZO * 2 }}
        ></div>

        {/* Marcador del valor sobre el arco */}
        {!vacio && (
          <div
            className="absolute w-3.5 h-3.5 rounded-full border-2 border-white"
            style={{
              background: color,
              left: `calc(50% + ${marcadorX}px)`,
              bottom: `calc(${marcadorY}px - 7px)`,
              transform: 'translateX(-50%)'
            }}
          ></div>
        )}

        {/* Valor central */}
        <div className="absolute inset-x-0 bottom-2 flex flex-col items-center">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold" style={{ color }}>
              {vacio ? '—' : pct}
            </span>
            {!vacio && <span className="text-lg font-semibold text-gray-400">%</span>}
          </div>
          <span className="text-[11px] font-medium text-gray-500 mt-0.5">{etiqueta}</span>
        </div>
      </div>

      <div className="flex items-center justify-between w-[280px] mt-1 px-1">
        <span className="text-[11px] font-medium text-gray-400">0%</span>
        <span className="text-[11px] font-medium text-gray-400">100%</span>
      </div>
    </div>
  );
}

export default function TarjetaDuracionMinima({ kpi, onVerReporte, onVerNoCumplen }: Props) {
  const sinDatos = kpi.totalEvaluados === 0;

  const tono = sinDatos
    ? 'gray'
    : kpi.porcentajeCumplimiento >= 80
      ? 'teal'
      : kpi.porcentajeCumplimiento >= 50
        ? 'amber'
        : 'red';

  const COLOR: Record<string, string> = {
    teal: '#0d9488',
    amber: '#f59e0b',
    red: '#ef4444',
    gray: '#d1d5db'
  };

  const fondo =
    tono === 'gray'
      ? 'bg-gray-50 border-gray-200'
      : tono === 'teal'
        ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-300'
        : tono === 'amber'
          ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300'
          : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300';

  const fondoIcono =
    tono === 'teal'
      ? 'bg-teal-600'
      : tono === 'amber'
        ? 'bg-amber-500'
        : tono === 'red'
          ? 'bg-red-500'
          : 'bg-gray-400';

  return (
    <div className={`rounded-xl p-6 mb-8 border-2 ${fondo}`}>
      {/* Cabecera */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0 ${fondoIcono}`}>
            <i className="ri-timer-flash-line text-white text-2xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Indicador de Duración Mínima de Expedientes
            </h3>
            <p className="text-sm text-gray-600">
              Meta: cada expediente debe durar menos de <strong>3 días hábiles</strong> desde la{' '}
              <strong>carga de la factura</strong> hasta su liberación (solo Dropship)
            </p>
          </div>
        </div>

        {kpi.noCumplen > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300 rounded-xl flex-shrink-0 animate-pulse">
            <i className="ri-alarm-warning-fill text-red-600 text-xl"></i>
            <div className="text-sm">
              <p className="font-bold text-red-700">
                {kpi.noCumplen} expediente{kpi.noCumplen !== 1 ? 's' : ''} fuera de rango
              </p>
              <p className="text-red-600 text-xs">Duración de 3 días o más</p>
            </div>
          </div>
        )}
        {kpi.noCumplen === 0 && kpi.totalEvaluados > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-teal-100 border border-teal-300 rounded-xl flex-shrink-0">
            <i className="ri-shield-check-fill text-teal-600 text-xl"></i>
            <div className="text-sm">
              <p className="font-bold text-teal-700">Todo en orden</p>
              <p className="text-teal-600 text-xs">100% cumple la meta</p>
            </div>
          </div>
        )}
      </div>

      {/* Medidor + métricas */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-5 flex flex-col items-center justify-center">
          <MedidorCumplimiento
            porcentaje={kpi.porcentajeCumplimiento}
            color={COLOR[tono]}
            etiqueta="cumplimiento global"
            vacio={sinDatos}
          />
          <p className="mt-4 text-[11px] text-gray-500 text-center">
            {sinDatos
              ? 'Sin expedientes evaluables en el período'
              : `${kpi.totalEvaluados} expediente${kpi.totalEvaluados !== 1 ? 's' : ''} evaluado${kpi.totalEvaluados !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Cumplen */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 flex flex-col">
            <p className="text-xs font-medium text-gray-500 mb-2">Cumplen Meta</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-teal-600">{kpi.cumplen}</span>
              <span className="text-lg text-gray-500">exp.</span>
            </div>
            <div className="flex items-center gap-1 mt-auto pt-3">
              <i className="ri-checkbox-circle-fill text-teal-500 text-lg"></i>
              <span className="text-xs text-teal-700 font-medium">&lt; 3 días de duración</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Dentro del rango aceptable</p>
          </div>

          {/* No Cumplen */}
          <div
            onClick={onVerNoCumplen}
            className={`bg-white rounded-xl p-5 border-2 cursor-pointer hover:shadow-md transition-shadow flex flex-col ${
              kpi.noCumplen > 0 ? 'border-red-300' : 'border-gray-200'
            }`}
          >
            <p className="text-xs font-medium text-gray-500 mb-2">No Cumplen Meta</p>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-4xl font-bold ${
                  kpi.noCumplen > 0 ? 'text-red-600' : 'text-gray-400'
                }`}
              >
                {kpi.noCumplen}
              </span>
              <span className="text-lg text-gray-500">exp.</span>
            </div>
            <div className="flex items-center gap-1 mt-auto pt-3">
              <i
                className={`ri-error-warning-fill text-lg ${
                  kpi.noCumplen > 0 ? 'text-red-500' : 'text-gray-400'
                }`}
              ></i>
              <span
                className={`text-xs font-medium ${
                  kpi.noCumplen > 0 ? 'text-red-700' : 'text-gray-400'
                }`}
              >
                ≥ 3 días de duración
              </span>
            </div>
            <p className="text-xs text-teal-600 mt-1 font-medium">Haz clic para ver el detalle</p>
          </div>

          {/* Promedio general */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 flex flex-col">
            <p className="text-xs font-medium text-gray-500 mb-2">Duración Promedio</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-800">{kpi.diasPromedioTotal}</span>
              <span className="text-lg text-gray-500">días</span>
            </div>
            <div className="flex items-center gap-1 mt-auto pt-3">
              <i className="ri-bar-chart-box-line text-gray-500 text-lg"></i>
              <span className="text-xs text-gray-600">Promedio del período</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Meta: menos de 3 días hábiles</p>
          </div>
        </div>
      </div>

      {/* Botón abrir reporte */}
      <div className="flex justify-end">
        <button
          onClick={onVerReporte}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-file-chart-line text-teal-600"></i>
          Ver reporte completo de cumplimiento
        </button>
      </div>
    </div>
  );
}