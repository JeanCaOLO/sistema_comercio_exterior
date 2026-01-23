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
    totalSolicitudes: { mesAnterior: 0, anoAnterior: 0 },
    altaPrioridad: { mesAnterior: 0, anoAnterior: 0 },
    cargaTrabajo: { mesAnterior: 0, anoAnterior: 0 },
    volumenLineas: { mesAnterior: 0, anoAnterior: 0 },
    minutosPromedio: { mesAnterior: 0, anoAnterior: 0 }
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
    total: 0
  });

  const [estadoDataDropship, setEstadoDataDropship] = useState({
    creado: 0,
    asignado: 0,
    enProceso: 0,
    enRevision: 0,
    liberado: 0,
    total: 0
  });

  const [estadoDataZF, setEstadoDataZF] = useState({
    creado: 0,
    asignado: 0,
    enProceso: 0,
    enRevision: 0,
    liberado: 0,
    total: 0
  });

  const [tiemposEntreEstados, setTiemposEntreEstados] = useState<{
    estado: string;
    minutosPromedio: number;
  }[]>([]);

  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<string | null>(null);
  const [historialExpediente, setHistorialExpediente] = useState<HistorialCambio[]>([]);
  const [tiemposExpediente, setTiemposExpediente] = useState<TiempoEstado[]>([]);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [expedientes, setExpedientes] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

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

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const { inicio, fin } = obtenerRangoFechas();
      
      // Obtener expedientes del período actual
      const { data: expedientes, error } = await supabase
        .from('expedientes')
        .select('*')
        .gte('fecha_solicitud', inicio.toISOString().split('T')[0])
        .lte('fecha_solicitud', fin.toISOString().split('T')[0]);

      if (error) throw error;

      // Calcular fechas para comparativos
      const mesAnteriorInicio = new Date(inicio);
      mesAnteriorInicio.setMonth(mesAnteriorInicio.getMonth() - 1);
      const mesAnteriorFin = new Date(fin);
      mesAnteriorFin.setMonth(mesAnteriorFin.getMonth() - 1);

      const anoAnteriorInicio = new Date(inicio);
      anoAnteriorInicio.setFullYear(anoAnteriorInicio.getFullYear() - 1);
      const anoAnteriorFin = new Date(fin);
      anoAnteriorFin.setFullYear(anoAnteriorFin.getFullYear() - 1);

      // Obtener datos del mes anterior
      const { data: expedientesMesAnterior } = await supabase
        .from('expedientes')
        .select('*')
        .gte('fecha_solicitud', mesAnteriorInicio.toISOString().split('T')[0])
        .lte('fecha_solicitud', mesAnteriorFin.toISOString().split('T')[0]);

      // Obtener datos del año anterior
      const { data: expedientesAnoAnterior } = await supabase
        .from('expedientes')
        .select('*')
        .gte('fecha_solicitud', anoAnteriorInicio.toISOString().split('T')[0])
        .lte('fecha_solicitud', anoAnteriorFin.toISOString().split('T')[0]);

      if (expedientes && expedientes.length > 0) {
        setExpedientes(expedientes);

        // Calcular KPIs del período actual
        const altaPrioridad = expedientes.filter(exp => exp.prioridad === 'Alta' || exp.prioridad_urgente).length;
        const cargaTrabajo = expedientes.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0);
        const volumenLineas = expedientes.reduce((sum, exp) => sum + (exp.lineas_oc || 0), 0);
        const totalMinutos = expedientes.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0);
        const minutosPromedio = expedientes.length > 0 ? Math.round(totalMinutos / expedientes.length) : 0;

        setKpiData({
          totalSolicitudes: expedientes.length,
          altaPrioridad,
          cargaTrabajo,
          volumenLineas,
          minutosPromedio
        });

        // Calcular comparativos mes anterior
        const altaPrioridadMesAnt = expedientesMesAnterior?.filter(exp => exp.prioridad === 'Alta' || exp.prioridad_urgente).length || 0;
        const cargaTrabajoMesAnt = expedientesMesAnterior?.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0) || 0;
        const volumenLineasMesAnt = expedientesMesAnterior?.reduce((sum, exp) => sum + (exp.lineas_oc || 0), 0) || 0;
        const totalMinutosMesAnt = expedientesMesAnterior?.reduce((sum, exp) => sum + (exp.tiempo_minutos || 0), 0) || 0;
        const minutosPromedioMesAnt = expedientesMesAnterior && expedientesMesAnterior.length > 0 
          ? Math.round(totalMinutosMesAnt / expedientesMesAnterior.length) : 0;

        // Calcular comparativos año anterior
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

        // Calcular distribución por dificultad
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

        // Calcular top solicitantes
        const solicitantesCount: { [key: string]: number } = {};
        expedientes.forEach(exp => {
          solicitantesCount[exp.solicitante] = (solicitantesCount[exp.solicitante] || 0) + 1;
        });

        const topSolicitantes = Object.entries(solicitantesCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setSolicitantesData(topSolicitantes);

        // Calcular estados GENERALES
        const estadoCount = {
          creado: expedientes.filter(exp => exp.estado_expediente === 'Creado' || exp.estado_expediente === 'Nuevo').length,
          asignado: expedientes.filter(exp => exp.estado_expediente === 'Asignado').length,
          enProceso: expedientes.filter(exp => exp.estado_expediente === 'En Proceso').length,
          enRevision: expedientes.filter(exp => exp.estado_expediente === 'En Revisión').length,
          liberado: expedientes.filter(exp => exp.estado_expediente === 'Liberado' || exp.estado_expediente === 'LIBERADO').length
        };

        setEstadoData({
          creado: estadoCount.creado,
          asignado: estadoCount.asignado,
          enProceso: estadoCount.enProceso,
          enRevision: estadoCount.enRevision,
          liberado: estadoCount.liberado,
          total: expedientes.length
        });

        // Calcular estados DROPSHIP
        const expedientesDropship = expedientes.filter(exp => exp.tipo_modulo === 'Dropship');
        const estadoCountDropship = {
          creado: expedientesDropship.filter(exp => exp.estado_expediente === 'Creado' || exp.estado_expediente === 'Nuevo').length,
          asignado: expedientesDropship.filter(exp => exp.estado_expediente === 'Asignado').length,
          enProceso: expedientesDropship.filter(exp => exp.estado_expediente === 'En Proceso').length,
          enRevision: expedientesDropship.filter(exp => exp.estado_expediente === 'En Revisión').length,
          liberado: expedientesDropship.filter(exp => exp.estado_expediente === 'Liberado' || exp.estado_expediente === 'LIBERADO').length
        };

        setEstadoDataDropship({
          creado: estadoCountDropship.creado,
          asignado: estadoCountDropship.asignado,
          enProceso: estadoCountDropship.enProceso,
          enRevision: estadoCountDropship.enRevision,
          liberado: estadoCountDropship.liberado,
          total: expedientesDropship.length
        });

        // Calcular estados ZF
        const expedientesZF = expedientes.filter(exp => exp.tipo_modulo === 'ZF');
        const estadoCountZF = {
          creado: expedientesZF.filter(exp => exp.estado_expediente === 'Creado' || exp.estado_expediente === 'Nuevo').length,
          asignado: expedientesZF.filter(exp => exp.estado_expediente === 'Asignado').length,
          enProceso: expedientesZF.filter(exp => exp.estado_expediente === 'En Proceso').length,
          enRevision: expedientesZF.filter(exp => exp.estado_expediente === 'En Revisión').length,
          liberado: expedientesZF.filter(exp => exp.estado_expediente === 'Liberado' || exp.estado_expediente === 'LIBERADO').length
        };

        setEstadoDataZF({
          creado: estadoCountZF.creado,
          asignado: estadoCountZF.asignado,
          enProceso: estadoCountZF.enProceso,
          enRevision: estadoCountZF.enRevision,
          liberado: estadoCountZF.liberado,
          total: expedientesZF.length
        });

        // Calcular tiempos promedio entre estados
        await cargarTiemposEntreEstados();
      } else {
        // Si no hay datos, resetear todo
        setExpedientes([]);
        setKpiData({
          totalSolicitudes: 0,
          altaPrioridad: 0,
          cargaTrabajo: 0,
          volumenLineas: 0,
          minutosPromedio: 0
        });
        setEstadoData({ creado: 0, asignado: 0, enProceso: 0, enRevision: 0, liberado: 0, total: 0 });
        setEstadoDataDropship({ creado: 0, asignado: 0, enProceso: 0, enRevision: 0, liberado: 0, total: 0 });
        setEstadoDataZF({ creado: 0, asignado: 0, enProceso: 0, enRevision: 0, liberado: 0, total: 0 });
        setComparativos({
          totalSolicitudes: { mesAnterior: '0%', anoAnterior: '0%' },
          altaPrioridad: { mesAnterior: '0%', anoAnterior: '0%' },
          cargaTrabajo: { mesAnterior: '0%', anoAnterior: '0%' },
          volumenLineas: { mesAnterior: '0%', anoAnterior: '0%' },
          minutosPromedio: { mesAnterior: '0%', anoAnterior: '0%' }
        });
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarTiemposEntreEstados = async () => {
    try {
      const { inicio, fin } = obtenerRangoFechas();
      
      // Obtener IDs de expedientes del período actual
      const { data: expedientesPeriodo, error: errorExp } = await supabase
        .from('expedientes')
        .select('id')
        .gte('fecha_solicitud', inicio.toISOString().split('T')[0])
        .lte('fecha_solicitud', fin.toISOString().split('T')[0]);

      if (errorExp) throw errorExp;

      if (!expedientesPeriodo || expedientesPeriodo.length === 0) {
        setTiemposEntreEstados([]);
        return;
      }

      const expedienteIds = expedientesPeriodo.map(exp => exp.id);

      // Obtener tiempos solo de los expedientes del período
      const { data: tiempos, error } = await supabase
        .from('expedientes_tiempos_estados')
        .select('*')
        .in('expediente_id', expedienteIds)
        .not('minutos_transcurridos', 'is', null)
        .gte('fecha_inicio', inicio.toISOString())
        .lte('fecha_inicio', fin.toISOString());

      if (error) throw error;

      if (tiempos && tiempos.length > 0) {
        // Agrupar por estado y calcular promedio
        const tiemposPorEstado: { [key: string]: number[] } = {};
        
        tiempos.forEach(tiempo => {
          if (!tiemposPorEstado[tiempo.estado_nuevo]) {
            tiemposPorEstado[tiempo.estado_nuevo] = [];
          }
          tiemposPorEstado[tiempo.estado_nuevo].push(tiempo.minutos_transcurridos);
        });

        const promedios = Object.entries(tiemposPorEstado).map(([estado, minutos]) => ({
          estado,
          minutosPromedio: Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length)
        }));

        setTiemposEntreEstados(promedios);
      } else {
        setTiemposEntreEstados([]);
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
              <ProgressBar
                label="Creado"
                value={estadoData.creado}
                total={estadoData.total}
                color="bg-blue-500"
              />
              <ProgressBar
                label="Asignado"
                value={estadoData.asignado}
                total={estadoData.total}
                color="bg-indigo-500"
              />
              <ProgressBar
                label="En Proceso"
                value={estadoData.enProceso}
                total={estadoData.total}
                color="bg-amber-500"
              />
              <ProgressBar
                label="En Revisión"
                value={estadoData.enRevision}
                total={estadoData.total}
                color="bg-orange-500"
              />
              <ProgressBar
                label="Liberado"
                value={estadoData.liberado}
                total={estadoData.total}
                color="bg-green-500"
              />
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Total de expedientes: <span className="font-semibold text-gray-900">{estadoData.total}</span>
                </div>
              </div>
            </div>
          )}

          {vistaEstados === 'dropship' && (
            <div className="space-y-4">
              <ProgressBar
                label="Creado"
                value={estadoDataDropship.creado}
                total={estadoDataDropship.total}
                color="bg-blue-500"
              />
              <ProgressBar
                label="Asignado"
                value={estadoDataDropship.asignado}
                total={estadoDataDropship.total}
                color="bg-indigo-500"
              />
              <ProgressBar
                label="En Proceso"
                value={estadoDataDropship.enProceso}
                total={estadoDataDropship.total}
                color="bg-amber-500"
              />
              <ProgressBar
                label="En Revisión"
                value={estadoDataDropship.enRevision}
                total={estadoDataDropship.total}
                color="bg-orange-500"
              />
              <ProgressBar
                label="Liberado"
                value={estadoDataDropship.liberado}
                total={estadoDataDropship.total}
                color="bg-green-500"
              />
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Total Dropship: <span className="font-semibold text-gray-900">{estadoDataDropship.total}</span>
                </div>
              </div>
            </div>
          )}

          {vistaEstados === 'zf' && (
            <div className="space-y-4">
              <ProgressBar
                label="Creado"
                value={estadoDataZF.creado}
                total={estadoDataZF.total}
                color="bg-blue-500"
              />
              <ProgressBar
                label="Asignado"
                value={estadoDataZF.asignado}
                total={estadoDataZF.total}
                color="bg-indigo-500"
              />
              <ProgressBar
                label="En Proceso"
                value={estadoDataZF.enProceso}
                total={estadoDataZF.total}
                color="bg-amber-500"
              />
              <ProgressBar
                label="En Revisión"
                value={estadoDataZF.enRevision}
                total={estadoDataZF.total}
                color="bg-orange-500"
              />
              <ProgressBar
                label="Liberado"
                value={estadoDataZF.liberado}
                total={estadoDataZF.total}
                color="bg-green-500"
              />
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Total ZF: <span className="font-semibold text-gray-900">{estadoDataZF.total}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Tiempos Promedio Entre Estados</h3>
          {tiemposEntreEstados.length > 0 ? (
            <div className="space-y-3">
              {tiemposEntreEstados.map((tiempo, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{tiempo.estado}</span>
                  <span className="text-sm font-bold text-teal-600">{formatearTiempo(tiempo.minutosPromedio)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <i className="ri-time-line text-4xl mb-2"></i>
              <p className="text-sm">No hay datos de tiempos disponibles</p>
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