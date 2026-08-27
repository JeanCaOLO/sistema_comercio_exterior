import { useState, useEffect } from 'react';
import KPICard from './KPICard';
import DonutChart from './DonutChart';
import BarChart from './BarChart';
import ProgressBar from './ProgressBar';
import { supabase } from '../../../lib/supabase';
import { formatearFechaCorta, parseFechaSegura } from '../../../lib/fechas';
import { descargarExcel } from '../../../lib/exportar';

const aFechaISO = (fecha: Date): string => {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

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
  const [rangoPersonalizado, setRangoPersonalizado] = useState<{ inicio: string; fin: string } | null>(null);
  const [errorFiltros, setErrorFiltros] = useState('');
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
    creadoAEsperaRespuesta: { dias: 0, cumpleMeta: true }
  });

  const [kpiDsPromedioNotificado, setKpiDsPromedioNotificado] = useState<number>(0);
  const [kpiZfPromedioCompletado, setKpiZfPromedioCompletado] = useState<number>(0);

  // KPI Asignado → Notificado (Dropship)
  const [kpiAsignadoNotificado, setKpiAsignadoNotificado] = useState({
    totalEvaluados: 0,
    promedioDias: 0
  });
  const [asignadoNotificadoDetalle, setAsignadoNotificadoDetalle] = useState<{
    id: string;
    po_tiquetera: string;
    exp_id: string;
    solicitante: string;
    fechaAsignado: string;
    fechaNotificado: string;
    dias: number;
  }[]>([]);
  const [showReporteAsignadoNotificado, setShowReporteAsignadoNotificado] = useState(false);

  const [notificadoOkPais, setNotificadoOkPais] = useState(0);

  // KPI ETD vs Notificado (Dropship)
  const META_ETD_DIAS = 5;
  const [kpiEtdNotificado, setKpiEtdNotificado] = useState({
    totalEvaluados: 0,
    dentroRango: 0,
    fueraRango: 0,
    porcentajeOk: 0,
    promedioDias: 0
  });

  // KPIs MCG (Dropship con check MCG) — reglas propias y excluidos de los KPIs generales
  const META_MCG_CREACION_DIAS = 2;
  const [kpiMcgCreacion, setKpiMcgCreacion] = useState({
    totalEvaluados: 0,
    cumplen: 0,
    noCumplen: 0,
    porcentajeCumplimiento: 0,
    diasPromedio: 0
  });

  const META_MCG_ETD_DIAS = 2;
  const [kpiMcgEtdNotificado, setKpiMcgEtdNotificado] = useState({
    totalEvaluados: 0,
    dentroRango: 0,
    fueraRango: 0,
    porcentajeOk: 0,
    promedioDias: 0
  });

  // KPI Duración Mínima < 3 días (solo Dropship)
  const META_DURACION_DIAS = 3;
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

  const [etdDetalle, setEtdDetalle] = useState<{
    id: string;
    po_tiquetera: string;
    exp_id: string;
    solicitante: string;
    etd: string;
    fechaNotificado: string;
    diasDiferencia: number;
    cumpleMeta: boolean;
  }[]>([]);
  const [showReporteEtd, setShowReporteEtd] = useState(false);

  useEffect(() => {
    // Establecer mes actual por defecto al cargar
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    setFechaInicio(aFechaISO(primerDia));
    setFechaFin(aFechaISO(ultimoDia));
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [periodoActivo, rangoPersonalizado]);

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

    if (periodoActivo === 'personalizado' && rangoPersonalizado) {
      return {
        inicio: parseFechaSegura(rangoPersonalizado.inicio),
        fin: parseFechaSegura(rangoPersonalizado.fin)
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
    // Solo expedientes Dropship (excluye ZF)
    const expDropship = listaExpedientes.filter(exp =>
      (exp.tipo_modulo || '').toLowerCase() === 'dropship'
    );

    const evaluados = expDropship.map(exp => {
      const fechaCreacion = exp.created_at || exp.fecha_creacion_expediente;
      // En Dropship, Notificado y Visto Listo son estados finales
      const esFinalizado = exp.estado_expediente === 'Notificado' || exp.estado_expediente === 'Visto Listo';
      const fechaFin = esFinalizado && exp.fecha_liberacion ? new Date(exp.fecha_liberacion) : ahora;
      const fechaIni = new Date(fechaCreacion);
      const diffMs = fechaFin.getTime() - fechaIni.getTime();
      const diasDuracion = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
      return {
        id: exp.id,
        po_tiquetera: exp.po_tiquetera,
        exp_id: exp.exp_id || '',
        tipo_modulo: 'dropship',
        estado_expediente: exp.estado_expediente,
        solicitante: exp.solicitante,
        responsable_creacion: exp.responsable_creacion,
        diasDuracion: Math.round(diasDuracion * 10) / 10,
        cumpleMeta: diasDuracion < META_DURACION_DIAS,
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

  const calcularKPIsMcg = async (expMcg: any[]) => {
    if (!expMcg || expMcg.length === 0) {
      setKpiMcgCreacion({ totalEvaluados: 0, cumplen: 0, noCumplen: 0, porcentajeCumplimiento: 0, diasPromedio: 0 });
      setKpiMcgEtdNotificado({ totalEvaluados: 0, dentroRango: 0, fueraRango: 0, porcentajeOk: 0, promedioDias: 0 });
      return;
    }

    const mcgIds = expMcg.map(e => e.id);

    // Fecha en que el ticket llegó a "Asignado" (inicio del conteo de creación)
    const { data: tiemposAsignado } = await supabase
      .from('expedientes_tiempos_estados')
      .select('expediente_id, fecha_inicio')
      .in('expediente_id', mcgIds)
      .eq('estado_nuevo', 'Asignado');

    const fechaAsignadoPorExp: Record<string, string> = {};
    if (tiemposAsignado) {
      tiemposAsignado.forEach((t: any) => {
        if (!fechaAsignadoPorExp[t.expediente_id] || t.fecha_inicio < fechaAsignadoPorExp[t.expediente_id]) {
          fechaAsignadoPorExp[t.expediente_id] = t.fecha_inicio;
        }
      });
    }

    // Fecha en que se colocó el número de expediente (EXP ID) desde el historial
    const { data: historialExpId } = await supabase
      .from('expedientes_historial')
      .select('expediente_id, valor_nuevo, fecha_cambio')
      .in('expediente_id', mcgIds)
      .eq('campo_modificado', 'EXP ID');

    const fechaExpIdPorExp: Record<string, string> = {};
    if (historialExpId) {
      historialExpId.forEach((h: any) => {
        const valor = (h.valor_nuevo || '').trim();
        if (!valor) return;
        if (!fechaExpIdPorExp[h.expediente_id] || h.fecha_cambio < fechaExpIdPorExp[h.expediente_id]) {
          fechaExpIdPorExp[h.expediente_id] = h.fecha_cambio;
        }
      });
    }

    // ── KPI Creación de expediente (≤ 2 días) ──
    let cumpleCreacion = 0;
    let noCumpleCreacion = 0;
    let sumaCreacion = 0;
    let contadosCreacion = 0;

    expMcg.forEach(exp => {
      const expId = (exp.exp_id || '').trim();
      const tieneExpId = expId !== '' && expId !== 'Por Asignar' && expId !== 'No asignado' && expId !== 'No Asignado';
      if (!tieneExpId) return;

      const fechaAsignado = fechaAsignadoPorExp[exp.id] || exp.created_at;
      const fechaExpId = fechaExpIdPorExp[exp.id] || fechaAsignado;
      const dias = (new Date(fechaExpId).getTime() - new Date(fechaAsignado).getTime()) / (1000 * 60 * 60 * 24);

      contadosCreacion++;
      sumaCreacion += dias;
      if (dias <= META_MCG_CREACION_DIAS) cumpleCreacion++;
      else noCumpleCreacion++;
    });

    setKpiMcgCreacion({
      totalEvaluados: contadosCreacion,
      cumplen: cumpleCreacion,
      noCumplen: noCumpleCreacion,
      porcentajeCumplimiento: contadosCreacion > 0 ? Math.round((cumpleCreacion / contadosCreacion) * 100) : 0,
      diasPromedio: contadosCreacion > 0 ? Math.round((sumaCreacion / contadosCreacion) * 10) / 10 : 0
    });

    // ── KPI ETD → Notificado (< 2 días) ──
    const expMcgConEtd = expMcg.filter(exp =>
      (exp.estado_expediente === 'Notificado' || exp.estado_expediente === 'Visto Listo') && exp.etd
    );

    if (expMcgConEtd.length > 0) {
      const notIds = expMcgConEtd.map(e => e.id);
      const { data: tiemposNotif } = await supabase
        .from('expedientes_tiempos_estados')
        .select('expediente_id, fecha_inicio')
        .in('expediente_id', notIds)
        .eq('estado_nuevo', 'Notificado');

      const fechaNotifPorExp: Record<string, string> = {};
      if (tiemposNotif) {
        tiemposNotif.forEach((t: any) => {
          if (!fechaNotifPorExp[t.expediente_id] || t.fecha_inicio < fechaNotifPorExp[t.expediente_id]) {
            fechaNotifPorExp[t.expediente_id] = t.fecha_inicio;
          }
        });
      }

      let dentro = 0;
      let fuera = 0;
      let sumaDias = 0;
      let contados = 0;

      expMcgConEtd.forEach(exp => {
        const fechaNotif = fechaNotifPorExp[exp.id];
        if (!fechaNotif) return;
        const dias = (new Date(fechaNotif).getTime() - new Date(exp.etd).getTime()) / (1000 * 60 * 60 * 24);
        contados++;
        sumaDias += dias;
        if (dias < META_MCG_ETD_DIAS) dentro++;
        else fuera++;
      });

      setKpiMcgEtdNotificado({
        totalEvaluados: contados,
        dentroRango: dentro,
        fueraRango: fuera,
        porcentajeOk: contados > 0 ? Math.round((dentro / contados) * 100) : 0,
        promedioDias: contados > 0 ? Math.round((sumaDias / contados) * 10) / 10 : 0
      });
    } else {
      setKpiMcgEtdNotificado({ totalEvaluados: 0, dentroRango: 0, fueraRango: 0, porcentajeOk: 0, promedioDias: 0 });
    }
  };

  const cargarKpiAsignadoNotificado = async (expDropshipNormal: any[]) => {
    const expNotificados = expDropshipNormal.filter(exp =>
      exp.estado_expediente === 'Notificado' || exp.estado_expediente === 'Visto Listo'
    );

    if (expNotificados.length === 0) {
      setKpiAsignadoNotificado({ totalEvaluados: 0, promedioDias: 0 });
      setAsignadoNotificadoDetalle([]);
      return;
    }

    const ids = expNotificados.map(e => e.id);
    const createdMap: Record<string, string> = {};
    expNotificados.forEach(exp => { createdMap[exp.id] = exp.created_at; });

    // Fecha en que el ticket quedó "Asignado"
    const { data: tiemposAsignado } = await supabase
      .from('expedientes_tiempos_estados')
      .select('expediente_id, fecha_inicio')
      .in('expediente_id', ids)
      .eq('estado_nuevo', 'Asignado');

    const fechaAsignado: Record<string, string> = {};
    if (tiemposAsignado) {
      tiemposAsignado.forEach((t: any) => {
        if (!fechaAsignado[t.expediente_id] || t.fecha_inicio < fechaAsignado[t.expediente_id]) {
          fechaAsignado[t.expediente_id] = t.fecha_inicio;
        }
      });
    }

    // Fecha en que llegó a "Notificado"
    const { data: tiemposNotif } = await supabase
      .from('expedientes_tiempos_estados')
      .select('expediente_id, fecha_inicio')
      .in('expediente_id', ids)
      .eq('estado_nuevo', 'Notificado');

    const fechaNotif: Record<string, string> = {};
    if (tiemposNotif) {
      tiemposNotif.forEach((t: any) => {
        if (!fechaNotif[t.expediente_id] || t.fecha_inicio < fechaNotif[t.expediente_id]) {
          fechaNotif[t.expediente_id] = t.fecha_inicio;
        }
      });
    }

    // Fallback: historial para tickets sin registro de tiempo de Notificado
    const faltantes = ids.filter(id => !fechaNotif[id]);
    if (faltantes.length > 0) {
      const { data: histNotif } = await supabase
        .from('expedientes_historial')
        .select('expediente_id, fecha_cambio')
        .in('expediente_id', faltantes)
        .eq('campo_modificado', 'Estado')
        .eq('valor_nuevo', 'Notificado');
      if (histNotif) {
        histNotif.forEach((h: any) => {
          if (!fechaNotif[h.expediente_id] || h.fecha_cambio < fechaNotif[h.expediente_id]) {
            fechaNotif[h.expediente_id] = h.fecha_cambio;
          }
        });
      }
    }

    const detalle: {
      id: string;
      po_tiquetera: string;
      exp_id: string;
      solicitante: string;
      fechaAsignado: string;
      fechaNotificado: string;
      dias: number;
    }[] = [];

    expNotificados.forEach(exp => {
      const fAsig = fechaAsignado[exp.id] || createdMap[exp.id];
      const fNotif = fechaNotif[exp.id];
      if (!fNotif) return;
      const dias = (new Date(fNotif).getTime() - new Date(fAsig).getTime()) / (1000 * 60 * 60 * 24);
      detalle.push({
        id: exp.id,
        po_tiquetera: exp.po_tiquetera,
        exp_id: exp.exp_id || '',
        solicitante: exp.solicitante || '',
        fechaAsignado: fAsig,
        fechaNotificado: fNotif,
        dias: Math.round(dias * 10) / 10
      });
    });

    const total = detalle.length;
    const suma = detalle.reduce((s, d) => s + d.dias, 0);
    setKpiAsignadoNotificado({
      totalEvaluados: total,
      promedioDias: total > 0 ? Math.round((suma / total) * 10) / 10 : 0
    });
    setAsignadoNotificadoDetalle(detalle.sort((a, b) => b.dias - a.dias));
  };

  const cargarKPIsZF = async (expZF: any[]) => {
    try {
      if (!expZF || expZF.length === 0) {
        setKpisZF({
          creadoAEsperaRespuesta: { dias: 0, cumpleMeta: true }
        });
        return;
      }

      const expedienteIds = expZF.map(exp => exp.id);

      // Mapa: expediente_id → created_at
      const createdMap: Record<string, string> = {};
      expZF.forEach(exp => {
        createdMap[exp.id] = exp.created_at;
      });

      // ── Intento 1: tiempos de estados ──
      let tiemposCreadoAEspera: { expediente_id: string; fechaEspera: string }[] = [];

      const { data: tiempos, error: errorTiempos } = await supabase
        .from('expedientes_tiempos_estados')
        .select('expediente_id, estado_nuevo, fecha_fin')
        .in('expediente_id', expedienteIds)
        .not('fecha_fin', 'is', null);

      if (!errorTiempos && tiempos && tiempos.length > 0) {
        const filtrados = tiempos.filter((t: any) => {
          const destino = (t.estado_nuevo || '').trim().toLowerCase();
          return destino === 'espera de respuesta';
        });

        // Primera vez que llegó a Espera de Respuesta por ticket
        const primeraPorExp: Record<string, string> = {};
        filtrados.forEach((t: any) => {
          if (!primeraPorExp[t.expediente_id] || t.fecha_fin < primeraPorExp[t.expediente_id]) {
            primeraPorExp[t.expediente_id] = t.fecha_fin;
          }
        });

        Object.entries(primeraPorExp).forEach(([expId, fechaEspera]) => {
          tiemposCreadoAEspera.push({ expediente_id: expId, fechaEspera });
        });
      }

      // ── Intento 2 (fallback): historial de cambios ──
      if (tiemposCreadoAEspera.length === 0) {
        const { data: historial, error: errorHistorial } = await supabase
          .from('expedientes_historial')
          .select('expediente_id, campo_modificado, valor_nuevo, fecha_cambio')
          .in('expediente_id', expedienteIds)
          .eq('campo_modificado', 'Estado');

        if (!errorHistorial && historial && historial.length > 0) {
          const filtrados = historial.filter((h: any) => {
            const destino = (h.valor_nuevo || '').trim().toLowerCase();
            return destino === 'espera de respuesta';
          });

          // Primera vez que llegó a Espera de Respuesta por ticket
          const primeraPorExp: Record<string, string> = {};
          filtrados.forEach((h: any) => {
            if (!primeraPorExp[h.expediente_id] || h.fecha_cambio < primeraPorExp[h.expediente_id]) {
              primeraPorExp[h.expediente_id] = h.fecha_cambio;
            }
          });

          Object.entries(primeraPorExp).forEach(([expId, fechaEspera]) => {
            tiemposCreadoAEspera.push({ expediente_id: expId, fechaEspera });
          });
        }
      }

      // ── Calcular días desde creación hasta Espera de Respuesta ──
      const diasPorExpediente: number[] = [];
      tiemposCreadoAEspera.forEach(({ expediente_id: expId, fechaEspera }) => {
        const fechaCreacion = createdMap[expId];
        if (!fechaCreacion) return;
        const diffMs = new Date(fechaEspera).getTime() - new Date(fechaCreacion).getTime();
        const dias = diffMs / (1000 * 60 * 60 * 24);
        diasPorExpediente.push(dias);
      });

      let diasPromedioCreadoAEspera = 0;
      if (diasPorExpediente.length > 0) {
        const totalDias = diasPorExpediente.reduce((sum, d) => sum + d, 0);
        diasPromedioCreadoAEspera = Math.round((totalDias / diasPorExpediente.length) * 10) / 10;
      }

      setKpisZF({
        creadoAEsperaRespuesta: {
          dias: diasPromedioCreadoAEspera,
          cumpleMeta: diasPorExpediente.length > 0 && diasPromedioCreadoAEspera < 15
        }
      });
    } catch (error) {
      console.error('Error al cargar KPIs de ZF:', error);
      setKpisZF({
        creadoAEsperaRespuesta: { dias: 0, cumpleMeta: true }
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
        .gte('fecha_solicitud', aFechaISO(inicio))
        .lte('fecha_solicitud', aFechaISO(fin));

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
        .gte('fecha_solicitud', aFechaISO(mesAnteriorInicio))
        .lte('fecha_solicitud', aFechaISO(mesAnteriorFin));

      const { data: expedientesAnoAnterior } = await supabase
        .from('expedientes')
        .select('*')
        .gte('fecha_solicitud', aFechaISO(anoAnteriorInicio))
        .lte('fecha_solicitud', aFechaISO(anoAnteriorFin));

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

        // Tickets MCG (Dropship con check MCG) — se excluyen de los KPIs generales
        const expDropshipMcg = expDropship.filter(exp => exp.mcg === true);
        const expDropshipNormal = expDropship.filter(exp => exp.mcg !== true);

        // KPI OK País (Dropship) — cuenta Notificado y Visto Listo
        const countNotificadoOkPais = expDropship.filter(exp =>
          (exp.estado_expediente === 'Notificado' || exp.estado_expediente === 'Visto Listo') && exp.ok_pais === true
        ).length;
        setNotificadoOkPais(countNotificadoOkPais);

        // KPI ETD vs Notificado (Dropship) — compara fecha ETD con fecha de llegada a Notificado
        const expNotificadosConEtd = expDropshipNormal.filter(exp =>
          (exp.estado_expediente === 'Notificado' || exp.estado_expediente === 'Visto Listo') && exp.etd
        );

        if (expNotificadosConEtd.length > 0) {
          const expNotIds = expNotificadosConEtd.map(e => e.id);
          const { data: tiemposNotificado } = await supabase
            .from('expedientes_tiempos_estados')
            .select('expediente_id, fecha_inicio')
            .in('expediente_id', expNotIds)
            .eq('estado_nuevo', 'Notificado');

          const tiempoPorExp: Record<string, string> = {};
          if (tiemposNotificado) {
            tiemposNotificado.forEach((t: any) => {
              if (!tiempoPorExp[t.expediente_id] || t.fecha_inicio < tiempoPorExp[t.expediente_id]) {
                tiempoPorExp[t.expediente_id] = t.fecha_inicio;
              }
            });
          }

          let dentroRango = 0;
          let fueraRango = 0;
          let sumaDias = 0;
          let contados = 0;
          const detalleEtd: {
            id: string;
            po_tiquetera: string;
            exp_id: string;
            solicitante: string;
            etd: string;
            fechaNotificado: string;
            diasDiferencia: number;
            cumpleMeta: boolean;
          }[] = [];

          expNotificadosConEtd.forEach(exp => {
            const fechaNotificado = tiempoPorExp[exp.id];
            if (!fechaNotificado) return;
            const diffMs = new Date(fechaNotificado).getTime() - new Date(exp.etd).getTime();
            const dias = diffMs / (1000 * 60 * 60 * 24);
            contados++;
            sumaDias += dias;
            const cumple = dias <= META_ETD_DIAS;
            if (cumple) {
              dentroRango++;
            } else {
              fueraRango++;
            }
            detalleEtd.push({
              id: exp.id,
              po_tiquetera: exp.po_tiquetera,
              exp_id: exp.exp_id || '',
              solicitante: exp.solicitante || '',
              etd: exp.etd,
              fechaNotificado,
              diasDiferencia: Math.round(dias * 10) / 10,
              cumpleMeta: cumple
            });
          });

          setKpiEtdNotificado({
            totalEvaluados: contados,
            dentroRango,
            fueraRango,
            porcentajeOk: contados > 0 ? Math.round((dentroRango / contados) * 100) : 0,
            promedioDias: contados > 0 ? Math.round(sumaDias / contados * 10) / 10 : 0
          });
          setEtdDetalle(detalleEtd.sort((a, b) => b.diasDiferencia - a.diasDiferencia));
        } else {
          setKpiEtdNotificado({ totalEvaluados: 0, dentroRango: 0, fueraRango: 0, porcentajeOk: 0, promedioDias: 0 });
          setEtdDetalle([]);
        }

        // Estados ZF — comparación case-insensitive
        const expZF = expedientes.filter(exp =>
          (exp.tipo_modulo || '').toLowerCase() === 'zf'
        );
        setEstadoDataZF(contarEstados(expZF));

        // ── KPI Dropship: Promedio días Creación → Notificado ──
        const expDsNotificados = expDropshipNormal.filter(exp =>
          exp.estado_expediente === 'Notificado' || exp.estado_expediente === 'Visto Listo'
        );
        let promedioDsNoti = 0;
        if (expDsNotificados.length > 0) {
          const dsIds = expDsNotificados.map(e => e.id);
          const dsCreated: Record<string, string> = {};
          expDsNotificados.forEach(exp => { dsCreated[exp.id] = exp.created_at; });
          
          const { data: dsTiempos } = await supabase
            .from('expedientes_tiempos_estados')
            .select('expediente_id, fecha_inicio')
            .in('expediente_id', dsIds)
            .eq('estado_nuevo', 'Notificado');
          
          const dsFechaLlegada: Record<string, string> = {};
          if (dsTiempos) {
            dsTiempos.forEach((t: any) => {
              if (!dsFechaLlegada[t.expediente_id] || t.fecha_inicio < dsFechaLlegada[t.expediente_id]) {
                dsFechaLlegada[t.expediente_id] = t.fecha_inicio;
              }
            });
          }
          
          const dsFaltantes = dsIds.filter(id => !dsFechaLlegada[id]);
          if (dsFaltantes.length > 0) {
            const { data: dsHist } = await supabase
              .from('expedientes_historial')
              .select('expediente_id, fecha_cambio')
              .in('expediente_id', dsFaltantes)
              .eq('campo_modificado', 'Estado')
              .eq('valor_nuevo', 'Notificado');
            if (dsHist) {
              dsHist.forEach((h: any) => {
                if (!dsFechaLlegada[h.expediente_id] || h.fecha_cambio < dsFechaLlegada[h.expediente_id]) {
                  dsFechaLlegada[h.expediente_id] = h.fecha_cambio;
                }
              });
            }
          }
          
          const dsDias: number[] = [];
          Object.entries(dsFechaLlegada).forEach(([expId, fecha]) => {
            const created = dsCreated[expId];
            if (!created) return;
            dsDias.push((new Date(fecha).getTime() - new Date(created).getTime()) / (1000 * 60 * 60 * 24));
          });
          if (dsDias.length > 0) {
            promedioDsNoti = Math.round((dsDias.reduce((a, b) => a + b, 0) / dsDias.length) * 10) / 10;
          }
        }
        setKpiDsPromedioNotificado(promedioDsNoti);

        // ── KPI ZF: Promedio días Creación → Completado ──
        const expZfCompletados = expZF.filter(exp => exp.estado_expediente === 'Completado');
        let promedioZfCompl = 0;
        if (expZfCompletados.length > 0) {
          const zfIds = expZfCompletados.map(e => e.id);
          const zfCreated: Record<string, string> = {};
          expZfCompletados.forEach(exp => { zfCreated[exp.id] = exp.created_at; });
          
          const { data: zfTiempos } = await supabase
            .from('expedientes_tiempos_estados')
            .select('expediente_id, fecha_inicio')
            .in('expediente_id', zfIds)
            .eq('estado_nuevo', 'Completado');
          
          const zfFechaLlegada: Record<string, string> = {};
          if (zfTiempos) {
            zfTiempos.forEach((t: any) => {
              if (!zfFechaLlegada[t.expediente_id] || t.fecha_inicio < zfFechaLlegada[t.expediente_id]) {
                zfFechaLlegada[t.expediente_id] = t.fecha_inicio;
              }
            });
          }
          
          const zfFaltantes = zfIds.filter(id => !zfFechaLlegada[id]);
          if (zfFaltantes.length > 0) {
            const { data: zfHist } = await supabase
              .from('expedientes_historial')
              .select('expediente_id, fecha_cambio')
              .in('expediente_id', zfFaltantes)
              .eq('campo_modificado', 'Estado')
              .eq('valor_nuevo', 'Completado');
            if (zfHist) {
              zfHist.forEach((h: any) => {
                if (!zfFechaLlegada[h.expediente_id] || h.fecha_cambio < zfFechaLlegada[h.expediente_id]) {
                  zfFechaLlegada[h.expediente_id] = h.fecha_cambio;
                }
              });
            }
          }
          
          const zfDias: number[] = [];
          Object.entries(zfFechaLlegada).forEach(([expId, fecha]) => {
            const created = zfCreated[expId];
            if (!created) return;
            zfDias.push((new Date(fecha).getTime() - new Date(created).getTime()) / (1000 * 60 * 60 * 24));
          });
          if (zfDias.length > 0) {
            promedioZfCompl = Math.round((zfDias.reduce((a, b) => a + b, 0) / zfDias.length) * 10) / 10;
          }
        }
        setKpiZfPromedioCompletado(promedioZfCompl);

        calcularKPIDuracionMinima(expDropshipNormal);
        await calcularKPIsMcg(expDropshipMcg);
        await cargarKpiAsignadoNotificado(expDropshipNormal);
        await cargarTiemposEntreEstados(filtroModuloTiempos);
        await cargarKPIsZF(expZF);
      } else {
        setExpedientes([]);
        setKpiData({ totalSolicitudes: 0, altaPrioridad: 0, cargaTrabajo: 0, volumenLineas: 0, minutosPromedio: 0 });
        const estadoVacio = { creado: 0, asignado: 0, enProceso: 0, enRevision: 0, liberado: 0, notificado: 0, completado: 0, facturacion: 0, recepcionCarga: 0, esperaRespuesta: 0, arriboCarga: 0, pendienteProforma: 0, total: 0 };
        setEstadoData(estadoVacio);
        setEstadoDataDropship(estadoVacio);
        setEstadoDataZF(estadoVacio);
        setNotificadoOkPais(0);
        setKpiEtdNotificado({ totalEvaluados: 0, dentroRango: 0, fueraRango: 0, porcentajeOk: 0, promedioDias: 0 });
        setEtdDetalle([]);
        setKpiDuracion({ totalEvaluados: 0, cumplen: 0, noCumplen: 0, porcentajeCumplimiento: 0, diasPromedioTotal: 0 });
        setExpedientesReporte([]);
        setKpiMcgCreacion({ totalEvaluados: 0, cumplen: 0, noCumplen: 0, porcentajeCumplimiento: 0, diasPromedio: 0 });
        setKpiMcgEtdNotificado({ totalEvaluados: 0, dentroRango: 0, fueraRango: 0, porcentajeOk: 0, promedioDias: 0 });
        setComparativos({
          totalSolicitudes: { mesAnterior: '0%', anoAnterior: '0%' },
          altaPrioridad: { mesAnterior: '0%', anoAnterior: '0%' },
          cargaTrabajo: { mesAnterior: '0%', anoAnterior: '0%' },
          volumenLineas: { mesAnterior: '0%', anoAnterior: '0%' },
          minutosPromedio: { mesAnterior: '0%', anoAnterior: '0%' }
        });
        setKpisZF({
          creadoAEsperaRespuesta: { dias: 0, cumpleMeta: true }
        });
        setKpiDsPromedioNotificado(0);
        setKpiZfPromedioCompletado(0);
        setKpiAsignadoNotificado({ totalEvaluados: 0, promedioDias: 0 });
        setAsignadoNotificadoDetalle([]);
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
        .gte('fecha_solicitud', aFechaISO(inicio))
        .lte('fecha_solicitud', aFechaISO(fin));

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
          'Recepción de Carga',
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
          'Recepción de Carga',
          'Facturación', 'Liberación', 'Notificado'
        ];
        const estadosPrevios: { [key: string]: string } = {
          'En Proceso': 'Asignado',
          'Espera de Respuesta': 'En Proceso',
          'Completado': 'Espera de Respuesta',
          'Recepción de Carga': 'Espera de Respuesta',
          'Facturación': 'Recepción de Carga',
          'Liberación': 'Facturación',
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

  const descargarReporteDuracion = () => {
    const filas = expedientesReporte
      .filter(e =>
        reporteFiltro === 'todos' ? true : reporteFiltro === 'cumplen' ? e.cumpleMeta : !e.cumpleMeta
      )
      .map(e => ({
        'PO/Tiquetera': e.po_tiquetera,
        'EXP ID': e.exp_id || '-',
        'Módulo': 'Dropship',
        'Estado': e.estado_expediente,
        'Solicitante': e.solicitante,
        'Responsable': e.responsable_creacion,
        'Creado': formatearFechaCorta(e.fechaCreacion),
        'Finalizado': e.fechaFin ? formatearFechaCorta(e.fechaFin) : 'En curso',
        'Días de Duración': e.diasDuracion,
        'Cumple Meta (<3 días)': e.cumpleMeta ? 'Sí' : 'No'
      }));
    descargarExcel(`reporte-duracion-dropship-${new Date().toISOString().split('T')[0]}.xlsx`, filas);
  };

  const descargarReporteEtd = () => {
    const filas = etdDetalle.map(e => ({
      'PO/Tiquetera': e.po_tiquetera,
      'EXP ID': e.exp_id || '-',
      'Solicitante': e.solicitante,
      'ETD': formatearFechaCorta(e.etd),
      'Fecha Notificado': formatearFechaCorta(e.fechaNotificado),
      'Días (ETD → Notificado)': e.diasDiferencia,
      'Cumple Meta (≤5 días)': e.cumpleMeta ? 'Sí' : 'No'
    }));
    descargarExcel(`reporte-etd-notificado-${new Date().toISOString().split('T')[0]}.xlsx`, filas);
  };

  const descargarReporteAsignadoNotificado = () => {
    const filas = asignadoNotificadoDetalle.map(e => ({
      'PO/Tiquetera': e.po_tiquetera,
      'EXP ID': e.exp_id || '-',
      'Solicitante': e.solicitante,
      'Fecha Asignado': formatearFechaCorta(e.fechaAsignado),
      'Fecha Notificado': formatearFechaCorta(e.fechaNotificado),
      'Días (Asignado → Notificado)': e.dias
    }));
    descargarExcel(`reporte-asignado-notificado-${new Date().toISOString().split('T')[0]}.xlsx`, filas);
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
  };

  const limpiarFiltros = () => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    setFechaInicio(aFechaISO(primerDia));
    setFechaFin(aFechaISO(ultimoDia));
    setRangoPersonalizado(null);
    setPeriodoActivo('mes-actual');
    setErrorFiltros('');
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

        {errorFiltros && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <i className="ri-error-warning-line text-red-600"></i>
            <span className="text-sm text-red-700 font-medium">{errorFiltros}</span>
          </div>
        )}
        
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
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
          title="Promedio → Notificado (DS)"
          value={kpiDsPromedioNotificado > 0 ? `${kpiDsPromedioNotificado} días` : '—'}
          icon="ri-ship-line"
          color="bg-sky-500"
        />
        <KPICard
          title="Promedio → Completado (ZF)"
          value={kpiZfPromedioCompletado > 0 ? `${kpiZfPromedioCompletado} días` : '—'}
          icon="ri-building-line"
          color="bg-violet-500"
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
              <p className="text-sm text-gray-600">Meta: cada expediente debe durar menos de <strong>3 días</strong> desde su creación (solo Dropship)</p>
            </div>
          </div>
          {/* Alerta global */}
          {kpiDuracion.noCumplen > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300 rounded-xl animate-pulse">
              <i className="ri-alarm-warning-fill text-red-600 text-xl"></i>
              <div className="text-sm">
                <p className="font-bold text-red-700">{kpiDuracion.noCumplen} expediente{kpiDuracion.noCumplen !== 1 ? 's' : ''} fuera de rango</p>
                <p className="text-red-600 text-xs">Duración de 3 días o más</p>
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
              <span className="text-xs text-teal-700 font-medium">&lt; 3 días de duración</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Dentro del rango aceptable</p>
          </div>

          {/* No Cumplen */}
          <div
            onClick={() => { setReporteFiltro('no-cumplen'); setShowReporteDuracion(true); }}
            className={`bg-white rounded-xl p-5 border-2 cursor-pointer hover:shadow-md transition-shadow ${
              kpiDuracion.noCumplen > 0 ? 'border-red-300' : 'border-gray-200'
            }`}
          >
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
              }`}>≥ 3 días de duración</span>
            </div>
            <p className="text-xs text-teal-600 mt-1 font-medium">Haz clic para ver el detalle</p>
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
            <p className="text-xs text-gray-500 mt-1">Meta: menos de 3 días</p>
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
                <p className="text-sm text-gray-500 mt-1">Expedientes Dropship que cumplen o no la meta de &lt;3 días de duración</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={descargarReporteDuracion}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-2-line"></i>
                  Descargar Excel
                </button>
                <button
                  onClick={() => setShowReporteDuracion(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl text-gray-500"></i>
                </button>
              </div>
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
                  <p className="text-xs text-gray-500">Cumplen (&lt;3 días)</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${
                    kpiDuracion.noCumplen > 0 ? 'text-red-600' : 'text-gray-400'
                  }`}>{kpiDuracion.noCumplen}</p>
                  <p className="text-xs text-gray-500">No Cumplen (≥3 días)</p>
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
                          {formatearFechaCorta(exp.fechaCreacion)}
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

      {/* =========== MODAL DETALLE ETD → NOTIFICADO =========== */}
      {showReporteEtd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Detalle ETD → Notificado</h2>
                <p className="text-sm text-gray-500 mt-1">POs Dropship con días entre su ETD y la fecha de Notificado</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={descargarReporteEtd}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-2-line"></i>
                  Descargar Excel
                </button>
                <button
                  onClick={() => setShowReporteEtd(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl text-gray-500"></i>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{kpiEtdNotificado.totalEvaluados}</p>
                  <p className="text-xs text-gray-500">Total Evaluados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-600">{kpiEtdNotificado.dentroRango}</p>
                  <p className="text-xs text-gray-500">Dentro del rango (≤5 días)</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${kpiEtdNotificado.fueraRango > 0 ? 'text-red-600' : 'text-gray-400'}`}>{kpiEtdNotificado.fueraRango}</p>
                  <p className="text-xs text-gray-500">Fuera del rango</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{kpiEtdNotificado.promedioDias} días</p>
                  <p className="text-xs text-gray-500">Promedio</p>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / Tiquetera</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">EXP ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Solicitante</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">ETD</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Fecha Notificado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Cumple Meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {etdDetalle.map(exp => (
                    <tr key={exp.id} className={`hover:bg-gray-50 transition-colors ${!exp.cumpleMeta ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{exp.po_tiquetera}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.exp_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.solicitante}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.etd)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaNotificado)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${exp.cumpleMeta ? 'text-teal-700' : 'text-red-600'}`}>
                          {exp.diasDiferencia} días
                        </span>
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
                  ))}
                  {etdDetalle.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        <i className="ri-inbox-line text-4xl mb-2"></i>
                        <p className="text-sm">No hay POs para mostrar</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========== MODAL DETALLE ASIGNADO → NOTIFICADO =========== */}
      {showReporteAsignadoNotificado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Detalle Asignado → Notificado</h2>
                <p className="text-sm text-gray-500 mt-1">Días entre la asignación y la notificación de cada expediente Dropship</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={descargarReporteAsignadoNotificado}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-2-line"></i>
                  Descargar Excel
                </button>
                <button
                  onClick={() => setShowReporteAsignadoNotificado(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl text-gray-500"></i>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{kpiAsignadoNotificado.totalEvaluados}</p>
                  <p className="text-xs text-gray-500">Total Evaluados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-sky-600">{kpiAsignadoNotificado.promedioDias} días</p>
                  <p className="text-xs text-gray-500">Promedio</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{asignadoNotificadoDetalle.length > 0 ? Math.max(...asignadoNotificadoDetalle.map(d => d.dias)) : 0} días</p>
                  <p className="text-xs text-gray-500">Máximo</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{asignadoNotificadoDetalle.length > 0 ? Math.min(...asignadoNotificadoDetalle.map(d => d.dias)) : 0} días</p>
                  <p className="text-xs text-gray-500">Mínimo</p>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / Tiquetera</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">EXP ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Solicitante</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Fecha Asignado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Fecha Notificado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Días</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {asignadoNotificadoDetalle.map(exp => (
                    <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{exp.po_tiquetera}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.exp_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{exp.solicitante}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaAsignado)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaCorta(exp.fechaNotificado)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold text-sky-700">{exp.dias} días</span>
                      </td>
                    </tr>
                  ))}
                  {asignadoNotificadoDetalle.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                        <i className="ri-inbox-line text-4xl mb-2"></i>
                        <p className="text-sm">No hay expedientes para mostrar</p>
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

        <div className="max-w-md">
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
                  <p className="text-xs text-gray-500 mt-1">Meta: &lt;15 días</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                kpisZF.creadoAEsperaRespuesta.cumpleMeta 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {kpisZF.creadoAEsperaRespuesta.dias === 0 
                  ? 'Sin datos' 
                  : kpisZF.creadoAEsperaRespuesta.cumpleMeta ? '✓ Cumple' : '✗ No Cumple'}
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
                  {kpisZF.creadoAEsperaRespuesta.dias === 0
                    ? 'Esperando datos'
                    : kpisZF.creadoAEsperaRespuesta.dias < 15
                    ? `${(15 - kpisZF.creadoAEsperaRespuesta.dias).toFixed(1)} días bajo meta` 
                    : `${(kpisZF.creadoAEsperaRespuesta.dias - 15).toFixed(1)} días sobre meta`}
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Contador OK País (Notificado + Visto Listo) */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-green-100">
                  <i className="ri-flag-line text-2xl text-green-600"></i>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-600">Entregados con OK País</h4>
                  <p className="text-xs text-gray-500 mt-1">Notificados y Visto Listo cerrados con éxito</p>
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
                    style={{ width: (estadoDataDropship.notificado + (expedientes.filter(e => (e.tipo_modulo || '').toLowerCase() === 'dropship' && e.estado_expediente === 'Visto Listo').length)) > 0 ? `${Math.min(100, (notificadoOkPais / (estadoDataDropship.notificado + expedientes.filter(e => (e.tipo_modulo || '').toLowerCase() === 'dropship' && e.estado_expediente === 'Visto Listo').length)) * 100)}%` : '0%' }}
                  ></div>
                </div>
                <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                  {(estadoDataDropship.notificado + expedientes.filter(e => (e.tipo_modulo || '').toLowerCase() === 'dropship' && e.estado_expediente === 'Visto Listo').length) > 0
                    ? `${Math.round((notificadoOkPais / (estadoDataDropship.notificado + expedientes.filter(e => (e.tipo_modulo || '').toLowerCase() === 'dropship' && e.estado_expediente === 'Visto Listo').length)) * 100)}% de entregados`
                    : '0% de entregados'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {estadoDataDropship.notificado + expedientes.filter(e => (e.tipo_modulo || '').toLowerCase() === 'dropship' && e.estado_expediente === 'Visto Listo').length} en Notificado / Visto Listo en el período
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
                  <h4 className="text-sm font-medium text-gray-600">Pendientes de OK País</h4>
                  <p className="text-xs text-gray-500 mt-1">Entregados sin marca de cierre</p>
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-orange-600">
                {(() => {
                  const totalEntregados = estadoDataDropship.notificado + expedientes.filter(e => (e.tipo_modulo || '').toLowerCase() === 'dropship' && e.estado_expediente === 'Visto Listo').length;
                  return Math.max(0, totalEntregados - notificadoOkPais);
                })()}
              </span>
              <span className="text-lg text-gray-500">expedientes</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Requieren marca de cierre "OK País"
              </p>
            </div>
          </div>

          {/* KPI ETD vs Notificado */}
          <div className={`bg-white rounded-xl p-6 border-2 hover:shadow-lg transition-shadow ${
            kpiEtdNotificado.fueraRango > 0 ? 'border-red-300' : 'border-gray-200'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${
                  kpiEtdNotificado.fueraRango > 0 ? 'bg-red-100' : 'bg-teal-100'
                }`}>
                  <i className={`ri-ship-line text-2xl ${
                    kpiEtdNotificado.fueraRango > 0 ? 'text-red-600' : 'text-teal-600'
                  }`}></i>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-600">ETD → Notificado</h4>
                  <p className="text-xs text-gray-500 mt-1">Meta: ≤ {META_ETD_DIAS} días entre ETD y Notificado</p>
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-bold ${
                kpiEtdNotificado.fueraRango > 0 ? 'text-red-600' : 'text-teal-600'
              }`}>
                {kpiEtdNotificado.dentroRango}
              </span>
              <span className="text-lg text-gray-500">OK / {kpiEtdNotificado.totalEvaluados}</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      kpiEtdNotificado.porcentajeOk >= 80 ? 'bg-teal-500' :
                      kpiEtdNotificado.porcentajeOk >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${kpiEtdNotificado.porcentajeOk}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                  {kpiEtdNotificado.porcentajeOk}% OK
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {kpiEtdNotificado.fueraRango > 0
                  ? `${kpiEtdNotificado.fueraRango} expediente${kpiEtdNotificado.fueraRango !== 1 ? 's' : ''} fuera del KPI (promedio ${kpiEtdNotificado.promedioDias} días)`
                  : kpiEtdNotificado.totalEvaluados > 0
                  ? `Todos dentro del rango (promedio ${kpiEtdNotificado.promedioDias} días)`
                  : 'Sin datos para evaluar'}
              </p>
              <button
                onClick={() => setShowReporteEtd(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-file-chart-line"></i>
                Ver detalle de POs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========== KPI: Duración Promedio Asignado → Notificado =========== */}
      <div className="bg-gradient-to-br from-sky-50 to-cyan-50 border border-sky-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-sky-500 rounded-xl">
            <i className="ri-timer-line text-white text-2xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Duración Promedio Asignado → Notificado</h3>
            <p className="text-sm text-gray-600">Promedio de días entre la asignación y la notificación del expediente (Dropship)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-sky-100">
                <i className="ri-time-line text-2xl text-sky-600"></i>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-600">Duración Promedio</h4>
                <p className="text-xs text-gray-500 mt-1">Asignado → Notificado</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-sky-600">{kpiAsignadoNotificado.promedioDias}</span>
              <span className="text-lg text-gray-500">días</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-cyan-100">
                <i className="ri-file-list-3-line text-2xl text-cyan-600"></i>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-600">Expedientes Evaluados</h4>
                <p className="text-xs text-gray-500 mt-1">notificados en el período</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-gray-800">{kpiAsignadoNotificado.totalEvaluados}</span>
              <span className="text-lg text-gray-500">exp.</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-gray-100">
                <i className="ri-bar-chart-box-line text-2xl text-gray-600"></i>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-600">Desglose</h4>
                <p className="text-xs text-gray-500 mt-1">detalle por expediente</p>
              </div>
            </div>
            <button
              onClick={() => setShowReporteAsignadoNotificado(true)}
              disabled={asignadoNotificadoDetalle.length === 0}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-100 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-file-chart-line"></i>
              Ver desglose completo
            </button>
          </div>
        </div>
      </div>

      {/* =========== KPIs MCG (Dropship con MCG) =========== */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 flex items-center justify-center bg-indigo-500 rounded-xl">
            <i className="ri-shield-star-line text-white text-2xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">KPIs MCG</h3>
            <p className="text-sm text-gray-600">Expedientes Dropship marcados con MCG — evaluados por separado y excluidos de los KPIs generales</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Creación de expediente */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100">
                  <i className="ri-file-add-line text-2xl text-indigo-600"></i>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-600">Creación de Expediente</h4>
                  <p className="text-xs text-gray-500 mt-1">Asignado → número de expediente · Meta: ≤ 2 días</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{kpiMcgCreacion.totalEvaluados}</p>
                <p className="text-xs text-gray-500">Evaluados</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-teal-600">{kpiMcgCreacion.cumplen}</p>
                <p className="text-xs text-gray-500">Cumplen (≤2d)</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${kpiMcgCreacion.noCumplen > 0 ? 'text-red-600' : 'text-gray-400'}`}>{kpiMcgCreacion.noCumplen}</p>
                <p className="text-xs text-gray-500">No cumplen</p>
              </div>
            </div>
            <div className="mt-3 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${kpiMcgCreacion.porcentajeCumplimiento >= 80 ? 'bg-teal-500' : kpiMcgCreacion.porcentajeCumplimiento >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${kpiMcgCreacion.porcentajeCumplimiento}%` }}
              ></div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Promedio: <strong>{kpiMcgCreacion.diasPromedio} días</strong></span>
              <span className="text-xs font-semibold text-gray-600">{kpiMcgCreacion.porcentajeCumplimiento}% cumple</span>
            </div>
          </div>

          {/* ETD → Notificado */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100">
                  <i className="ri-ship-line text-2xl text-indigo-600"></i>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-600">ETD → Notificado</h4>
                  <p className="text-xs text-gray-500 mt-1">Meta: &lt; 2 días entre ETD y Notificado</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{kpiMcgEtdNotificado.totalEvaluados}</p>
                <p className="text-xs text-gray-500">Evaluados</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-teal-600">{kpiMcgEtdNotificado.dentroRango}</p>
                <p className="text-xs text-gray-500">Dentro (&lt;2d)</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${kpiMcgEtdNotificado.fueraRango > 0 ? 'text-red-600' : 'text-gray-400'}`}>{kpiMcgEtdNotificado.fueraRango}</p>
                <p className="text-xs text-gray-500">Fuera</p>
              </div>
            </div>
            <div className="mt-3 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${kpiMcgEtdNotificado.porcentajeOk >= 80 ? 'bg-teal-500' : kpiMcgEtdNotificado.porcentajeOk >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${kpiMcgEtdNotificado.porcentajeOk}%` }}
              ></div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Promedio: <strong>{kpiMcgEtdNotificado.promedioDias} días</strong></span>
              <span className="text-xs font-semibold text-gray-600">{kpiMcgEtdNotificado.porcentajeOk}% OK</span>
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