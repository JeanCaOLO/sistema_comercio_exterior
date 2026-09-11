import { formatearFechaCorta } from '../../../lib/fechas';
import { descargarExcel } from '../../../lib/exportar';

// ── Tipos de detalle para el desglose de POs MCG ──
export interface FilaCreacionMcg {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  fechaAsignado: string;
  fechaLiberacion: string;
  dias: number;
  cumpleMeta: boolean;
}

export interface FilaEtdMcg {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  etd: string;
  fechaNotificado: string;
  dias: number;
  cumpleMeta: boolean;
}

interface Props {
  tipo: 'creacion' | 'etd';
  filas: (FilaCreacionMcg | FilaEtdMcg)[];
  total: number;
  cumplen: number;
  noCumplen: number;
  promedioDias: number;
  onClose: () => void;
}

export default function ModalDetalleMcg({ tipo, filas, total, cumplen, noCumplen, promedioDias, onClose }: Props) {
  const esCreacion = tipo === 'creacion';
  const titulo = esCreacion ? 'Detalle Creación de Expediente MCG' : 'Detalle ETD → Notificado MCG';
  const subtitulo = esCreacion
    ? 'POs Dropship marcadas con MCG — días entre la asignación y cuando llega al estado de liberación'
    : 'POs Dropship marcadas con MCG — días entre su ETD y la fecha de Notificado';

  const descargar = () => {
    if (esCreacion) {
      const filasCreacion = filas as FilaCreacionMcg[];
      const filasExcel = filasCreacion.map(f => ({
        'PO/Tiquetera': f.po_tiquetera,
        'EXP ID': f.exp_id || '-',
        'Solicitante': f.solicitante,
        'Asignado': formatearFechaCorta(f.fechaAsignado),
        'Fecha Liberación': formatearFechaCorta(f.fechaLiberacion),
        'Días (Asignado → Liberación)': f.dias,
        'Cumple Meta (≤2 días)': f.cumpleMeta ? 'Sí' : 'No'
      }));
      descargarExcel(`reporte-mcg-creacion-${new Date().toISOString().split('T')[0]}.xlsx`, filasExcel);
    } else {
      const filasEtd = filas as FilaEtdMcg[];
      const filasExcel = filasEtd.map(f => ({
        'PO/Tiquetera': f.po_tiquetera,
        'EXP ID': f.exp_id || '-',
        'Solicitante': f.solicitante,
        'ETD': formatearFechaCorta(f.etd),
        'Fecha Notificado': formatearFechaCorta(f.fechaNotificado),
        'Días (ETD → Notificado)': f.dias,
        'Cumple Meta (<2 días)': f.cumpleMeta ? 'Sí' : 'No'
      }));
      descargarExcel(`reporte-mcg-etd-notificado-${new Date().toISOString().split('T')[0]}.xlsx`, filasExcel);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
            <p className="text-sm text-gray-500 mt-1">{subtitulo}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={descargar}
              disabled={filas.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Resumen rápido */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{total}</p>
              <p className="text-xs text-gray-500">Total Evaluados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-600">{cumplen}</p>
              <p className="text-xs text-gray-500">{esCreacion ? 'Cumplen (≤2d)' : 'Dentro (<2d)'}</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${noCumplen > 0 ? 'text-red-600' : 'text-gray-400'}`}>{noCumplen}</p>
              <p className="text-xs text-gray-500">{esCreacion ? 'No cumplen' : 'Fuera'}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{promedioDias} días</p>
              <p className="text-xs text-gray-500">Promedio</p>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / Tiquetera</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">EXP ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Solicitante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  {esCreacion ? 'Asignado' : 'ETD'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  {esCreacion ? 'Fecha Liberación' : 'Fecha Notificado'}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Cumple Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map(f => {
                const cumple = f.cumpleMeta;
                return (
                  <tr key={f.id} className={`hover:bg-gray-50 transition-colors ${!cumple ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{f.po_tiquetera}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{f.exp_id || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{f.solicitante}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {esCreacion
                        ? formatearFechaCorta((f as FilaCreacionMcg).fechaAsignado)
                        : formatearFechaCorta((f as FilaEtdMcg).etd)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {esCreacion
                        ? formatearFechaCorta((f as FilaCreacionMcg).fechaLiberacion)
                        : formatearFechaCorta((f as FilaEtdMcg).fechaNotificado)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${cumple ? 'text-teal-700' : 'text-red-600'}`}>
                        {f.dias} días
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {cumple ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full">
                          <i className="ri-checkbox-circle-fill"></i> Cumple
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                          <i className="ri-alarm-warning-fill"></i> Alerta
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
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