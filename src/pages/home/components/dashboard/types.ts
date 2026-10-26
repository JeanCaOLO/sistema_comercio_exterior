// Tipos y valores iniciales compartidos por el Dashboard de Control.

import type { FilaZfEta, FilaZfEtaVariable, FilaZfSinEta, FilaZfTransito } from '@/lib/kpisZf';

export type VistaEstados = 'general' | 'dropship' | 'zf';
export type FiltroModuloTiempos = 'todos' | 'dropship' | 'zf';

export interface RangoFechas {
  inicio: string;
  fin: string;
}

// ── Conteo de expedientes por estado ──
export interface EstadoData {
  creado: number;
  asignado: number;
  enProceso: number;
  enRevision: number;
  liberado: number;
  notificado: number;
  completado: number;
  facturacion: number;
  recepcionCarga: number;
  esperaRespuesta: number;
  arriboCarga: number;
  pendienteProforma: number;
  total: number;
}

export const crearEstadoVacio = (): EstadoData => ({
  creado: 0,
  asignado: 0,
  enProceso: 0,
  enRevision: 0,
  liberado: 0,
  notificado: 0,
  completado: 0,
  facturacion: 0,
  recepcionCarga: 0,
  esperaRespuesta: 0,
  arriboCarga: 0,
  pendienteProforma: 0,
  total: 0,
});

// ── KPIs generales del período ──
export interface KpiData {
  totalSolicitudes: number;
  altaPrioridad: number;
  cargaTrabajo: number;
  volumenLineas: number;
  minutosPromedio: number;
}

export const crearKpiDataVacio = (): KpiData => ({
  totalSolicitudes: 0,
  altaPrioridad: 0,
  cargaTrabajo: 0,
  volumenLineas: 0,
  minutosPromedio: 0,
});

export interface ComparativoPar {
  mesAnterior: string;
  anoAnterior: string;
}

export interface Comparativos {
  totalSolicitudes: ComparativoPar;
  altaPrioridad: ComparativoPar;
  cargaTrabajo: ComparativoPar;
  volumenLineas: ComparativoPar;
  minutosPromedio: ComparativoPar;
}

export const crearComparativosVacios = (): Comparativos => ({
  totalSolicitudes: { mesAnterior: '0%', anoAnterior: '0%' },
  altaPrioridad: { mesAnterior: '0%', anoAnterior: '0%' },
  cargaTrabajo: { mesAnterior: '0%', anoAnterior: '0%' },
  volumenLineas: { mesAnterior: '0%', anoAnterior: '0%' },
  minutosPromedio: { mesAnterior: '0%', anoAnterior: '0%' },
});

// ── Gráficos del análisis general ──
export interface DificultadItem {
  label: string;
  value: number;
  color: string;
}

export interface SolicitanteItem {
  name: string;
  count: number;
}

export const crearDificultadVacia = (): DificultadItem[] => [
  { label: 'Baja', value: 0, color: '#10b981' },
  { label: 'Media', value: 0, color: '#f59e0b' },
  { label: 'Alta', value: 0, color: '#ef4444' },
];

// ── Tiempos promedio entre estados ──
export interface TiempoEntreEstados {
  desde: string;
  hasta: string;
  minutosPromedio: number;
  cantidad: number;
  fuente: 'real' | 'estimado';
}

// ── KPIs Dropship ──
export interface KpiAsignadoNotificado {
  totalEvaluados: number;
  promedioDias: number;
}

export interface KpiEtdNotificado {
  totalEvaluados: number;
  dentroRango: number;
  fueraRango: number;
  porcentajeOk: number;
  promedioDias: number;
}

export interface KpiMcgResumen {
  totalEvaluados: number;
  cumplen: number;
  noCumplen: number;
  porcentajeCumplimiento: number;
  diasPromedio: number;
}

export const crearKpiMcgVacio = (): KpiMcgResumen => ({
  totalEvaluados: 0,
  cumplen: 0,
  noCumplen: 0,
  porcentajeCumplimiento: 0,
  diasPromedio: 0,
});

export interface KpiDuracion {
  totalEvaluados: number;
  cumplen: number;
  noCumplen: number;
  porcentajeCumplimiento: number;
  diasPromedioTotal: number;
}

export const crearKpiDuracionVacio = (): KpiDuracion => ({
  totalEvaluados: 0,
  cumplen: 0,
  noCumplen: 0,
  porcentajeCumplimiento: 0,
  diasPromedioTotal: 0,
});

// ── KPIs Zona Franca ──
export interface KpisZfResumen {
  eta: FilaZfEta[];
  transito: FilaZfTransito[];
  etaVariable: FilaZfEtaVariable[];
  sinEta: FilaZfSinEta[];
  sinEtaActivos: number;
  totalActivosZf: number;
  sinEtaReal: number;
}

export const crearKpisZfVacio = (): KpisZfResumen => ({
  eta: [],
  transito: [],
  etaVariable: [],
  sinEta: [],
  sinEtaActivos: 0,
  totalActivosZf: 0,
  sinEtaReal: 0,
});