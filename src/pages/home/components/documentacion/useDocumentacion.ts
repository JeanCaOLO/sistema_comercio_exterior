import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  cargarDocumentosCaa,
  recargarDocumentosCaa,
  consolidarDocumentos,
  eliminarDocumentosCaa,
  descargarArchivo,
  obtenerNombreUsuario,
} from '@/pages/home/components/documentacion/servicios';
import {
  contarDocumentos,
  filtrarDocumentos,
  paginar,
  rutasDeDocumentos,
} from '@/pages/home/components/documentacion/utils';
import type {
  DocumentoCAA,
  FiltroRapido,
  ModuloDestino,
} from '@/pages/home/components/documentacion/types';

// Emails autorizados para eliminar documentos en el módulo de Documentación
export const EMAILS_AUTORIZADOS_ELIMINAR = [
  'jalvarez@ologistics.com',
  'jmora@ologistics.com',
];

const ITEMS_PER_PAGE = 25;

export const useDocumentacion = () => {
  const { user } = useAuth();

  const [documentos, setDocumentos] = useState<DocumentoCAA[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetModulo, setTargetModulo] = useState<ModuloDestino>('dropship');
  const [generando, setGenerando] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [searchPO, setSearchPO] = useState('');
  const [filtroRuta, setFiltroRuta] = useState('');
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>('todos');
  const [currentPage, setCurrentPage] = useState(1);

  const [usuarioActual, setUsuarioActual] = useState('Sistema');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMCGPrompt, setShowMCGPrompt] = useState(false);
  const [filaDocumentos, setFilaDocumentos] = useState<DocumentoCAA | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const avisarExito = useCallback((mensaje: string, ms = 5000) => {
    setSuccessMessage(mensaje);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), ms);
  }, []);

  const avisarError = useCallback((mensaje: string, ms = 5000) => {
    setErrorMessage(mensaje);
    setShowError(true);
    setTimeout(() => setShowError(false), ms);
  }, []);

  const cargarDocumentos = useCallback(async () => {
    try {
      setLoading(true);
      setLoadTimeout(false);
      const data = await cargarDocumentosCaa();
      setDocumentos(data);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      setDocumentos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDocumentos();
    obtenerNombreUsuario().then(setUsuarioActual);
  }, [cargarDocumentos]);

  // Red de seguridad: si la carga se queda colgada más de 15s, salimos del loading
  useEffect(() => {
    if (!loading) {
      setLoadTimeout(false);
      return;
    }
    const timer = setTimeout(() => {
      console.warn('Documentacion: carga bloqueada por más de 15s, forzando salida del loading');
      setLoadTimeout(true);
      setLoading(false);
      setDocumentos([]);
    }, 15000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Volver a la primera página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchPO, filtroRuta, filtroRapido]);

  const documentosFiltrados = useMemo(
    () => filtrarDocumentos(documentos, { searchPO, filtroRuta, filtroRapido }),
    [documentos, searchPO, filtroRuta, filtroRapido]
  );

  const paginacion = useMemo(
    () => paginar(documentosFiltrados, currentPage, ITEMS_PER_PAGE),
    [documentosFiltrados, currentPage]
  );

  const rutasDisponibles = useMemo(() => rutasDeDocumentos(documentos), [documentos]);

  const hayFiltrosActivos = !!searchPO || !!filtroRuta || filtroRapido !== 'todos';

  const puedeEliminar = !!user?.email && EMAILS_AUTORIZADOS_ELIMINAR.includes(user.email);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === documentosFiltrados.length && documentosFiltrados.length > 0) {
        return new Set();
      }
      return new Set(documentosFiltrados.map((d) => d.id));
    });
  }, [documentosFiltrados]);

  const generarTicket = useCallback(async (marcarMCG = false) => {
    if (selectedIds.size === 0) {
      avisarError('Selecciona al menos un documento para generar ticket.', 4000);
      return;
    }

    const ids = Array.from(selectedIds);
    setGenerando(true);
    setShowError(false);
    setShowSuccess(false);

    try {
      const resultado = await consolidarDocumentos(ids, targetModulo, marcarMCG);

      avisarExito(
        `¡Ticket consolidado generado! 1 expediente con ${resultado.totalPos} PO(s) y ${resultado.totalDocumentos} documento(s) enviado a ${targetModulo === 'dropship' ? 'Dropship' : 'ZF'}.`
      );

      // Limpieza local inmediata para no bloquear la UI
      const idsSet = new Set(ids);
      setDocumentos((prev) => prev.filter((d) => !idsSet.has(d.id)));
      setSelectedIds(new Set());

      // Sincronización en segundo plano
      recargarDocumentosCaa().then((data) => {
        if (data) setDocumentos(data);
      });
    } catch (error: any) {
      console.error('Error al generar ticket:', error);
      avisarError(error?.message || 'Error al generar el ticket.');
    } finally {
      setGenerando(false);
    }
  }, [selectedIds, targetModulo, avisarExito, avisarError]);

  const confirmarEliminar = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setDeleting(true);
    setShowError(false);

    try {
      const total = selectedIds.size;
      await eliminarDocumentosCaa(Array.from(selectedIds));
      avisarExito(`${total} documento(s) eliminado(s) de Documentación.`, 4000);
      setShowDeleteConfirm(false);
      await cargarDocumentos();
    } catch (error: any) {
      console.error('Error al eliminar:', error);
      avisarError(error?.message || 'Error al eliminar los documentos.');
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, avisarExito, avisarError, cargarDocumentos]);

  const descargarDocumento = useCallback(async (url: string, fileName: string) => {
    try {
      setDownloadingId(url);
      await descargarArchivo(url, fileName);
    } catch (error) {
      console.error('Error al descargar:', error);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return {
    // datos
    documentos,
    documentosFiltrados,
    rutasDisponibles,
    paginacion,
    contarDocumentos,
    // estado de carga / mensajes
    loading,
    loadTimeout,
    showSuccess,
    successMessage,
    showError,
    errorMessage,
    // filtros
    searchPO,
    setSearchPO,
    filtroRuta,
    setFiltroRuta,
    filtroRapido,
    setFiltroRapido,
    hayFiltrosActivos,
    // selección y destino
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    targetModulo,
    setTargetModulo,
    generando,
    // acciones / modales
    showDeleteConfirm,
    setShowDeleteConfirm,
    showMCGPrompt,
    setShowMCGPrompt,
    confirmarEliminar,
    deleting,
    generarTicket,
    puedeEliminar,
    usuarioActual,
    // repositorio de la fila
    filaDocumentos,
    setFilaDocumentos,
    downloadingId,
    descargarDocumento,
    // paginación
    setCurrentPage,
  };
};