// Hook que centraliza estado, filtros y acciones de la Lista de Expedientes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAutocorrector } from '@/hooks/useAutocorrector';
import { cargarRutasActivas, type RutaLogistica } from '@/lib/rutas';
import { parseDocEntries, type DocEntry } from '@/lib/documentos';
import type { Expediente } from './types';
import {
  ITEMS_PER_PAGE,
  calcularTiempoTranscurrido,
  filtrarExpedientes,
  hayFiltrosActivos,
} from './utils';
import {
  cargarExpedientes,
  cargarHistorialExpediente,
  cargarUsuariosActivos,
  descargarArchivo,
  eliminarExpediente,
  guardarCambiosExpediente,
  obtenerNombreUsuarioActual,
} from './servicios';

export function useListaExpedientes() {
  const { corregir } = useAutocorrector();

  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPersona, setFilterPersona] = useState('Todos');
  const [filterPrioridad, setFilterPrioridad] = useState('Todos');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterTipoModulo, setFilterTipoModulo] = useState('Todos');

  const [currentPage, setCurrentPage] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [todasPersonas, setTodasPersonas] = useState<string[]>([]);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [rutas, setRutas] = useState<RutaLogistica[]>([]);
  const [usuarioActual, setUsuarioActual] = useState<string>('Sistema');

  // Detalle / edición
  const [selectedExpediente, setSelectedExpediente] = useState<Expediente | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Feedback
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Historial
  const [showHistorial, setShowHistorial] = useState(false);
  const [historialData, setHistorialData] = useState<any[]>([]);
  const [cargadorNoAutorizado, setCargadorNoAutorizado] = useState(false);

  // Documentos
  const [showDocumentos, setShowDocumentos] = useState(false);
  const [documentosExpediente, setDocumentosExpediente] = useState<DocEntry[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<Expediente | null>(null);

  const avisarError = useCallback((mensaje: string) => {
    setErrorMessage(mensaje);
    setShowError(true);
    setTimeout(() => setShowError(false), 5000);
  }, []);

  const avisarExito = useCallback(() => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  }, []);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await cargarExpedientes();
      setExpedientes(data);
    } catch (error) {
      console.error('Error al cargar expedientes:', error);
      setExpedientes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const recargaSilenciosa = useCallback(async () => {
    try {
      const data = await cargarExpedientes();
      setExpedientes(data);
    } catch (error) {
      console.error('Error en recarga silenciosa:', error);
    }
  }, []);

  const cargarRutasDisponibles = useCallback(async () => {
    const activas = await cargarRutasActivas();
    setRutas(activas);
  }, []);

  useEffect(() => {
    cargar();
    obtenerNombreUsuarioActual().then(setUsuarioActual);
    cargarRutasDisponibles();

    cargarUsuariosActivos()
      .then((nombres) => {
        setTodasPersonas(nombres);
        setResponsables(nombres);
      })
      .catch((error) => console.error('Error al cargar usuarios:', error));

    // Safety net: si loading queda en true más de 15s, forzarlo a false
    const safetyTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('Safety net: loading forzado a false después de 15s');
          return false;
        }
        return prev;
      });
    }, 15000);

    return () => clearTimeout(safetyTimer);
  }, [cargar, cargarRutasDisponibles]);

  // Refresca el selector cuando se guardan cambios en Configuración → Rutas
  useEffect(() => {
    const onRutasActualizadas = () => {
      cargarRutasDisponibles();
    };
    window.addEventListener('rutasActualizadas', onRutasActualizadas);
    return () => window.removeEventListener('rutasActualizadas', onRutasActualizadas);
  }, [cargarRutasDisponibles]);

  // Reloj del listado (se refresca cada minuto)
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Volver a la primera página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterPersona, filterPrioridad, filterEstado, filterTipoModulo]);

  const filtros = useMemo(
    () => ({ searchTerm, filterPersona, filterPrioridad, filterEstado, filterTipoModulo }),
    [searchTerm, filterPersona, filterPrioridad, filterEstado, filterTipoModulo]
  );

  const filteredExpedientes = useMemo(
    () => filtrarExpedientes(expedientes, filtros),
    [expedientes, filtros]
  );

  const hayFiltros = hayFiltrosActivos(filtros);

  const totalPages = Math.max(1, Math.ceil(filteredExpedientes.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedExpedientes = useMemo(
    () =>
      filteredExpedientes.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
    [filteredExpedientes, safePage]
  );

  const verHistorial = useCallback(
    async (expediente: Expediente) => {
      try {
        setExpedienteSeleccionado(expediente);
        setShowHistorial(true);
        const { historial, cargadorNoAutorizado: noAutorizado } =
          await cargarHistorialExpediente(expediente);
        setHistorialData(historial);
        setCargadorNoAutorizado(noAutorizado);
      } catch (error) {
        console.error('Error al cargar historial:', error);
        setHistorialData([]);
      }
    },
    []
  );

  const verDocumentos = useCallback((expediente: Expediente) => {
    try {
      setDocumentosExpediente(parseDocEntries(expediente.doc));
    } catch (error) {
      console.error('Error al procesar documentos:', error);
      setDocumentosExpediente([]);
    }
    setExpedienteSeleccionado(expediente);
    setShowDocumentos(true);
  }, []);

  const descargarDocumento = useCallback(async (url: string, fileName: string) => {
    setDownloadingId(url);
    try {
      await descargarArchivo(url, fileName);
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const abrirModal = useCallback((expediente: Expediente) => {
    setSelectedExpediente(expediente);
    setShowModal(true);
    setEditMode(false);
    setUploadedFiles([]);
  }, []);

  const cerrarModal = useCallback(() => {
    setShowModal(false);
    setSelectedExpediente(null);
    setEditMode(false);
    setUploadedFiles([]);
  }, []);

  const handleChange = useCallback((field: string, value: any) => {
    setSelectedExpediente((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const cancelarEdicion = useCallback(() => {
    setEditMode(false);
    setUploadedFiles([]);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const files = Array.from(e.target.files);
      const validFiles = files.filter((file) => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        return [
          'pdf',
          'xlsx',
          'xls',
          'xlsm',
          'csv',
          'png',
          'jpg',
          'jpeg',
          'webp',
          'gif',
          'bmp',
        ].includes(extension || '');
      });

      if (validFiles.length !== files.length) {
        avisarError(
          'Solo se permiten archivos PDF, Excel (.xlsx, .xls, .xlsm), CSV e imágenes (PNG, JPG, JPEG, WebP, GIF, BMP)'
        );
      }

      setUploadedFiles((prev) => [...prev, ...validFiles]);
    },
    [avisarError]
  );

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const guardarCambios = useCallback(async () => {
    if (!selectedExpediente) return;

    const original = expedientes.find((e) => e.id === selectedExpediente.id);
    if (!original) {
      avisarError('Expediente original no encontrado');
      return;
    }

    setSaving(true);
    setUploadingFiles(uploadedFiles.length > 0);

    try {
      const updates = await guardarCambiosExpediente({
        seleccionado: selectedExpediente,
        original,
        archivos: uploadedFiles,
      });

      // Actualizar el expediente en el estado local al instante (sin bloquear la UI)
      setExpedientes((prev) =>
        prev.map((exp) => (exp.id === selectedExpediente.id ? { ...exp, ...updates } : exp))
      );

      avisarExito();
      setEditMode(false);
      setUploadedFiles([]);
      setShowModal(false);
      setSelectedExpediente(null);

      // Recarga silenciosa en background — no bloquea la UI
      recargaSilenciosa();
    } catch (error: any) {
      console.error('Error al guardar cambios:', error);
      avisarError(error?.message || 'Error al guardar los cambios');
    } finally {
      setSaving(false);
      setUploadingFiles(false);
    }
  }, [selectedExpediente, expedientes, uploadedFiles, avisarError, avisarExito, recargaSilenciosa]);

  const handleDelete = useCallback(
    async (expedienteId: string) => {
      if (!confirm('¿Está seguro de eliminar este expediente?')) return;

      try {
        await eliminarExpediente(expedienteId);
        avisarExito();
        cargar();
        cerrarModal();
      } catch (error) {
        console.error('Error al eliminar expediente:', error);
        avisarError('Error al eliminar el expediente');
      }
    },
    [avisarError, avisarExito, cargar, cerrarModal]
  );

  return {
    // datos
    expedientes,
    loading,
    filteredExpedientes,
    paginatedExpedientes,
    todasPersonas,
    responsables,
    rutas,
    usuarioActual,
    currentTime,

    // filtros
    searchTerm,
    setSearchTerm,
    filterPersona,
    setFilterPersona,
    filterPrioridad,
    setFilterPrioridad,
    filterEstado,
    setFilterEstado,
    filterTipoModulo,
    setFilterTipoModulo,
    hayFiltros,

    // paginación
    currentPage: safePage,
    setCurrentPage,
    totalPages,

    // feedback
    showSuccess,
    showError,
    errorMessage,

    // detalle / edición
    selectedExpediente,
    showModal,
    editMode,
    saving,
    uploadingFiles,
    abrirModal,
    cerrarModal,
    handleChange,
    handleFileChange,
    removeFile,
    setEditMode,
    cancelarEdicion,
    guardarCambios,
    handleDelete,
    corregir,

    // historial
    showHistorial,
    setShowHistorial,
    historialData,
    expedienteSeleccionado,
    cargadorNoAutorizado,
    verHistorial,

    // documentos
    showDocumentos,
    setShowDocumentos,
    documentosExpediente,
    downloadingId,
    descargarDocumento,
    verDocumentos,

    // util
    calcularTiempoTranscurrido,
  };
}