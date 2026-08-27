import { useState } from 'react';
import ReporteAtrasos from './ReporteAtrasos';
import ReporteRuta from './ReporteRuta';
import ReporteCiclo from './ReporteCiclo';

export default function Reportes() {
  const [activeTab, setActiveTab] = useState<'atrasos' | 'ruta' | 'ciclo'>('atrasos');

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-500 mt-2">Analítica de productividad, eficiencia y atrasos de expedientes</p>
      </div>

      {/* Pestañas */}
      <div className="mb-6 inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('atrasos')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'atrasos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-alarm-warning-line mr-1.5"></i>
          Atrasos &amp; Aging
        </button>
        <button
          onClick={() => setActiveTab('ruta')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'ruta' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-route-line mr-1.5"></i>
          Por Ruta
        </button>
        <button
          onClick={() => setActiveTab('ciclo')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'ciclo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-timer-line mr-1.5"></i>
          Ciclo Asig→Notif
        </button>
      </div>

      {activeTab === 'atrasos' ? (
        <ReporteAtrasos />
      ) : activeTab === 'ruta' ? (
        <ReporteRuta />
      ) : (
        <ReporteCiclo />
      )}
    </div>
  );
}