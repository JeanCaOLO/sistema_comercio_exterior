import { useState } from 'react';
import { formatearFechaCorta } from '@/lib/fechas';
import { descargarExcel } from '@/lib/exportar';

export interface FilaZfDetalle {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  solicitante: string;
  fechaCreacion: string;
  fechaEspera: string;
  dias: number;
  cumpleMeta: boolean;
}

interface SeccionKpisZfProps {
  dias: number;
  cumpleMeta: boolean;
  detalle: FilaZfDetalle[];
  metaDias: number;
}

export default function SeccionKpisZf({ dias, cumpleMeta, detalle, metaDias }: SeccionKpisZfProps) {
  const [showDetalle, setShowDetalle] = useState(false);

  const sinDatos = dias === 0 && detalle.length === 0;
  const cumplen = detalle.filter(d => d.cumpleMeta).length;
  const noCumplen = detalle.length - cumplen;

  const colorValor = cumpleMeta ? 'text-green-600' : 'text-red-600';
  const colorIcono = cumpleMeta ? 'text-green-600' : 'text-red-600';
  const colorFondoIcono = cumpleMeta ? 'bg-green-100' : 'bg-red-100';

  const descargar = () => {
    const filas = detalle.map(d => ({
      'PO/Tiquetera': d.po_tiquetera,
      'EXP ID': d.exp_id || '-',
      'Solicitante': d.solicitante || '—',
      'Creado': formatearFechaCorta(d.fechaCreacion),
      'Entró a Espera de Respuesta': formatearFechaCorta(d.fechaEspera),
      'Días (Creado → Espera)': d.dias,
      [`Cumple Meta (<${metaDias} días)`]: d.cumpleMeta ? 'Sí' : 'No'
    }));
    descargarExcel(`reporte-zf-creado-espera-${new Date().toISOString().split('T')[0]}.xlsx`, filas);
  };

  return (
    <>
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-emerald-600 rounded-xl">
            <i className="ri-dashboard-line text-white text-2xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">KPIs de Expedientes ZF</h3>
            <p className="text-sm text-gray-600">Indicadores clave de rendimiento para Zona Franca</p>
          </div>
        </div>

        <div className="max-w-md">
          {/* KPI 1: Creado → Espera de Respuesta */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${colorFondoIcono}`}>
                  <i className={`ri-calendar-check-line text-2xl ${colorIcono}`}></i>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-600">Creado → Espera de Respuesta</h4>
                  <p className="text-xs text-gray-500 mt-1">Meta: &lt;{metaDias} días hábiles</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                cumpleMeta ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {sinDatos ? 'Sin datos' : cumpleMeta ? '✓ Cumple' : '✗ No Cumple'}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${colorValor}`}>{dias}</span>
              <span className="text-lg text-gray-600">días</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Tiempo promedio</span>
                <span className={`font-semibold ${colorValor}`}>
                  {sinDatos
                    ? 'Esperando datos'
                    : dias < metaDias
                    ? `${(metaDias - dias).toFixed(1)} días bajo meta`
                    : `${(dias - metaDias).toFixed(1)} días sobre meta`}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowDetalle(true)}
              disabled={detalle.length === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-file-chart-line"></i>
              Ver detalle de POs
            </button>
          </div>
        </div>
      </div>

      {/* =========== MODAL DETALLE ZF: CREADO → ESPERA DE RESPUESTA =========== */}
      {showDetalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Detalle Creado → Espera de Respuesta (ZF)</h2>
                <p className="text-sm text-gray-500 mt-1">Días hábiles entre la creación y la entrada a «Espera de Respuesta» de cada expediente ZF</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={descargar}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-2-line"></i>
                  Descargar Excel
                </button>
                <button
                  onClick={() => setShowDetalle(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl text-gray-500"></i>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{detalle.length}</p>
                  <p className="text-xs text-gray-500">Total Evaluados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{cumplen}</p>
                  <p className="text-xs text-gray-500">Cumplen (&lt;{metaDias} días)</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${noCumplen > 0 ? 'text-red-600' : 'text-gray-400'}`}>{noCumplen}</p>
                  <p className="text-xs text-gray-500">No Cumplen (≥{metaDias} días)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{dias} días</p>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Creado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Entró a Espera</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Cumple Meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detalle.map(exp => (
                    <tr key={exp.id} className={`hover:bg-gray-50 transition-colors ${!exp.cumpleMeta ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{exp.po_tiquetera}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.exp_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.solicitante || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaCreacion)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaEspera)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${exp.cumpleMeta ? 'text-green-700' : 'text-red-600'}`}>
                          {exp.dias} días
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {exp.cumpleMeta ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                            <i className="ri-checkbox-circle-fill"></i> Cumple
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                            <i className="ri-alarm-warning-fill"></i> Alerta
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {detalle.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        <i className="ri-inbox-line text-4xl mb-2"></i>
                        <p className="text-sm">No hay expedientes ZF con llegada a «Espera de Respuesta»</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}