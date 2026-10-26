// KPI · Duración Promedio Asignado → Notificado (Dropship).

import type { KpiAsignadoNotificado } from './types';

interface Props {
  kpi: KpiAsignadoNotificado;
  promedioCreacionNotificado: number;
  totalDetalle: number;
  onVerDesglose: () => void;
}

export default function TarjetaAsignadoNotificado({
  kpi,
  promedioCreacionNotificado,
  totalDetalle,
  onVerDesglose,
}: Props) {
  return (
    <div className="bg-gradient-to-br from-sky-50 to-cyan-50 border border-sky-200 rounded-xl p-6 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 flex items-center justify-center bg-sky-500 rounded-xl">
          <i className="ri-timer-line text-white text-2xl"></i>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Duración Promedio Asignado → Notificado</h3>
          <p className="text-sm text-gray-600">
            Promedio de días hábiles entre la asignación y la notificación del expediente (Dropship)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-sky-100">
              <i className="ri-time-line text-2xl text-sky-600"></i>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-600">Duración Promedio</h4>
              <p className="text-xs text-gray-500 mt-1">Asignado → Notificado</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-sky-600">{kpi.promedioDias}</span>
            <span className="text-lg text-gray-500">días</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-cyan-100">
              <i className="ri-file-list-3-line text-2xl text-cyan-600"></i>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-600">Expedientes Evaluados</h4>
              <p className="text-xs text-gray-500 mt-1">notificados en el período</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-gray-800">{kpi.totalEvaluados}</span>
            <span className="text-lg text-gray-500">exp.</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-teal-100">
              <i className="ri-ship-line text-2xl text-teal-600"></i>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-600">Promedio Creación → Notificado</h4>
              <p className="text-xs text-gray-500 mt-1">desde la creación del expediente</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-teal-600">
              {promedioCreacionNotificado > 0 ? promedioCreacionNotificado : '—'}
            </span>
            <span className="text-lg text-gray-500">
              {promedioCreacionNotificado > 0 ? 'días' : ''}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-gray-100">
              <i className="ri-bar-chart-box-line text-2xl text-gray-600"></i>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-600">Desglose</h4>
              <p className="text-xs text-gray-500 mt-1">detalle por expediente</p>
            </div>
          </div>
          <button
            onClick={onVerDesglose}
            disabled={totalDetalle === 0}
            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-100 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-file-chart-line"></i>
            Ver desglose completo
          </button>
        </div>
      </div>
    </div>
  );
}