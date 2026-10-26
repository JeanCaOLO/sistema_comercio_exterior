// Hook del Dashboard de Control: estado, carga de datos y acciones.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calcularKpiFacturacion,
  calcularKpiEta15,
  type ResultadoFacturacion,
  type ResultadoEta15,
} from '@/lib/kpisDropship';
import {
  calcularKpiDuracionMinima,
  META_DURACION_DIAS,
  META_MCG_CREACION_DIAS,
} from '@/lib/kpisCreacion';
import type { FilaCreacionMcg, FilaEtdMcg } from '@/pages/home/components/ModalDetalleMcg';
import type { FilaDuracion, FiltroDuracion } from '@/pages/home/components/dashboard/ModalDetalleDuracion';
import type { FilaEtdNotificado } from '@/pages/home/components/dashboard/ModalDetalleEtdNotificado';
import type { FilaAsignadoNotificado } from '@/pages/home/components/dashboard/ModalDetalleAsignadoNotificado';
import type { FilaSinEtd } from '@/pages/home/components/dashboard/ModalDetalleSinEtd';
import {
  calcularKpiAsignadoNotificado,
  calcularKpiEtdNotificado,
  calcularKpisMcg,
  calcularPromedioCreacionCompletado,
  calcularPromedioCreacionNotificado,
  cargarExpedientesPorFechaAsignado,
  cargarKpisZf,
  cargarTiemposEntreEstados,
  cargarZfDelPeriodo,
  contarDocumentosPendientes,
} from './servicios';
import {
  aFechaISO,
  calcularPorcentajeCambio,
  contarEstados,
  esDropship,
  obtenerRangoFechas,
} from './utils';
import {
  crearComparativosVacios,
  crearDificultadVacia,
  crearEstadoVacio,
  crearKpiDataVacio,
  crearKpiDuracionVacio,
  crearKpiMcgVacio,
  crearKpisZfVacio,
  type Comparativos,
  type DificultadItem,
  type EstadoData,
  type FiltroModuloTiempos,
  type KpiAsignadoNotificado,
  type KpiData,
  type KpiDuracion,
  type KpiEtdNotificado,
  type KpiMcgResumen,
  type KpisZfResumen,
  type RangoFechas,
  type SolicitanteItem,
  type TiempoEntreEstados,
  type VistaEstados,
} from './types';

export const META_ETD_DIAS = 5;
export const META_MCG_ETD_DIAS = 2;

const KPI_ETD_VACIO: KpiEtdNotificado = {
  totalEvaluados: 0,
  dentroRango: 0,
  fueraRango: 0,
  porcentajeOk: 0,
  promedioDias: 0,
};

const FACTURACION_VACIA: ResultadoFacturacion = {
  filas: [],
  total: 0,
  cumplen: 0,
  noCumplen: 0,
  porcentaje: 0,
  promedio: 0,
  porcentajeMeta: 0,
  pendientes: 0,
};

const ETA15_VACIA: ResultadoEta15 = {
  filas: [],
  total: 0,
  enTiempo: 0,
  tarde: 0,
  porcentajeTarde: 0,
  atrasoPromedio: 0,
  sinEta: 0,
};

