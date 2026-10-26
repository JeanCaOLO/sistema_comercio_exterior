// Sección Dropship del Dashboard: tiempos, cumplimiento, MCG y motivos de espera.

import EncabezadoSeccion from './EncabezadoSeccion';
import ModalDetalleDuracion from './ModalDetalleDuracion';
import ModalDetalleEtdNotificado from './ModalDetalleEtdNotificado';
import ModalDetalleAsignadoNotificado from './ModalDetalleAsignadoNotificado';
import ModalDetalleSinEtd from './ModalDetalleSinEtd';
import ModalDetalleMcg from '@/pages/home/components/ModalDetalleMcg';
import SeccionKpisDropship from '@/pages/home/components/SeccionKpisDropship';
import SeccionKpisMcg from '@/pages/home/components/SeccionKpisMcg';
import TopMotivosEspera from '@/pages/home/components/TopMotivosEspera';
import KpiTiempoFacturacion from './KpiTiempoFacturacion';
import KpiLiberadoEta15 from './KpiLiberadoEta15';
import TarjetaDuracionMinima from './TarjetaDuracionMinima';
import TarjetaAsignadoNotificado from './TarjetaAsignadoNotificado';
import { META_ETD_DIAS, META_MCG_ETD_DIAS, type DashboardData } from './useDashboard';
import { META_MCG_CREACION_DIAS } from '@/lib/kpisCreacion';
import { META_FACTURACION_DIAS, DIAS_ANTES_ETA } from '@/lib/kpisDropship';
import {
  descargarReporteAsignadoNotificado,
  descargarReporteDuracion,
  descargarReporteEtd,
  descargarReporteSinEtd,
} from './reportes';

type DashboardProps = {
  datos: DashboardData;
};

export default function SeccionDropship({ datos }: DashboardProps) {
  return (
    <>
      <EncabezadoSeccion
        icono="ri-ship-2-line"
        titulo="Dropship"
        descripcion="Indicadores de tiempos, notificación y cumplimiento de los expedientes Dropship (incluye MCG)"
        chips={[`${datos.estadoDataDropship.total} expedientes`, 'Dropship + MCG']}
        colorIcono="bg-sky-600"
      />

      <TarjetaDuracionMinima
        kpi={datos.kpiDuracion}
        onVerReporte={() => datos.setShowReporteDuracion(true)}
        onVerNoCumplen={() => {
          datos.setReporteFiltro('no-cumplen');
          datos.setShowReporteDuracion(true);
        }}
      />

      <ModalDetalleDuracion
        abierto={datos.showReporteDuracion}
        kpi={datos.kpiDuracion}
        filas={datos.expedientesReporte}
        filtro={datos.reporteFiltro}
        onFiltro={datos.setReporteFiltro}
        onClose={() => datos.setShowReporteDuracion(false)}
        onDescargar={() =>
          descargarReporteDuracion(datos.expedientesReporte, datos.reporteFiltro)
        }
      />

      <ModalDetalleEtdNotificado
        abierto={datos.showReporteEtd}
        kpi={datos.kpiEtdNotificado}
        filas={datos.etdDetalle}
        metaDias={META_ETD_DIAS}
        onClose={() => datos.setShowReporteEtd(false)}
        onDescargar={() => descargarReporteEtd(datos.etdDetalle)}
      />

      <ModalDetalleAsignadoNotificado
        abierto={datos.showReporteAsignadoNotificado}
        kpi={datos.kpiAsignadoNotificado}
        filas={datos.asignadoNotificadoDetalle}
        onClose={() => datos.setShowReporteAsignadoNotificado(false)}
        onDescargar={() => descargarReporteAsignadoNotificado(datos.asignadoNotificadoDetalle)}
      />

      <SeccionKpisDropship
        kpiEtdNotificado={datos.kpiEtdNotificado}
        metaEtdDias={META_ETD_DIAS}
        onVerDetalleEtd={() => datos.setShowReporteEtd(true)}
        notificadoOkPais={datos.notificadoOkPais}
        totalEntregados={datos.entregadosDropship}
        transitoCorto={datos.transitoCortoDropship}
        totalDropship={datos.estadoDataDropship.total}
        expedientesSinEtd={datos.sinEtdDetalle.length}
        onVerDetalleSinEtd={() => datos.setShowSinEtdDetalle(true)}
      />

      {/* KPI: Tiempo de facturación Liberado → Notificado País */}
      <KpiTiempoFacturacion resultado={datos.kpiFacturacion} metaDias={META_FACTURACION_DIAS} />

      {/* KPI: Liberado después de ETA − 15 días */}
      <KpiLiberadoEta15 resultado={datos.kpiEta15} diasAntesEta={DIAS_ANTES_ETA} />

      <TarjetaAsignadoNotificado
        kpi={datos.kpiAsignadoNotificado}
        promedioCreacionNotificado={datos.kpiDsPromedioNotificado}
        totalDetalle={datos.asignadoNotificadoDetalle.length}
        onVerDesglose={() => datos.setShowReporteAsignadoNotificado(true)}
      />

      <SeccionKpisMcg
        creacion={datos.kpiMcgCreacion}
        etd={datos.kpiMcgEtdNotificado}
        metaCreacionDias={META_MCG_CREACION_DIAS}
        metaEtdDias={META_MCG_ETD_DIAS}
        onVerDetalleCreacion={() => datos.setShowMcgCreacionDetalle(true)}
        onVerDetalleEtd={() => datos.setShowMcgEtdDetalle(true)}
        disabledCreacion={datos.mcgCreacionDetalle.length === 0}
        disabledEtd={datos.mcgEtdDetalle.length === 0}
      />

      <TopMotivosEspera />

      {/* Modal detalle POs sin ETD */}
      <ModalDetalleSinEtd
        abierto={datos.showSinEtdDetalle}
        filas={datos.sinEtdDetalle}
        onClose={() => datos.setShowSinEtdDetalle(false)}
        onDescargar={() => descargarReporteSinEtd(datos.sinEtdDetalle)}
      />

      {/* Modal detalle MCG: creación */}
      {datos.showMcgCreacionDetalle && (
        <ModalDetalleMcg
          tipo="creacion"
          filas={datos.mcgCreacionDetalle}
          total={datos.kpiMcgCreacion.totalEvaluados}
          cumplen={datos.kpiMcgCreacion.cumplen}
          noCumplen={datos.kpiMcgCreacion.noCumplen}
          promedioDias={datos.kpiMcgCreacion.diasPromedio}
          onClose={() => datos.setShowMcgCreacionDetalle(false)}
        />
      )}

      {/* Modal detalle MCG: ETD → Notificado */}
      {datos.showMcgEtdDetalle && (
        <ModalDetalleMcg
          tipo="etd"
          filas={datos.mcgEtdDetalle}
          total={datos.kpiMcgEtdNotificado.totalEvaluados}
          cumplen={datos.kpiMcgEtdNotificado.cumplen}
          noCumplen={datos.kpiMcgEtdNotificado.noCumplen}
          promedioDias={datos.kpiMcgEtdNotificado.diasPromedio}
          onClose={() => datos.setShowMcgEtdDetalle(false)}
        />
      )}
    </>
  );
}