import type { FiltrosHistorial, MovimientoHistorial, TiqueteHistorial } from './types';

/** Orden natural del flujo de estados de un tíquete. */
export const ORDEN_ESTADOS: string[] = [
  'No Asignado',
  'Asignado',
  'En Proceso',
  'Liberación',
  'Facturación',
  'Recepción de Carga',
  'Notificado',
  'Espera de Respuesta',
  'Visto Listo',
  'Completado',
];

export const FILTROS_INICIALES: FiltrosHistorial = {
  busqueda: '',
  modulo: 'todos',
  campo: 'todos',
  usuario: 'todos',
  estado: 'todos',
  fechaInicio: '',
  fechaFin: '',
};

export const texto = (valor: unknown): string => {
  if (valor === null || valor === undefined) return '';
  return String(valor);
};

export const etiquetaModulo = (modulo: string): string => {
  if (modulo === 'dropship') return 'Dropship';
  if (modulo === 'zf') return 'ZF';
  return modulo || '—';
};

export const fechaHora = (fecha?: string | null): string => {
  if (!fecha) return '—';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const fechaCorta = (fecha?: string | null): string => {
  if (!fecha) return '—';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fechaMs = (fecha?: string | null): number => {
  if (!fecha) return 0;
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

export const diasDesde = (fecha?: string | null): number | null => {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

/** Formatea una cantidad de minutos en un texto legible (días / horas / minutos). */
export const formatearMinutos = (minutos?: number | null): string => {
  if (minutos === null || minutos === undefined || Number.isNaN(minutos)) return '—';
  if (minutos <= 0) return 'menos de 1 min';
  const total = Math.round(minutos);
  const dias = Math.floor(total / 1440);
  const horas = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (dias > 0) return `${dias} d ${horas} h`;
  if (horas > 0) return `${horas} h ${mins} min`;
  return `${mins} min`;
};

/** Minutos entre dos fechas (null si alguna no es válida). */
export const minutosEntre = (desde?: string | null, hasta?: string | null): number | null => {
  if (!desde || !hasta) return null;
  const a = new Date(desde).getTime();
  const b = new Date(hasta).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 60000));
};

export const esCambioDeEstado = (campo: string): boolean =>
  campo.trim().toLowerCase() === 'estado';

const coincide = (valores: unknown[], termino: string): boolean =>
  valores.some((valor) => texto(valor).toLowerCase().includes(termino));

const enRango = (fecha: string | null, inicio: string, fin: string): boolean => {
  if (!inicio && !fin) return true;
  if (!fecha) return false;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return false;
  if (inicio && d < new Date(`${inicio}T00:00:00`)) return false;
  if (fin && d > new Date(`${fin}T23:59:59`)) return false;
  return true;
};

export const contarFiltrosActivos = (filtros: FiltrosHistorial): number => {
  let total = 0;
  if (filtros.busqueda.trim()) total += 1;
  if (filtros.modulo !== 'todos') total += 1;
  if (filtros.campo !== 'todos') total += 1;
  if (filtros.usuario !== 'todos') total += 1;
  if (filtros.estado !== 'todos') total += 1;
  if (filtros.fechaInicio) total += 1;
  if (filtros.fechaFin) total += 1;
  return total;
};

/**
 * Aplica los filtros sobre la lista de tíquetes con su historial.
 * Si hay filtros de movimiento (campo, usuario o fechas), solo se muestran
 * los tíquetes que tienen al menos un movimiento que cumpla el criterio.
 */
export const filtrarTiquetes = (
  tiquetes: TiqueteHistorial[],
  filtros: FiltrosHistorial
): TiqueteHistorial[] => {
  const termino = filtros.busqueda.trim().toLowerCase();
  const hayFiltroMovimiento =
    filtros.campo !== 'todos' ||
    filtros.usuario !== 'todos' ||
    Boolean(filtros.fechaInicio) ||
    Boolean(filtros.fechaFin);

  const resultado: TiqueteHistorial[] = [];

  tiquetes.forEach((tiquete) => {
    if (filtros.modulo !== 'todos' && tiquete.modulo !== filtros.modulo) return;
    if (filtros.estado !== 'todos' && tiquete.estadoActual !== filtros.estado) return;

    const base = tiquete.movimientos.filter((mov) => {
      if (filtros.campo !== 'todos' && mov.campoModificado !== filtros.campo) return false;
      if (filtros.usuario !== 'todos' && mov.usuario !== filtros.usuario) return false;
      if (!enRango(mov.fechaCambio, filtros.fechaInicio, filtros.fechaFin)) return false;
      return true;
    });

    const tiqueteCoincide =
      !termino ||
      coincide(
        [tiquete.po, tiquete.expId, tiquete.solicitante, tiquete.responsable, tiquete.estadoActual],
        termino
      );

    const movimientosQueCoinciden = termino
      ? base.filter((mov) =>
          coincide(
            [mov.campoModificado, mov.valorAnterior, mov.valorNuevo, mov.usuario, mov.usuarioEmail],
            termino
          )
        )
      : base;

    // Si el tíquete coincide por PO/EXP, se muestra todo su historial filtrado;
    // si no, solo los movimientos que coinciden con la búsqueda.
    const movimientos = termino && tiqueteCoincide ? base : movimientosQueCoinciden;

    const incluir =
      movimientos.length > 0 || (!hayFiltroMovimiento && (!termino || tiqueteCoincide));

    if (!incluir) return;

    resultado.push({
      ...tiquete,
      movimientos,
      totalMovimientos: movimientos.length,
    });
  });

  return resultado;
};

export const ordenarTiquetes = (
  tiquetes: TiqueteHistorial[],
  orden: 'actividad' | 'antiguos' | 'movimientos'
): TiqueteHistorial[] => {
  const copia = [...tiquetes];
  if (orden === 'movimientos') {
    copia.sort((a, b) => b.totalMovimientos - a.totalMovimientos);
  } else if (orden === 'antiguos') {
    copia.sort((a, b) => {
      const fa = fechaMs(a.fechaSolicitud) || fechaMs(a.ultimoCambio);
      const fb = fechaMs(b.fechaSolicitud) || fechaMs(b.ultimoCambio);
      return fa - fb;
    });
  } else {
    copia.sort((a, b) => {
      const fa = fechaMs(a.ultimoCambio) || fechaMs(a.fechaSolicitud);
      const fb = fechaMs(b.ultimoCambio) || fechaMs(b.fechaSolicitud);
      return fb - fa;
    });
  }
  return copia;
};

export const movimientosPlanos = (tiquetes: TiqueteHistorial[]): MovimientoHistorial[] => {
  const lista = tiquetes.flatMap((tiquete) => tiquete.movimientos);
  lista.sort((a, b) => fechaMs(b.fechaCambio) - fechaMs(a.fechaCambio));
  return lista;
};

export const listarOpciones = (tiquetes: TiqueteHistorial[]) => {
  const campos = new Set<string>();
  const usuarios = new Set<string>();
  const estados = new Set<string>();

  tiquetes.forEach((tiquete) => {
    if (tiquete.estadoActual) estados.add(tiquete.estadoActual);
    tiquete.movimientos.forEach((mov) => {
      if (mov.campoModificado) campos.add(mov.campoModificado);
      if (mov.usuario) usuarios.add(mov.usuario);
    });
  });

  const ordenar = (valores: Set<string>) =>
    Array.from(valores).sort((a, b) => a.localeCompare(b, 'es'));

  return {
    campos: ordenar(campos),
    usuarios: ordenar(usuarios),
    estados: ordenar(estados),
  };
};