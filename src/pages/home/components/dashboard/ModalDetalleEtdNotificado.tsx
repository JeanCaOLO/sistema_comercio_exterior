import { formatearFechaCorta } from '@/lib/fechas';

export interface FilaEtdNotificado {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  etd: string;
  fechaNotificado: string;
  diasDiferencia: number;
  cumpleMeta: boolean;
}

interface ModalDetalleEtdNotificadoProps {
  abierto: boolean;
  kpi: { totalEvaluados: number; dentroRango: number; fueraRango: number; promedioDias: number };
  filas: FilaEtdNotificado[];
  metaDias: number;
  onClose: () => void;
  onDescargar: () => void;
}

export default function ModalDetalleEtdNotificado({
  abierto,
  kpi,
  filas,
  metaDias,
  onClose,
  onDescargar
}: ModalDetalleEtdNotificadoProps) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Detalle ETD → Notificado</h2>
            <p className="text-sm text-gray-500 mt-1">POs Dropship con días entre su ETD y la fecha de Notificado</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDescargar}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-download-2-line"></i>
              Descargar Excel
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-2xl text-gray-500"></i>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{kpi.totalEvaluados}</p>
              <p className="text-xs text-gray-500">Total Evaluados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-600">{kpi.dentroRango}</p>
              <p className="text-xs text-gray-500">Dentro del rango (≤{metaDias} días)</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${kpi.fueraRango > 0 ? 'text-red-600' : 'text-gray-400'}`}>{kpi.fueraRango}</p>
              <p className="text-xs text-gray-500">Fuera del rango</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{kpi.promedioDias} días</p>
              <p className="text-xs text-gray-500">Promedio</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / Tiquetera</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">EXP ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Solicitante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">ETD</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Fecha Notificado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Cumple Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map((exp) => (
                <tr key={exp.id} className={`hover:bg-gray-50 transition-colors ${!exp.cumpleMeta ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{exp.po_tiquetera}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.exp_id || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.solicitante}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.etd)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaNotificado)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${exp.cumpleMeta ? 'text-teal-700' : 'text-red-600'}`}>
                      {exp.diasDiferencia} días
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {exp.cumpleMeta ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full whitespace-nowrap">
                        <i className="ri-checkbox-circle-fill"></i> Cumple
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full whitespace-nowrap">
                        <i className="ri-alarm-warning-fill"></i> Alerta
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <i className="ri-inbox-line text-4xl mb-2"></i>
                    <p className="text-sm">No hay POs para mostrar</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}