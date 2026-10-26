import { useState } from 'react';
import { formatearFechaCorta } from '@/lib/fechas';
import { descargarExcel } from '@/lib/exportar';
import type { FilaZfSinEta } from '@/lib/kpisZf';

interface ModalDetalleSinEtaZfProps {
  filas: FilaZfSinEta[];
  totalActivos: number;
  onClose: () => void;
}

export default function ModalDetalleSinEtaZf({ filas, totalActivos, onClose }: ModalDetalleSinEtaZfProps) {
  const [busqueda, setBusqueda] = useState('');

  const term = busqueda.trim().toLowerCase();
  const filtradas = term
    ? filas.filter(
        (f) =>
          f.po_tiquetera.toLowerCase().includes(term) ||
          (f.exp_id || '').toLowerCase().includes(term) ||
          (f.solicitante || '').toLowerCase().includes(term) ||
          (f.responsable || '').toLowerCase().includes(term)
      )
    : filas;

  const porcentaje = totalActivos > 0 ? Math.round((filas.length / totalActivos) * 100) : 0;

  const descargar = () => {
    const rows = filtradas.map((f) => ({
      'PO/Tiquetera': f.po_tiquetera,
      'EXP ID': f.exp_id || '-',
      'Solicitante': f.solicitante || '—',
      'Responsable': f.responsable || '—',
      'Estado': f.estado,
      'Recibo Delzof': f.fechaRecibo ? formatearFechaCorta(f.fechaRecibo) : 'Sin recibo',
      'Fecha de Asignación': formatearFechaCorta(f.fechaAsignacion),
      'Días sin ETA': f.dias,
    }));
    descargarExcel(`reporte-zf-sin-eta-${new Date().toISOString().split('T')[0]}.xlsx`, rows);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Detalle ZF sin ETA</h2>
            <p className="text-sm text-gray-500 mt-1">Tickets ZF activos que todavía no tienen ETA Real registrada</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={descargar}
              disabled={filas.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
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
              <p className="text-2xl font-bold text-gray-800">{filas.length}</p>
              <p className="text-xs text-gray-500">Sin ETA</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{totalActivos}</p>
              <p className="text-xs text-gray-500">Tickets ZF activos</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${porcentaje >= 30 ? 'text-red-600' : 'text-amber-600'}`}>{porcentaje}%</p>
              <p className="text-xs text-gray-500">Del total activo</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="relative max-w-md">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por PO, EXP ID, solicitante o responsable..."
              className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full cursor-pointer"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / Tiquetera</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">EXP ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Solicitante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Responsable</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Recibo Delzof</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Asignación</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días sin ETA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtradas.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{f.po_tiquetera}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{f.exp_id || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{f.solicitante || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{f.responsable || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                      {f.estado || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {f.fechaRecibo ? formatearFechaCorta(f.fechaRecibo) : <span className="text-gray-400">Sin recibo</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(f.fechaAsignacion)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${f.dias >= 10 ? 'text-red-600' : 'text-amber-600'}`}>{f.dias} días</span>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <i className="ri-checkbox-circle-line text-4xl mb-2 text-emerald-400"></i>
                    <p className="text-sm">
                      {filas.length === 0
                        ? 'Todos los tickets ZF activos tienen ETA Real registrada'
                        : 'No hay tickets que coincidan con la búsqueda'}
                    </p>
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