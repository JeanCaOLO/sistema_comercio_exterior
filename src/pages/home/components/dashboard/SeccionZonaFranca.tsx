// Sección Zona Franca del Dashboard.

import EncabezadoSeccion from './EncabezadoSeccion';
import SeccionKpisZf from '@/pages/home/components/SeccionKpisZf';
import type { DashboardData } from './useDashboard';

interface Props {
  datos: DashboardData;
}

export default function SeccionZonaFranca({ datos }: Props) {
  return (
    <>
      <EncabezadoSeccion
        icono="ri-building-4-line"
        titulo="Zona Franca (ZF)"
        descripcion="Cumplimiento de ETA estimada y tránsito corto de los expedientes ZF"
        chips={[`${datos.estadoDataZF.total} expedientes`, 'Solo ZF']}
        colorIcono="bg-emerald-600"
      />

      <SeccionKpisZf kpis={datos.kpisZF} />
    </>
  );
}