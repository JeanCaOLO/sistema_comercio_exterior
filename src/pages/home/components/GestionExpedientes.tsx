import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { crearNotificacion, notificarComentario } from '@/lib/notificaciones';
import { useAuth } from '@/contexts/AuthContext';
import { useAutocorrector } from '@/hooks/useAutocorrector';
import { parseDocEntries, type DocEntry } from '@/lib/documentos';
import ModalDocumentosExpediente from '@/pages/home/components/ModalDocumentosExpediente';
import CargandoTablero from './gestion/CargandoTablero';
import FiltrosGestion from './gestion/FiltrosGestion';
import TableroKanban from './gestion/TableroKanban';
import ModalHistorialExpediente from './gestion/ModalHistorialExpediente';
import ModalDetalleExpediente from './gestion/ModalDetalleExpediente';
import ModalConfirmarDevolver from './gestion/ModalConfirmarDevolver';
import { useExpedientesKanban } from './gestion/useExpedientesKanban';
import {
  ESTADOS_DROPSHIP,
  ESTADOS_ZF,
  type Expediente,
  type TipoModulo,
} from './gestion/types';
import {
  calcularDiasHabilesReales,
  calcularTiempoReal,
  validarTransicionDropship,
} from './gestion/utils';
import {
  cargarDocExpediente,
  combinarDocumentosConNuevas,
  devolverTicketADocumentacion,
  enviarCorreoCambioEstado,
  obtenerGruposOriginales,
  registrarTiempoEstado,
  subirArchivosExpediente,
} from './gestion/servicios';

interface GestionExpedientesProps {
  onNuevoExpediente?: () => void;
  refreshTrigger?: number;
  tipoModulo?: TipoModulo;
}

