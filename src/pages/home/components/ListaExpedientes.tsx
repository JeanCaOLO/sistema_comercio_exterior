import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface Expediente {
  id: string;
  po_tiquetera: string;
  tipo_po: string;
  solicitante: string;
  fecha_solicitud: string;
  prioridad: string;
  prioridad_urgente: boolean;
  motivo_urgencia: string | null;
  dificultad: string;
  tiempo_minutos: number;
  dias_entrega: number;
  fecha_requerimiento: string;
  exp_id: string;
  doc: string | string[] | null;
  lineas_oc: number;
  fecha_creacion_expediente: string;
  estado_expediente: string;
  motivo_revision: string | null;
  responsable_creacion: string;
  instrucciones_adicionales: string | null;
  created_at: string;
  fecha_apertura?: string;
  fecha_liberacion?: string;
  tiempo_real_minutos?: number;
  dias_entrega_real?: number;
  tipo_modulo?: 'dropship' | 'zf';
  bl_cargado?: boolean;
}

// Estados combinados de ambos módulos
const ESTADOS_DROPSHIP = ['Asignado', 'En Proceso', 'Espera de Respuesta', 'Liberación', 'Recepción de Carga', 'Facturación', 'Notificado'];
const ESTADOS_ZF = ['Asignado', 'En Proceso', 'Espera de Respuesta', 'Completado', 'Liberación'];
const TODOS_ESTADOS = Array.from(new Set([...ESTADOS_DROPSHIP, ...ESTADOS_ZF])).sort();

