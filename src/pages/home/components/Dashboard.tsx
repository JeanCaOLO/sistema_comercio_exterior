// Dashboard de Control — orquestador de secciones.
// La lógica vive en dashboard/useDashboard y las piezas visuales en dashboard/.

import { useDashboard } from './dashboard/useDashboard';
import FiltrosPeriodo from './dashboard/FiltrosPeriodo';
import SeccionExpedientesGeneral from './dashboard/SeccionExpedientesGeneral';
import SeccionDropship from './dashboard/SeccionDropship';
import SeccionZonaFranca from './dashboard/SeccionZonaFranca';
import SeccionAnalisisGeneral from './dashboard/SeccionAnalisisGeneral';
import EncabezadoSeccion from './dashboard/EncabezadoSeccion';
import KpiDocumentacionCompleta from './dashboard/KpiDocumentacionCompleta';

export default function Dashboard() {
  const datos = useDashboard();

  if (datos.loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          <p className="mt-4 text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard de Control</h1>
        <p className="text-gray-500 mt-2">Resumen general de solicitudes y expedientes</p>
      </div>

      <FiltrosPeriodo
        fechaInicio={datos.fechaInicio}
        fechaFin={datos.fechaFin}
        periodoActivo={datos.periodoActivo}
        errorFiltros={datos.errorFiltros}
        onFechaInicio={datos.setFechaInicio}
        onFechaFin={datos.setFechaFin}
        onSeleccionarPeriodo={datos.seleccionarPeriodo}
        onAplicar={datos.aplicarFiltroPersonalizado}
        onLimpiar={datos.limpiarFiltros}
      />

      {/* ══════════════════ MÓDULO 1 · EXPEDIENTES EN GENERAL ══════════════════ */}
      <SeccionExpedientesGeneral
        kpiData={datos.kpiData}
        comparativos={datos.comparativos}
        documentosPendientes={datos.documentosPendientes}
      />

      {/* ══════════════════ DOCUMENTACIÓN · COMPLETITUD POR PO ══════════════════ */}
      <EncabezadoSeccion
        icono="ri-folder-check-line"
        titulo="Documentación"
        descripcion="POs en etapa de documentación y su avance en factura, BL, packing list y contenedor"
        chips={['Estado actual', 'Dropship + ZF']}
        colorIcono="bg-emerald-600"
      />

      <KpiDocumentacionCompleta />

      {/* ══════════════════ MÓDULO 2 · DROPSHIP ══════════════════ */}
      <SeccionDropship datos={datos} />

      {/* ══════════════════ MÓDULO 3 · ZONA FRANCA ══════════════════ */}
      <SeccionZonaFranca datos={datos} />

      {/* ══════════════════ ANÁLISIS GENERAL DEL PERÍODO ══════════════════ */}
      <SeccionAnalisisGeneral datos={datos} />
    </div>
  );
}