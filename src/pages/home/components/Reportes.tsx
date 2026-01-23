import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function Reportes() {
  const [selectedReport, setSelectedReport] = useState('');
  const [dateRange, setDateRange] = useState({
    inicio: '',
    fin: ''
  });
  const [loading, setLoading] = useState(false);

  const reportTypes = [
    { id: 'solicitudes-mes', name: 'Solicitudes del Mes', icon: 'ri-calendar-line', color: 'bg-blue-500' },
    { id: 'prioridad-alta', name: 'Alta Prioridad', icon: 'ri-alarm-warning-line', color: 'bg-red-500' },
    { id: 'por-solicitante', name: 'Por Solicitante', icon: 'ri-user-line', color: 'bg-purple-500' },
    { id: 'por-estado', name: 'Por Estado', icon: 'ri-pie-chart-line', color: 'bg-green-500' },
    { id: 'carga-trabajo', name: 'Carga de Trabajo', icon: 'ri-time-line', color: 'bg-amber-500' },
    { id: 'completo', name: 'Reporte Completo', icon: 'ri-file-list-3-line', color: 'bg-teal-500' }
  ];

  const handleGenerateReport = async (format: 'pdf' | 'excel') => {
    if (!selectedReport) {
      alert('Por favor seleccione un tipo de reporte');
      return;
    }

    setLoading(true);

    try {
      let query = supabase.from('expedientes').select('*');

      if (dateRange.inicio) {
        query = query.gte('fecha_solicitud', dateRange.inicio);
      }
      if (dateRange.fin) {
        query = query.lte('fecha_solicitud', dateRange.fin);
      }

      const { data: expedientes, error } = await query;

      if (error) throw error;

      let filteredData = expedientes || [];

      switch (selectedReport) {
        case 'prioridad-alta':
          filteredData = filteredData.filter(exp => exp.prioridad === 'Alta' || exp.prioridad_urgente);
          break;
        case 'solicitudes-mes':
          const mesActual = new Date().getMonth();
          filteredData = filteredData.filter(exp => {
            const fecha = new Date(exp.fecha_solicitud);
            return fecha.getMonth() === mesActual;
          });
          break;
      }

      await supabase.from('reportes_historicos').insert([{
        tipo_reporte: selectedReport,
        fecha_inicio: dateRange.inicio || null,
        fecha_fin: dateRange.fin || null,
        generado_por: 'Usuario Actual',
        formato: format
      }]);

      if (format === 'excel') {
        const csv = convertToCSV(filteredData);
        downloadFile(csv, `reporte-${selectedReport}.csv`, 'text/csv');
      } else {
        alert('Reporte generado exitosamente. En una implementación completa, aquí se generaría un PDF.');
      }

    } catch (error: any) {
      console.error('Error al generar reporte:', error);
      alert('Error al generar reporte: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    return [headers, ...rows].join('\n');
  };

  const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reportes y Exportes</h1>
        <p className="text-gray-500 mt-2">Genere reportes personalizados y exporte datos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Tipo de Reporte</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportTypes.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer text-left ${
                    selectedReport === report.id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${report.color} rounded-lg flex items-center justify-center`}>
                      <i className={`${report.icon} text-white text-2xl`}></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{report.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Generar reporte</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Rango de Fechas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={dateRange.inicio}
                  onChange={(e) => setDateRange({ ...dateRange, inicio: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={dateRange.fin}
                  onChange={(e) => setDateRange({ ...dateRange, fin: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Formato de Exportación</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleGenerateReport('pdf')}
                disabled={loading || !selectedReport}
                className="flex-1 px-6 py-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <i className="ri-file-pdf-line text-xl mr-2"></i>
                {loading ? 'Generando...' : 'Exportar a PDF'}
              </button>
              <button
                onClick={() => handleGenerateReport('excel')}
                disabled={loading || !selectedReport}
                className="flex-1 px-6 py-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <i className="ri-file-excel-2-line text-xl mr-2"></i>
                {loading ? 'Generando...' : 'Exportar a Excel'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Reportes Recientes</h2>
            <div className="space-y-3">
              {[
                { name: 'Solicitudes del Mes', date: '2025-01-28', format: 'PDF' },
                { name: 'Alta Prioridad', date: '2025-01-27', format: 'Excel' },
                { name: 'Por Estado', date: '2025-01-26', format: 'PDF' },
                { name: 'Reporte Completo', date: '2025-01-25', format: 'Excel' }
              ].map((report, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{report.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{report.date}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      report.format === 'PDF' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {report.format}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-sm p-6 text-white">
            <i className="ri-information-line text-3xl mb-3"></i>
            <h3 className="text-lg font-semibold mb-2">Información</h3>
            <p className="text-sm text-teal-50">
              Los reportes se generan en tiempo real basados en los datos actuales de la base de datos. 
              Puede filtrar por rango de fechas para obtener información específica.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