export default function ListaExpedientes() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [filteredExpedientes, setFilteredExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPersona, setFilterPersona] = useState('Todos');
  const [filterPrioridad, setFilterPrioridad] = useState('Todos');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterTipoModulo, setFilterTipoModulo] = useState('Todos');
  const [selectedExpediente, setSelectedExpediente] = useState<Expediente | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [todasPersonas, setTodasPersonas] = useState<string[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [historialData, setHistorialData] = useState<any[]>([]);
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<any>(null);
  const [showDocumentos, setShowDocumentos] = useState(false);
  const [documentosExpediente, setDocumentosExpediente] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Nuevos estados para edición
  const [editMode, setEditMode] = useState(false);
  const [solicitantes, setSolicitantes] = useState<string[]>([]);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [usuarioActual, setUsuarioActual] = useState<string>('Sistema');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  useEffect(() => {
    cargarExpedientes();
    cargarUsuarios();
    obtenerUsuarioActual();
  }, []);

  useEffect(() => {
    filtrarExpedientes();
  }, [searchTerm, filterPersona, filterPrioridad, filterEstado, filterTipoModulo, expedientes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const obtenerUsuarioActual = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('email', user.email)
          .single();
        
        if (usuario) {
          setUsuarioActual(usuario.nombre);
        }
      }
    } catch (error) {
      console.error('Error al obtener usuario actual:', error);
    }
  };

  const cargarUsuarios = async () => {
    try {
      const { data: usuarios, error } = await supabase
        .from('usuarios')
        .select('nombre, rol, email')
        .eq('estado', 'Activo')
        .order('nombre');

      if (error) throw error;

      if (usuarios && usuarios.length > 0) {
        const todosSolicitantes = usuarios.map(u => u.nombre);
        const todosResponsables = usuarios.filter(u => u.rol === 'Gestor' || u.rol === 'Administrador').map(u => u.nombre);
        
        setSolicitantes(todosSolicitantes);
        setResponsables(todosResponsables.length > 0 ? todosResponsables : todosSolicitantes);
        
        const personasUnicas = Array.from(new Set([...todosSolicitantes, ...todosResponsables]));
        setTodasPersonas(personasUnicas);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const cargarExpedientes = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando TODOS los expedientes en segundo plano...');
      
      // CAMBIO: Cargar TODOS los expedientes sin límite (ambos módulos)
      const { data, error } = await supabase
        .from('expedientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error en la consulta:', error);
        throw error;
      }
      
      console.log('✅ Total expedientes cargados:', data?.length || 0);
      console.log('📊 Expedientes Dropship:', data?.filter(e => e.tipo_modulo === 'dropship').length || 0);
      console.log('📊 Expedientes ZF:', data?.filter(e => e.tipo_modulo === 'zf').length || 0);
      
      // Guardar TODOS los expedientes
      setExpedientes(data || []);
      
      // Mostrar solo los últimos 100 inicialmente
      const ultimos100 = (data || []).slice(0, 100);
      console.log('📊 Mostrando inicialmente:', ultimos100.length, 'expedientes');
      setFilteredExpedientes(ultimos100);
    } catch (error) {
      console.error('❌ Error al cargar expedientes:', error);
      setExpedientes([]);
      setFilteredExpedientes([]);
    } finally {
      setLoading(false);
    }
  };

  const filtrarExpedientes = () => {
    let filtered = [...expedientes];

    console.log('🔍 Iniciando filtrado...');
    console.log('📊 Total de expedientes en memoria:', expedientes.length);
    console.log('🔎 Filtros activos:', { searchTerm, filterPersona, filterPrioridad, filterEstado, filterTipoModulo });

    // Verificar si hay filtros activos
    const hayFiltrosActivos = searchTerm !== '' || filterPersona !== 'Todos' || filterPrioridad !== 'Todos' || filterEstado !== 'Todos' || filterTipoModulo !== 'Todos';

    // Si NO hay filtros, mostrar solo los últimos 100
    if (!hayFiltrosActivos) {
      const ultimos100 = filtered.slice(0, 100);
      console.log('📋 Sin filtros - Mostrando últimos 100 expedientes');
      setFilteredExpedientes(ultimos100);
      return;
    }

    // Si HAY filtros, aplicarlos sobre TODOS los expedientes
    console.log('🔍 Filtros activos - Buscando en todos los expedientes');

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(exp => 
        exp.po_tiquetera.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.exp_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.solicitante.toLowerCase().includes(searchTerm.toLowerCase())
      );
      console.log('🔎 Después de búsqueda:', filtered.length);
    }

    // Filtrar por persona (solicitante O responsable)
    if (filterPersona !== 'Todos') {
      filtered = filtered.filter(exp => 
        exp.solicitante === filterPersona || exp.responsable_creacion === filterPersona
      );
      console.log('👤 Después de filtro persona:', filtered.length);
    }

    // Filtrar por prioridad
    if (filterPrioridad !== 'Todos') {
      if (filterPrioridad === 'Urgente') {
        filtered = filtered.filter(exp => exp.prioridad_urgente === true);
      } else {
        filtered = filtered.filter(exp => exp.prioridad === filterPrioridad && exp.prioridad_urgente !== true);
      }
      console.log('⚡ Después de filtro prioridad:', filtered.length);
    }

    // Filtrar por estado
    if (filterEstado !== 'Todos') {
      filtered = filtered.filter(exp => exp.estado_expediente === filterEstado);
      console.log('📌 Después de filtro estado:', filtered.length);
    }

    // Filtrar por tipo de módulo
    if (filterTipoModulo !== 'Todos') {
      filtered = filtered.filter(exp => exp.tipo_modulo === filterTipoModulo);
      console.log('📦 Después de filtro tipo módulo:', filtered.length);
    }

    console.log('✅ Expedientes filtrados finales:', filtered.length);
    console.log('📋 IDs de expedientes filtrados:', filtered.map(e => ({ po: e.po_tiquetera, exp: e.exp_id, tipo: e.tipo_modulo })));

    setFilteredExpedientes(filtered);
  };

  const calcularTiempoTranscurrido = (expediente: Expediente): { minutos: number; dias: number } => {
    // Determinar el estado final según el tipo de módulo
    const estadoFinal = expediente.tipo_modulo === 'dropship' ? 'Notificado' : 'Liberación';
    
    // Si está en el estado final, usar el tiempo ya calculado
    if (expediente.estado_expediente === estadoFinal && expediente.tiempo_real_minutos && expediente.dias_entrega_real) {
      return {
        minutos: expediente.tiempo_real_minutos,
        dias: expediente.dias_entrega_real
      };
    }

    const fechaInicio = new Date(expediente.created_at);
    const fechaFin = currentTime;
    
    const diffMs = fechaFin.getTime() - fechaInicio.getTime();
    const minutos = Math.max(0, Math.round(diffMs / (1000 * 60)));
    
    const dias = calcularDiasHabilesReales(expediente.created_at, fechaFin.toISOString());
    
    return { minutos, dias };
  };

  const calcularTiempoReal = (fechaInicio: string, fechaFin: string): number => {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const diffMs = fin.getTime() - inicio.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60)));
  };

  const registrarTiempoEstado = async (expedienteId: string, estadoAnterior: string, estadoNuevo: string) => {
    try {
      const ahora = new Date().toISOString();
      // Cerrar el registro abierto del estado anterior
      const { data: registroAbierto } = await supabase
        .from('expedientes_tiempos_estados')
        .select('*')
        .eq('expediente_id', expedienteId)
        .eq('estado_nuevo', estadoAnterior)
        .is('fecha_fin', null)
        .order('fecha_inicio', { ascending: false })
        .limit(1);

      if (registroAbierto && registroAbierto.length > 0) {
        const registro = registroAbierto[0];
        const fechaInicio = new Date(registro.fecha_inicio);
        const fechaFin = new Date(ahora);
        const minutosTranscurridos = Math.round((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60));
        await supabase
          .from('expedientes_tiempos_estados')
          .update({ fecha_fin: ahora, minutos_transcurridos: minutosTranscurridos })
          .eq('id', registro.id);
      }
      // Abrir nuevo registro para el estado nuevo
      await supabase.from('expedientes_tiempos_estados').insert([{
        expediente_id: expedienteId,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        fecha_inicio: ahora,
        fecha_fin: null,
        minutos_transcurridos: null
      }]);
    } catch (error) {
      console.error('Error al registrar tiempo de estado:', error);
    }
  };

  const calcularDiasHabilesReales = (fechaApertura: string, fechaLiberacion: string): number => {
    const inicio = new Date(fechaApertura);
    const fin = new Date(fechaLiberacion);
    let dias = 0;
    let fecha = new Date(inicio);

    while (fecha <= fin) {
      const diaSemana = fecha.getDay();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getDate()).padStart(2, '0');
      const fechaStr = `${mes}-${dia}`;
      
      const FERIADOS = ['01-01', '04-02', '04-03', '04-11', '05-01', '07-25', '08-02', '09-15', '12-01', '12-25'];
      
      if (diaSemana !== 0 && diaSemana !== 6 && !FERIADOS.includes(fechaStr)) {
        dias++;
      }
      
      fecha.setDate(fecha.getDate() + 1);
    }
    
    return Math.max(0, dias);
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
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  };

  const verDocumentos = (expediente: any) => {
    try {
      let docs: string[] = [];
      
      if (expediente.doc) {
        if (Array.isArray(expediente.doc)) {
          docs = expediente.doc.filter((url: any) => typeof url === 'string' && url.trim() !== '');
        } else if (typeof expediente.doc === 'string') {
          const docTrimmed = expediente.doc.trim();
          if (docTrimmed.startsWith('[') || docTrimmed.startsWith('{')) {
            try {
              const parsed = JSON.parse(docTrimmed);
              docs = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              docs = [docTrimmed];
            }
          } else if (docTrimmed !== '') {
            docs = [docTrimmed];
          }
        }
      }
      
      setDocumentosExpediente(docs);
      setExpedienteSeleccionado(expediente);
      setShowDocumentos(true);
    } catch (error) {
      console.error('Error al procesar documentos:', error);
      setDocumentosExpediente([]);
      setExpedienteSeleccionado(expediente);
      setShowDocumentos(true);
    }
  };

  const formatearTiempo = (minutos: number): string => {
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas < 24) return `${horas}h ${mins}m`;
    const dias = Math.floor(horas / 24);
    const hrs = horas % 24;
    return `${dias}d ${hrs}h`;
  };

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
    setUploadedFiles([]);
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleDelete = async (expedienteId: string) => {
    if (!confirm('¿Está seguro de eliminar este expediente?')) return;
    
    try {
      const { error } = await supabase
        .from('expedientes')
        .delete()
        .eq('id', expedienteId);

      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      cargarExpedientes();
      cerrarModal();
    } catch (error) {
      console.error('Error al eliminar expediente:', error);
      setErrorMessage('Error al eliminar el expediente');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  const handleChange = (field: string, value: any) => {
    if (selectedExpediente) {
      setSelectedExpediente({
        ...selectedExpediente,
        [field]: value
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(file => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        return ['pdf', 'xlsx', 'xls', 'csv'].includes(extension || '');
      });
      
      if (validFiles.length !== files.length) {
        setErrorMessage('Solo se permiten archivos PDF, Excel (.xlsx, .xls) y CSV');
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
      }
      
      setUploadedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToSupabase = async (expedienteId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    try {
      for (const file of uploadedFiles) {
        const fileName = `${expedienteId}/${Date.now()}_${file.name}`;
        
        const { data, error } = await supabase.storage
          .from('expedientes-documentos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          if (error.message.includes('not found') || error.message.includes('does not exist')) {
            throw new Error('El almacenamiento de documentos no está configurado. Por favor, cree un bucket llamado "expedientes-documentos" en Supabase Storage con acceso público.');
          }
          throw new Error(`Error al subir ${file.name}: ${error.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('expedientes-documentos')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }
    } catch (error: any) {
      throw error;
    }
    
    return uploadedUrls;
  };

  const guardarCambios = async () => {
    if (!selectedExpediente) return;

    setSaving(true);
    setUploadingFiles(uploadedFiles.length > 0);
    
    try {
      const expedienteOriginal = expedientes.find(e => e.id === selectedExpediente.id);
      
      if (!expedienteOriginal) {
        throw new Error('Expediente original no encontrado');
      }

      const { data: { user } } = await supabase.auth.getUser();
      let nombreUsuario = 'Sistema';
      let emailUsuario = '';
      
      if (user) {
        emailUsuario = user.email || '';
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('email', user.email)
          .single();
        
        if (usuario) {
          nombreUsuario = usuario.nombre;
        }
      }

      const updates: any = {
        po_tiquetera: selectedExpediente.po_tiquetera,
        tipo_po: selectedExpediente.tipo_po,
        solicitante: selectedExpediente.solicitante,
        prioridad: selectedExpediente.prioridad,
        prioridad_urgente: selectedExpediente.prioridad_urgente,
        motivo_urgencia: selectedExpediente.prioridad_urgente ? selectedExpediente.motivo_urgencia : null,
        dificultad: selectedExpediente.dificultad,
        tiempo_minutos: selectedExpediente.tiempo_minutos,
        dias_entrega: selectedExpediente.dias_entrega,
        exp_id: selectedExpediente.exp_id,
        lineas_oc: selectedExpediente.lineas_oc,
        estado_expediente: selectedExpediente.estado_expediente,
        motivo_revision: selectedExpediente.estado_expediente === 'En Revisión' ? selectedExpediente.motivo_revision : null,
        responsable_creacion: selectedExpediente.responsable_creacion,
        instrucciones_adicionales: selectedExpediente.instrucciones_adicionales,
        usuario_modificador: emailUsuario,
        bl_cargado: selectedExpediente.bl_cargado ?? false
      };

      if (uploadedFiles.length > 0) {
        try {
          const nuevasUrls = await uploadFilesToSupabase(selectedExpediente.id);
          
          let docsExistentes: string[] = [];
          if (selectedExpediente.doc) {
            if (Array.isArray(selectedExpediente.doc)) {
              docsExistentes = selectedExpediente.doc;
            } else if (typeof selectedExpediente.doc === 'string') {
              try {
                const parsed = JSON.parse(selectedExpediente.doc);
                docsExistentes = Array.isArray(parsed) ? parsed : [parsed];
              } catch {
                docsExistentes = selectedExpediente.doc.trim() !== '' ? [selectedExpediente.doc] : [];
              }
            }
          }
          
          const todosLosDocs = [...docsExistentes, ...nuevasUrls];
          updates.doc = todosLosDocs;
        } catch (uploadError) {
          console.error('Error al subir archivos:', uploadError);
          setErrorMessage('Error al subir los archivos. Por favor, intente nuevamente.');
          setShowError(true);
          setTimeout(() => setShowError(false), 5000);
          setSaving(false);
          setUploadingFiles(false);
          return;
        }
      }

      const camposAComparar = [
        { key: 'po_tiquetera', label: 'PO/Tiquetera' },
        { key: 'tipo_po', label: 'Ruta Logística' },
        { key: 'solicitante', label: 'Solicitante' },
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
        { key: 'instrucciones_adicionales', label: 'Observaciones' }
      ];

      for (const campo of camposAComparar) {
        const valorAnterior = expedienteOriginal[campo.key as keyof Expediente];
        const valorNuevo = selectedExpediente[campo.key as keyof Expediente];
        
        if (valorAnterior !== valorNuevo) {
          await supabase.from('expedientes_historial').insert([{
            expediente_id: selectedExpediente.id,
            campo_modificado: campo.label,
            valor_anterior: String(valorAnterior || ''),
            valor_nuevo: String(valorNuevo || ''),
            usuario: nombreUsuario,
            usuario_email: emailUsuario,
            fecha_cambio: new Date().toISOString()
          }]);
        }
      }

      // Determinar el estado final según el tipo de módulo
      const estadoFinal = selectedExpediente.tipo_modulo === 'dropship' ? 'Notificado' : 'Liberación';
      const estadoNuevo = selectedExpediente.estado_expediente;
      const estadoAnterior = expedienteOriginal.estado_expediente;
      
      if (estadoNuevo === estadoFinal && estadoAnterior !== estadoFinal) {
        const fechaInicio = selectedExpediente.created_at;
        const fechaLiberacion = new Date().toISOString();
        const tiempoRealMinutos = calcularTiempoReal(fechaInicio, fechaLiberacion);
        const diasEntregaReal = calcularDiasHabilesReales(fechaInicio, fechaLiberacion);
        
        updates.fecha_liberacion = fechaLiberacion;
        updates.tiempo_real_minutos = tiempoRealMinutos;
        updates.dias_entrega_real = diasEntregaReal;
      }

      const { error } = await supabase
        .from('expedientes')
        .update(updates)
        .eq('id', selectedExpediente.id);

      if (error) throw error;

      // Registrar tiempo si cambió el estado
      if (estadoAnterior && estadoNuevo && estadoAnterior !== estadoNuevo) {
        await registrarTiempoEstado(selectedExpediente.id, estadoAnterior, estadoNuevo);
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setEditMode(false);
      cerrarModal();
      cargarExpedientes();
    } catch (error: any) {
      console.error('Error al guardar cambios:', error);
      setErrorMessage(error.message || 'Error al guardar los cambios');
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setSaving(false);
      setUploadingFiles(false);
    }
  };

  const getPrioridadColor = (prioridad: string, urgente: boolean) => {
    if (urgente) return 'bg-red-100 text-red-800 border-red-200';
    switch (prioridad) {
      case 'Alta': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Media': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Baja': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Asignado': return 'bg-purple-500 text-white';
      case 'En Proceso': return 'bg-orange-500 text-white';
      case 'Espera de Respuesta': return 'bg-yellow-500 text-white';
      case 'Liberación': return 'bg-green-500 text-white';
      case 'Recepción de Carga': return 'bg-indigo-500 text-white';
      case 'Facturación': return 'bg-pink-500 text-white';
      case 'Notificado': return 'bg-teal-500 text-white';
      case 'Completado': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getDificultadColor = (dificultad: string) => {
    switch (dificultad) {
      case 'Alta': return 'bg-red-100 text-red-800';
      case 'Media': return 'bg-yellow-100 text-yellow-800';
      case 'Baja': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Verificar si hay filtros activos para mostrar el banner
  const hayFiltrosActivos = searchTerm !== '' || filterPersona !== 'Todos' || filterPrioridad !== 'Todos' || filterEstado !== 'Todos' || filterTipoModulo !== 'Todos';

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="relative inline-flex">
            <div className="w-20 h-20 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="ri-file-list-3-line text-3xl text-teal-600"></i>
            </div>
          </div>
          <p className="mt-6 text-gray-700 font-semibold text-lg">Cargando expedientes...</p>
          <p className="mt-2 text-sm text-gray-500">Intenta ajustar los filtros de búsqueda</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Lista de Expedientes</h1>
        <p className="text-gray-500 mt-2">Vista completa de todos los expedientes (Dropship y ZF) ordenados por fecha de creación</p>
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
          <p className="text-red-800 font-semibold text-sm">{errorMessage || 'Error al realizar la operación'}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="PO, EXP ID o Solicitante..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Módulo</label>
            <select
              value={filterTipoModulo}
              onChange={(e) => setFilterTipoModulo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="dropship">Dropship</option>
              <option value="zf">ZF</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Persona Asignada</label>
            <select
              value={filterPersona}
              onChange={(e) => setFilterPersona(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
            >
              <option value="Todos">Todos</option>
              {todasPersonas.map(persona => (
                <option key={persona} value={persona}>{persona}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Prioridad</label>
            <select
              value={filterPrioridad}
              onChange={(e) => setFilterPrioridad(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="Urgente">Urgente</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
            >
              <option value="Todos">Todos</option>
              {(selectedExpediente?.tipo_modulo === 'dropship' ? ESTADOS_DROPSHIP : ESTADOS_ZF).map(estado => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Información de resultados */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Mostrando <span className="font-semibold text-teal-600">{filteredExpedientes.length}</span> de <span className="font-semibold">{expedientes.length}</span> expedientes
            {!hayFiltrosActivos && expedientes.length > 100 && (
              <span className="ml-2 text-gray-500">(últimos 100 sin filtros)</span>
            )}
          </p>
        </div>
      </div>

      {/* Tabla de Expedientes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {!hayFiltrosActivos && expedientes.length > 100 && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <i className="ri-information-line text-lg"></i>
              <span>
                Mostrando los últimos <span className="font-semibold">100 expedientes</span>. 
                Usa los filtros para buscar en todo el historial de <span className="font-semibold">{expedientes.length}</span> expedientes.
              </span>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Tipo</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PO/Tiquetera</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">EXP ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Solicitante</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Responsable</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Prioridad</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Dificultad</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Tiempo</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Fecha Creación</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExpedientes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center">
                    <div className="text-gray-400">
                      <i className="ri-inbox-line text-5xl mb-3"></i>
                      <p className="text-lg font-medium">No se encontraron expedientes</p>
                      <p className="text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpedientes.map((expediente) => {
                  const tiempoTranscurrido = calcularTiempoTranscurrido(expediente);
                  const estadoFinal = expediente.tipo_modulo === 'dropship' ? 'Notificado' : 'Liberación';
                  const esFinalizado = expediente.estado_expediente === estadoFinal;
                  
                  return (
                    <tr 
                      key={expediente.id}
                      onClick={() => abrirModal(expediente)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          expediente.tipo_modulo === 'dropship' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {expediente.tipo_modulo === 'dropship' ? 'Dropship' : 'ZF'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{expediente.po_tiquetera}</div>
                        <div className="text-xs text-gray-500">{expediente.tipo_po}</div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {expediente.exp_id}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {expediente.solicitante}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {expediente.responsable_creacion}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEstadoColor(expediente.estado_expediente)}`}>
                          {expediente.estado_expediente}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPrioridadColor(expediente.prioridad, expediente.prioridad_urgente)}`}>
                          {expediente.prioridad_urgente ? 'URGENTE' : expediente.prioridad}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDificultadColor(expediente.dificultad)}`}>
                          {expediente.dificultad}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-xs">
                          <div className={`font-medium ${esFinalizado ? 'text-green-700' : 'text-blue-700'}`}>
                            ⏱️ {formatearTiempo(tiempoTranscurrido.minutos)}
                          </div>
                          <div className={`${esFinalizado ? 'text-green-600' : 'text-blue-600'}`}>
                            📅 {tiempoTranscurrido.dias} días
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                        {new Date(expediente.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              verHistorial(expediente);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                            title="Ver historial"
                          >
                            <i className="ri-history-line text-base"></i>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              verDocumentos(expediente);
                            }}
                            className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                            title="Ver documentos"
                          >
                            <i className="ri-file-list-line text-base"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Historial */}
      {showHistorial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Historial de Cambios</h3>
                <p className="text-sm text-gray-500 mt-1">
                  PO: {expedienteSeleccionado?.po_tiquetera} | EXP: {expedienteSeleccionado?.exp_id}
                </p>
              </div>
              <button
                onClick={() => setShowHistorial(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {historialData.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No hay cambios registrados</p>
              ) : (
                <div className="space-y-4">
                  {historialData.map((cambio, index) => (
                    <div key={index} className="border-l-4 border-teal-500 pl-4 py-2 bg-gray-50 rounded-r-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {cambio.campo_modificado}
                          </p>
                          <div className="text-xs text-gray-600 mt-1 space-y-1">
                            <div>
                              <span className="font-medium">Anterior:</span>{' '}
                              <span className="text-red-600">{cambio.valor_anterior || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="font-medium">Nuevo:</span>{' '}
                              <span className="text-green-600">{cambio.valor_nuevo}</span>
                            </div>
                          </div>
                          <p className="text-xs text-teal-600 mt-2 font-medium">
                            <i className="ri-user-line mr-1"></i>
                            Modificado por: {cambio.usuario}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 ml-4">
                          {new Date(cambio.fecha_cambio).toLocaleString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Documentos */}
      {showDocumentos && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Documentos del Expediente</h3>
                <p className="text-sm text-gray-500 mt-1">
                  PO: {expedienteSeleccionado?.po_tiquetera} | EXP: {expedienteSeleccionado?.exp_id}
                </p>
              </div>
              <button
                onClick={() => setShowDocumentos(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {documentosExpediente.length === 0 ? (
                <div className="text-center py-12">
                  <i className="ri-file-list-line text-6xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500 text-lg font-medium">No hay documentos adjuntos</p>
                  <p className="text-gray-400 text-sm mt-2">Los documentos que agregues aparecerán aquí</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documentosExpediente.map((url, index) => {
                    let fileName = `Documento ${index + 1}`;
                    try {
                      const urlParts = url.split('/');
                      const lastPart = urlParts[urlParts.length - 1];
                      const fileNameMatch = lastPart.match(/\d+_(.*)/);
                      fileName = fileNameMatch ? fileNameMatch[1] : lastPart;
                    } catch (e) {
                      console.error('Error al extraer nombre de archivo:', e);
                    }
                    
                    const extension = fileName.split('.').pop()?.toLowerCase();
                    let icon = 'ri-file-line';
                    let iconColor = 'text-gray-600';
                    
                    if (extension === 'pdf') {
                      icon = 'ri-file-pdf-line';
                      iconColor = 'text-red-600';
                    } else if (['xlsx', 'xls'].includes(extension || '')) {
                      icon = 'ri-file-excel-line';
                      iconColor = 'text-green-600';
                    } else if (extension === 'csv') {
                      icon = 'ri-file-text-line';
                      iconColor = 'text-blue-600';
                    }
                    
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 flex-shrink-0">
                            <i className={`${icon} text-2xl ${iconColor}`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                            <p className="text-xs text-gray-500">Documento {index + 1}</p>
                          </div>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="ml-3 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <i className="ri-download-line"></i>
                          <span className="text-sm font-medium">Descargar</span>
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalles/Edición */}
      {showModal && selectedExpediente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editMode ? 'Editar Expediente' : 'Detalles del Expediente'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Tipo: <span className={`font-semibold ${selectedExpediente.tipo_modulo === 'dropship' ? 'text-blue-600' : 'text-purple-600'}`}>
                    {selectedExpediente.tipo_modulo === 'dropship' ? 'Dropship' : 'ZF'}
                  </span>
                </p>
              </div>
              <button
                onClick={cerrarModal}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-2xl text-gray-500"></i>
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PO/Tiquetera</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={selectedExpediente.po_tiquetera}
                      onChange={(e) => handleChange('po_tiquetera', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    />
                  ) : (
                    <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">{selectedExpediente.po_tiquetera}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ruta Logística</label>
                  {editMode ? (
                    <select
                      value={selectedExpediente.tipo_po}
                      onChange={(e) => handleChange('tipo_po', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                    >
                      <option value="ZF - OVERSEAS">ZF - OVERSEAS LOGISTICS OPERATIONS</option>
                      <option value="Directo CR - CONSORCIO">Directo CR - CONSORCIO FERRETERO DE SAN JOSE, S.A.</option>
                      <option value="Directo CR - EPA CR">Directo CR - FERRETERIA EPA, S.A.</option>
                      <option value="Directo GT - EPA GT">Directo GT - FERRETERIA EPA, S.A.</option>
                      <option value="Directo SV - EPA SV">Directo SV - FERRETERIA EPA, C.A.</option>
                      <option value="Directo VE - FEBECA">Directo VE - FEBECA C.A.</option>
                      <option value="Directo VE - EPA VE">Directo VE - FERRETERIA EPA, C.A.</option>
                      <option value="GL GT - EPA GT">GL GT - FERRETERIA EPA, S.A. (Guatemala)</option>
                      <option value="GL SV - EPA SV">GL SV - FERRETERIA EPA, S.A. DE C.V.</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">{selectedExpediente.tipo_po}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Solicitante</label>
                  {editMode ? (
                    <select
                      value={selectedExpediente.solicitante}
                      onChange={(e) => handleChange('solicitante', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                    >
                      {solicitantes.map(nombre => (
                        <option key={nombre} value={nombre}>{nombre}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">{selectedExpediente.solicitante}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                  {editMode ? (
                    <select
                      value={selectedExpediente.estado_expediente}
                      onChange={(e) => handleChange('estado_expediente', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                    >
                      {(selectedExpediente?.tipo_modulo === 'dropship' ? ESTADOS_DROPSHIP : ESTADOS_ZF).map(estado => (
                        <option key={estado} value={estado}>{estado}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(selectedExpediente.estado_expediente)}`}>
                      {selectedExpediente.estado_expediente}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prioridad</label>
                  {editMode ? (
                    <select
                      value={selectedExpediente.prioridad}
                      onChange={(e) => handleChange('prioridad', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                    >
                      <option value="Baja">Baja</option>
                      <option value="Media">Media</option>
                      <option value="Alta">Alta</option>
                    </select>
                  ) : (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getPrioridadColor(selectedExpediente.prioridad, selectedExpediente.prioridad_urgente)}`}>
                      {selectedExpediente.prioridad_urgente ? 'URGENTE' : selectedExpediente.prioridad}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dificultad</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getDificultadColor(selectedExpediente.dificultad)}`}>
                    {selectedExpediente.dificultad}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Líneas OC</label>
                  {editMode ? (
                    <input
                      type="number"
                      value={selectedExpediente.lineas_oc}
                      onChange={(e) => handleChange('lineas_oc', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    />
                  ) : (
                    <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">{selectedExpediente.lineas_oc}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">EXP ID</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={selectedExpediente.exp_id}
                      onChange={(e) => handleChange('exp_id', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    />
                  ) : (
                    <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">{selectedExpediente.exp_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Solicitud</label>
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                    {new Date(selectedExpediente.fecha_solicitud).toLocaleDateString('es-ES')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Requerimiento</label>
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                    {new Date(selectedExpediente.fecha_requerimiento).toLocaleDateString('es-ES')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Creación</label>
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                    {new Date(selectedExpediente.fecha_creacion_expediente).toLocaleDateString('es-ES')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Responsable Creación</label>
                  {editMode ? (
                    <select
                      value={selectedExpediente.responsable_creacion}
                      onChange={(e) => handleChange('responsable_creacion', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                    >
                      {responsables.map(nombre => (
                        <option key={nombre} value={nombre}>{nombre}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">{selectedExpediente.responsable_creacion}</p>
                  )}
                </div>

                {/* Campo ETD solo para Dropship */}
                {selectedExpediente.tipo_modulo === 'dropship' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ETD</label>
                    {editMode ? (
                      <input
                        type="date"
                        value={selectedExpediente.etd || ''}
                        onChange={(e) => handleChange('etd', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                      />
                    ) : (
                      <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                        {selectedExpediente.etd ? new Date(selectedExpediente.etd).toLocaleDateString('es-ES') : 'No especificado'}
                      </p>
                    )}
                  </div>
                )}

                {/* Campo ETA Real solo para ZF */}
                {selectedExpediente.tipo_modulo === 'zf' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ETA Real</label>
                    {editMode ? (
                      <input
                        type="date"
                        value={selectedExpediente.eta_real || ''}
                        onChange={(e) => handleChange('eta_real', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                      />
                    ) : (
                      <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                        {selectedExpediente.eta_real ? new Date(selectedExpediente.eta_real).toLocaleDateString('es-ES') : 'No especificado'}
                      </p>
                    )}
                  </div>
                )}

                {/* BL Cargado — ambos módulos */}
                <div className={`flex items-center gap-4 rounded-lg p-4 border ${selectedExpediente.bl_cargado ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      BL (Bill of Lading) cargado
                    </label>
                    <p className="text-xs text-gray-500">Estado del Bill of Lading para este expediente</p>
                  </div>
                  {editMode ? (
                    <button
                      type="button"
                      onClick={() => handleChange('bl_cargado', !selectedExpediente.bl_cargado)}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        selectedExpediente.bl_cargado ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          selectedExpediente.bl_cargado ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${selectedExpediente.bl_cargado ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {selectedExpediente.bl_cargado ? 'BL Cargado' : 'Sin BL'}
                    </span>
                  )}
                </div>

                {selectedExpediente.prioridad_urgente && selectedExpediente.motivo_urgencia && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Motivo de Urgencia</label>
                    <p className="text-gray-900 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                      {selectedExpediente.motivo_urgencia}
                    </p>
                  </div>
                )}

                {selectedExpediente.estado_expediente === 'En Revisión' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Motivo de Revisión</label>
                    {editMode ? (
                      <textarea
                        value={selectedExpediente.motivo_revision || ''}
                        onChange={(e) => handleChange('motivo_revision', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                      />
                    ) : (
                      <p className="text-gray-900 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
                        {selectedExpediente.motivo_revision || 'N/A'}
                      </p>
                    )}
                  </div>
                )}

                {selectedExpediente.instrucciones_adicionales && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observaciones
                    </label>
                    {editMode ? (
                      <textarea
                        value={selectedExpediente.instrucciones_adicionales || ''}
                        onChange={(e) => handleChange('instrucciones_adicionales', e.target.value)}
                        rows={6}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                        placeholder="Agregue observaciones adicionales..."
                      />
                    ) : (
                      <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                        {selectedExpediente.instrucciones_adicionales}
                      </p>
                    )}
                  </div>
                )}

                <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t">
                  {!editMode ? (
                    <>
                      <button
                        type="button"
                        onClick={handleEdit}
                        className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-edit-line mr-2"></i>
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(selectedExpediente.id)}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-delete-bin-line mr-2"></i>
                        Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={cerrarModal}
                        className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Cerrar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditMode(false);
                          setUploadedFiles([]);
                        }}
                        className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={guardarCambios}
                        disabled={saving || uploadingFiles}
                        className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? (uploadingFiles ? 'Subiendo archivos...' : 'Guardando...') : 'Guardar Cambios'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
