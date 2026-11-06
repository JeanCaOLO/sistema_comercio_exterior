import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  EstadoPeriodo,
  EstadoPeriodoRaw,
  EtapaRuta,
  ExpedienteLite,
  HistorialRaw,
  MovimientoHistorial,
  TiqueteHistorial,
} from './types';
import { ORDEN_ESTADOS, diasDesde, esCambioDeEstado, fechaMs, minutosEntre, texto } from './utils';

const TAMANO_PAGINA = 1000;
const MAX_PAGINAS = 40;
const ORDEN_FUERA_DE_FLUJO = 99;

interface OrdenColumna {
  columna: string;
  ascendente: boolean;
}

// PostgREST devuelve como máximo 1000 filas por petición, por eso se pagina
// hasta traer todo el historial (incluidos los tíquetes más antiguos).
const cargarTodasLasFilas = async (
  tabla: string,
  columnas: string,
  orden: OrdenColumna[]
): Promise<any[]> => {
  const filas: any[] = [];

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    let consulta = (supabase as any).from(tabla).select(columnas);
    orden.forEach((item) => {
      consulta = consulta.order(item.columna, { ascending: item.ascendente });
    });

    const desde = pagina * TAMANO_PAGINA;
    const { data, error } = await consulta.range(desde, desde + TAMANO_PAGINA - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    filas.push(...data);
    if (data.length < TAMANO_PAGINA) break;
  }

  return filas;
};

const COLUMNAS_EXPEDIENTE = [
  'id',
  'po_tiquetera',
  'exp_id',
  'tipo_modulo',
  'estado_expediente',
  'solicitante',
  'responsable_creacion',
  'fecha_solicitud',
  'fecha_creacion_expediente',
  'created_at',
  'prioridad',
  'prioridad_urgente',
].join(', ');

const COLUMNAS_HISTORIAL = [
  'id',
  'expediente_id',
  'campo_modificado',
  'valor_anterior',
  'valor_nuevo',
  'usuario',
  'usuario_email',
  'fecha_cambio',
].join(', ');

const COLUMNAS_TIEMPOS = [
  'id',
  'expediente_id',
  'estado_anterior',
  'estado_nuevo',
  'fecha_inicio',
  'fecha_fin',
  'minutos_transcurridos',
].join(', ');

const ordenEtapa = (estado: string): number => {
  const indice = ORDEN_ESTADOS.indexOf(estado);
  return indice >= 0 ? indice : ORDEN_FUERA_DE_FLUJO;
};

/**
 * Reconstruye la ruta completa de estados de un tíquete combinando los tiempos
 * oficiales (expedientes_tiempos_estados) con los cambios de estado del historial.
 */
const construirRuta = (
  periodos: EstadoPeriodo[],
  movimientosEstado: MovimientoHistorial[],
  estadoActual: string,
  fechaSolicitud: string
): EtapaRuta[] => {
  const mapa = new Map<string, EtapaRuta>();

  const crear = (estado: string): EtapaRuta => ({
    estado,
    orden: ordenEtapa(estado),
    fechaInicio: null,
    fechaFin: null,
    minutos: null,
    visitado: false,
    esActual: false,
    veces: 0,
  });

  const asegurar = (estado: string): EtapaRuta => {
    const existente = mapa.get(estado);
    if (existente) return existente;
    const nueva = crear(estado);
    mapa.set(estado, nueva);
    return nueva;
  };

  periodos
    .slice()
    .sort((a, b) => fechaMs(a.fechaInicio) - fechaMs(b.fechaInicio))
    .forEach((periodo) => {
      if (periodo.estadoAnterior) {
        const anterior = asegurar(periodo.estadoAnterior);
        anterior.visitado = true;
        anterior.veces = anterior.veces || 1;
        if (!anterior.fechaFin) anterior.fechaFin = periodo.fechaInicio;
      }
      if (periodo.estadoNuevo) {
        const nuevo = asegurar(periodo.estadoNuevo);
        nuevo.visitado = true;
        nuevo.veces += 1;
        if (!nuevo.fechaInicio) nuevo.fechaInicio = periodo.fechaInicio;
        if (periodo.fechaFin) nuevo.fechaFin = periodo.fechaFin;
        if (periodo.minutos !== null) {
          nuevo.minutos = (nuevo.minutos || 0) + periodo.minutos;
        }
      }
    });

  // Completar con los cambios de estado del historial cuando no hay tiempo oficial.
  movimientosEstado.forEach((mov, index) => {
    const estado = mov.valorNuevo;
    if (!estado) return;
    const siguiente = movimientosEstado[index + 1];
    const existente = mapa.get(estado);

    if (existente) {
      if (!existente.visitado) {
        existente.visitado = true;
        existente.veces = existente.veces || 1;
        existente.fechaInicio = existente.fechaInicio || mov.fechaCambio;
        existente.fechaFin = existente.fechaFin || (siguiente ? siguiente.fechaCambio : null);
      }
      return;
    }

    const nueva = crear(estado);
    nueva.visitado = true;
    nueva.veces = 1;
    nueva.fechaInicio = mov.fechaCambio;
    nueva.fechaFin = siguiente ? siguiente.fechaCambio : null;
    mapa.set(estado, nueva);
  });

  mapa.forEach((etapa) => {
    if (!etapa.fechaInicio && etapa.fechaFin && fechaSolicitud) {
      etapa.fechaInicio = fechaSolicitud;
    }
    if (etapa.minutos === null) {
      const calculado = minutosEntre(etapa.fechaInicio, etapa.fechaFin);
      if (calculado !== null) etapa.minutos = calculado;
    }
  });

  if (estadoActual) {
    const actual = asegurar(estadoActual);
    actual.esActual = true;
    actual.visitado = true;
  }

  ORDEN_ESTADOS.forEach((estado, indice) => {
    if (!mapa.has(estado)) {
      mapa.set(estado, {
        estado,
        orden: indice,
        fechaInicio: null,
        fechaFin: null,
        minutos: null,
        visitado: false,
        esActual: false,
        veces: 0,
      });
    }
  });

  return Array.from(mapa.values()).sort((a, b) => {
    if (a.orden !== b.orden) return a.orden - b.orden;
    return fechaMs(a.fechaInicio) - fechaMs(b.fechaInicio);
  });
};

