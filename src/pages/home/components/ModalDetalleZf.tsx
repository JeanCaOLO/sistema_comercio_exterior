import { useState } from 'react';
import { formatearFechaCorta } from '@/lib/fechas';
import { descargarExcel } from '@/lib/exportar';

export interface FilaDetalleZf {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  fechaAsignacion: string;
  fechaCompletado?: string;
  fechaReferencia: string;
  dias: number;
  cumpleMeta: boolean;
}

interface ModalDetalleZfProps {
  titulo: string;
  subtitulo: string;
  etiquetaFecha: string;
  metaTexto: string;
  nombreArchivo: string;
  filas: FilaDetalleZf[];
  onClose: () => void;
}

export default function ModalDetalleZf({
  titulo,
  subtitulo,
  etiquetaFecha,
  metaTexto,
  nombreArchivo,
  filas,
  onClose,
}: ModalDetalleZfProps) {
  const [filtro, setFiltro] = useState<'todos' | 'cumplen' | 'no-cumplen'>('todos');

  const total = filas.length;
  const cumplen = filas.filter((f) => f.cumpleMeta).length;
  const noCumplen = total - cumplen;
  const promedio = total > 0 ? Math.round((filas.reduce((s, f) => s + f.dias, 0) / total) * 10) / 10 : 0;

  const filtradas = filas.filter((f) =>
    filtro === 'todos' ? true : filtro === 'cumplen' ? f.cumpleMeta : !f.cumpleMeta
  );

  const mostrarCompletado = filas.some((f) => !!f.fechaCompletado);

  const descargar = () => {
    const rows = filas.map((f) => ({
      'PO/Tiquetera': f.po_tiquetera,
      'EXP ID': f.exp_id || '-',
      'Solicitante': f.solicitante || '—',
      'Fecha de Asignación': formatearFechaCorta(f.fechaAsignacion),
      ...(mostrarCompletado ? { 'Fecha de Completado': formatearFechaCorta(f.fechaCompletado || '') } : {}),
      [etiquetaFecha]: formatearFechaCorta(f.fechaReferencia),
      'Días': f.dias,
      [`Cumple Meta (${metaTexto})`]: f.cumpleMeta ? 'Sí' : 'No',
    }));
    descargarExcel(`${nombreArchivo}-${new Date().toISOString().split('T')[0]}.xlsx`, rows);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
            <p className="text-sm text-gray-500 mt-1">{subtitulo}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={descargar}
              disabled={total === 0}
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

        {/* Resumen */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{total}</p>
              <p className="text-xs text-gray-500">Total Evaluados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{cumplen}</p>
              <p className="text-xs text-gray-500">Cumplen ({metaTexto})</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${noCumplen > 0 ? 'text-red-600' : 'text-gray-400'}`}>{noCumplen}</p>
              <p className="text-xs text-gray-500">No Cumplen</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{promedio} días</p>
              <p className="text-xs text-gray-500">Promedio</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <span className="text-sm font-medium text-gray-600">Filtrar:</span>
          <div className="flex gap-2">
            {(['todos', 'cumplen', 'no-cumplen'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filtro === f
                    ? f === 'no-cumplen'
                      ? 'bg-red-500 text-white'
                      : f === 'cumplen'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f === 'todos'
                  ? `Todos (${total})`
                  : f === 'cumplen'
                  ? `Cumplen (${cumplen})`
                  : `No Cumplen (${noCumplen})`}
              </button>
            ))}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Fecha de Asignación</th>
                {mostrarCompletado && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Fecha de Completado</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{etiquetaFecha}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Cumple Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtradas.map((exp) => (
                <tr key={exp.id} className={`hover:bg-gray-50 transition-colors ${!exp.cumpleMeta ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{exp.po_tiquetera}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.exp_id || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.solicitante || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaAsignacion)}</td>
                  {mostrarCompletado && (
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaCompletado || '')}</td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaReferencia)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${exp.cumpleMeta ? 'text-emerald-700' : 'text-red-600'}`}>
                      {exp.dias} días
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {exp.cumpleMeta ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                        <i className="ri-checkbox-circle-fill"></i> Cumple
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                        <i className="ri-alarm-warning-fill"></i> No cumple
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={mostrarCompletado ? 8 : 7} className="px-6 py-12 text-center text-gray-400">
                    <i className="ri-inbox-line text-4xl mb-2"></i>
                    <p className="text-sm">
                      {total === 0
                        ? 'No hay expedientes ZF para evaluar en este KPI (faltan datos como la ETA Real o el cierre del expediente)'
                        : 'No hay expedientes en esta categoría'}
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