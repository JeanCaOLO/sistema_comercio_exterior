import { formatearFechaCorta } from '@/lib/fechas';
import type { FilaDuracionMinima } from '@/lib/kpisCreacion';

// El reloj de este indicador arranca en la carga de documentos (factura),
// no en la asignación del ticket.
export type FilaDuracion = FilaDuracionMinima;

export type FiltroDuracion = 'todos' | 'cumplen' | 'no-cumplen';

interface ModalDetalleDuracionProps {
  abierto: boolean;
  kpi: { totalEvaluados: number; cumplen: number; noCumplen: number };
  filas: FilaDuracion[];
  filtro: FiltroDuracion;
  onFiltro: (filtro: FiltroDuracion) => void;
  onClose: () => void;
  onDescargar: () => void;
}

export default function ModalDetalleDuracion({
  abierto,
  kpi,
  filas,
  filtro,
  onFiltro,
  onClose,
  onDescargar
}: ModalDetalleDuracionProps) {
  if (!abierto) return null;

  const filtradas = filas.filter((e) =>
    filtro === 'todos' ? true : filtro === 'cumplen' ? e.cumpleMeta : !e.cumpleMeta
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reporte de Duración Mínima</h2>
            <p className="text-sm text-gray-500 mt-1">Días hábiles desde la carga de la factura hasta la liberación (meta: &lt; 3 días)</p>
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
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{kpi.totalEvaluados}</p>
              <p className="text-xs text-gray-500">Total Evaluados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-600">{kpi.cumplen}</p>
              <p className="text-xs text-gray-500">Cumplen (&lt;3 días hábiles)</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${kpi.noCumplen > 0 ? 'text-red-600' : 'text-gray-400'}`}>{kpi.noCumplen}</p>
              <p className="text-xs text-gray-500">No Cumplen (≥3 días hábiles)</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-medium text-gray-600">Filtrar:</span>
          <div className="flex gap-2">
            {(['todos', 'cumplen', 'no-cumplen'] as const).map((f) => (
              <button
                key={f}
                onClick={() => onFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filtro === f
                    ? f === 'no-cumplen'
                      ? 'bg-red-500 text-white'
                      : f === 'cumplen'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f === 'todos'
                  ? `Todos (${kpi.totalEvaluados})`
                  : f === 'cumplen'
                  ? `Cumplen (${kpi.cumplen})`
                  : `No Cumplen (${kpi.noCumplen})`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / Tiquetera</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">EXP ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Responsable</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Carga de factura</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Liberación</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Duración</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Cumple Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtradas.map((exp) => (
                <tr key={exp.id} className={`hover:bg-gray-50 transition-colors ${!exp.cumpleMeta ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-full whitespace-nowrap">
                      {exp.estado_expediente}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{exp.po_tiquetera}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.exp_id || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      exp.tipo_modulo === 'dropship' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'
                    }`}>
                      {exp.tipo_modulo === 'dropship' ? 'Dropship' : 'ZF'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.responsable_creacion}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatearFechaCorta(exp.fechaCargaDocumentos)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {exp.fechaFin ? formatearFechaCorta(exp.fechaFin) : <span className="text-amber-600 font-medium">En curso</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${exp.cumpleMeta ? 'text-teal-700' : 'text-red-600'}`}>
                      {exp.diasDuracion} días
                    </span>
                    {!exp.fechaFin && <span className="block text-xs text-gray-400">en curso</span>}
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
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                    <i className="ri-inbox-line text-4xl mb-2"></i>
                    <p className="text-sm">No hay expedientes en esta categoría</p>
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