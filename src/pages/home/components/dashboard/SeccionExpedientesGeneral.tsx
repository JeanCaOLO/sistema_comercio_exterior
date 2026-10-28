// Sección 1 del Dashboard: expedientes en general + pendientes de Documentación.

import KPICard from '@/pages/home/components/KPICard';
import EncabezadoSeccion from './EncabezadoSeccion';
import type { Comparativos, KpiData } from './types';

interface Props {
  kpiData: KpiData;
  comparativos: Comparativos;
  documentosPendientes: number;
}

export default function SeccionExpedientesGeneral({
  kpiData,
  comparativos,
  documentosPendientes,
}: Props) {
  return (
    <>
      <EncabezadoSeccion
        icono="ri-folder-chart-line"
        titulo="Expedientes · Visión General"
        descripcion="Volumen del período y POs que todavía esperan documentación"
        chips={[`${kpiData.totalSolicitudes} expedientes`, 'Todos los módulos']}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <KPICard
          title="Total Solicitudes"
          value={kpiData.totalSolicitudes}
          icon="ri-file-list-3-line"
          color="bg-teal-600"
          trend={comparativos.totalSolicitudes.mesAnterior}
          subtitle={`vs año anterior: ${comparativos.totalSolicitudes.anoAnterior}`}
        />
        <KPICard
          title="Pendientes en Documentación"
          value={documentosPendientes}
          icon="ri-folder-open-line"
          color="bg-orange-500"
        />
      </div>
    </>
  );
}