import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ExpedienteLite, HistorialRaw, MovimientoHistorial, TiqueteHistorial } from './types';
import { diasDesde, texto } from './utils';

const TAMANO_PAGINA = 1000;
const MAX_PAGINAS = 40;

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

/**
 * Carga todos los expedientes y todo el historial de cambios para construir
 * el reporte de movimiento por tíquete.
 */
export function useHistorialTiquetes() {
  const [expedientes, setExpedientes] = useState<ExpedienteLite[]>([]);
  const [historial, setHistorial] = useState<HistorialRaw[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const [expedientesRaw, historialRaw] = await Promise.all([
        cargarTodasLasFilas('expedientes', COLUMNAS_EXPEDIENTE, [
          { columna: 'created_at', ascendente: false },
        ]),
        cargarTodasLasFilas('expedientes_historial', COLUMNAS_HISTORIAL, [
          { columna: 'fecha_cambio', ascendente: false },
          { columna: 'id', ascendente: false },
        ]),
      ]);

      setExpedientes((expedientesRaw || []) as ExpedienteLite[]);
      setHistorial((historialRaw || []) as HistorialRaw[]);
    } catch (err: any) {
      console.error('Error al cargar el historial de tíquetes:', err);
      setError(err?.message || 'No se pudo cargar el historial de los tíquetes');
      setExpedientes([]);
      setHistorial([]);
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

    const movimientosPorExpediente = new Map<string, MovimientoHistorial[]>();
    const idsConHistorial = new Set<string>();

    historial.forEach((fila) => {
      const expedienteId = texto(fila.expediente_id);
      if (!expedienteId) return;

      const exp = expedientesPorId.get(expedienteId);
      const movimiento: MovimientoHistorial = {
        id: texto(fila.id),
        expedienteId,
        po: texto(exp?.po_tiquetera) || (exp ? '—' : `Sin ficha (${expedienteId.slice(0, 8)})`),
        expId: texto(exp?.exp_id) || '—',
        modulo: texto(exp?.tipo_modulo).toLowerCase(),
        estadoActual: texto(exp?.estado_expediente) || '—',
        solicitante: texto(exp?.solicitante) || '—',
        responsable: texto(exp?.responsable_creacion) || '—',
        campoModificado: texto(fila.campo_modificado) || '—',
        valorAnterior: texto(fila.valor_anterior),
        valorNuevo: texto(fila.valor_nuevo),
        usuario: texto(fila.usuario) || 'Sistema',
        usuarioEmail: texto(fila.usuario_email),
        fechaCambio: texto(fila.fecha_cambio),
        fechaSolicitud:
          texto(exp?.fecha_solicitud) || texto(exp?.fecha_creacion_expediente) || texto(exp?.created_at),
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

      const ultimoCambio = movimientos[0]?.fechaCambio || null;
      const primerCambio = movimientos.length > 0 ? movimientos[movimientos.length - 1].fechaCambio : null;

      const usuarios = Array.from(
        new Set(movimientos.map((mov) => mov.usuario).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'es'));

      const campos = Array.from(
        new Set(movimientos.map((mov) => mov.campoModificado).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'es'));

      lista.push({
        expedienteId: id,
        po: texto(exp?.po_tiquetera) || (exp ? '—' : `Sin ficha (${id.slice(0, 8)})`),
        expId: texto(exp?.exp_id) || '—',
        modulo: texto(exp?.tipo_modulo).toLowerCase(),
        estadoActual: texto(exp?.estado_expediente) || '—',
        solicitante: texto(exp?.solicitante) || '—',
        responsable: texto(exp?.responsable_creacion) || '—',
        fechaSolicitud:
          texto(exp?.fecha_solicitud) || texto(exp?.fecha_creacion_expediente) || texto(exp?.created_at),
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
      });
    });

    return lista;
  }, [expedientes, historial]);

  return { tiquetes, cargando, error, recargar: cargar };
}