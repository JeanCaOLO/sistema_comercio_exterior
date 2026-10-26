// Sección de análisis general del período (distribuciones, estados y tiempos).

import DonutChart from '@/pages/home/components/DonutChart';
import BarChart from '@/pages/home/components/BarChart';
import EncabezadoSeccion from './EncabezadoSeccion';
import EstadosExpedientes from './EstadosExpedientes';
import TiemposPromedioEstados from './TiemposPromedioEstados';
import type { DashboardData } from './useDashboard';

interface Props {
  datos: DashboardData;
}

export default function SeccionAnalisisGeneral({ datos }: Props) {
  return (
    <>
      <EncabezadoSeccion
        icono="ri-pie-chart-line"
        titulo="Análisis General del Período"
        descripcion="Distribución, estados y trazabilidad de todos los expedientes (Dropship + ZF)"
        colorIcono="bg-gray-700"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Distribución por Dificultad</h3>
          <DonutChart data={datos.dificultadData} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Solicitantes</h3>
          <BarChart data={datos.solicitantesData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <EstadosExpedientes
          estadoData={datos.estadoData}
          estadoDataDropship={datos.estadoDataDropship}
          estadoDataZF={datos.estadoDataZF}
          vista={datos.vistaEstados}
          onVista={datos.setVistaEstados}
        />

        <TiemposPromedioEstados
          tiempos={datos.tiemposEntreEstados}
          filtroModulo={datos.filtroModuloTiempos}
          onFiltroModulo={datos.setFiltroModuloTiempos}
        />
      </div>
    </>
  );
}