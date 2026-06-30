import { useState, useEffect } from 'react';
import KPICard from './KPICard';
import DonutChart from './DonutChart';
import BarChart from './BarChart';
import ProgressBar from './ProgressBar';
import { supabase } from '../../../lib/supabase';

interface HistorialCambio {
  id: string;
  campo_modificado: string;
  valor_anterior: string;
  valor_nuevo: string;
  usuario: string;
  fecha_cambio: string;
}

interface TiempoEstado {
  id: string;
  estado_anterior: string;
  estado_nuevo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  minutos_transcurridos: number | null;
}

export default function Dashboard() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [periodoActivo, setPeriodoActivo] = useState('mes-actual');
  const [vistaEstados, setVistaEstados] = useState<'general' | 'dropship' | 'zf'>('general');

  const [kpiData, setKpiData] = useState({
    totalSolicitudes: 0,
    altaPrioridad: 0,
    cargaTrabajo: 0,
    volumenLineas: 0,
    minutosPromedio: 0
  });

  const [comparativos, setComparativos] = useState({
    totalSolicitudes: { mesAnterior: '0%', anoAnterior: '0%' },
    altaPrioridad: { mesAnterior: '0%', anoAnterior: '0%' },
    cargaTrabajo: { mesAnterior: '0%', anoAnterior: '0%' },
    volumenLineas: { mesAnterior: '0%', anoAnterior: '0%' },
    minutosPromedio: { mesAnterior: '0%', anoAnterior: '0%' }
  });

  const [dificultadData, setDificultadData] = useState([
    { label: 'Baja', value: 0, color: '#10b981' },
    { label: 'Media', value: 0, color: '#f59e0b' },
    { label: 'Alta', value: 0, color: '#ef4444' }
  ]);

  const [solicitantesData, setSolicitantesData] = useState<{ name: string; count: number }[]>([]);

  const [estadoData, setEstadoData] = useState({
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
    total: 0
  });

  const [estadoDataDropship, setEstadoDataDropship] = useState({
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
    total: 0
  });

  const [estadoDataZF, setEstadoDataZF] = useState({
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
    total: 0
  });

  const [filtroModuloTiempos, setFiltroModuloTiempos] = useState<'todos' | 'dropship' | 'zf'>('todos');

  const [tiemposEntreEstados, setTiemposEntreEstados] = useState<{
    desde: string;
    hasta: string;
    minutosPromedio: number;
    cantidad: number;
    fuente: 'real' | 'estimado';
  }[]>([]);

  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<string | null>(null);
  const [historialExpediente, setHistorialExpediente] = useState<HistorialCambio[]>([]);
  const [tiemposExpediente, setTiemposExpediente] = useState<TiempoEstado[]>([]);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [expedientes, setExpedientes] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [kpisZF, setKpisZF] = useState({
    creadoAEsperaRespuesta: { dias: 0, cumpleMeta: true },
    arriboALiberacion: { minutos: 0, cumpleMeta: true }
  });

  const [notificadoOkPais, setNotificadoOkPais] = useState(0);

  // KPI Duración Mínima 2 días
  const META_DURACION_DIAS = 2;
  const [kpiDuracion, setKpiDuracion] = useState({
    totalEvaluados: 0,
    cumplen: 0,
    noCumplen: 0,
    porcentajeCumplimiento: 0,
    diasPromedioTotal: 0
  });
  const [expedientesReporte, setExpedientesReporte] = useState<{
    id: string;
    po_tiquetera: string;
    exp_id: string;
    tipo_modulo: string;
    estado_expediente: string;
    solicitante: string;
    responsable_creacion: string;
    diasDuracion: number;
    cumpleMeta: boolean;
    fechaCreacion: string;
    fechaFin: string | null;
  }[]>([]);
  const [showReporteDuracion, setShowReporteDuracion] = useState(false);
  const [reporteFiltro, setReporteFiltro] = useState<'todos' | 'cumplen' | 'no-cumplen'>('todos');

  useEffect(() => {
    // Establecer mes actual por defecto al cargar
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    setFechaInicio(primerDia.toISOString().split('T')[0]);
    setFechaFin(ultimoDia.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, fechaFin, periodoActivo]);

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      cargarTiemposEntreEstados(filtroModuloTiempos);
    }
  }, [filtroModuloTiempos]);

  const calcularPorcentajeCambio = (actual: number, anterior: number) => {
    if (anterior === 0) return actual > 0 ? '+100%' : '0%';
    const cambio = ((actual - anterior) / anterior) * 100;
    return cambio > 0 ? `+${cambio.toFixed(1)}%` : `${cambio.toFixed(1)}%`;
  };

  const obtenerRangoFechas = () => {
    const hoy = new Date();
    let inicio: Date;
    let fin: Date;

    if (periodoActivo === 'personalizado' && fechaInicio && fechaFin) {
      return {
        inicio: new Date(fechaInicio),
        fin: new Date(fechaFin)
      };
    }

    switch (periodoActivo) {
      case 'mes-actual':
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        break;
      case 'mes-anterior':
        inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        break;
      case 'trimestre':
        const mesInicio = Math.floor(hoy.getMonth() / 3) * 3;
        inicio = new Date(hoy.getFullYear(), mesInicio, 1);
        fin = new Date(hoy.getFullYear(), mesInicio + 3, 0);
        break;
      case 'ano-actual':
        inicio = new Date(hoy.getFullYear(), 0, 1);
        fin = new Date(hoy.getFullYear(), 11, 31);
        break;
      default:
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    }

    return { inicio, fin };
  };

  const contarEstados = (lista: any[]) => ({
    creado: lista.filter(e => ['Creado', 'Nuevo'].includes(e.estado_expediente)).length,
    asignado: lista.filter(e => e.estado_expediente === 'Asignado').length,
    enProceso: lista.filter(e => e.estado_expediente === 'En Proceso').length,
    enRevision: lista.filter(e => ['En Revisión', 'En Revision'].includes(e.estado_expediente)).length,
    liberado: lista.filter(e => ['Liberado', 'LIBERADO', 'Liberación', 'Liberacion'].includes(e.estado_expediente)).length,
    notificado: lista.filter(e => e.estado_expediente === 'Notificado').length,
    completado: lista.filter(e => e.estado_expediente === 'Completado').length,
    facturacion: lista.filter(e => ['Facturación', 'Facturacion'].includes(e.estado_expediente)).length,
    recepcionCarga: lista.filter(e => ['Recepción de Carga', 'Recepcion de Carga'].includes(e.estado_expediente)).length,
    esperaRespuesta: lista.filter(e => ['Espera de Respuesta', 'Espera de respuesta'].includes(e.estado_expediente)).length,
    arriboCarga: lista.filter(e => ['Arribo de Carga', 'Arribo de carga'].includes(e.estado_expediente)).length,
    pendienteProforma: lista.filter(e => ['Pendiente Proforma', 'Pendiente proforma'].includes(e.estado_expediente)).length,
    total: lista.length
  });

  const calcularKPIDuracionMinima = (listaExpedientes: any[]) => {
    const ahora = new Date();
    const evaluados = listaExpedientes.map(exp => {
      const fechaCreacion = exp.created_at || exp.fecha_creacion_expediente;
      const estadoFinal = (exp.tipo_modulo || '').toLowerCase() === 'dropship' ? 'Notificado' : 'Liberación';
      const esFinalizado = exp.estado_expediente === estadoFinal;
      const fechaFin = esFinalizado && exp.fecha_liberacion ? new Date(exp.fecha_liberacion) : ahora;
      const fechaIni = new Date(fechaCreacion);
      const diffMs = fechaFin.getTime() - fechaIni.getTime();
      const diasDuracion = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
      return {
        id: exp.id,
        po_tiquetera: exp.po_tiquetera,
        exp_id: exp.exp_id || '',
        tipo_modulo: (exp.tipo_modulo || '').toLowerCase(),
        estado_expediente: exp.estado_expediente,
        solicitante: exp.solicitante,
        responsable_creacion: exp.responsable_creacion,
        diasDuracion: Math.round(diasDuracion * 10) / 10,
        cumpleMeta: diasDuracion >= META_DURACION_DIAS,
        fechaCreacion: fechaCreacion,
        fechaFin: esFinalizado && exp.fecha_liberacion ? exp.fecha_liberacion : null
      };
    });

    const cumplen = evaluados.filter(e => e.cumpleMeta).length;
    const noCumplen = evaluados.filter(e => !e.cumpleMeta).length;
    const totalDias = evaluados.reduce((sum, e) => sum + e.diasDuracion, 0);
    const diasPromedio = evaluados.length > 0 ? Math.round((totalDias / evaluados.length) * 10) / 10 : 0;

    setKpiDuracion({
      totalEvaluados: evaluados.length,
      cumplen,
      noCumplen,
      porcentajeCumplimiento: evaluados.length > 0 ? Math.round((cumplen / evaluados.length) * 100) : 0,
      diasPromedioTotal: diasPromedio
    });
    setExpedientesReporte(evaluados.sort((a, b) => a.diasDuracion - b.diasDuracion));
  };

  const cargarKPIsZF = async () => {
    try {
      const { inicio, fin } = obtenerRangoFechas();

      // Obtener IDs de expedientes ZF del período
      const { data: expedientesZF, error: errorExp } = await supabase
        .from('expedientes')
        .select('id')
        .eq('tipo_modulo', 'zf')
        .gte('fecha_solicitud', inicio.toISOString().split('T')[0])
        .lte('fecha_solicitud', fin.toISOString().split('T')[0]);

      if (errorExp || !expedientesZF || expedientesZF.length === 0) {
        setKpisZF({
          creadoAEsperaRespuesta: { dias: 0, cumpleMeta: true },
          arriboALiberacion: { minutos: 0, cumpleMeta: true }
        });
        return;
      }

      const expedienteIds = expedientesZF.map(exp => exp.id);

      // Obtener tiempos de estados
      const { data: tiempos, error } = await supabase
        .from('expedientes_tiempos_estados')
        .select('*')
        .in('expediente_id', expedienteIds)
        .not('minutos_transcurridos', 'is', null);

      if (error || !tiempos || tiempos.length === 0) {
        setKpisZF({
          creadoAEsperaRespuesta: { dias: 0, cumpleMeta: true },
          arriboALiberacion: { minutos: 0, cumpleMeta: true }
        });
        return;
      }

      // KPI 1: Creado → Espera de Respuesta (meta ≤15 días)
      const tiemposCreadoAEspera = tiempos.filter(t => 
        (t.estado_anterior === 'Creado' || t.estado_anterior === 'Asignado' || t.estado_anterior === 'En Proceso') &&
        t.estado_nuevo === 'Espera de Respuesta'
      );

      let diasPromedioCreadoAEspera = 0;
      if (tiemposCreadoAEspera.length > 0) {
        const totalMinutos = tiemposCreadoAEspera.reduce((sum, t) => sum + (t.minutos_transcurridos || 0), 0);
        const minutosPromedio = totalMinutos / tiemposCreadoAEspera.length;
        diasPromedioCreadoAEspera = Math.round((minutosPromedio / 60 / 24) * 10) / 10; // Redondear a 1 decimal
      }

      // KPI 2: Arribo → Liberación (meta ≤45 minutos)
      const tiemposArriboALiberacion = tiempos.filter(t => 
        t.estado_anterior === 'Arribo de Carga' &&
        (t.estado_nuevo === 'Liberación' || t.estado_nuevo === 'Liberado')
      );

      let minutosPromedioArriboALiberacion = 0;
      if (tiemposArriboALiberacion.length > 0) {
        const totalMinutos = tiemposArriboALiberacion.reduce((sum, t) => sum + (t.minutos_transcurridos || 0), 0);
        minutosPromedioArriboALiberacion = Math.round(totalMinutos / tiemposArriboALiberacion.length);
      }

      setKpisZF({
        creadoAEsperaRespuesta: {
          dias: diasPromedioCreadoAEspera,
          cumpleMeta: diasPromedioCreadoAEspera <= 15
        },
        arriboALiberacion: {
          minutos: minutosPromedioArriboALiberacion,
          cumpleMeta: minutosPromedioArriboALiberacion <= 45
        }
      });
    } catch (error) {
      console.error('Error al cargar KPIs de ZF:', error);
      setKpisZF({
        creadoAEsperaRespuesta: { dias: 0, cumpleMeta: true },
        arriboALiberacion: { minutos: 0, cumpleMeta: true }
      });
    }
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const { inicio, fin } = obtenerRangoFechas();
      
      const { data: expedientes, error } = await supabase
        .from('expedientes')
        .select('*')
        .gte('fecha_solicitud', inicio.toISOString().split('T')[0])
        .lte('fecha_solicitud', fin.toISOString().split('T')[0]);

      if (error) throw error;

      const mesAnteriorInicio = new Date(inicio);
      mesAnteriorInicio.setMonth(mesAnteriorInicio.getMonth() - 1);
      const mesAnteriorFin = new Date(fin);
      mesAnteriorFin.setMonth(mesAnteriorFin.getMonth() - 1);

      const anoAnteriorInicio = new Date(inicio);
      anoAnteriorInicio.setFullYear(anoAnteriorInicio.getFullYear() - 1);
      const anoAnteriorFin = new Date(fin);
      anoAnteriorFin.setFullYear(anoAnteriorFin.getFullYear() - 1);

      const { data: expedientesMesAnterior } = await supabase
        .from('expedientes')
        .select('*')
        .gte('fecha_solicitud', mesAnteriorInicio.toISOString().split('T')[0])
        .lte('fecha_solicitud', mesAnteriorFin.toISOString().split('T')[0]);

      const { data: expedientesAnoAnterior } = await supabase
        .from('expedientes')
        .select('*')
        .gte('fecha_solicitud', anoAnteriorInicio.toISOString().split('T')[0])
        .lte('fecha_solicitud', anoAnteriorFin.toISOString().split('T')[0]);

      if (expedientes && expedientes.length > 0) {
        setExpedientes(expedientes);

        const altaPrioridad = expedientes.filter(exp => exp.prioridad === 'Alta' || exp.prioridad_urgente).length;
        const cargaTrabajo = expedientes.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0);
        const volumenLineas = expedientes.reduce((sum, exp) => sum + (exp.lineas_oc || 0), 0);
        const totalMinutos = expedientes.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0);
        const minutosPromedio = expedientes.length > 0 ? Math.round(totalMinutos / expedientes.length) : 0;

        setKpiData({ totalSolicitudes: expedientes.length, altaPrioridad, cargaTrabajo, volumenLineas, minutosPromedio });

        const altaPrioridadMesAnt = expedientesMesAnterior?.filter(exp => exp.prioridad === 'Alta' || exp.prioridad_urgente).length || 0;
        const cargaTrabajoMesAnt = expedientesMesAnterior?.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0) || 0;
        const volumenLineasMesAnt = expedientesMesAnterior?.reduce((sum, exp) => sum + (exp.lineas_oc || 0), 0) || 0;
        const totalMinutosMesAnt = expedientesMesAnterior?.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0) || 0;
        const minutosPromedioMesAnt = expedientesMesAnterior && expedientesMesAnterior.length > 0
          ? Math.round(totalMinutosMesAnt / expedientesMesAnterior.length) : 0;

        const altaPrioridadAnoAnt = expedientesAnoAnterior?.filter(exp => exp.prioridad === 'Alta' || exp.prioridad_urgente).length || 0;
        const cargaTrabajoAnoAnt = expedientesAnoAnterior?.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0) || 0;
        const volumenLineasAnoAnt = expedientesAnoAnterior?.reduce((sum, exp) => sum + (exp.lineas_oc || 0), 0) || 0;
        const totalMinutosAnoAnt = expedientesAnoAnterior?.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0) || 0;
        const minutosPromedioAnoAnt = expedientesAnoAnterior && expedientesAnoAnterior.length > 0
          ? Math.round(totalMinutosAnoAnt / expedientesAnoAnterior.length) : 0;

        setComparativos({
          totalSolicitudes: {
            mesAnterior: calcularPorcentajeCambio(expedientes.length, expedientesMesAnterior?.length || 0),
            anoAnterior: calcularPorcentajeCambio(expedientes.length, expedientesAnoAnterior?.length || 0)
          },
          altaPrioridad: {
            mesAnterior: calcularPorcentajeCambio(altaPrioridad, altaPrioridadMesAnt),
            anoAnterior: calcularPorcentajeCambio(altaPrioridad, altaPrioridadAnoAnt)
          },
          cargaTrabajo: {
            mesAnterior: calcularPorcentajeCambio(cargaTrabajo, cargaTrabajoMesAnt),
            anoAnterior: calcularPorcentajeCambio(cargaTrabajo, cargaTrabajoAnoAnt)
          },
          volumenLineas: {
            mesAnterior: calcularPorcentajeCambio(volumenLineas, volumenLineasMesAnt),
            anoAnterior: calcularPorcentajeCambio(volumenLineas, volumenLineasAnoAnt)
          },
          minutosPromedio: {
            mesAnterior: calcularPorcentajeCambio(minutosPromedio, minutosPromedioMesAnt),
            anoAnterior: calcularPorcentajeCambio(minutosPromedio, minutosPromedioAnoAnt)
          }
        });

        const dificultadCount = {
          Baja: expedientes.filter(exp => exp.dificultad === 'Baja').length,
          Media: expedientes.filter(exp => exp.dificultad === 'Media').length,
          Alta: expedientes.filter(exp => exp.dificultad === 'Alta').length
        };
        const totalDificultad = dificultadCount.Baja + dificultadCount.Media + dificultadCount.Alta;
        setDificultadData([
          { label: 'Baja', value: totalDificultad > 0 ? Math.round((dificultadCount.Baja / totalDificultad) * 100) : 0, color: '#10b981' },
          { label: 'Media', value: totalDificultad > 0 ? Math.round((dificultadCount.Media / totalDificultad) * 100) : 0, color: '#f59e0b' },
          { label: 'Alta', value: totalDificultad > 0 ? Math.round((dificultadCount.Alta / totalDificultad) * 100) : 0, color: '#ef4444' }
        ]);

        const solicitantesCount: { [key: string]: number } = {};
        expedientes.forEach(exp => {
          solicitantesCount[exp.solicitante] = (solicitantesCount[exp.solicitante] || 0) + 1;
        });
        const topSolicitantes = Object.entries(solicitantesCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setSolicitantesData(topSolicitantes);

        // Estados generales
        setEstadoData(contarEstados(expedientes));

        // Estados Dropship — comparación case-insensitive
        const expDropship = expedientes.filter(exp =>
          (exp.tipo_modulo || '').toLowerCase() === 'dropship'
        );
        setEstadoDataDropship(contarEstados(expDropship));

        // KPI Notificado → OK País (Dropship)
        const countNotificadoOkPais = expDropship.filter(exp =>
          exp.estado_expediente === 'Notificado' && exp.ok_pais === true
        ).length;
        setNotificadoOkPais(countNotificadoOkPais);

        // Estados ZF — comparación case-insensitive
        const expZF = expedientes.filter(exp =>
          (exp.tipo_modulo || '').toLowerCase() === 'zf'
        );
        setEstadoDataZF(contarEstados(expZF));

        calcularKPIDuracionMinima(expedientes);
        await cargarTiemposEntreEstados(filtroModuloTiempos);
        await cargarKPIsZF();
      } else {
        setExpedientes([]);
        setKpiData({ totalSolicitudes: 0, altaPrioridad: 0, cargaTrabajo: 0, volumenLineas: 0, minutosPromedio: 0 });
        const estadoVacio = { creado: 0, asignado: 0, enProceso: 0, enRevision: 0, liberado: 0, notificado: 0, completado: 0, facturacion: 0, recepcionCarga: 0, esperaRespuesta: 0, arriboCarga: 0, pendienteProforma: 0, total: 0 };
        setEstadoData(estadoVacio);
        setEstadoDataDropship(estadoVacio);
        setEstadoDataZF(estadoVacio);
        setNotificadoOkPais(0);
        setKpiDuracion({ totalEvaluados: 0, cumplen: 0, noCumplen: 0, porcentajeCumplimiento: 0, diasPromedioTotal: 0 });
        setExpedientesReporte([]);
        setComparativos({
          totalSolicitudes: { mesAnterior: '0%', anoAnterior: '0%' },
          altaPrioridad: { mesAnterior: '0%', anoAnterior: '0%' },
          cargaTrabajo: { mesAnterior: '0%', anoAnterior: '0%' },
          volumenLineas: { mesAnterior: '0%', anoAnterior: '0%' },
          minutosPromedio: { mesAnterior: '0%', anoAnterior: '0%' }
        });
        setKpisZF({
          creadoAEsperaRespuesta: { dias: 0, cumpleMeta: true },
          arriboALiberacion: { minutos: 0, cumpleMeta: true }
        });
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarTiemposEntreEstados = async (moduloFiltro: 'todos' | 'dropship' | 'zf' = 'todos') => {
    try {
      const { inicio, fin } = obtenerRangoFechas();

      let query = supabase
        .from('expedientes')
        .select('id, created_at, estado_expediente, tipo_modulo, fecha_liberacion, tiempo_real_minutos')
        .gte('fecha_solicitud', inicio.toISOString().split('T')[0])
        .lte('fecha_solicitud', fin.toISOString().split('T')[0]);

      if (moduloFiltro !== 'todos') {
        query = query.eq('tipo_modulo', moduloFiltro);
      }

      const { data: expedientesPeriodo, error: errorExp } = await query;

      if (errorExp || !expedientesPeriodo || expedientesPeriodo.length === 0) {
        setTiemposEntreEstados([]);
        return;
      }

      const expedienteIds = expedientesPeriodo.map(exp => exp.id);

      // Intentar cargar datos reales de la tabla de tiempos
      const { data: tiempos } = await supabase
        .from('expedientes_tiempos_estados')
        .select('*')
        .in('expediente_id', expedienteIds)
        .not('minutos_transcurridos', 'is', null);

      if (tiempos && tiempos.length > 0) {
        // Datos reales: agrupar por transición (estado_anterior → estado_nuevo)
        const transiciones: { [key: string]: { minutos: number[]; desde: string; hasta: string } } = {};

        tiempos.forEach(t => {
          const desde = t.estado_anterior || 'Inicio';
          const hasta = t.estado_nuevo || 'Desconocido';
          const key = `${desde}|${hasta}`;
          if (!transiciones[key]) transiciones[key] = { minutos: [], desde, hasta };
          if ((t.minutos_transcurridos || 0) > 0) {
            transiciones[key].minutos.push(t.minutos_transcurridos);
          }
        });

        const ordenEstados = [
          'Asignado', 'En Proceso', 'Espera de Respuesta', 'Completado',
          'Arribo de Carga', 'Pendiente Proforma', 'Recepción de Carga',
          'Facturación', 'Liberación', 'Notificado'
        ];

        const promedios = Object.values(transiciones)
          .filter(t => t.minutos.length > 0)
          .map(t => ({
            desde: t.desde,
            hasta: t.hasta,
            minutosPromedio: Math.round(t.minutos.reduce((a, b) => a + b, 0) / t.minutos.length),
            cantidad: t.minutos.length,
            fuente: 'real' as const
          }))
          .sort((a, b) => {
            const idxA = ordenEstados.indexOf(a.hasta);
            const idxB = ordenEstados.indexOf(b.hasta);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });

        setTiemposEntreEstados(promedios);
      } else {
        // Fallback: estimar tiempos desde los datos de expedientes
        // Agrupa expedientes por estado actual y calcula días promedio desde creación
        const estadosOrden = [
          'Asignado', 'En Proceso', 'Espera de Respuesta', 'Completado',
          'Arribo de Carga', 'Pendiente Proforma', 'Recepción de Carga',
          'Facturación', 'Liberación', 'Notificado'
        ];
        const estadosPrevios: { [key: string]: string } = {
          'En Proceso': 'Asignado',
          'Espera de Respuesta': 'En Proceso',
          'Completado': 'Espera de Respuesta',
          'Arribo de Carga': 'Completado',
          'Pendiente Proforma': 'Arribo de Carga',
          'Recepción de Carga': 'Espera de Respuesta',
          'Facturación': 'Recepción de Carga',
          'Liberación': 'Pendiente Proforma',
          'Notificado': 'Liberación'
        };

        const ahora = new Date();
        const porEstado: { [key: string]: number[] } = {};

        expedientesPeriodo.forEach(exp => {
          const estado = exp.estado_expediente;
          if (!estado || !estadosOrden.includes(estado)) return;
          const created = new Date(exp.created_at);
          let minutos = 0;
          if (exp.tiempo_real_minutos) {
            // Para finalizados, distribuir el tiempo total entre los estados del flujo
            const estadoIdx = estadosOrden.indexOf(estado);
            minutos = Math.round(exp.tiempo_real_minutos / Math.max(1, estadoIdx + 1));
          } else {
            // Para en curso, tiempo desde creación al momento actual
            minutos = Math.round((ahora.getTime() - created.getTime()) / (1000 * 60));
          }
          if (minutos > 0) {
            if (!porEstado[estado]) porEstado[estado] = [];
            porEstado[estado].push(minutos);
          }
        });

        const estimados = Object.entries(porEstado)
          .filter(([, mins]) => mins.length > 0)
          .map(([estado, mins]) => ({
            desde: estadosPrevios[estado] || 'Inicio',
            hasta: estado,
            minutosPromedio: Math.round(mins.reduce((a, b) => a + b, 0) / mins.length),
            cantidad: mins.length,
            fuente: 'estimado' as const
          }))
          .sort((a, b) => estadosOrden.indexOf(a.hasta) - estadosOrden.indexOf(b.hasta));

        setTiemposEntreEstados(estimados);
      }
    } catch (error) {
      console.error('Error al cargar tiempos entre estados:', error);
      setTiemposEntreEstados([]);
    }
  };

  const verHistorial = async (expedienteId: string) => {
    try {
      setExpedienteSeleccionado(expedienteId);
      
      // Cargar historial de cambios
      const { data: historial, error: errorHistorial } = await supabase
        .from('expedientes_historial')
        .select('*')
        .eq('expediente_id', expedienteId)
        .order('fecha_cambio', { ascending: false });

      if (errorHistorial) throw errorHistorial;
      setHistorialExpediente(historial || []);

      // Cargar tiempos por estado
      const { data: tiempos, error: errorTiempos } = await supabase
        .from('expedientes_tiempos_estados')
        .select('*')
        .eq('expediente_id', expedienteId)
        .order('fecha_inicio', { ascending: false });

      if (errorTiempos) throw errorTiempos;
      setTiemposExpediente(tiempos || []);

      setShowHistorialModal(true);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  };

  const formatearTiempo = (minutos: number | null) => {
    if (!minutos) return 'En curso';
    
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    
    if (horas > 24) {
      const dias = Math.floor(horas / 24);
      const horasRestantes = horas % 24;
      return `${dias}d ${horasRestantes}h ${mins}m`;
    }
    
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
  };

  const aplicarFiltroPersonalizado = () => {
    if (!fechaInicio || !fechaFin) {
      alert('Por favor seleccione ambas fechas');
      return;
    }
    setPeriodoActivo('personalizado');
  };

  const limpiarFiltros = () => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    setFechaInicio(primerDia.toISOString().split('T')[0]);
    setFechaFin(ultimoDia.toISOString().split('T')[0]);
    setPeriodoActivo('mes-actual');
  };

  if (loading) {
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

      {/* Filtros de Fecha */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros de Período</h3>
        
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setPeriodoActivo('mes-actual')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                periodoActivo === 'mes-actual'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mes Actual
            </button>
            <button
              onClick={() => setPeriodoActivo('mes-anterior')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                periodoActivo === 'mes-anterior'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mes Anterior
            </button>
            <button
              onClick={() => setPeriodoActivo('trimestre')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                periodoActivo === 'trimestre'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Trimestre
            </button>
            <button
              onClick={() => setPeriodoActivo('ano-actual')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                periodoActivo === 'ano-actual'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Año Actual
            </button>
          </div>

          <div className="flex-1 flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
              />
            </div>
            <button
              onClick={aplicarFiltroPersonalizado}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-filter-line mr-2"></i>
              Aplicar
            </button>
            <button
              onClick={limpiarFiltros}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line mr-2"></i>
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <KPICard
          title="Total Solicitudes"
          value={kpiData.totalSolicitudes}
          icon="ri-file-list-3-line"
          color="bg-blue-500"
          trend={comparativos.totalSolicitudes.mesAnterior}
          subtitle={`vs año anterior: ${comparativos.totalSolicitudes.anoAnterior}`}
        />
        <KPICard
          title="Alta Prioridad"
          value={kpiData.altaPrioridad}
          icon="ri-alarm-warning-line"
          color="bg-red-500"
          trend={comparativos.altaPrioridad.mesAnterior}
          subtitle={`vs año anterior: ${comparativos.altaPrioridad.anoAnterior}`}
        />
        <KPICard
          title="Carga de Trabajo (min)"
          value={kpiData.cargaTrabajo.toLocaleString()}
          icon="ri-time-line"
          color="bg-amber-500"
          trend={comparativos.cargaTrabajo.mesAnterior}
          subtitle={`vs año anterior: ${comparativos.cargaTrabajo.anoAnterior}`}
        />
        <KPICard
          title="Volumen de Líneas OC"
          value={kpiData.volumenLineas.toLocaleString()}
          icon="ri-stack-line"
          color="bg-teal-500"
          trend={comparativos.volumenLineas.mesAnterior}
          subtitle={`vs año anterior: ${comparativos.volumenLineas.anoAnterior}`}
        />
        <KPICard
          title="Minutos Promedio"
          value={kpiData.minutosPromedio}
          icon="ri-timer-line"
          color="bg-purple-500"
          trend={comparativos.minutosPromedio.mesAnterior}
          subtitle={`vs año anterior: ${comparativos.minutosPromedio.anoAnterior}`}
        />
      </div>

      {/* =========== KPI DURACIÓN MÍNIMA 2 DÍAS =========== */}
      <div className={`rounded-xl p-6 mb-8 border-2 ${
        kpiDuracion.totalEvaluados === 0
          ? 'bg-gray-50 border-gray-200'
          : kpiDuracion.porcentajeCumplimiento >= 80
          ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-300'
          : kpiDuracion.porcentajeCumplimiento >= 50
          ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300'
          : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
      }`}>
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 flex items-center justify-center rounded-xl ${
              kpiDuracion.porcentajeCumplimiento >= 80 ? 'bg-teal-600' :
              kpiDuracion.porcentajeCumplimiento >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}>
              <i className="ri-timer-flash-line text-white text-2xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Indicador de Duración Mínima de Expedientes</h3>
              <p className="text-sm text-gray-600">Meta: cada expediente debe durar al menos <strong>2 días</strong> desde su creación</p>
            </div>
          </div>
          {/* Alerta global */}
          {kpiDuracion.noCumplen > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300 rounded-xl animate-pulse">
              <i className="ri-alarm-warning-fill text-red-600 text-xl"></i>
              <div className="text-sm">
                <p className="font-bold text-red-700">{kpiDuracion.noCumplen} expediente{kpiDuracion.noCumplen !== 1 ? 's' : ''} fuera de rango</p>
                <p className="text-red-600 text-xs">Duración menor a 2 días</p>
              </div>
            </div>
          )}
          {kpiDuracion.noCumplen === 0 && kpiDuracion.totalEvaluados > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-teal-100 border border-teal-300 rounded-xl">
              <i className="ri-shield-check-fill text-teal-600 text-xl"></i>
              <div className="text-sm">
                <p className="font-bold text-teal-700">Todo en orden</p>
                <p className="text-teal-600 text-xs">100% cumple la meta</p>
              </div>
            </div>
          )}
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Cumplimiento */}
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-2">Cumplimiento Global</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-bold ${
                kpiDuracion.porcentajeCumplimiento >= 80 ? 'text-teal-600' :
                kpiDuracion.porcentajeCumplimiento >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>{kpiDuracion.porcentajeCumplimiento}</span>
              <span className="text-lg text-gray-500">%</span>
            </div>
            <div className="mt-3 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${
                  kpiDuracion.porcentajeCumplimiento >= 80 ? 'bg-teal-500' :
                  kpiDuracion.porcentajeCumplimiento >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${kpiDuracion.porcentajeCumplimiento}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{kpiDuracion.totalEvaluados} expedientes evaluados</p>
          </div>

          {/* Cumplen */}
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-2">Cumplen Meta</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-teal-600">{kpiDuracion.cumplen}</span>
              <span className="text-lg text-gray-500">exp.</span>
            </div>
            <div className="flex items-center gap-1 mt-3">
              <i className="ri-checkbox-circle-fill text-teal-500 text-lg"></i>
              <span className="text-xs text-teal-700 font-medium">≥ 2 días de duración</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Dentro del rango aceptable</p>
          </div>

          {/* No Cumplen */}
          <div className={`bg-white rounded-xl p-5 border-2 ${
            kpiDuracion.noCumplen > 0 ? 'border-red-300' : 'border-gray-200'
          }`}>
            <p className="text-xs font-medium text-gray-500 mb-2">No Cumplen Meta</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-bold ${
                kpiDuracion.noCumplen > 0 ? 'text-red-600' : 'text-gray-400'
              }`}>{kpiDuracion.noCumplen}</span>
              <span className="text-lg text-gray-500">exp.</span>
            </div>
            <div className="flex items-center gap-1 mt-3">
              <i className={`ri-error-warning-fill text-lg ${
                kpiDuracion.noCumplen > 0 ? 'text-red-500' : 'text-gray-400'
              }`}></i>
              <span className={`text-xs font-medium ${
                kpiDuracion.noCumplen > 0 ? 'text-red-700' : 'text-gray-400'
              }`}>&lt; 2 días de duración</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Requieren atención</p>
          </div>

          {/* Promedio general */}
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-2">Duración Promedio</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-800">{kpiDuracion.diasPromedioTotal}</span>
              <span className="text-lg text-gray-500">días</span>
            </div>
            <div className="flex items-center gap-1 mt-3">
              <i className="ri-bar-chart-box-line text-gray-500 text-lg"></i>
              <span className="text-xs text-gray-600">Promedio del período</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Meta mínima: 2 días</p>
          </div>
        </div>

        {/* Botón abrir reporte */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowReporteDuracion(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-file-chart-line text-teal-600"></i>
            Ver reporte completo de cumplimiento
          </button>
        </div>
      </div>

      {/* =========== MODAL REPORTE CUMPLIMIENTO =========== */}
      {showReporteDuracion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Reporte de Duración Mínima</h2>
                <p className="text-sm text-gray-500 mt-1">Expedientes que cumplen o no la meta de ≥2 días de duración</p>
              </div>
              <button
                onClick={() => setShowReporteDuracion(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-2xl text-gray-500"></i>
              </button>
            </div>

            {/* Resumen rápido */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{kpiDuracion.totalEvaluados}</p>
                  <p className="text-xs text-gray-500">Total Evaluados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-600">{kpiDuracion.cumplen}</p>
                  <p className="text-xs text-gray-500">Cumplen (≥2 días)</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${
                    kpiDuracion.noCumplen > 0 ? 'text-red-600' : 'text-gray-400'
                  }`}>{kpiDuracion.noCumplen}</p>
                  <p className="text-xs text-gray-500">No Cumplen (&lt;2 días)</p>
                </div>
              </div>
            </div>

            {/* Filtros del reporte */}
            <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-medium text-gray-600">Filtrar:</span>
              <div className="flex gap-2">
                {(['todos', 'cumplen', 'no-cumplen'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setReporteFiltro(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      reporteFiltro === f
                        ? f === 'no-cumplen' ? 'bg-red-500 text-white' : f === 'cumplen' ? 'bg-teal-600 text-white' : 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'todos' ? `Todos (${kpiDuracion.totalEvaluados})` : f === 'cumplen' ? `Cumplen (${kpiDuracion.cumplen})` : `No Cumplen (${kpiDuracion.noCumplen})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabla */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / Tiquetera</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">EXP ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Módulo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Responsable</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Creado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Duración</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Cumple Meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expedientesReporte
                    .filter(e =>
                      reporteFiltro === 'todos' ? true :
                      reporteFiltro === 'cumplen' ? e.cumpleMeta :
                      !e.cumpleMeta
                    )
                    .map((exp) => (
                      <tr key={exp.id} className={`hover:bg-gray-50 transition-colors ${
                        !exp.cumpleMeta ? 'bg-red-50/40' : ''
                      }`}>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-full">
                            {exp.estado_expediente}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{exp.po_tiquetera}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.exp_id || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                            exp.tipo_modulo === 'dropship' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'
                          }`}>
                            {exp.tipo_modulo === 'dropship' ? 'Dropship' : 'ZF'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.responsable_creacion}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(exp.fechaCreacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-bold ${
                            exp.cumpleMeta ? 'text-teal-700' : 'text-red-600'
                          }`}>
                            {exp.diasDuracion} días
                          </span>
                          {!exp.fechaFin && (
                            <span className="block text-xs text-gray-400">en curso</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {exp.cumpleMeta ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full">
                              <i className="ri-checkbox-circle-fill"></i> Cumple
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                              <i className="ri-alarm-warning-fill"></i> Alerta
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                  {expedientesReporte.filter(e =>
                    reporteFiltro === 'todos' ? true :
                    reporteFiltro === 'cumplen' ? e.cumpleMeta :
                    !e.cumpleMeta
                  ).length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                        <i className="ri-inbox-line text-4xl mb-2"></i>
                        <p className="text-sm">No hay expedientes en esta categoría</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* KPIs Específicos de ZF */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-emerald-600 rounded-xl">
            <i className="ri-dashboard-line text-white text-2xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">KPIs de Expedientes ZF</h3>
            <p className="text-sm text-gray-600">Indicadores clave de rendimiento para Zona Franca</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* KPI 1: Creado → Espera de Respuesta */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${
                  kpisZF.creadoAEsperaRespuesta.cumpleMeta ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <i className={`ri-calendar-check-line text-2xl ${
                    kpisZF.creadoAEsperaRespuesta.cumpleMeta ? 'text-green-600' : 'text-red-600'
                  }`}></i>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-600">Creado → Espera de Respuesta</h4>
                  <p className="text-xs text-gray-500 mt-1">Meta: ≤15 días</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                kpisZF.creadoAEsperaRespuesta.cumpleMeta 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {kpisZF.creadoAEsperaRespuesta.cumpleMeta ? '✓ Cumple' : '✗ No Cumple'}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${
                kpisZF.creadoAEsperaRespuesta.cumpleMeta ? 'text-green-600' : 'text-red-600'
              }`}>
                {kpisZF.creadoAEsperaRespuesta.dias}
              </span>
              <span className="text-lg text-gray-600">días</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Tiempo promedio</span>
                <span className={`font-semibold ${
                  kpisZF.creadoAEsperaRespuesta.cumpleMeta ? 'text-green-600' : 'text-red-600'
                }`}>
                  {kpisZF.creadoAEsperaRespuesta.dias <= 15 
                    ? `${15 - kpisZF.creadoAEsperaRespuesta.dias} días bajo meta` 
                    : `${kpisZF.creadoAEsperaRespuesta.dias - 15} días sobre meta`}
                </span>
              </div>
            </div>
          </div>

          {/* KPI 2: Arribo → Liberación */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${
                  kpisZF.arriboALiberacion.cumpleMeta ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <i className={`ri-time-line text-2xl ${
                    kpisZF.arriboALiberacion.cumpleMeta ? 'text-green-600' : 'text-red-600'
                  }`}></i>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-600">Arribo → Liberación</h4>
                  <p className="text-xs text-gray-500 mt-1">Meta: ≤45 minutos</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                kpisZF.arriboALiberacion.cumpleMeta 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {kpisZF.arriboALiberacion.cumpleMeta ? '✓ Cumple' : '✗ No Cumple'}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${
                kpisZF.arriboALiberacion.cumpleMeta ? 'text-green-600' : 'text-red-600'
              }`}>
                {kpisZF.arriboALiberacion.minutos}
              </span>
              <span className="text-lg text-gray-600">min</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Tiempo promedio</span>
                <span className={`font-semibold ${
                  kpisZF.arriboALiberacion.cumpleMeta ? 'text-green-600' : 'text-red-600'
                }`}>
                  {kpisZF.arriboALiberacion.minutos <= 45 
                    ? `${45 - kpisZF.arriboALiberacion.minutos} min bajo meta` 
                    : `${kpisZF.arriboALiberacion.minutos - 45} min sobre meta`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Dropship: Notificado → OK País */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-amber-500 rounded-xl">
            <i className="ri-checkbox-circle-line text-white text-2xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">KPIs de Expedientes Dropship</h3>
            <p className="text-sm text-gray-600">Indicadores clave para expedientes Dropship</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Contador Notificado → OK País */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow md:col-span-1">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-green-100">
                  <i className="ri-flag-line text-2xl text-green-600"></i>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-600">Notificado → OK País</h4>
                  <p className="text-xs text-gray-500 mt-1">Expedientes cerrados con éxito</p>
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-green-600">{notificadoOkPais}</span>
              <span className="text-lg text-gray-500">expedientes</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: estadoDataDropship.notificado > 0 ? `${Math.min(100, (notificadoOkPais / estadoDataDropship.notificado) * 100)}%` : '0%' }}
                  ></div>
                </div>
                <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                  {estadoDataDropship.notificado > 0
                    ? `${Math.round((notificadoOkPais / estadoDataDropship.notificado) * 100)}% de Notificados`
                    : '0% de Notificados'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {estadoDataDropship.notificado} en estado Notificado en el período
              </p>
            </div>
          </div>

          {/* Expedientes con Tránsito Corto */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-amber-100">
                  <i className="ri-speed-line text-2xl text-amber-600"></i>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-600">Tránsito Corto</h4>
                  <p className="text-xs text-gray-500 mt-1">Dropship con tránsito corto</p>
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-amber-600">
                {expedientes.filter(e => (e.tipo_modulo || '').toLowerCase() === 'dropship' && e.transito_corto === true).length}
              </span>
              <span className="text-lg text-gray-500">expedientes</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Del total de {estadoDataDropship.total} expedientes Dropship en el período
              </p>
            </div>
          </div>

          {/* Pendientes de OK País */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-orange-100">
                  <i className="ri-hourglass-line text-2xl text-orange-600"></i>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-600">Notificados Pendientes OK País</h4>
                  <p className="text-xs text-gray-500 mt-1">Notificados sin cerrar aún</p>
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-orange-600">
                {Math.max(0, estadoDataDropship.notificado - notificadoOkPais)}
              </span>
              <span className="text-lg text-gray-500">expedientes</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Requieren marca de cierre "OK País"
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Distribución por Dificultad</h3>
          <DonutChart data={dificultadData} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Solicitantes</h3>
          <BarChart data={solicitantesData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Estado de Expedientes</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setVistaEstados('general')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  vistaEstados === 'general'
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setVistaEstados('dropship')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  vistaEstados === 'dropship'
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Dropship
              </button>
              <button
                onClick={() => setVistaEstados('zf')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  vistaEstados === 'zf'
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ZF
              </button>
            </div>
          </div>

          {vistaEstados === 'general' && (
            <div className="space-y-4">
              <ProgressBar label="Asignado"          value={estadoData.asignado}        total={estadoData.total} color="bg-indigo-500" />
              <ProgressBar label="En Proceso"        value={estadoData.enProceso}       total={estadoData.total} color="bg-amber-500" />
              <ProgressBar label="Espera de Respuesta" value={estadoData.esperaRespuesta} total={estadoData.total} color="bg-orange-400" />
              <ProgressBar label="Recepción de Carga"  value={estadoData.recepcionCarga}  total={estadoData.total} color="bg-sky-500" />
              <ProgressBar label="Liberación"        value={estadoData.liberado}        total={estadoData.total} color="bg-teal-500" />
              <ProgressBar label="Facturación"       value={estadoData.facturacion}     total={estadoData.total} color="bg-violet-500" />
              <ProgressBar label="Notificado"        value={estadoData.notificado}      total={estadoData.total} color="bg-green-500" />
              <ProgressBar label="Completado"        value={estadoData.completado}      total={estadoData.total} color="bg-emerald-500" />
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">Total de expedientes: <span className="font-semibold text-gray-900">{estadoData.total}</span></div>
              </div>
            </div>
          )}

          {vistaEstados === 'dropship' && (
            <div className="space-y-4">
              <ProgressBar label="Asignado"          value={estadoDataDropship.asignado}        total={estadoDataDropship.total} color="bg-indigo-500" />
              <ProgressBar label="En Proceso"        value={estadoDataDropship.enProceso}       total={estadoDataDropship.total} color="bg-amber-500" />
              <ProgressBar label="Espera de Respuesta" value={estadoDataDropship.esperaRespuesta} total={estadoDataDropship.total} color="bg-orange-400" />
              <ProgressBar label="Recepción de Carga"  value={estadoDataDropship.recepcionCarga}  total={estadoDataDropship.total} color="bg-sky-500" />
              <ProgressBar label="Liberación"        value={estadoDataDropship.liberado}        total={estadoDataDropship.total} color="bg-teal-500" />
              <ProgressBar label="Facturación"       value={estadoDataDropship.facturacion}     total={estadoDataDropship.total} color="bg-violet-500" />
              <ProgressBar label="Notificado"        value={estadoDataDropship.notificado}      total={estadoDataDropship.total} color="bg-green-500" />
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">Total Dropship: <span className="font-semibold text-gray-900">{estadoDataDropship.total}</span></div>
              </div>
            </div>
          )}

          {vistaEstados === 'zf' && (
            <div className="space-y-4">
              <ProgressBar label="Asignado"          value={estadoDataZF.asignado}        total={estadoDataZF.total} color="bg-indigo-500" />
              <ProgressBar label="En Proceso"        value={estadoDataZF.enProceso}       total={estadoDataZF.total} color="bg-amber-500" />
              <ProgressBar label="Espera de Respuesta" value={estadoDataZF.esperaRespuesta} total={estadoDataZF.total} color="bg-orange-400" />
              <ProgressBar label="Completado"        value={estadoDataZF.completado}      total={estadoDataZF.total} color="bg-emerald-500" />
              <ProgressBar label="Arribo de Carga"   value={estadoDataZF.arriboCarga}     total={estadoDataZF.total} color="bg-cyan-500" />
              <ProgressBar label="Pendiente Proforma" value={estadoDataZF.pendienteProforma} total={estadoDataZF.total} color="bg-violet-500" />
              <ProgressBar label="Liberación"        value={estadoDataZF.liberado}        total={estadoDataZF.total} color="bg-teal-500" />
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">Total ZF: <span className="font-semibold text-gray-900">{estadoDataZF.total}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4 gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Tiempos Promedio Entre Estados</h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {tiemposEntreEstados.length > 0 && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  tiemposEntreEstados[0]?.fuente === 'real'
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  <i className={`mr-1 ${
                    tiemposEntreEstados[0]?.fuente === 'real'
                      ? 'ri-database-2-line'
                      : 'ri-calculator-line'
                  }`}></i>
                  {tiemposEntreEstados[0]?.fuente === 'real' ? 'Datos reales' : 'Estimación'}
                </span>
              )}
            </div>
          </div>
          {/* Filtro por módulo */}
          <div className="flex gap-2 mb-5">
            {(['todos', 'dropship', 'zf'] as const).map(mod => (
              <button
                key={mod}
                onClick={() => setFiltroModuloTiempos(mod)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filtroModuloTiempos === mod
                    ? mod === 'dropship'
                      ? 'bg-sky-600 text-white'
                      : mod === 'zf'
                      ? 'bg-violet-600 text-white'
                      : 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {mod === 'todos' ? 'Todos los módulos' : mod === 'dropship' ? 'Solo Dropship' : 'Solo ZF'}
              </button>
            ))}
            {filtroModuloTiempos !== 'todos' && (
              <span className={`ml-auto self-center text-xs px-2.5 py-1 rounded-full font-semibold ${
                filtroModuloTiempos === 'dropship' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
              }`}>
                <i className="ri-filter-3-line mr-1"></i>
                Flujo {filtroModuloTiempos === 'dropship' ? 'Dropship' : 'ZF'}
              </span>
            )}
          </div>

          {tiemposEntreEstados.length > 0 ? (
            <div className="space-y-2">
              {tiemposEntreEstados[0]?.fuente === 'estimado' && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <i className="ri-information-line text-amber-600 mt-0.5 flex-shrink-0"></i>
                  <p className="text-xs text-amber-800">
                    Los cambios de estado registrados por la app mostrarán tiempos exactos por transición.
                    Estos valores son una estimación basada en el tiempo total de cada expediente.
                  </p>
                </div>
              )}
              {tiemposEntreEstados.map((item, index) => (
                <div key={index} className="group relative">
                  <div className="flex items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
                    {/* Estado origen */}
                    <div className="flex-shrink-0 w-32">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg block text-center truncate">
                        {item.desde}
                      </span>
                    </div>

                    {/* Flecha + tiempo */}
                    <div className="flex-1 flex flex-col items-center">
                      <span className={`text-sm font-bold ${
                        filtroModuloTiempos === 'dropship' ? 'text-sky-700' :
                        filtroModuloTiempos === 'zf' ? 'text-violet-700' : 'text-teal-700'
                      }`}>
                        {formatearTiempo(item.minutosPromedio)}
                      </span>
                      <div className="flex items-center w-full mt-1">
                        <div className={`flex-1 h-px ${
                          filtroModuloTiempos === 'dropship' ? 'bg-sky-300' :
                          filtroModuloTiempos === 'zf' ? 'bg-violet-300' : 'bg-teal-300'
                        }`}></div>
                        <i className={`ri-arrow-right-line mx-1 flex-shrink-0 ${
                          filtroModuloTiempos === 'dropship' ? 'text-sky-500' :
                          filtroModuloTiempos === 'zf' ? 'text-violet-500' : 'text-teal-500'
                        }`}></i>
                      </div>
                      {item.fuente === 'real' && (
                        <span className="text-xs text-gray-400">{item.cantidad} transic.</span>
                      )}
                    </div>

                    {/* Estado destino */}
                    <div className="flex-shrink-0 w-36">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg block text-center truncate border ${
                        filtroModuloTiempos === 'dropship'
                          ? 'text-sky-800 bg-sky-50 border-sky-200'
                          : filtroModuloTiempos === 'zf'
                          ? 'text-violet-800 bg-violet-50 border-violet-200'
                          : 'text-teal-800 bg-teal-50 border-teal-200'
                      }`}>
                        {item.hasta}
                      </span>
                    </div>

                    {/* Barra de tiempo relativa */}
                    <div className="flex-shrink-0 w-16">
                      <div className="bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            filtroModuloTiempos === 'dropship' ? 'bg-sky-400' :
                            filtroModuloTiempos === 'zf' ? 'bg-violet-400' : 'bg-teal-400'
                          }`}
                          style={{
                            width: `${
                              Math.min(
                                100,
                                (item.minutosPromedio /
                                  Math.max(...tiemposEntreEstados.map(t => t.minutosPromedio))) * 100
                              )
                            }%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full mb-4">
                <i className="ri-time-line text-3xl text-gray-400"></i>
              </div>
              <p className="text-gray-600 font-medium">Sin datos de transición todavía</p>
              <p className="text-sm text-gray-400 mt-1 max-w-xs">
                Los tiempos se registran automáticamente cuando los expedientes cambian de estado en la app
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Historial de Expedientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">PO</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">EXP ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Solicitante</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Estado</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Responsable</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {expedientes.slice(0, 10).map((exp) => (
                <tr key={exp.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">{exp.po_tiquetera}</td>
                  <td className="py-3 px-4 text-sm text-gray-900">{exp.exp_id}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{exp.solicitante}</td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-800">
                      {exp.estado_expediente}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{exp.responsable_creacion}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => verHistorial(exp.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <i className="ri-history-line"></i>
                      Ver Historial
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showHistorialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Historial del Expediente</h2>
              <button
                onClick={() => setShowHistorialModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-2xl text-gray-500"></i>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <i className="ri-time-line text-teal-600"></i>
                  Tiempos por Estado
                </h3>
                {tiemposExpediente.length > 0 ? (
                  <div className="space-y-3">
                    {tiemposExpediente.map((tiempo) => (
                      <div key={tiempo.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-gray-900">{tiempo.estado_nuevo}</span>
                          <span className="text-sm font-bold text-teal-600">
                            {formatearTiempo(tiempo.minutos_transcurridos)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          <div>Inicio: {new Date(tiempo.fecha_inicio).toLocaleString('es-ES')}</div>
                          {tiempo.fecha_fin && (
                            <div>Fin: {new Date(tiempo.fecha_fin).toLocaleString('es-ES')}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No hay datos de tiempos disponibles</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <i className="ri-history-line text-teal-600"></i>
                  Historial de Cambios
                </h3>
                {historialExpediente.length > 0 ? (
                  <div className="space-y-3">
                    {historialExpediente.map((cambio) => (
                      <div key={cambio.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-semibold text-gray-900 capitalize">
                              {cambio.campo_modificado.replace(/_/g, ' ')}
                            </span>
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="text-red-600">{cambio.valor_anterior || 'N/A'}</span>
                              {' → '}
                              <span className="text-green-600">{cambio.valor_nuevo}</span>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(cambio.fecha_cambio).toLocaleString('es-ES')}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Por: {cambio.usuario}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No hay cambios registrados</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}