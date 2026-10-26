// KPI · Indicador de Duración Mínima de Expedientes (carga de factura → liberación).

import type { KpiDuracion } from './types';

interface Props {
  kpi: KpiDuracion;
  onVerReporte: () => void;
  onVerNoCumplen: () => void;
}

export default function TarjetaDuracionMinima({ kpi, onVerReporte, onVerNoCumplen }: Props) {
  return (
    <div
      className={`rounded-xl p-6 mb-8 border-2 ${
        kpi.totalEvaluados === 0
          ? 'bg-gray-50 border-gray-200'
          : kpi.porcentajeCumplimiento >= 80
            ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-300'
            : kpi.porcentajeCumplimiento >= 50
              ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300'
              : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
      }`}
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 flex items-center justify-center rounded-xl ${
              kpi.porcentajeCumplimiento >= 80
                ? 'bg-teal-600'
                : kpi.porcentajeCumplimiento >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
          >
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

        {/* Alerta global */}
        {kpi.noCumplen > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300 rounded-xl animate-pulse">
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
          <div className="flex items-center gap-2 px-4 py-2 bg-teal-100 border border-teal-300 rounded-xl">
            <i className="ri-shield-check-fill text-teal-600 text-xl"></i>
            <div className="text-sm">
              <p className="font-bold text-teal-700">Todo en orden</p>
              <p className="text-teal-600 text-xs">100% cumple la meta</p>
            </div>
          </div>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Cumplimiento */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-2">Cumplimiento Global</p>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-4xl font-bold ${
                kpi.porcentajeCumplimiento >= 80
                  ? 'text-teal-600'
                  : kpi.porcentajeCumplimiento >= 50
                    ? 'text-amber-600'
                    : 'text-red-600'
              }`}
            >
              {kpi.porcentajeCumplimiento}
            </span>
            <span className="text-lg text-gray-500">%</span>
          </div>
          <div className="mt-3 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${
                kpi.porcentajeCumplimiento >= 80
                  ? 'bg-teal-500'
                  : kpi.porcentajeCumplimiento >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${kpi.porcentajeCumplimiento}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">{kpi.totalEvaluados} expedientes evaluados</p>
        </div>

        {/* Cumplen */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-2">Cumplen Meta</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-teal-600">{kpi.cumplen}</span>
            <span className="text-lg text-gray-500">exp.</span>
          </div>
          <div className="flex items-center gap-1 mt-3">
            <i className="ri-checkbox-circle-fill text-teal-500 text-lg"></i>
            <span className="text-xs text-teal-700 font-medium">&lt; 3 días de duración</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Dentro del rango aceptable</p>
        </div>

        {/* No Cumplen */}
        <div
          onClick={onVerNoCumplen}
          className={`bg-white rounded-xl p-5 border-2 cursor-pointer hover:shadow-md transition-shadow ${
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
          <div className="flex items-center gap-1 mt-3">
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
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-2">Duración Promedio</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-gray-800">{kpi.diasPromedioTotal}</span>
            <span className="text-lg text-gray-500">días</span>
          </div>
          <div className="flex items-center gap-1 mt-3">
            <i className="ri-bar-chart-box-line text-gray-500 text-lg"></i>
            <span className="text-xs text-gray-600">Promedio del período</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Meta: menos de 3 días hábiles</p>
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