export function useDashboard() {
  // ── Filtros de período ──
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [periodoActivo, setPeriodoActivo] = useState('mes-actual');
  const [rangoPersonalizado, setRangoPersonalizado] = useState<RangoFechas | null>(null);
  const [errorFiltros, setErrorFiltros] = useState('');
  const [vistaEstados, setVistaEstados] = useState<VistaEstados>('general');

  // ── Datos generales ──
  const [expedientes, setExpedientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<KpiData>(crearKpiDataVacio());
  const [comparativos, setComparativos] = useState<Comparativos>(crearComparativosVacios());
  const [dificultadData, setDificultadData] = useState<DificultadItem[]>(crearDificultadVacia());
  const [solicitantesData, setSolicitantesData] = useState<SolicitanteItem[]>([]);
  const [estadoData, setEstadoData] = useState<EstadoData>(crearEstadoVacio());
  const [estadoDataDropship, setEstadoDataDropship] = useState<EstadoData>(crearEstadoVacio());
  const [estadoDataZF, setEstadoDataZF] = useState<EstadoData>(crearEstadoVacio());
  const [documentosPendientes, setDocumentosPendientes] = useState(0);

  // ── Tiempos entre estados ──
  const [filtroModuloTiempos, setFiltroModuloTiempos] = useState<FiltroModuloTiempos>('todos');
  const [tiemposEntreEstados, setTiemposEntreEstados] = useState<TiempoEntreEstados[]>([]);

  // ── KPIs Dropship ──
  const [kpiDsPromedioNotificado, setKpiDsPromedioNotificado] = useState(0);
  const [kpiAsignadoNotificado, setKpiAsignadoNotificado] = useState<KpiAsignadoNotificado>({
    totalEvaluados: 0,
    promedioDias: 0,
  });
  const [asignadoNotificadoDetalle, setAsignadoNotificadoDetalle] = useState<
    FilaAsignadoNotificado[]
  >([]);
  const [showReporteAsignadoNotificado, setShowReporteAsignadoNotificado] = useState(false);
  const [notificadoOkPais, setNotificadoOkPais] = useState(0);
  const [sinEtdDetalle, setSinEtdDetalle] = useState<FilaSinEtd[]>([]);
  const [showSinEtdDetalle, setShowSinEtdDetalle] = useState(false);
  const [kpiEtdNotificado, setKpiEtdNotificado] = useState<KpiEtdNotificado>(KPI_ETD_VACIO);
  const [etdDetalle, setEtdDetalle] = useState<FilaEtdNotificado[]>([]);
  const [showReporteEtd, setShowReporteEtd] = useState(false);
  const [kpiFacturacion, setKpiFacturacion] = useState<ResultadoFacturacion>(FACTURACION_VACIA);
  const [kpiEta15, setKpiEta15] = useState<ResultadoEta15>(ETA15_VACIA);

  // ── KPIs MCG ──
  const [kpiMcgCreacion, setKpiMcgCreacion] = useState<KpiMcgResumen>(crearKpiMcgVacio());
  const [kpiMcgEtdNotificado, setKpiMcgEtdNotificado] = useState<KpiMcgResumen>(crearKpiMcgVacio());
  const [mcgCreacionDetalle, setMcgCreacionDetalle] = useState<FilaCreacionMcg[]>([]);
  const [showMcgCreacionDetalle, setShowMcgCreacionDetalle] = useState(false);
  const [mcgEtdDetalle, setMcgEtdDetalle] = useState<FilaEtdMcg[]>([]);
  const [showMcgEtdDetalle, setShowMcgEtdDetalle] = useState(false);

  // ── KPI Duración mínima ──
  const [kpiDuracion, setKpiDuracion] = useState<KpiDuracion>(crearKpiDuracionVacio());
  const [expedientesReporte, setExpedientesReporte] = useState<FilaDuracion[]>([]);
  const [showReporteDuracion, setShowReporteDuracion] = useState(false);
  const [reporteFiltro, setReporteFiltro] = useState<FiltroDuracion>('todos');

  // ── KPIs Zona Franca ──
  const [kpisZF, setKpisZF] = useState<KpisZfResumen>(crearKpisZfVacio());
  const [kpiZfPromedioCompletado, setKpiZfPromedioCompletado] = useState(0);

  // Fecha inicial por defecto: mes actual
  useEffect(() => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    setFechaInicio(aFechaISO(primerDia));
    setFechaFin(aFechaISO(ultimoDia));
  }, []);

  useEffect(() => {
    contarDocumentosPendientes()
      .then(setDocumentosPendientes)
      .catch((error) => {
        console.error('Error al cargar documentos pendientes:', error);
        setDocumentosPendientes(0);
      });
  }, []);

  const calcularKPIDuracionMinima = useCallback((listaExpedientes: any[]) => {
    const resultado = calcularKpiDuracionMinima(listaExpedientes, META_DURACION_DIAS);
    setKpiDuracion({
      totalEvaluados: resultado.totalEvaluados,
      cumplen: resultado.cumplen,
      noCumplen: resultado.noCumplen,
      porcentajeCumplimiento: resultado.porcentajeCumplimiento,
      diasPromedioTotal: resultado.diasPromedioTotal,
    });
    setExpedientesReporte(resultado.filas);
  }, []);

  const limpiarKpisDropship = useCallback(() => {
    setNotificadoOkPais(0);
    setSinEtdDetalle([]);
    setKpiEtdNotificado({ ...KPI_ETD_VACIO });
    setEtdDetalle([]);
    setKpiFacturacion(FACTURACION_VACIA);
    setKpiEta15(ETA15_VACIA);
    setKpiDsPromedioNotificado(0);
    setKpiAsignadoNotificado({ totalEvaluados: 0, promedioDias: 0 });
    setAsignadoNotificadoDetalle([]);
    setKpiMcgCreacion(crearKpiMcgVacio());
    setKpiMcgEtdNotificado(crearKpiMcgVacio());
    setMcgCreacionDetalle([]);
    setMcgEtdDetalle([]);
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);

      const { inicio, fin } = obtenerRangoFechas(periodoActivo, rangoPersonalizado);

      // El período se calcula según la FECHA DE ASIGNADO de cada PO
      const lista = await cargarExpedientesPorFechaAsignado(aFechaISO(inicio), aFechaISO(fin));

      if (!lista || lista.length === 0) {
        setExpedientes([]);
        setKpiData(crearKpiDataVacio());
        setEstadoData(crearEstadoVacio());
        setEstadoDataDropship(crearEstadoVacio());
        setEstadoDataZF(crearEstadoVacio());
        setComparativos(crearComparativosVacios());
        setDificultadData(crearDificultadVacia());
        setSolicitantesData([]);
        setTiemposEntreEstados([]);
        setKpisZF(crearKpisZfVacio());
        setKpiZfPromedioCompletado(0);
        setKpiDuracion(crearKpiDuracionVacio());
        setExpedientesReporte([]);
        limpiarKpisDropship();
        return;
      }

      setExpedientes(lista);

      // ── Comparativos (mes y año anterior) ──
      const mesAnteriorInicio = new Date(inicio);
      mesAnteriorInicio.setMonth(mesAnteriorInicio.getMonth() - 1);
      const mesAnteriorFin = new Date(fin);
      mesAnteriorFin.setMonth(mesAnteriorFin.getMonth() - 1);

      const anoAnteriorInicio = new Date(inicio);
      anoAnteriorInicio.setFullYear(anoAnteriorInicio.getFullYear() - 1);
      const anoAnteriorFin = new Date(fin);
      anoAnteriorFin.setFullYear(anoAnteriorFin.getFullYear() - 1);

      const expedientesMesAnterior = await cargarExpedientesPorFechaAsignado(
        aFechaISO(mesAnteriorInicio),
        aFechaISO(mesAnteriorFin)
      );

      const expedientesAnoAnterior = await cargarExpedientesPorFechaAsignado(
        aFechaISO(anoAnteriorInicio),
        aFechaISO(anoAnteriorFin)
      );

      const altaPrioridad = lista.filter(
        (exp) => exp.prioridad === 'Alta' || exp.prioridad_urgente
      ).length;
      const cargaTrabajo = lista.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0);
      const volumenLineas = lista.reduce((sum, exp) => sum + (exp.lineas_oc || 0), 0);
      const minutosPromedio =
        lista.length > 0 ? Math.round(cargaTrabajo / lista.length) : 0;

      setKpiData({
        totalSolicitudes: lista.length,
        altaPrioridad,
        cargaTrabajo,
        volumenLineas,
        minutosPromedio,
      });

      const altaPrioridadMesAnt =
        expedientesMesAnterior?.filter((exp) => exp.prioridad === 'Alta' || exp.prioridad_urgente)
          .length || 0;
      const cargaTrabajoMesAnt =
        expedientesMesAnterior?.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0) || 0;
      const volumenLineasMesAnt =
        expedientesMesAnterior?.reduce((sum, exp) => sum + (exp.lineas_oc || 0), 0) || 0;
      const minutosPromedioMesAnt =
        expedientesMesAnterior && expedientesMesAnterior.length > 0
          ? Math.round(cargaTrabajoMesAnt / expedientesMesAnterior.length)
          : 0;

      const altaPrioridadAnoAnt =
        expedientesAnoAnterior?.filter((exp) => exp.prioridad === 'Alta' || exp.prioridad_urgente)
          .length || 0;
      const cargaTrabajoAnoAnt =
        expedientesAnoAnterior?.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0) || 0;
      const volumenLineasAnoAnt =
        expedientesAnoAnterior?.reduce((sum, exp) => sum + (exp.lineas_oc || 0), 0) || 0;
      const minutosPromedioAnoAnt =
        expedientesAnoAnterior && expedientesAnoAnterior.length > 0
          ? Math.round(cargaTrabajoAnoAnt / expedientesAnoAnterior.length)
          : 0;

      setComparativos({
        totalSolicitudes: {
          mesAnterior: calcularPorcentajeCambio(lista.length, expedientesMesAnterior?.length || 0),
          anoAnterior: calcularPorcentajeCambio(lista.length, expedientesAnoAnterior?.length || 0),
        },
        altaPrioridad: {
          mesAnterior: calcularPorcentajeCambio(altaPrioridad, altaPrioridadMesAnt),
          anoAnterior: calcularPorcentajeCambio(altaPrioridad, altaPrioridadAnoAnt),
        },
        cargaTrabajo: {
          mesAnterior: calcularPorcentajeCambio(cargaTrabajo, cargaTrabajoMesAnt),
          anoAnterior: calcularPorcentajeCambio(cargaTrabajo, cargaTrabajoAnoAnt),
        },
        volumenLineas: {
          mesAnterior: calcularPorcentajeCambio(volumenLineas, volumenLineasMesAnt),
          anoAnterior: calcularPorcentajeCambio(volumenLineas, volumenLineasAnoAnt),
        },
        minutosPromedio: {
          mesAnterior: calcularPorcentajeCambio(minutosPromedio, minutosPromedioMesAnt),
          anoAnterior: calcularPorcentajeCambio(minutosPromedio, minutosPromedioAnoAnt),
        },
      });

      // ── Distribución por dificultad ──
      const dificultadCount = {
        Baja: lista.filter((exp) => exp.dificultad === 'Baja').length,
        Media: lista.filter((exp) => exp.dificultad === 'Media').length,
        Alta: lista.filter((exp) => exp.dificultad === 'Alta').length,
      };
      const totalDificultad =
        dificultadCount.Baja + dificultadCount.Media + dificultadCount.Alta;
      setDificultadData([
        {
          label: 'Baja',
          value: totalDificultad > 0 ? Math.round((dificultadCount.Baja / totalDificultad) * 100) : 0,
          color: '#10b981',
        },
        {
          label: 'Media',
          value:
            totalDificultad > 0 ? Math.round((dificultadCount.Media / totalDificultad) * 100) : 0,
          color: '#f59e0b',
        },
        {
          label: 'Alta',
          value: totalDificultad > 0 ? Math.round((dificultadCount.Alta / totalDificultad) * 100) : 0,
          color: '#ef4444',
        },
      ]);

      // ── Top solicitantes ──
      const solicitantesCount: { [key: string]: number } = {};
      lista.forEach((exp) => {
        solicitantesCount[exp.solicitante] = (solicitantesCount[exp.solicitante] || 0) + 1;
      });
      setSolicitantesData(
        Object.entries(solicitantesCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );

      // ── Estados generales y Dropship ──
      setEstadoData(contarEstados(lista));

      const expDropship = lista.filter(esDropship);
      setEstadoDataDropship(contarEstados(expDropship));

      // POs Dropship (incluye MCG) que aún no tienen ETD
      setSinEtdDetalle(
        expDropship
          .filter((exp) => !exp.etd)
          .map((exp) => ({
            id: exp.id,
            po_tiquetera: exp.po_tiquetera,
            exp_id: exp.exp_id || '',
            solicitante: exp.solicitante || '',
            estado_expediente: exp.estado_expediente || '—',
            tipo_modulo: exp.mcg === true ? 'MCG' : 'Dropship',
          }))
      );

      const expMcg = expDropship.filter((exp) => exp.mcg === true);
      const expNormal = expDropship.filter((exp) => exp.mcg !== true);

      // OK País: cuenta Notificado y Visto Listo
      setNotificadoOkPais(
        expDropship.filter(
          (exp) =>
            (exp.estado_expediente === 'Notificado' || exp.estado_expediente === 'Visto Listo') &&
            exp.ok_pais === true
        ).length
      );

      // ── KPIs Dropship ──
      const etdNotificado = await calcularKpiEtdNotificado(expNormal, META_ETD_DIAS);
      setKpiEtdNotificado(etdNotificado.kpi);
      setEtdDetalle(etdNotificado.detalle);

      const expZF = await cargarZfDelPeriodo(aFechaISO(inicio), aFechaISO(fin));
      setEstadoDataZF(contarEstados(expZF));

      setKpiDsPromedioNotificado(await calcularPromedioCreacionNotificado(expNormal));
      setKpiZfPromedioCompletado(await calcularPromedioCreacionCompletado(expZF));

      calcularKPIDuracionMinima(expNormal);

      const mcg = await calcularKpisMcg(expMcg, META_MCG_CREACION_DIAS, META_MCG_ETD_DIAS);
      setKpiMcgCreacion(mcg.creacion);
      setMcgCreacionDetalle(mcg.creacionDetalle);
      setKpiMcgEtdNotificado(mcg.etd);
      setMcgEtdDetalle(mcg.etdDetalle);

      const asignado = await calcularKpiAsignadoNotificado(expNormal);
      setKpiAsignadoNotificado(asignado.kpi);
      setAsignadoNotificadoDetalle(asignado.detalle);

      setKpiFacturacion(await calcularKpiFacturacion(expNormal));
      setKpiEta15(calcularKpiEta15(expNormal));

      try {
        setKpisZF(await cargarKpisZf(expZF));
      } catch (error) {
        console.error('Error al cargar KPIs de ZF:', error);
        setKpisZF(crearKpisZfVacio());
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  }, [periodoActivo, rangoPersonalizado, calcularKPIDuracionMinima, limpiarKpisDropship]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Tiempos promedio entre estados (se recalculan al cambiar de módulo o de datos)
  useEffect(() => {
    let cancelado = false;

    if (expedientes.length === 0) {
      setTiemposEntreEstados([]);
      return () => {
        cancelado = true;
      };
    }

    cargarTiemposEntreEstados(expedientes, filtroModuloTiempos)
      .then((filas) => {
        if (!cancelado) setTiemposEntreEstados(filas);
      })
      .catch((error) => {
        console.error('Error al cargar tiempos entre estados:', error);
        if (!cancelado) setTiemposEntreEstados([]);
      });

    return () => {
      cancelado = true;
    };
  }, [expedientes, filtroModuloTiempos]);

  // ── Métricas derivadas de la lista cargada ──
  const entregadosDropship = useMemo(
    () =>
      estadoDataDropship.notificado +
      expedientes.filter((e) => esDropship(e) && e.estado_expediente === 'Visto Listo').length,
    [estadoDataDropship.notificado, expedientes]
  );

  const transitoCortoDropship = useMemo(
    () => expedientes.filter((e) => esDropship(e) && e.transito_corto === true).length,
    [expedientes]
  );

  // ── Acciones de período ──
  const seleccionarPeriodo = useCallback((periodo: string) => {
    setPeriodoActivo(periodo);
    setRangoPersonalizado(null);
    const { inicio, fin } = obtenerRangoFechas(periodo, null);
    setFechaInicio(aFechaISO(inicio));
    setFechaFin(aFechaISO(fin));
  }, []);

  const aplicarFiltroPersonalizado = useCallback(() => {
    if (!fechaInicio || !fechaFin) {
      setErrorFiltros('Por favor seleccione ambas fechas');
      return;
    }
    if (fechaInicio > fechaFin) {
      setErrorFiltros('La fecha de inicio no puede ser mayor a la fecha de fin');
      return;
    }
    setErrorFiltros('');
    setRangoPersonalizado({ inicio: fechaInicio, fin: fechaFin });
    setPeriodoActivo('personalizado');
  }, [fechaInicio, fechaFin]);

  const limpiarFiltros = useCallback(() => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    setFechaInicio(aFechaISO(primerDia));
    setFechaFin(aFechaISO(ultimoDia));
    setRangoPersonalizado(null);
    setPeriodoActivo('mes-actual');
    setErrorFiltros('');
  }, []);

  return {
    // período
    fechaInicio,
    setFechaInicio,
    fechaFin,
    setFechaFin,
    periodoActivo,
    errorFiltros,
    seleccionarPeriodo,
    aplicarFiltroPersonalizado,
    limpiarFiltros,

    // datos
    loading,
    expedientes,
    kpiData,
    comparativos,
    dificultadData,
    solicitantesData,
    estadoData,
    estadoDataDropship,
    estadoDataZF,
    documentosPendientes,
    vistaEstados,
    setVistaEstados,

    // tiempos
    filtroModuloTiempos,
    setFiltroModuloTiempos,
    tiemposEntreEstados,

    // dropship
    kpiDsPromedioNotificado,
    kpiAsignadoNotificado,
    asignadoNotificadoDetalle,
    showReporteAsignadoNotificado,
    setShowReporteAsignadoNotificado,
    notificadoOkPais,
    sinEtdDetalle,
    showSinEtdDetalle,
    setShowSinEtdDetalle,
    kpiEtdNotificado,
    etdDetalle,
    showReporteEtd,
    setShowReporteEtd,
    kpiFacturacion,
    kpiEta15,
    entregadosDropship,
    transitoCortoDropship,

    // mcg
    kpiMcgCreacion,
    kpiMcgEtdNotificado,
    mcgCreacionDetalle,
    showMcgCreacionDetalle,
    setShowMcgCreacionDetalle,
    mcgEtdDetalle,
    showMcgEtdDetalle,
    setShowMcgEtdDetalle,

    // duración
    kpiDuracion,
    expedientesReporte,
    showReporteDuracion,
    setShowReporteDuracion,
    reporteFiltro,
    setReporteFiltro,

    // zf
    kpisZF,
    kpiZfPromedioCompletado,
  };
}

// Tipo del estado que consumen las secciones visuales.
export type DashboardData = ReturnType<typeof useDashboard>;