export default function GestionExpedientes({
  refreshTrigger,
  tipoModulo = 'dropship',
}: GestionExpedientesProps) {
  const { perfil } = useAuth();
  const esAdmin = perfil?.roles?.includes('Administrador') ?? false;
  const { corregir } = useAutocorrector();

  const {
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
    rutas,
    recargaSilenciosa,
    fechaInicioTicket,
    calcularTiempoTranscurrido,
    getExpedientesPorEstado,
    limpiarFiltros,
  } = useExpedientesKanban({ tipoModulo, refreshTrigger });

  // ── Estado de interfaz ──
  const [selectedExpediente, setSelectedExpediente] = useState<Expediente | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isAsignarMode, setIsAsignarMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [draggedItem, setDraggedItem] = useState<Expediente | null>(null);

  const [showHistorial, setShowHistorial] = useState(false);
  const [historialData, setHistorialData] = useState<any[]>([]);
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<any>(null);
  const [cargadorNoAutorizado, setCargadorNoAutorizado] = useState(false);

  const [showDocumentos, setShowDocumentos] = useState(false);
  const [documentosExpediente, setDocumentosExpediente] = useState<DocEntry[]>([]);

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [showDevolverConfirm, setShowDevolverConfirm] = useState(false);
  const [devolverGrupos, setDevolverGrupos] = useState<any[]>([]);
  const [devolverCargandoInfo, setDevolverCargandoInfo] = useState(false);

  const tituloModulo =
    tipoModulo === 'dropship' ? 'Gestión de Expedientes Dropship' : 'Gestión de Expedientes ZF';
  const ESTADOS = tipoModulo === 'dropship' ? ESTADOS_DROPSHIP : ESTADOS_ZF;

  const mostrarError = (mensaje: string, duracion = 5000) => {
    setErrorMessage(mensaje);
    setShowError(true);
    setTimeout(() => setShowError(false), duracion);
  };

  const mostrarExito = (duracion = 3000) => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), duracion);
  };

  // ── Documentos ──
  const descargarDocumento = async (url: string, fileName: string) => {
    try {
      setDownloadingId(url);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Error al descargar');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error('Error al descargar documento:', error);
      // Fallback: abrir en nueva pestaña si fetch falla (CORS, auth, etc.)
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  };

  const verDocumentos = async (expediente: any) => {
    try {
      let doc = expediente.doc;
      if (doc === undefined) {
        doc = await cargarDocExpediente(expediente.id);
      }
      setDocumentosExpediente(parseDocEntries(doc));
      setExpedienteSeleccionado(expediente);
      setShowDocumentos(true);
    } catch (error) {
      console.error('Error al procesar documentos:', error);
      setDocumentosExpediente([]);
      setExpedienteSeleccionado(expediente);
      setShowDocumentos(true);
    }
  };

  const verHistorial = async (expediente: any) => {
    try {
      const { data, error } = await supabase
        .from('expedientes_historial')
        .select('*')
        .eq('expediente_id', expediente.id)
        .order('fecha_cambio', { ascending: false });

      if (error) throw error;

      setHistorialData(data || []);
      setExpedienteSeleccionado(expediente);
      setShowHistorial(true);

      // Verificar si el cargador original está autorizado (por email o rol administrador)
      const cargador = expediente.cargador_documentos || expediente.solicitante || '';
      if (!cargador) {
        setCargadorNoAutorizado(true);
        return;
      }

      const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('id, email')
        .eq('nombre', cargador)
        .maybeSingle();

      if (!usuarioData?.email) {
        setCargadorNoAutorizado(true);
        return;
      }

      const email = usuarioData.email.toLowerCase();
      const esListaBlanca = ['lchavala', 'smcdonald', 'mpaniagua'].some(
        (u) => email.startsWith(u.toLowerCase() + '@') || email === u.toLowerCase()
      );

      let esAdministrador = false;
      if (usuarioData.id) {
        const { data: rolesData } = await supabase
          .from('usuario_roles')
          .select('roles!inner(nombre)')
          .eq('usuario_id', usuarioData.id);
        esAdministrador = (rolesData || []).some(
          (r: any) => r.roles?.nombre === 'Administrador'
        );
      }

      setCargadorNoAutorizado(!(esListaBlanca || esAdministrador));
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  };

  // ── Modal de detalle ──
  const abrirModal = (expediente: Expediente) => {
    setSelectedExpediente(expediente);
    setShowModal(true);
    setEditMode(false);
    setUploadedFiles([]);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setSelectedExpediente(null);
    setEditMode(false);
    setIsAsignarMode(false);
    setUploadedFiles([]);
  };

  const handleEdit = (expediente?: Expediente) => {
    if (expediente) {
      setSelectedExpediente(expediente);
      setShowModal(true);
    }
    setEditMode(true);
  };

  const handleDelete = async (expedienteId: string) => {
    if (!confirm('¿Está seguro de eliminar este expediente?')) return;

    try {
      const { error } = await supabase.from('expedientes').delete().eq('id', expedienteId);
      if (error) throw error;

      mostrarExito();
      await recargaSilenciosa();
      cerrarModal();
    } catch (error) {
      console.error('Error al eliminar expediente:', error);
      mostrarError('Error al eliminar el expediente', 3000);
    }
  };

  const handleChange = (field: string, value: any) => {
    setSelectedExpediente((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  // Aplica la misma regla de retroceso de Dropship al selector de Estado del modal.
  // Compara contra el estado original guardado en la base.
  const handleEstadoChange = (nuevoEstado: string) => {
    if (!selectedExpediente) return;

    const expedienteOriginal = expedientes.find((e) => e.id === selectedExpediente.id);
    const estadoAnterior =
      expedienteOriginal?.estado_expediente ?? selectedExpediente.estado_expediente;

    if (tipoModulo === 'dropship') {
      const errorTransicion = validarTransicionDropship(estadoAnterior, nuevoEstado);
      if (errorTransicion) {
        mostrarError(errorTransicion);
        return;
      }
    }

    handleChange('estado_expediente', nuevoEstado);
  };

  // ── Archivos ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const validFiles = files.filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'xlsx', 'xls', 'xlsm', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(
        extension || ''
      );
    });

    if (validFiles.length !== files.length) {
      mostrarError(
        'Solo se permiten archivos PDF, Excel (.xlsx, .xls, .xlsm), CSV e imágenes (PNG, JPG, JPEG, WebP, GIF, BMP)',
        3000
      );
    }

    setUploadedFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Guardar cambios ──
  const guardarCambios = async () => {
    if (!selectedExpediente) return;

    setSaving(true);
    setUploadingFiles(uploadedFiles.length > 0);

    try {
      const expedienteOriginal = expedientes.find((e) => e.id === selectedExpediente.id);
      if (!expedienteOriginal) {
        throw new Error('Expediente original no encontrado');
      }

      // Obtener usuario actual
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let nombreUsuario = 'Sistema';
      let emailUsuario = '';

      if (user) {
        emailUsuario = user.email || '';
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('email', user.email)
          .single();
        if (usuario) nombreUsuario = usuario.nombre;
      }

      const updates: any = {
        po_tiquetera: selectedExpediente.po_tiquetera,
        tipo_po: selectedExpediente.tipo_po,
        prioridad: selectedExpediente.prioridad,
        prioridad_urgente: selectedExpediente.prioridad_urgente,
        motivo_urgencia: selectedExpediente.prioridad_urgente
          ? selectedExpediente.motivo_urgencia
          : null,
        dificultad: selectedExpediente.dificultad,
        tiempo_minutos: selectedExpediente.tiempo_minutos,
        dias_entrega: selectedExpediente.dias_entrega,
        exp_id: selectedExpediente.exp_id,
        lineas_oc: selectedExpediente.lineas_oc,
        estado_expediente: selectedExpediente.estado_expediente,
        motivo_revision:
          selectedExpediente.estado_expediente === 'En Revisión'
            ? selectedExpediente.motivo_revision
            : null,
        responsable_creacion: selectedExpediente.responsable_creacion,
        instrucciones_adicionales: selectedExpediente.instrucciones_adicionales,
        usuario_modificador: emailUsuario,
        transito_corto: selectedExpediente.transito_corto ?? false,
        ok_pais:
          tipoModulo === 'dropship' ? (selectedExpediente.ok_pais ?? false) : false,
        bl_cargado: selectedExpediente.bl_cargado ?? false,
        packing_list_cargado: selectedExpediente.packing_list_cargado ?? false,
        aplica_tlc: selectedExpediente.aplica_tlc ?? false,
        incidente:
          tipoModulo === 'dropship' ? (selectedExpediente.incidente ?? false) : false,
        comentario_incidente:
          tipoModulo === 'dropship' && selectedExpediente.incidente
            ? selectedExpediente.comentario_incidente || null
            : null,
        finiquito:
          tipoModulo === 'dropship' ? (selectedExpediente.finiquito ?? false) : false,
        mcg: tipoModulo === 'dropship' ? (selectedExpediente.mcg ?? false) : false,
        etd: tipoModulo === 'dropship' ? selectedExpediente.etd || null : null,
        eta_real: selectedExpediente.eta_real || null,
        recibo_delzof_fecha:
          tipoModulo === 'zf' ? selectedExpediente.recibo_delzof_fecha || null : null,
        recibo_delzof_numero:
          tipoModulo === 'zf' ? selectedExpediente.recibo_delzof_numero?.trim() || null : null,
      };

      // Documentos: detectar si se agregaron archivos nuevos
      let docsAgregados = false;
      let countDocsNuevos = 0;

      if (uploadedFiles.length > 0) {
        try {
          const nuevasUrls = await subirArchivosExpediente(
            selectedExpediente.id,
            uploadedFiles
          );

          // Cargar `doc` bajo demanda si no vino en la carga inicial
          let docActual = selectedExpediente.doc;
          if (docActual === undefined) {
            docActual = await cargarDocExpediente(selectedExpediente.id);
          }

          updates.doc = combinarDocumentosConNuevas(docActual, nuevasUrls);
          docsAgregados = true;
          countDocsNuevos = nuevasUrls.length;
        } catch (uploadError: any) {
          console.error('❌ Error al subir archivos:', uploadError);
          mostrarError(uploadError?.message || 'Error al subir los archivos. Intente nuevamente.');
          setSaving(false);
          setUploadingFiles(false);
          return;
        }
      }

      // Registrar cambios en historial
      const camposAComparar = [
        { key: 'po_tiquetera', label: 'PO/Tiquetera' },
        { key: 'tipo_po', label: 'Ruta Logística' },
        { key: 'prioridad', label: 'Prioridad' },
        { key: 'prioridad_urgente', label: 'Prioridad Urgente' },
        { key: 'motivo_urgencia', label: 'Motivo de Urgencia' },
        { key: 'dificultad', label: 'Dificultad' },
        { key: 'tiempo_minutos', label: 'Tiempo Minutos' },
        { key: 'dias_entrega', label: 'Días de Entrega' },
        { key: 'exp_id', label: 'EXP ID' },
        { key: 'lineas_oc', label: 'Líneas OC' },
        { key: 'estado_expediente', label: 'Estado' },
        { key: 'motivo_revision', label: 'Motivo de Revisión' },
        { key: 'responsable_creacion', label: 'Responsable Creación' },
        { key: 'instrucciones_adicionales', label: 'Observaciones' },
        { key: 'transito_corto', label: 'Tránsito Corto' },
        { key: 'ok_pais', label: 'OK País' },
        { key: 'bl_cargado', label: 'BL Cargado' },
        { key: 'packing_list_cargado', label: 'Packing List Cargado' },
        { key: 'aplica_tlc', label: 'Aplica TLC' },
        { key: 'incidente', label: 'Incidente' },
        { key: 'comentario_incidente', label: 'Comentario Incidente' },
        { key: 'finiquito', label: 'Finiquito' },
        { key: 'mcg', label: 'MCG' },
        { key: 'etd', label: 'ETD' },
        { key: 'eta_real', label: 'ETA Real' },
        { key: 'recibo_delzof_fecha', label: 'Fecha Recibo Delzof' },
        { key: 'recibo_delzof_numero', label: 'N° Recibo Delzof' },
      ];

      for (const campo of camposAComparar) {
        const valorAnterior = expedienteOriginal[campo.key as keyof Expediente];
        const valorNuevo = selectedExpediente[campo.key as keyof Expediente];

        if (valorAnterior !== valorNuevo) {
          await supabase.from('expedientes_historial').insert([
            {
              expediente_id: selectedExpediente.id,
              campo_modificado: campo.label,
              valor_anterior: String(valorAnterior || ''),
              valor_nuevo: String(valorNuevo || ''),
              usuario: nombreUsuario,
              usuario_email: emailUsuario,
              fecha_cambio: new Date().toISOString(),
            },
          ]);
        }
      }

      if (docsAgregados && countDocsNuevos > 0) {
        await supabase.from('expedientes_historial').insert([
          {
            expediente_id: selectedExpediente.id,
            campo_modificado: 'Documentos',
            valor_anterior: '',
            valor_nuevo: `Se agregaron ${countDocsNuevos} documento(s)`,
            usuario: nombreUsuario,
            usuario_email: emailUsuario,
            fecha_cambio: new Date().toISOString(),
          },
        ]);
      }

      // Estado final según el módulo
      const estadoFinal =
        selectedExpediente.tipo_modulo === 'dropship' ? 'Notificado' : 'Completado';
      const estadoNuevo = selectedExpediente.estado_expediente;
      const estadoAnterior = expedienteOriginal.estado_expediente;

      if (estadoNuevo === estadoFinal && estadoAnterior !== estadoFinal) {
        const fechaInicio = fechaInicioTicket(selectedExpediente);
        const fechaFinalizacion = new Date().toISOString();

        updates.fecha_liberacion = fechaFinalizacion;
        updates.tiempo_real_minutos = calcularTiempoReal(fechaInicio, fechaFinalizacion);
        updates.dias_entrega_real = calcularDiasHabilesReales(fechaInicio, fechaFinalizacion);
      }

      const hoy = new Date().toISOString();

      // Dropship: fechas de Visto Listo y Notificado
      if (
        selectedExpediente.tipo_modulo === 'dropship' &&
        estadoNuevo === 'Visto Listo' &&
        estadoAnterior !== 'Visto Listo'
      ) {
        updates.fecha_liberacion = hoy;
        updates.fecha_visto_listo = hoy;
      }

      if (
        selectedExpediente.tipo_modulo === 'dropship' &&
        estadoNuevo === 'Notificado' &&
        estadoAnterior !== 'Notificado'
      ) {
        updates.fecha_notificado = hoy;
      }

      const { error } = await supabase
        .from('expedientes')
        .update(updates)
        .eq('id', selectedExpediente.id);

      if (error) throw error;

      // Notificación si se agregaron documentos
      if (docsAgregados && countDocsNuevos > 0) {
        crearNotificacion({
          poTiquetera: selectedExpediente.po_tiquetera,
          solicitante: selectedExpediente.solicitante || '',
          responsable: selectedExpediente.responsable_creacion || '',
          usuarioGenero: nombreUsuario,
          tipo: 'documento_agregado',
          mensaje: `${nombreUsuario} agregó ${countDocsNuevos} documento(s) al expediente ${selectedExpediente.po_tiquetera} (${selectedExpediente.exp_id})`,
          icono: 'ri-file-add-line',
          expedienteId: selectedExpediente.id,
        });
      }

      // Notificación de comentario
      const comentarioAnterior = (expedienteOriginal.instrucciones_adicionales || '').trim();
      const comentarioNuevo = (selectedExpediente.instrucciones_adicionales || '').trim();
      if (comentarioNuevo && comentarioNuevo !== comentarioAnterior) {
        notificarComentario({
          poTiquetera: selectedExpediente.po_tiquetera,
          solicitante: selectedExpediente.solicitante || '',
          responsable: selectedExpediente.responsable_creacion || '',
          usuarioGenero: nombreUsuario,
          expedienteId: selectedExpediente.id,
          textoComentario: comentarioNuevo,
        });
      }

      // Si cambió el estado, registrar tiempo y enviar correo
      if (estadoAnterior && estadoNuevo && estadoAnterior !== estadoNuevo) {
        await registrarTiempoEstado(selectedExpediente.id, estadoAnterior, estadoNuevo);
        await enviarCorreoCambioEstado(
          selectedExpediente,
          estadoAnterior,
          estadoNuevo,
          tipoModulo
        );
      }

      // Actualizar el expediente en el estado local al instante
      setExpedientes((prev) =>
        prev.map((exp) => (exp.id === selectedExpediente.id ? { ...exp, ...updates } : exp))
      );

      mostrarExito();
      setEditMode(false);
      setIsAsignarMode(false);
      cerrarModal();
      // Recarga silenciosa en background — no bloquea la UI
      recargaSilenciosa();
    } catch (error: any) {
      console.error('❌ Error al guardar cambios:', error);
      mostrarError(error.message || 'Error al guardar los cambios');
    } finally {
      setSaving(false);
      setUploadingFiles(false);
    }
  };

  // ── Arrastrar y soltar en el kanban ──
  const handleDragStart = (e: React.DragEvent, expediente: Expediente) => {
    setDraggedItem(expediente);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, nuevoEstado: string) => {
    e.preventDefault();

    if (!draggedItem || draggedItem.estado_expediente === nuevoEstado) {
      setDraggedItem(null);
      return;
    }

    // ── Regla Dropship: avance uno a uno y sin retrocesos (salvo excepciones) ──
    if (tipoModulo === 'dropship') {
      const errorTransicion = validarTransicionDropship(
        draggedItem.estado_expediente,
        nuevoEstado
      );
      if (errorTransicion) {
        mostrarError(errorTransicion);
        setDraggedItem(null);
        return;
      }
    }

    // Caso especial: No Asignado → Asignado abre modal para completar campos
    if (draggedItem.estado_expediente === 'No Asignado' && nuevoEstado === 'Asignado') {
      // Validar que tenga BL cargado y documentos
      if (draggedItem.bl_cargado !== true) {
        mostrarError(
          'No se puede asignar este expediente: debe tener el BL cargado (marcado en el módulo CAA o desde edición).'
        );
        setDraggedItem(null);
        return;
      }

      // Cargar `doc` bajo demanda para validar que tenga documentos
      let docActual = draggedItem.doc;
      if (docActual === undefined) {
        docActual = await cargarDocExpediente(draggedItem.id);
      }

      let tieneDocs = false;
      if (docActual) {
        if (Array.isArray(docActual)) {
          tieneDocs = docActual.length > 0;
        } else if (typeof docActual === 'string') {
          const trimmed = docActual.trim();
          tieneDocs = trimmed.length > 2 && trimmed !== '[]';
        }
      }

      if (!tieneDocs) {
        mostrarError(
          'No se puede asignar este expediente: debe tener al menos un documento adjunto.'
        );
        setDraggedItem(null);
        return;
      }

      setSelectedExpediente({ ...draggedItem, doc: docActual, estado_expediente: 'Asignado' });
      setEditMode(true);
      setIsAsignarMode(true);
      setShowModal(true);
      setDraggedItem(null);
      return;
    }

    try {
      const estadoAnterior = draggedItem.estado_expediente;

      // Obtener usuario actual
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let nombreUsuario = 'Sistema';
      let emailUsuario = '';

      if (user) {
        emailUsuario = user.email || '';
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('email', user.email)
          .single();
        if (usuario) nombreUsuario = usuario.nombre;
      }

      const updates: any = {
        estado_expediente: nuevoEstado,
        updated_at: new Date().toISOString(),
        usuario_modificador: emailUsuario,
      };

      const estadoFinal = draggedItem.tipo_modulo === 'dropship' ? 'Notificado' : 'Completado';

      if (nuevoEstado === estadoFinal) {
        const fechaInicio = fechaInicioTicket(draggedItem);
        const fechaFinalizacion = new Date().toISOString();

        updates.fecha_liberacion = fechaFinalizacion;
        updates.tiempo_real_minutos = calcularTiempoReal(fechaInicio, fechaFinalizacion);
        updates.dias_entrega_real = calcularDiasHabilesReales(fechaInicio, fechaFinalizacion);
      }

      const hoy = new Date().toISOString();

      if (draggedItem.tipo_modulo === 'dropship' && nuevoEstado === 'Visto Listo') {
        updates.fecha_liberacion = hoy;
        updates.fecha_visto_listo = hoy;
      }

      if (draggedItem.tipo_modulo === 'dropship' && nuevoEstado === 'Notificado') {
        updates.fecha_notificado = hoy;
      }

      const { error } = await supabase
        .from('expedientes')
        .update(updates)
        .eq('id', draggedItem.id);

      if (error) throw error;

      await supabase.from('expedientes_historial').insert([
        {
          expediente_id: draggedItem.id,
          campo_modificado: 'Estado',
          valor_anterior: estadoAnterior,
          valor_nuevo: nuevoEstado,
          usuario: nombreUsuario,
          usuario_email: emailUsuario,
          fecha_cambio: hoy,
        },
      ]);

      await registrarTiempoEstado(draggedItem.id, estadoAnterior, nuevoEstado);
      await enviarCorreoCambioEstado(draggedItem, estadoAnterior, nuevoEstado, tipoModulo);

      setExpedientes((prev) =>
        prev.map((exp) => (exp.id === draggedItem.id ? { ...exp, ...updates } : exp))
      );

      mostrarExito(2000);
      recargaSilenciosa();
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      mostrarError('Error al actualizar el estado del expediente', 3000);
    } finally {
      setDraggedItem(null);
    }
  };

  // ── Devolver a Documentación ──
  const abrirConfirmacionDevolver = async (expediente: Expediente) => {
    setShowDevolverConfirm(true);
    setDevolverGrupos([]);
    setDevolverCargandoInfo(true);
    const grupos = await obtenerGruposOriginales(expediente);
    setDevolverGrupos(grupos);
    setDevolverCargandoInfo(false);
  };

  const devolverADocumentacion = async (expediente: Expediente) => {
    try {
      setSaving(true);
      await devolverTicketADocumentacion(expediente);

      // Actualizar estado local al instante
      setExpedientes((prev) => prev.filter((e) => e.id !== expediente.id));

      setShowDevolverConfirm(false);
      mostrarExito();
      cerrarModal();
    } catch (error: any) {
      console.error('Error al devolver a Documentación:', error);
      mostrarError(error.message || 'Error al devolver el ticket a Documentación.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CargandoTablero tipoModulo={tipoModulo} titulo={tituloModulo} />;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{tituloModulo}</h1>
          <p className="text-gray-500 mt-2">Administra y da seguimiento a todos los expedientes</p>
        </div>
        {tipoModulo !== 'dropship' && (
          <button
            type="button"
            onClick={() => {
              const event = new CustomEvent('openFormularioExpediente', { detail: { tipoModulo } });
              window.dispatchEvent(event);
            }}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
          >
            <i className="ri-add-line text-xl"></i>
            Nuevo Expediente
          </button>
        )}
      </div>

      {showSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <i className="ri-checkbox-circle-line text-green-600 text-xl"></i>
          <p className="text-green-800 font-semibold text-sm">¡Operación exitosa!</p>
        </div>
      )}

      {showError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
          <i className="ri-error-warning-line text-red-600 text-xl"></i>
          <p className="text-red-800 font-semibold text-sm">
            {errorMessage || 'Error al realizar la operación'}
          </p>
        </div>
      )}

      <FiltrosGestion
        tipoModulo={tipoModulo}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterPersona={filterPersona}
        onPersonaChange={setFilterPersona}
        filterPrioridad={filterPrioridad}
        onPrioridadChange={setFilterPrioridad}
        filterRutas={filterRutas}
        onRutasChange={setFilterRutas}
        todasPersonas={todasPersonas}
        rutas={rutas}
        totalResultados={filteredExpedientes.length}
        onLimpiar={limpiarFiltros}
      />

      <TableroKanban
        estados={ESTADOS}
        searchTerm={searchTerm}
        getExpedientesPorEstado={getExpedientesPorEstado}
        calcularTiempoTranscurrido={calcularTiempoTranscurrido}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragStart={handleDragStart}
        onAbrir={abrirModal}
        onHistorial={verHistorial}
        onDocumentos={verDocumentos}
      />

      <ModalHistorialExpediente
        show={showHistorial}
        onClose={() => setShowHistorial(false)}
        expediente={expedienteSeleccionado}
        historialData={historialData}
        cargadorNoAutorizado={cargadorNoAutorizado}
      />

      <ModalDocumentosExpediente
        show={showDocumentos}
        onClose={() => setShowDocumentos(false)}
        poTiquetera={expedienteSeleccionado?.po_tiquetera}
        expId={expedienteSeleccionado?.exp_id}
        documentos={documentosExpediente}
        downloadingId={downloadingId}
        onDescargar={descargarDocumento}
      />

      <ModalDetalleExpediente
        show={showModal}
        expediente={selectedExpediente}
        editMode={editMode}
        isAsignarMode={isAsignarMode}
        estados={ESTADOS}
        rutas={rutas}
        responsables={responsables}
        saving={saving}
        uploadingFiles={uploadingFiles}
        uploadedFiles={uploadedFiles}
        esAdmin={esAdmin}
        corregir={corregir}
        onClose={cerrarModal}
        onChange={handleChange}
        onEstadoChange={handleEstadoChange}
        onEdit={() => handleEdit()}
        onDelete={handleDelete}
        onGuardar={guardarCambios}
        onCancelarEdicion={() => {
          setEditMode(false);
          setUploadedFiles([]);
        }}
        onFileChange={handleFileChange}
        onRemoveFile={removeFile}
        onDevolver={() => {
          if (selectedExpediente) abrirConfirmacionDevolver(selectedExpediente);
        }}
      />

      <ModalConfirmarDevolver
        show={showDevolverConfirm}
        expediente={selectedExpediente}
        grupos={devolverGrupos}
        cargandoInfo={devolverCargandoInfo}
        saving={saving}
        onClose={() => setShowDevolverConfirm(false)}
        onConfirmar={() => {
          if (selectedExpediente) devolverADocumentacion(selectedExpediente);
        }}
      />
    </div>
  );
}