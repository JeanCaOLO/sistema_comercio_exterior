import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { cargarRutasActivas, type RutaLogistica } from '@/lib/rutas';
import type { Expediente, TipoModulo } from './types';
import { calcularDiasHabilesReales, filtrarTerminadosAntiguos } from './utils';
import {
  aplicarOKPaisAutomatico,
  cargarFechasAsignado,
  consultarExpedientes,
  consultarFacturasBusqueda,
} from './servicios';

interface Params {
  tipoModulo: TipoModulo;
  refreshTrigger?: number;
}

/**
 * Hook con el estado de datos del tablero: expedientes, filtros, usuarios,
 * rutas y el reloj que actualiza los tiempos cada minuto.
 */
export function useExpedientesKanban({ tipoModulo, refreshTrigger }: Params) {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPersona, setFilterPersona] = useState('Todos');
  const [filterPrioridad, setFilterPrioridad] = useState('Todos');
  const [filterRutas, setFilterRutas] = useState<string[]>([]);
  const [facturasPorId, setFacturasPorId] = useState<Record<string, string[]>>({});
  const [fechasAsignado, setFechasAsignado] = useState<Record<string, string>>({});
  const [todasPersonas, setTodasPersonas] = useState<string[]>([]);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [solicitantes, setSolicitantes] = useState<string[]>([]);
  const [rutas, setRutas] = useState<RutaLogistica[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const cargarUsuarios = async () => {
    try {
      // Traer todos los usuarios y filtrar activos de forma case-insensitive en el cliente
      const { data: usuariosData, error } = await supabase
        .from('usuarios')
        .select('nombre, rol, email, estado')
        .order('nombre');

      if (error) {
        console.error('Error al cargar usuarios:', error);
        throw error;
      }

      // Filtro case-insensitive: activo, Activo, ACTIVO o sin estado son válidos
      const usuarios = (usuariosData || []).filter((u) => {
        const estado = (u.estado || '').toLowerCase().trim();
        return estado === '' || estado === 'activo';
      });

      const todosNombres = usuarios.map((u) => u.nombre);
      setSolicitantes(todosNombres);
      setResponsables(todosNombres);
      setTodasPersonas(todosNombres);
    } catch (error) {
      console.error('❌ Error al cargar usuarios:', error);
      setSolicitantes([]);
      setResponsables([]);
      setTodasPersonas([]);
    }
  };

  const cargarFacturasBusqueda = async () => {
    try {
      const mapa = await consultarFacturasBusqueda(tipoModulo);
      setFacturasPorId(mapa);
    } catch (err) {
      console.error('Error al cargar facturas para búsqueda:', err);
    }
  };

  const cargarExpedientes = async () => {
    try {
      setLoading(true);
      const data = await consultarExpedientes(tipoModulo);

      setFechasAsignado(await cargarFechasAsignado(data));
      const conOKAutomatico = await aplicarOKPaisAutomatico(data);
      setExpedientes(filtrarTerminadosAntiguos(conOKAutomatico));
    } catch (error) {
      console.error('❌ Error al cargar expedientes:', error);
      setExpedientes([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarRutasDisponibles = async () => {
    const activas = await cargarRutasActivas();
    setRutas(activas);
  };

  // Recarga silenciosa: sincroniza con Supabase en background sin bloquear la UI
  const recargaSilenciosa = async () => {
    try {
      const data = await consultarExpedientes(tipoModulo);
      setFechasAsignado(await cargarFechasAsignado(data));
      const conOKAutomatico = await aplicarOKPaisAutomatico(data);
      setExpedientes(filtrarTerminadosAntiguos(conOKAutomatico));
      await cargarFacturasBusqueda();
    } catch (err) {
      console.error('Error en recarga silenciosa:', err);
    }
  };

  useEffect(() => {
    cargarExpedientes();
    cargarFacturasBusqueda();
    cargarUsuarios();
    cargarRutasDisponibles();

    // Safety net: si loading queda en true más de 15s, forzarlo a false
    const safetyTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('⚠️ Safety net: loading forzado a false después de 15s');
          return false;
        }
        return prev;
      });
    }, 15000);

    return () => clearTimeout(safetyTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recargar cuando cambia refreshTrigger
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      cargarExpedientes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // Reloj: actualiza los tiempos cada minuto
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Refresca el selector cuando se guardan cambios en Configuración → Rutas
  useEffect(() => {
    const onRutasActualizadas = () => {
      cargarRutasDisponibles();
    };
    window.addEventListener('rutasActualizadas', onRutasActualizadas);
    return () => window.removeEventListener('rutasActualizadas', onRutasActualizadas);
  }, []);

  const filteredExpedientes = useMemo(() => {
    let filtrados = [...expedientes];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtrados = filtrados.filter(
        (exp) =>
          (exp.po_tiquetera || '').toLowerCase().includes(term) ||
          (exp.exp_id || '').toLowerCase().includes(term) ||
          (exp.solicitante || '').toLowerCase().includes(term) ||
          (exp.responsable_creacion || '').toLowerCase().includes(term) ||
          (facturasPorId[exp.id] || []).some((nombre) => nombre.includes(term))
      );
    }

    // En Dropship filtra por Solicitante, en ZF por Responsable de Creación
    if (filterPersona !== 'Todos') {
      filtrados = filtrados.filter((exp) =>
        tipoModulo === 'dropship'
          ? exp.solicitante === filterPersona
          : exp.responsable_creacion === filterPersona
      );
    }

    if (filterPrioridad !== 'Todos') {
      if (filterPrioridad === 'Urgente') {
        filtrados = filtrados.filter((exp) => exp.prioridad_urgente);
      } else {
        filtrados = filtrados.filter((exp) => exp.prioridad === filterPrioridad);
      }
    }

    // Filtro por ruta logística, solo disponible en Dropship
    if (tipoModulo === 'dropship' && filterRutas.length > 0) {
      filtrados = filtrados.filter((exp) => filterRutas.includes(exp.tipo_po));
    }

    return filtrados;
  }, [expedientes, searchTerm, filterPersona, filterPrioridad, filterRutas, facturasPorId, tipoModulo]);

  const fechaInicioTicket = (expediente: Expediente): string =>
    fechasAsignado[expediente.id] ||
    expediente.fecha_apertura ||
    expediente.fecha_creacion_expediente ||
    expediente.created_at;

  const calcularTiempoTranscurrido = (expediente: Expediente): { minutos: number; dias: number } => {
    // Para Dropship: 'Notificado' y 'Visto Listo' son estados finales (timer congelado)
    const esFinalDropship =
      expediente.tipo_modulo === 'dropship' &&
      (expediente.estado_expediente === 'Notificado' ||
        expediente.estado_expediente === 'Visto Listo');
    const esFinalZF = expediente.tipo_modulo === 'zf' && expediente.estado_expediente === 'Completado';

    if (
      (esFinalDropship || esFinalZF) &&
      expediente.tiempo_real_minutos &&
      expediente.dias_entrega_real
    ) {
      return {
        minutos: expediente.tiempo_real_minutos,
        dias: expediente.dias_entrega_real,
      };
    }

    const inicioTicket = fechaInicioTicket(expediente);
    const fechaInicio = new Date(inicioTicket);
    const diffMs = currentTime.getTime() - fechaInicio.getTime();
    const minutos = Math.max(0, Math.round(diffMs / (1000 * 60)));
    const dias = calcularDiasHabilesReales(inicioTicket, currentTime.toISOString());

    return { minutos, dias };
  };

  const getExpedientesPorEstado = (estado: string): Expediente[] =>
    filteredExpedientes.filter((exp) => exp.estado_expediente === estado);

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFilterPersona('Todos');
    setFilterPrioridad('Todos');
    setFilterRutas([]);
  };

  return {
    expedientes,
    setExpedientes,
    loading,
    searchTerm,
    setSearchTerm,
    filterPersona,
    setFilterPersona,
    filterPrioridad,
    setFilterPrioridad,
    filterRutas,
    setFilterRutas,
    filteredExpedientes,
    todasPersonas,
    responsables,
    solicitantes,
    rutas,
    fechasAsignado,
    recargaSilenciosa,
    fechaInicioTicket,
    calcularTiempoTranscurrido,
    getExpedientesPorEstado,
    limpiarFiltros,
  };
}