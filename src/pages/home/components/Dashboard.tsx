// Dashboard de Control — orquestador de secciones.
// La lógica vive en dashboard/useDashboard y las piezas visuales en dashboard/.

import { useDashboard } from './dashboard/useDashboard';
import FiltrosPeriodo from './dashboard/FiltrosPeriodo';
import SelectorModulo from './dashboard/SelectorModulo';
import SeccionExpedientesGeneral from './dashboard/SeccionExpedientesGeneral';
import SeccionDropship from './dashboard/SeccionDropship';
import SeccionZonaFranca from './dashboard/SeccionZonaFranca';
import SeccionAnalisisGeneral from './dashboard/SeccionAnalisisGeneral';
import EncabezadoSeccion from './dashboard/EncabezadoSeccion';
import KpiDocumentacionCompleta from './dashboard/KpiDocumentacionCompleta';
import EstadosExpedientes from './dashboard/EstadosExpedientes';

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

  const verDropship = datos.vistaModulo !== 'zf';
  const verZonaFranca = datos.vistaModulo !== 'dropship';

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Control</h1>
          <p className="text-gray-500 mt-2">Resumen general de solicitudes y expedientes</p>
        </div>

        <SelectorModulo
          vista={datos.vistaModulo}
          onVista={datos.seleccionarModulo}
          conteos={{
            general: datos.estadoData.total,
            dropship: datos.estadoDataDropship.total,
            zf: datos.estadoDataZF.total,
          }}
        />
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

      {/* ══════════════════ ESTADO DE EXPEDIENTES · PRIMERA VISTA ══════════════════ */}
      <EncabezadoSeccion
        icono="ri-list-check-2"
        titulo="Expedientes · Estado Actual"
        descripcion="Dónde está cada expediente del período, por estado y por módulo"
        chips={[`${datos.estadoData.total} expedientes`, 'General · Dropship · ZF']}
        colorIcono="bg-teal-600"
      />

      <div className="mb-8">
        <EstadosExpedientes
          estadoData={datos.estadoData}
          estadoDataDropship={datos.estadoDataDropship}
          estadoDataZF={datos.estadoDataZF}
          vista={datos.vistaEstados}
          onVista={datos.setVistaEstados}
          anchoCompleto
        />
      </div>

      {/* ══════════════════ MÓDULO 1 · EXPEDIENTES EN GENERAL (COMPARTIDO) ══════════════════ */}
      <SeccionExpedientesGeneral
        kpiData={datos.kpiData}
        comparativos={datos.comparativos}
        documentosPendientes={datos.documentosPendientes}
      />

      {/* ══════════════════ DOCUMENTACIÓN · COMPARTIDO ══════════════════ */}
      <EncabezadoSeccion
        icono="ri-folder-check-line"
        titulo="Documentación"
        descripcion="POs en etapa de documentación que solo tienen la factura cargada (sin BL, packing list ni contenedor)"
        chips={['Estado actual', 'Dropship + ZF']}
        colorIcono="bg-emerald-600"
      />

      <KpiDocumentacionCompleta />

      {/* ══════════════════ MÓDULO 2 · DROPSHIP ══════════════════ */}
      {verDropship && <SeccionDropship datos={datos} />}

      {/* ══════════════════ MÓDULO 3 · ZONA FRANCA ══════════════════ */}
      {verZonaFranca && <SeccionZonaFranca datos={datos} />}

      {/* ══════════════════ ANÁLISIS GENERAL DEL PERÍODO (COMPARTIDO) ══════════════════ */}
      <SeccionAnalisisGeneral datos={datos} />
    </div>
  );
}