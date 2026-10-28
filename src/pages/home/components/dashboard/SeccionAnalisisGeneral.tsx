// Sección de análisis general del período (solicitantes y tiempos).

import BarChart from '@/pages/home/components/BarChart';
import EncabezadoSeccion from './EncabezadoSeccion';
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
        descripcion="Solicitantes y trazabilidad de todos los expedientes (Dropship + ZF)"
        colorIcono="bg-gray-700"
      />

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Solicitantes</h3>
        <BarChart data={datos.solicitantesData} />
      </div>

      <div className="mb-8">
        <TiemposPromedioEstados
          tiempos={datos.tiemposEntreEstados}
          filtroModulo={datos.filtroModuloTiempos}
          onFiltroModulo={datos.setFiltroModuloTiempos}
        />
      </div>
    </>
  );
}