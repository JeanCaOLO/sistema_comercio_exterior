// Catálogo de motivos de cambio de ETD Inicial (opciones exactas solicitadas).
export const MOTIVOS_CAMBIO_ETD: string[] = [
  'Cambio CRD shipper',
  'Cambio de puerto de carga',
  'Cierre de puerto de carga',
  'Congestión portuaria origen',
  'Inspección',
  'Rolleo',
  'Shipper solicita cambio de booking',
  'Temas climáticos',
  'Tema aduanal / Documentación pendiente',
  'Otro',
];

export type EstadoEtd = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ConfigEstadoEtd {
  label: string;
  clase: string;
  icono: string;
}

export const ESTADOS_ETD: Record<EstadoEtd, ConfigEstadoEtd> = {
  PENDING: {
    label: 'Pendiente de aprobación',
    clase: 'bg-amber-100 text-amber-800',
    icono: 'ri-time-line',
  },
  APPROVED: {
    label: 'Aprobada',
    clase: 'bg-emerald-100 text-emerald-800',
    icono: 'ri-checkbox-circle-line',
  },
  REJECTED: {
    label: 'Rechazada',
    clase: 'bg-red-100 text-red-800',
    icono: 'ri-close-circle-line',
  },
};

// Etiquetas amigables para las claves de la PO de Raga (cuando se conocen).
export const ETIQUETAS_PO: Record<string, string> = {
  order_number: 'Número de PO',
  po_number: 'Número de PO',
  trading_company: 'Compañía',
  date_etd_initial: 'ETD Inicial',
  etd_initial: 'ETD Inicial',
  date_etd: 'ETD Variable',
  etd: 'ETD Variable',
  supplier: 'Proveedor',
  provider: 'Proveedor',
  vendor: 'Proveedor',
  shipper: 'Shipper',
  port_of_loading: 'Puerto de carga',
  loading_port: 'Puerto de carga',
  port_of_discharge: 'Puerto de descarga',
  discharge_port: 'Puerto de descarga',
  date_crd: 'CRD',
  crd: 'CRD',
  created_at: 'Fecha de creación',
  updated_at: 'Última actualización',
};

export function humanizarClave(clave: string): string {
  if (ETIQUETAS_PO[clave]) return ETIQUETAS_PO[clave];
  return clave
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function esFecha(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor);
}

// Formatea una fecha/hora ISO a un texto legible (es-ES).
export function formatearFechaHora(valor?: string | null): string {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}