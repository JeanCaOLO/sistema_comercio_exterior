import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cargarPaginaRepositorio } from '@/pages/home/components/repositorio/servicios';
import { descargarArchivo } from '@/pages/home/components/repositorio/utils';
import {
  REGISTROS_POR_PAGINA,
  type RegistroRepositorio,
} from '@/pages/home/components/repositorio/types';

export const useRepositorio = () => {
  const [registros, setRegistros] = useState<RegistroRepositorio[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [filtroModulo, setFiltroModulo] = useState('Todos');

  const [filasExpandidas, setFilasExpandidas] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [registroEditando, setRegistroEditando] = useState<RegistroRepositorio | null>(null);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [registroHistorial, setRegistroHistorial] = useState<RegistroRepositorio | null>(null);

  const yaCargo = useRef(false);

  // Debounce de la búsqueda para no consultar en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaAplicada((prev) => {
        if (prev === busqueda) return prev;
        setPagina(1);
        return busqueda;
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const resultado = await cargarPaginaRepositorio({
        pagina,
        porPagina: REGISTROS_POR_PAGINA,
        busqueda: busquedaAplicada,
        filtroEstado,
        filtroModulo,
      });
      setRegistros(resultado.registros);
      setTotal(resultado.total);
    } catch (err: any) {
      console.error('Error al cargar el repositorio:', err);
      setRegistros([]);
      setTotal(0);
      setError(err?.message || 'No se pudo cargar el repositorio de documentación.');
    } finally {
      setCargando(false);
      yaCargo.current = true;
    }
  }, [pagina, busquedaAplicada, filtroEstado, filtroModulo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / REGISTROS_POR_PAGINA)),
    [total]
  );

  useEffect(() => {
    if (pagina > totalPaginas && !cargando) setPagina(totalPaginas);
  }, [pagina, totalPaginas, cargando]);

  const cambiarEstado = useCallback((valor: string) => {
    setFiltroEstado(valor);
    setPagina(1);
  }, []);

  const cambiarModulo = useCallback((valor: string) => {
    setFiltroModulo(valor);
    setPagina(1);
  }, []);

  const limpiarFiltros = useCallback(() => {
    setBusqueda('');
    setBusquedaAplicada('');
    setFiltroEstado('Todos');
    setFiltroModulo('Todos');
    setPagina(1);
  }, []);

  const toggleExpandir = useCallback((id: string) => {
    setFilasExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const descargar = useCallback(async (url: string, fileName: string) => {
    try {
      setDownloadingId(url);
      await descargarArchivo(url, fileName);
    } catch (err) {
      console.error('Error al descargar:', err);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const abrirEdicion = useCallback((registro: RegistroRepositorio) => {
    setRegistroEditando(registro);
    setEditModalOpen(true);
  }, []);

  const abrirHistorial = useCallback((registro: RegistroRepositorio) => {
    setRegistroHistorial(registro);
    setHistorialOpen(true);
  }, []);

  const cerrarEdicion = useCallback(() => {
    setEditModalOpen(false);
    setRegistroEditando(null);
  }, []);

  const cerrarHistorial = useCallback(() => {
    setHistorialOpen(false);
    setRegistroHistorial(null);
  }, []);

  return {
    registros,
    total,
    totalPaginas,
    cargando,
    error,
    recargar: cargar,
    pagina,
    setPagina,
    busqueda,
    setBusqueda,
    filtroEstado,
    cambiarEstado,
    filtroModulo,
    cambiarModulo,
    limpiarFiltros,
    hayFiltrosActivos: !!busqueda || filtroEstado !== 'Todos' || filtroModulo !== 'Todos',
    filasExpandidas,
    toggleExpandir,
    downloadingId,
    descargar,
    editModalOpen,
    registroEditando,
    abrirEdicion,
    cerrarEdicion,
    historialOpen,
    registroHistorial,
    abrirHistorial,
    cerrarHistorial,
  };
};