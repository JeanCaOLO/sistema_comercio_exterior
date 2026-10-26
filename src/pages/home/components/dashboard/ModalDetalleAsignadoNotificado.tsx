import { formatearFechaCorta } from '@/lib/fechas';

export interface FilaAsignadoNotificado {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  fechaAsignado: string;
  fechaNotificado: string;
  dias: number;
}

interface ModalDetalleAsignadoNotificadoProps {
  abierto: boolean;
  kpi: { totalEvaluados: number; promedioDias: number };
  filas: FilaAsignadoNotificado[];
  onClose: () => void;
  onDescargar: () => void;
}

export default function ModalDetalleAsignadoNotificado({
  abierto,
  kpi,
  filas,
  onClose,
  onDescargar
}: ModalDetalleAsignadoNotificadoProps) {
  if (!abierto) return null;

  const maximo = filas.length > 0 ? Math.max(...filas.map((d) => d.dias)) : 0;
  const minimo = filas.length > 0 ? Math.min(...filas.map((d) => d.dias)) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Detalle Asignado → Notificado</h2>
            <p className="text-sm text-gray-500 mt-1">Días entre la asignación y la notificación de cada expediente Dropship</p>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{kpi.totalEvaluados}</p>
              <p className="text-xs text-gray-500">Total Evaluados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-sky-600">{kpi.promedioDias} días</p>
              <p className="text-xs text-gray-500">Promedio</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{maximo} días</p>
              <p className="text-xs text-gray-500">Máximo</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{minimo} días</p>
              <p className="text-xs text-gray-500">Mínimo</p>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Fecha Asignado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Fecha Notificado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{exp.po_tiquetera}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.exp_id || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.solicitante}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaAsignado)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaNotificado)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-sky-700">{exp.dias} días</span>
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <i className="ri-inbox-line text-4xl mb-2"></i>
                    <p className="text-sm">No hay expedientes para mostrar</p>
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