// Sección 1 del Dashboard: expedientes en general + pendientes en la bandeja.

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
  // Lleva al módulo Bandeja (Documentación) desde el Dashboard.
  const irABandeja = () => {
    window.dispatchEvent(new CustomEvent('navigateTo', { detail: { view: 'documentacion' } }));
  };

  return (
    <>
      <EncabezadoSeccion
        icono="ri-folder-chart-line"
        titulo="Expedientes · Visión General"
        descripcion="Volumen del período y documentación que sigue esperando en la bandeja"
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
          title="Pendiente en Bandeja"
          value={documentosPendientes}
          icon="ri-inbox-archive-line"
          color="bg-orange-500"
          subtitle="Registros cargados esperando consolidarse en ticket"
          actionLabel="Ir a la Bandeja"
          onAction={irABandeja}
        />
      </div>
    </>
  );
}