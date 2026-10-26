// Tarjeta de distribución por estado (general / dropship / zf).

import ProgressBar from '@/pages/home/components/ProgressBar';
import type { EstadoData, VistaEstados } from './types';

interface Props {
  estadoData: EstadoData;
  estadoDataDropship: EstadoData;
  estadoDataZF: EstadoData;
  vista: VistaEstados;
  onVista: (vista: VistaEstados) => void;
}

const TABS: { clave: VistaEstados; etiqueta: string }[] = [
  { clave: 'general', etiqueta: 'General' },
  { clave: 'dropship', etiqueta: 'Dropship' },
  { clave: 'zf', etiqueta: 'ZF' },
];

export default function EstadosExpedientes({
  estadoData,
  estadoDataDropship,
  estadoDataZF,
  vista,
  onVista,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h3 className="text-lg font-semibold text-gray-900">Estado de Expedientes</h3>
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.clave}
              onClick={() => onVista(tab.clave)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                vista === tab.clave
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {vista === 'general' && (
        <div className="space-y-4">
          <ProgressBar label="Asignado" value={estadoData.asignado} total={estadoData.total} color="bg-indigo-500" />
          <ProgressBar label="En Proceso" value={estadoData.enProceso} total={estadoData.total} color="bg-amber-500" />
          <ProgressBar label="Espera de Respuesta" value={estadoData.esperaRespuesta} total={estadoData.total} color="bg-orange-400" />
          <ProgressBar label="Recepción de Carga" value={estadoData.recepcionCarga} total={estadoData.total} color="bg-sky-500" />
          <ProgressBar label="Liberación" value={estadoData.liberado} total={estadoData.total} color="bg-teal-500" />
          <ProgressBar label="Facturación" value={estadoData.facturacion} total={estadoData.total} color="bg-violet-500" />
          <ProgressBar label="Notificado" value={estadoData.notificado} total={estadoData.total} color="bg-green-500" />
          <ProgressBar label="Completado" value={estadoData.completado} total={estadoData.total} color="bg-emerald-500" />
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Total de expedientes: <span className="font-semibold text-gray-900">{estadoData.total}</span>
            </div>
          </div>
        </div>
      )}

      {vista === 'dropship' && (
        <div className="space-y-4">
          <ProgressBar label="Asignado" value={estadoDataDropship.asignado} total={estadoDataDropship.total} color="bg-indigo-500" />
          <ProgressBar label="En Proceso" value={estadoDataDropship.enProceso} total={estadoDataDropship.total} color="bg-amber-500" />
          <ProgressBar label="Espera de Respuesta" value={estadoDataDropship.esperaRespuesta} total={estadoDataDropship.total} color="bg-orange-400" />
          <ProgressBar label="Recepción de Carga" value={estadoDataDropship.recepcionCarga} total={estadoDataDropship.total} color="bg-sky-500" />
          <ProgressBar label="Liberación" value={estadoDataDropship.liberado} total={estadoDataDropship.total} color="bg-teal-500" />
          <ProgressBar label="Facturación" value={estadoDataDropship.facturacion} total={estadoDataDropship.total} color="bg-violet-500" />
          <ProgressBar label="Notificado" value={estadoDataDropship.notificado} total={estadoDataDropship.total} color="bg-green-500" />
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Total Dropship: <span className="font-semibold text-gray-900">{estadoDataDropship.total}</span>
            </div>
          </div>
        </div>
      )}

      {vista === 'zf' && (
        <div className="space-y-4">
          <ProgressBar label="Asignado" value={estadoDataZF.asignado} total={estadoDataZF.total} color="bg-indigo-500" />
          <ProgressBar label="En Proceso" value={estadoDataZF.enProceso} total={estadoDataZF.total} color="bg-amber-500" />
          <ProgressBar label="Espera de Respuesta" value={estadoDataZF.esperaRespuesta} total={estadoDataZF.total} color="bg-orange-400" />
          <ProgressBar label="Completado" value={estadoDataZF.completado} total={estadoDataZF.total} color="bg-emerald-500" />
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Total ZF: <span className="font-semibold text-gray-900">{estadoDataZF.total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}