export function useHistorialTiquetes() {
  const [expedientes, setExpedientes] = useState<ExpedienteLite[]>([]);
  const [historial, setHistorial] = useState<HistorialRaw[]>([]);
  const [tiempos, setTiempos] = useState<EstadoPeriodoRaw[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const [expedientesRaw, historialRaw, tiemposRaw] = await Promise.all([
        cargarTodasLasFilas('expedientes', COLUMNAS_EXPEDIENTE, [
          { columna: 'created_at', ascendente: false },
        ]),
        cargarTodasLasFilas('expedientes_historial', COLUMNAS_HISTORIAL, [
          { columna: 'fecha_cambio', ascendente: false },
          { columna: 'id', ascendente: false },
        ]),
        cargarTodasLasFilas('expedientes_tiempos_estados', COLUMNAS_TIEMPOS, [
          { columna: 'fecha_inicio', ascendente: true },
        ]),
      ]);

      setExpedientes((expedientesRaw || []) as ExpedienteLite[]);
      setHistorial((historialRaw || []) as HistorialRaw[]);
      setTiempos((tiemposRaw || []) as EstadoPeriodoRaw[]);
    } catch (err: any) {
      console.error('Error al cargar el historial de tíquetes:', err);
      setError(err?.message || 'No se pudo cargar el historial de los tíquetes');
      setExpedientes([]);
      setHistorial([]);
      setTiempos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const tiquetes = useMemo<TiqueteHistorial[]>(() => {
    const expedientesPorId = new Map<string, ExpedienteLite>();
    expedientes.forEach((exp) => expedientesPorId.set(exp.id, exp));

    const periodosPorExpediente = new Map<string, EstadoPeriodo[]>();
    tiempos.forEach((fila) => {
      const expedienteId = texto(fila.expediente_id);
      if (!expedienteId) return;
      const lista = periodosPorExpediente.get(expedienteId) || [];
      lista.push({
        id: texto(fila.id),
        estadoAnterior: texto(fila.estado_anterior),
        estadoNuevo: texto(fila.estado_nuevo),
        fechaInicio: texto(fila.fecha_inicio) || null,
        fechaFin: texto(fila.fecha_fin) || null,
        minutos:
          typeof fila.minutos_transcurridos === 'number' ? fila.minutos_transcurridos : null,
      });
      periodosPorExpediente.set(expedienteId, lista);
    });

    const movimientosPorExpediente = new Map<string, MovimientoHistorial[]>();
    const idsConHistorial = new Set<string>();

    historial.forEach((fila) => {
      const expedienteId = texto(fila.expediente_id);
      if (!expedienteId) return;

      const exp = expedientesPorId.get(expedienteId);
      const campo = texto(fila.campo_modificado);
      const movimiento: MovimientoHistorial = {
        id: texto(fila.id),
        expedienteId,
        po: texto(exp?.po_tiquetera) || (exp ? '—' : `Sin ficha (${expedienteId.slice(0, 8)})`),
        expId: texto(exp?.exp_id) || '—',
        modulo: texto(exp?.tipo_modulo).toLowerCase(),
        estadoActual: texto(exp?.estado_expediente) || '—',
        solicitante: texto(exp?.solicitante) || '—',
        responsable: texto(exp?.responsable_creacion) || '—',
        campoModificado: campo || '—',
        valorAnterior: texto(fila.valor_anterior),
        valorNuevo: texto(fila.valor_nuevo),
        usuario: texto(fila.usuario) || 'Sistema',
        usuarioEmail: texto(fila.usuario_email),
        fechaCambio: texto(fila.fecha_cambio),
        fechaSolicitud:
          texto(exp?.fecha_solicitud) || texto(exp?.fecha_creacion_expediente) || texto(exp?.created_at),
        minutosDesdeAnterior: null,
        esCambioEstado: esCambioDeEstado(campo),
      };

      const lista = movimientosPorExpediente.get(expedienteId) || [];
      lista.push(movimiento);
      movimientosPorExpediente.set(expedienteId, lista);
      idsConHistorial.add(expedienteId);
    });

    const ids = new Set<string>();
    expedientes.forEach((exp) => ids.add(exp.id));
    idsConHistorial.forEach((id) => ids.add(id));

    const lista: TiqueteHistorial[] = [];

    ids.forEach((id) => {
      const exp = expedientesPorId.get(id);
      const movimientos = (movimientosPorExpediente.get(id) || []).slice().sort((a, b) => {
        const fa = new Date(a.fechaCambio).getTime();
        const fb = new Date(b.fechaCambio).getTime();
        if (Number.isNaN(fa) && Number.isNaN(fb)) return 0;
        if (Number.isNaN(fa)) return 1;
        if (Number.isNaN(fb)) return -1;
        return fb - fa;
      });

      // Tiempo transcurrido desde el movimiento cronológicamente anterior.
      movimientos.forEach((mov, index) => {
        const anterior = movimientos[index + 1];
        mov.minutosDesdeAnterior = anterior
          ? minutosEntre(anterior.fechaCambio, mov.fechaCambio)
          : null;
      });

      const ultimoCambio = movimientos[0]?.fechaCambio || null;
      const primerCambio = movimientos.length > 0 ? movimientos[movimientos.length - 1].fechaCambio : null;

      const usuarios = Array.from(
        new Set(movimientos.map((mov) => mov.usuario).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'es'));

      const campos = Array.from(
        new Set(movimientos.map((mov) => mov.campoModificado).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'es'));

      const estadoActual = texto(exp?.estado_expediente) || '—';
      const fechaSolicitud =
        texto(exp?.fecha_solicitud) || texto(exp?.fecha_creacion_expediente) || texto(exp?.created_at);

      const movimientosEstado = movimientos
        .filter((mov) => mov.esCambioEstado)
        .slice()
        .sort((a, b) => fechaMs(a.fechaCambio) - fechaMs(b.fechaCambio));

      const ruta = construirRuta(
        periodosPorExpediente.get(id) || [],
        movimientosEstado,
        estadoActual,
        fechaSolicitud
      );

      const visitadas = ruta.filter((etapa) => etapa.visitado);
      const minutosValidos = visitadas
        .map((etapa) => etapa.minutos)
        .filter((valor): valor is number => typeof valor === 'number' && valor > 0);
      const minutosCiclo =
        minutosValidos.length > 0 ? minutosValidos.reduce((acc, valor) => acc + valor, 0) : null;
      const etapaActual = ruta.find((etapa) => etapa.esActual);

      lista.push({
        expedienteId: id,
        po: texto(exp?.po_tiquetera) || (exp ? '—' : `Sin ficha (${id.slice(0, 8)})`),
        expId: texto(exp?.exp_id) || '—',
        modulo: texto(exp?.tipo_modulo).toLowerCase(),
        estadoActual,
        solicitante: texto(exp?.solicitante) || '—',
        responsable: texto(exp?.responsable_creacion) || '—',
        fechaSolicitud,
        prioridad: texto(exp?.prioridad) || '—',
        urgente: Boolean(exp?.prioridad_urgente),
        totalMovimientos: movimientos.length,
        totalMovimientosHistoricos: movimientos.length,
        ultimoCambio,
        primerCambio,
        diasSinMovimiento: diasDesde(ultimoCambio),
        usuarios,
        campos,
        movimientos,
        ruta,
        estadosRecorridos: visitadas.length,
        minutosCiclo,
        minutosEstadoActual: etapaActual?.minutos ?? null,
        totalCambiosEstado: movimientosEstado.length,
      });
    });

    return lista;
  }, [expedientes, historial, tiempos]);

  return { tiquetes, cargando, error, recargar: cargar };
}