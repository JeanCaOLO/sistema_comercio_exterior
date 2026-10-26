export interface FilaSinEtd {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  estado_expediente: string;
  tipo_modulo: string;
}

interface ModalDetalleSinEtdProps {
  abierto: boolean;
  filas: FilaSinEtd[];
  onClose: () => void;
  onDescargar: () => void;
}

export default function ModalDetalleSinEtd({ abierto, filas, onClose, onDescargar }: ModalDetalleSinEtdProps) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">POs sin ETD</h2>
            <p className="text-sm text-gray-500 mt-1">Expedientes Dropship (incluye MCG) que todavía no tienen fecha ETD registrada</p>
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

        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <i className="ri-calendar-line text-amber-600 text-xl"></i>
            <p className="text-sm text-amber-800">
              <span className="font-bold text-amber-900">{filas.length}</span> expediente{filas.length !== 1 ? 's' : ''} sin fecha ETD en el período
            </p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / Tiquetera</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">EXP ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Solicitante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{exp.po_tiquetera}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.exp_id || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      exp.tipo_modulo === 'MCG' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'
                    }`}>
                      {exp.tipo_modulo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.solicitante || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-full whitespace-nowrap">
                      {exp.estado_expediente}
                    </span>
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <i className="ri-inbox-line text-4xl mb-2"></i>
                    <p className="text-sm">No hay POs sin ETD en el período</p>
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