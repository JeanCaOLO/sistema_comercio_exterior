// Descarga de los reportes del Dashboard (Excel).

import { formatearFechaCorta } from '@/lib/fechas';
import { descargarExcel } from '@/lib/exportar';
import type { FilaDuracion, FiltroDuracion } from './ModalDetalleDuracion';
import type { FilaEtdNotificado } from './ModalDetalleEtdNotificado';
import type { FilaAsignadoNotificado } from './ModalDetalleAsignadoNotificado';
import type { FilaSinEtd } from './ModalDetalleSinEtd';

const hoy = (): string => new Date().toISOString().split('T')[0];

export const descargarReporteDuracion = (
  filas: FilaDuracion[],
  filtro: FiltroDuracion
): void => {
  const datos = filas
    .filter((e) =>
      filtro === 'todos' ? true : filtro === 'cumplen' ? e.cumpleMeta : !e.cumpleMeta
    )
    .map((e) => ({
      'PO/Tiquetera': e.po_tiquetera,
      'EXP ID': e.exp_id || '-',
      Módulo: 'Dropship',
      Estado: e.estado_expediente,
      Solicitante: e.solicitante,
      Responsable: e.responsable_creacion,
      'Carga de Factura': formatearFechaCorta(e.fechaCargaDocumentos),
      Finalizado: e.fechaFin ? formatearFechaCorta(e.fechaFin) : 'En curso',
      'Días (Factura → Liberación)': e.diasDuracion,
      'Cumple Meta (<3 días)': e.cumpleMeta ? 'Sí' : 'No',
    }));

  descargarExcel(`reporte-duracion-dropship-${hoy()}.xlsx`, datos);
};

export const descargarReporteEtd = (filas: FilaEtdNotificado[]): void => {
  const datos = filas.map((e) => ({
    'PO/Tiquetera': e.po_tiquetera,
    'EXP ID': e.exp_id || '-',
    Solicitante: e.solicitante,
    ETD: formatearFechaCorta(e.etd),
    'Fecha Notificado': formatearFechaCorta(e.fechaNotificado),
    'Días (ETD → Notificado)': e.diasDiferencia,
    'Cumple Meta (≤5 días)': e.cumpleMeta ? 'Sí' : 'No',
  }));

  descargarExcel(`reporte-etd-notificado-${hoy()}.xlsx`, datos);
};

export const descargarReporteAsignadoNotificado = (
  filas: FilaAsignadoNotificado[]
): void => {
  const datos = filas.map((e) => ({
    'PO/Tiquetera': e.po_tiquetera,
    'EXP ID': e.exp_id || '-',
    Solicitante: e.solicitante,
    'Fecha Asignado': formatearFechaCorta(e.fechaAsignado),
    'Fecha Notificado': formatearFechaCorta(e.fechaNotificado),
    'Días (Asignado → Notificado)': e.dias,
  }));

  descargarExcel(`reporte-asignado-notificado-${hoy()}.xlsx`, datos);
};

export const descargarReporteSinEtd = (filas: FilaSinEtd[]): void => {
  const datos = filas.map((e) => ({
    'PO/Tiquetera': e.po_tiquetera,
    'EXP ID': e.exp_id || '-',
    Módulo: e.tipo_modulo,
    Solicitante: e.solicitante,
    Estado: e.estado_expediente,
    ETD: 'Sin ETD',
  }));

  descargarExcel(`reporte-sin-etd-${hoy()}.xlsx`, datos);
};