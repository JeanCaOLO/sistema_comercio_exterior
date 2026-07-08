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
  transito_corto?: boolean;
  ok_pais?: boolean;
  bl_cargado?: boolean;
}

// Estados según el tipo de módulo
const ESTADOS_DROPSHIP = ['No Asignado', 'Asignado', 'En Proceso', 'Espera de Respuesta', 'Liberación', 'Recepción de Carga', 'Facturación', 'Notificado', 'Visto Listo'];
const ESTADOS_ZF = ['No Asignado', 'Asignado', 'En Proceso', 'Espera de Respuesta', 'Completado', 'Arribo de Carga', 'Pendiente Proforma', 'Liberación', 'Visto Listo'];

interface GestionExpedientesProps {
  onNuevoExpediente?: () => void;
  refreshTrigger?: number;
  tipoModulo?: 'dropship' | 'zf';
}

export default function GestionExpedientes({ onNuevoExpediente, refreshTrigger, tipoModulo = 'dropship' }: GestionExpedientesProps) {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [filteredExpedientes, setFilteredExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPersona, setFilterPersona] = useState('Todos');
  const [filterPrioridad, setFilterPrioridad] = useState('Todos');
  const [selectedExpediente, setSelectedExpediente] = useState<Expediente | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isAsignarMode, setIsAsignarMode] = useState(false);
  const [solicitantes, setSolicitantes] = useState<string[]>([]);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [todasPersonas, setTodasPersonas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [draggedItem, setDraggedItem] = useState<Expediente | null>(null);

  const [showHistorial, setShowHistorial] = useState(false);
  const [historialData, setHistorialData] = useState<any[]>([]);
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<any>(null);
  const [showDocumentos, setShowDocumentos] = useState(false);
  const [documentosExpediente, setDocumentosExpediente] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [usuarioActual, setUsuarioActual] = useState<string>('Sistema');

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const tituloModulo = tipoModulo === 'dropship' ? 'Gestión de Expedientes Dropship' : 'Gestión de Expedientes ZF';
  const ESTADOS = tipoModulo === 'dropship' ? ESTADOS_DROPSHIP : ESTADOS_ZF;

  useEffect(() => {
    cargarExpedientes();
    cargarUsuarios();
    obtenerUsuarioActual();
  }, []);

  useEffect(() => {
    filtrarExpedientes();
  }, [searchTerm, filterPersona, filterPrioridad, expedientes]);

  // Nuevo efecto para recargar cuando cambia refreshTrigger
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      cargarExpedientes();
    }
  }, [refreshTrigger]);

  // Actualizar el tiempo cada minuto para mostrar tiempos en tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(interval);
  }, []);

  const obtenerUsuarioActual = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Buscar el nombre del usuario en la tabla usuarios
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

  const filtrarExpedientes = () => {
    let filtered = [...expedientes];

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(exp => 
        exp.po_tiquetera.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.exp_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.solicitante.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por persona
    if (filterPersona !== 'Todos') {
      filtered = filtered.filter(exp => 
        exp.solicitante === filterPersona || exp.responsable_creacion === filterPersona
      );
    }

    // Filtrar por prioridad
    if (filterPrioridad !== 'Todos') {
      if (filterPrioridad === 'Urgente') {
        filtered = filtered.filter(exp => exp.prioridad_urgente);
      } else {
        filtered = filtered.filter(exp => exp.prioridad === filterPrioridad);
      }
    }

    setFilteredExpedientes(filtered);
  };

  const cargarUsuarios = async () => {
    try {
      const { data: usuarios, error } = await supabase
        .from('usuarios')
        .select('nombre, rol, email')
        .eq('estado', 'Activo')
        .order('nombre');

      if (error) {
        console.error('Error al cargar usuarios:', error);
        throw error;
      }

      if (usuarios && usuarios.length > 0) {
        const todosSolicitantes = usuarios.map(u => u.nombre);
        const todosResponsables = usuarios.filter(u => {
          const rol = (u.rol || '').toLowerCase();
          return rol.includes('gestor') || rol.includes('administrador');
        }).map(u => u.nombre);
        
        console.log('✅ Usuarios cargados:', todosSolicitantes.length);
        console.log('✅ Responsables cargados:', todosResponsables.length);
        
        setSolicitantes(todosSolicitantes);
        setResponsables(todosResponsables.length > 0 ? todosResponsables : todosSolicitantes);
        
        const personasUnicas = Array.from(new Set([...todosSolicitantes, ...todosResponsables]));
        setTodasPersonas(personasUnicas);
      } else {
        console.warn('⚠️ No se encontraron usuarios activos');
        setSolicitantes([]);
        setResponsables([]);
        setTodasPersonas([]);
      }
    } catch (error) {
      console.error('❌ Error al cargar usuarios:', error);
      setSolicitantes([]);
      setResponsables([]);
      setTodasPersonas([]);
    }
  };

  const cargarExpedientes = async () => {
    try {
      setLoading(true);
      console.log('📋 Cargando expedientes...');
      
      const { data, error } = await supabase
        .from('expedientes')
        .select('*')
        .eq('tipo_modulo', tipoModulo)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error al cargar expedientes:', error);
        throw error;
      }
      
      console.log('✅ Expedientes cargados:', data?.length || 0);
      setExpedientes(data || []);
    } catch (error) {
      console.error('❌ Error al cargar expedientes:', error);
      setExpedientes([]);
    } finally {
      setLoading(false);
    }
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

    // CORRECCIÓN: Usar created_at como punto de inicio
    // Esta es la fecha REAL en que se creó el registro en la base de datos
    const fechaInicio = new Date(expediente.created_at);
    
    // Si NO está en el estado final, calcular hasta ahora
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
    
    return Math.max(0, dias); // Asegurar que no sea negativo
  };

  const registrarCambioEstado = async (expedienteId: string, campo: string, valorAnterior: string, valorNuevo: string) => {
    await supabase.from('expedientes_historial').insert([{
      expediente_id: expedienteId,
      campo_modificado: campo,
      valor_anterior: valorAnterior,
      valor_nuevo: valorNuevo,
      usuario: usuarioActual,
      fecha_cambio: new Date().toISOString()
    }]);
  };

  // Registra el tiempo que estuvo en el estado anterior y abre el nuevo estado
  const registrarTiempoEstado = async (expedienteId: string, estadoAnterior: string, estadoNuevo: string) => {
    try {
      const ahora = new Date().toISOString();

      // Buscar si hay un registro abierto (sin fecha_fin) para el estado anterior
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

        // Cerrar el registro anterior con el tiempo transcurrido
        await supabase
          .from('expedientes_tiempos_estados')
          .update({
            fecha_fin: ahora,
            minutos_transcurridos: minutosTranscurridos
          })
          .eq('id', registro.id);
      }

      // Abrir un nuevo registro para el estado nuevo
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

  const enviarCorreoCambioEstado = async (expediente: Expediente, estadoAnterior: string, estadoNuevo: string) => {
    try {
      // ── DROPSHIP: notificar al responsable asignado en CUALQUIER cambio de estado ──
      if (tipoModulo === 'dropship') {
        const { data: usuarioResp } = await supabase
          .from('usuarios')
          .select('email')
          .eq('nombre', expediente.responsable_creacion)
          .maybeSingle();

        if (usuarioResp?.email) {
          console.log(`📧 Notificando a ${expediente.responsable_creacion} (${usuarioResp.email}) sobre cambio de estado en Dropship`);
          const { error: emailError } = await supabase.functions.invoke('send-email', {
            body: {
              to: [usuarioResp.email],
              subject: `Cambio de Estado - Expediente Dropship: ${expediente.po_tiquetera}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #0d9488; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: white; margin: 0;">Cambio de Estado - Expediente Dropship</h2>
                  </div>
                  <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                    <p style="color: #374151; font-size: 16px;">El expediente a su cargo ha cambiado de estado:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                      <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">PO / Tiquetera</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.po_tiquetera}</td></tr>
                      <tr style="background-color: #f3f4f6;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">EXP ID</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.exp_id}</td></tr>
                      <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Estado Anterior</td><td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626;">${estadoAnterior}</td></tr>
                      <tr style="background-color: #f3f4f6;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Estado Nuevo</td><td style="padding: 10px; border: 1px solid #e5e7eb; color: #16a34a; font-weight: bold;">${estadoNuevo}</td></tr>
                      <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Solicitante</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.solicitante}</td></tr>
                      <tr style="background-color: #f3f4f6;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Responsable</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.responsable_creacion}</td></tr>
                      <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Fecha y Hora</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}</td></tr>
                    </table>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Este es un mensaje automático del Sistema de Gestión de Expedientes.</p>
                  </div>
                </div>
              `
            }
          });
          if (emailError) {
            console.error('Error al enviar correo Dropship:', emailError);
          }
        } else {
          console.warn(`⚠️ No se encontró email para el responsable: ${expediente.responsable_creacion}`);
        }
        return;
      }

      // ── ZF: notificar a correos configurados cuando pasa a "Arribo de Carga" ──
      if (tipoModulo === 'zf' && estadoNuevo === 'Arribo de Carga') {
        const { data: config, error } = await supabase
          .from('configuracion_sistema')
          .select('valor')
          .eq('clave', 'correos_notificacion_arribo_carga')
          .maybeSingle();

        if (error) {
          console.error('Error al obtener correos de notificación:', error);
          return;
        }

        if (config && config.valor && Array.isArray(config.valor) && config.valor.length > 0) {
          const correos = config.valor as string[];
          console.log(`📧 Enviando notificación de Arribo de Carga a ${correos.length} destinatarios`);
          
          const { error: emailError } = await supabase.functions.invoke('send-email', {
            body: {
              to: correos,
              subject: `Expediente ZF en Arribo de Carga: ${expediente.po_tiquetera}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #0891b2; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: white; margin: 0;">Arribo de Carga - Expediente ZF</h2>
                  </div>
                  <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                    <p style="color: #374151; font-size: 16px;">Un expediente ZF ha llegado al estado <strong style="color: #0891b2;">Arribo de Carga</strong>.</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                      <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">PO / Tiquetera</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.po_tiquetera}</td></tr>
                      <tr style="background-color: #f3f4f6;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">EXP ID</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.exp_id}</td></tr>
                      <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Solicitante</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.solicitante}</td></tr>
                      <tr style="background-color: #f3f4f6;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Responsable</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.responsable_creacion}</td></tr>
                      <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Fecha y Hora</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}</td></tr>
                    </table>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Este es un mensaje automático del Sistema de Gestión de Expedientes.</p>
                  </div>
                </div>
              `
            }
          });
          if (emailError) {
            console.error('Error al enviar correo ZF Arribo de Carga:', emailError);
          }
        } else {
          console.log('⚠️ No hay correos configurados para notificaciones de Arribo de Carga');
        }
      }
    } catch (error) {
      console.error('Error en enviarCorreoCambioEstado:', error);
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
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  };

  const verDocumentos = (expediente: any) => {
    try {
      console.log('=== INICIO VISUALIZACIÓN DOCUMENTOS ===');
      console.log('Expediente:', expediente.po_tiquetera);
      console.log('Campo doc:', expediente.doc);
      console.log('Tipo:', typeof expediente.doc);
      
      let docs: string[] = [];
      
      if (expediente.doc) {
        // Si es un array (formato correcto de PostgreSQL JSONB)
        if (Array.isArray(expediente.doc)) {
          docs = expediente.doc.filter((url: any) => typeof url === 'string' && url.trim() !== '');
          console.log('✅ Array detectado, documentos:', docs.length);
        }
        // Si es string, intentar parsear
        else if (typeof expediente.doc === 'string') {
          const docTrimmed = expediente.doc.trim();
          if (docTrimmed.startsWith('[') || docTrimmed.startsWith('{')) {
            try {
              const parsed = JSON.parse(docTrimmed);
              docs = Array.isArray(parsed) ? parsed : [parsed];
              console.log('✅ JSON parseado, documentos:', docs.length);
            } catch {
              docs = [docTrimmed];
              console.log('⚠️ Parse falló, usando como URL única');
            }
          } else if (docTrimmed !== '') {
            docs = [docTrimmed];
            console.log('✅ URL simple detectada');
          }
        }
      }
      
      console.log('📄 Total documentos procesados:', docs.length);
      console.log('=== FIN VISUALIZACIÓN DOCUMENTOS ===');
      
      setDocumentosExpediente(docs);
      setExpedienteSeleccionado(expediente);
      setShowDocumentos(true);
    } catch (error) {
      console.error('❌ Error al procesar documentos:', error);
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
      // Intentar subir archivos directamente sin verificar/crear bucket
      // El bucket debe existir previamente en Supabase
      for (const file of uploadedFiles) {
        const fileName = `${expedienteId}/${Date.now()}_${file.name}`;
        console.log('📤 Subiendo archivo:', fileName);
        
        const { data, error } = await supabase.storage
          .from('expedientes-documentos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error('❌ Error al subir archivo:', error);
          
          // Si el error es porque el bucket no existe, dar instrucciones claras
          if (error.message.includes('not found') || error.message.includes('does not exist')) {
            throw new Error('El almacenamiento de documentos no está configurado. Por favor, cree un bucket llamado "expedientes-documentos" en Supabase Storage con acceso público.');
          }
          
          throw new Error(`Error al subir ${file.name}: ${error.message}`);
        }

        // Obtener URL pública
        const { data: urlData } = supabase.storage
          .from('expedientes-documentos')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
          console.log('✅ Archivo subido:', urlData.publicUrl);
        }
      }
    } catch (error: any) {
      console.error('❌ Error en uploadFilesToSupabase:', error);
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

      // Obtener usuario actual
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
        transito_corto: tipoModulo === 'dropship' ? (selectedExpediente.transito_corto ?? false) : false,
        ok_pais: tipoModulo === 'dropship' ? (selectedExpediente.ok_pais ?? false) : false,
        bl_cargado: selectedExpediente.bl_cargado ?? false
      };

      // Subir nuevos archivos si hay
      if (uploadedFiles.length > 0) {
        console.log('📤 Subiendo', uploadedFiles.length, 'archivo(s)...');
        
        try {
          const nuevasUrls = await uploadFilesToSupabase(selectedExpediente.id);
          console.log('✅ Archivos subidos exitosamente:', nuevasUrls);
          
          // Obtener documentos existentes
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
          
          console.log('📋 Documentos existentes:', docsExistentes.length);
          
          // Combinar documentos
          const todosLosDocs = [...docsExistentes, ...nuevasUrls];
          console.log('📦 Total documentos:', todosLosDocs.length);
          
          // Guardar como array JSON
          updates.doc = todosLosDocs;
        } catch (uploadError) {
          console.error('❌ Error al subir archivos:', uploadError);
          setErrorMessage('Error al subir los archivos. Por favor, intente nuevamente.');
          setShowError(true);
          setTimeout(() => setShowError(false), 5000);
          setSaving(false);
          setUploadingFiles(false);
          return;
        }
      }

      console.log('💾 Guardando cambios en la base de datos...');

      // Registrar cambios en historial
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
      
      // Si cambia al estado final, calcular tiempos reales
      if (estadoNuevo === estadoFinal && estadoAnterior !== estadoFinal) {
        const fechaInicio = selectedExpediente.created_at;
        const fechaFinalizacion = new Date().toISOString();
        const tiempoRealMinutos = calcularTiempoReal(fechaInicio, fechaFinalizacion);
        const diasEntregaReal = calcularDiasHabilesReales(fechaInicio, fechaFinalizacion);
        
        updates.fecha_liberacion = fechaFinalizacion;
        updates.tiempo_real_minutos = tiempoRealMinutos;
        updates.dias_entrega_real = diasEntregaReal;
      }

      const { error } = await supabase
        .from('expedientes')
        .update(updates)
        .eq('id', selectedExpediente.id);

      if (error) throw error;

      console.log('✅ Expediente actualizado correctamente');

      // Si cambió el estado, registrar tiempo y enviar correo
      if (estadoAnterior && estadoNuevo && estadoAnterior !== estadoNuevo) {
        await registrarTiempoEstado(selectedExpediente.id, estadoAnterior, estadoNuevo);
        await enviarCorreoCambioEstado(selectedExpediente, estadoAnterior, estadoNuevo);
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setEditMode(false);
      setIsAsignarMode(false);
      cerrarModal();
      cargarExpedientes();
    } catch (error: any) {
      console.error('❌ Error al guardar cambios:', error);
      setErrorMessage(error.message || 'Error al guardar los cambios');
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setSaving(false);
      setUploadingFiles(false);
    }
  };

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

    // Caso especial: No Asignado → Asignado abre modal para completar campos
    if (draggedItem.estado_expediente === 'No Asignado' && nuevoEstado === 'Asignado') {
      // Validar que tenga BL cargado y documentos
      // Usamos comparación estricta !== true para cubrir null, undefined, false y cualquier valor corrupto
      if (draggedItem.bl_cargado !== true) {
        setErrorMessage('No se puede asignar este expediente: debe tener el BL cargado (marcado en el módulo CAA o desde edición).');
        setShowError(true);
        setTimeout(() => setShowError(false), 5000);
        setDraggedItem(null);
        return;
      }
      
      // Verificar que tenga documentos
      let tieneDocs = false;
      if (draggedItem.doc) {
        if (Array.isArray(draggedItem.doc)) {
          tieneDocs = draggedItem.doc.length > 0;
        } else if (typeof draggedItem.doc === 'string') {
          const trimmed = draggedItem.doc.trim();
          tieneDocs = trimmed !== '' && trimmed !== '[]' && trimmed !== '{}';
        }
      }
      
      if (!tieneDocs) {
        setErrorMessage('No se puede asignar este expediente: debe tener al menos un documento adjunto.');
        setShowError(true);
        setTimeout(() => setShowError(false), 5000);
        setDraggedItem(null);
        return;
      }
      
      setSelectedExpediente({ ...draggedItem, estado_expediente: 'Asignado' });
      setEditMode(true);
      setIsAsignarMode(true);
      setShowModal(true);
      setDraggedItem(null);
      return;
    }

    try {
      const estadoAnterior = draggedItem.estado_expediente;

      // Obtener usuario actual
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
        estado_expediente: nuevoEstado,
        updated_at: new Date().toISOString(),
        usuario_modificador: emailUsuario
      };

      // Determinar el estado final según el tipo de módulo
      const estadoFinal = draggedItem.tipo_modulo === 'dropship' ? 'Notificado' : 'Liberación';
      
      // Si cambia al estado final, calcular tiempos reales
      if (nuevoEstado === estadoFinal) {
        const fechaInicio = draggedItem.created_at;
        const fechaFinalizacion = new Date().toISOString();
        const tiempoRealMinutos = calcularTiempoReal(fechaInicio, fechaFinalizacion);
        const diasEntregaReal = calcularDiasHabilesReales(fechaInicio, fechaFinalizacion);
        
        updates.fecha_liberacion = fechaFinalizacion;
        updates.tiempo_real_minutos = tiempoRealMinutos;
        updates.dias_entrega_real = diasEntregaReal;
      }

      const { error } = await supabase
        .from('expedientes')
        .update(updates)
        .eq('id', draggedItem.id);

      if (error) throw error;

      // Registrar cambio en historial con usuario
      await supabase.from('expedientes_historial').insert([{
        expediente_id: draggedItem.id,
        campo_modificado: 'Estado',
        valor_anterior: estadoAnterior,
        valor_nuevo: nuevoEstado,
        usuario: nombreUsuario,
        usuario_email: emailUsuario,
        fecha_cambio: new Date().toISOString()
      }]);

      // Registrar tiempo en el estado anterior y abrir nuevo estado
      await registrarTiempoEstado(draggedItem.id, estadoAnterior, nuevoEstado);

      await enviarCorreoCambioEstado(draggedItem, estadoAnterior, nuevoEstado);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      cargarExpedientes();
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    } finally {
      setDraggedItem(null);
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
      case 'No Asignado': return 'bg-gray-400';
      case 'Nuevo': return 'bg-blue-500';
      case 'Asignado': return 'bg-purple-500';
      case 'Creado': return 'bg-teal-500';
      case 'En Proceso': return 'bg-orange-500';
      case 'En Revisión': return 'bg-yellow-500';
      case 'Recepción de Carga': return 'bg-indigo-500';
      case 'Facturación': return 'bg-pink-500';
      case 'Liberado': return 'bg-green-500';
      case 'Completado': return 'bg-emerald-500';
      case 'Arribo de Carga': return 'bg-cyan-500';
      case 'Pendiente Proforma': return 'bg-violet-500';
      case 'Espera de Respuesta': return 'bg-amber-400';
      case 'Liberación': return 'bg-green-500';
      case 'Notificado': return 'bg-lime-500';
      case 'Visto Listo': return 'bg-rose-500';
      default: return 'bg-gray-500';
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

  const getDificultadIcon = (dificultad: string) => {
    switch (dificultad) {
      case 'Alta': return 'ri-arrow-up-circle-fill text-red-600';
      case 'Media': return 'ri-arrow-right-circle-fill text-yellow-600';
      case 'Baja': return 'ri-arrow-down-circle-fill text-green-600';
      default: return 'ri-checkbox-blank-circle-line text-gray-400';
    }
  };

  const getExpedientesPorEstado = (estado: string) => {
    return filteredExpedientes.filter(exp => exp.estado_expediente === estado);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          <p className="mt-4 text-gray-600">Cargando expedientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{tituloModulo}</h1>
          <p className="text-gray-500 mt-2">Administra y da seguimiento a todos los expedientes</p>
        </div>
        <button
          onClick={() => {
            const event = new CustomEvent('openFormularioExpediente', { detail: { tipoModulo } });
            window.dispatchEvent(event);
          }}
          className="px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
        >
          <i className="ri-add-line text-xl"></i>
          Nuevo Expediente
        </button>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Persona</label>
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
        </div>
      </div>

      {/* Tablero Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {ESTADOS.map(estado => {
          const expedientesEstado = getExpedientesPorEstado(estado);
          return (
            <div
              key={estado}
              className="flex-shrink-0 w-80 bg-gray-50 rounded-xl border border-gray-200"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, estado)}
            >
              <div className={`${getEstadoColor(estado)} text-white px-4 py-3 rounded-t-xl flex items-center justify-between`}>
                <h3 className="font-semibold text-sm">{estado}</h3>
                <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-bold">
                  {expedientesEstado.length}
                </span>
              </div>
              
              <div className="p-3 space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto">
                {expedientesEstado.map(expediente => {
                  const tiempoTranscurrido = calcularTiempoTranscurrido(expediente);
                  const estadoFinal = expediente.tipo_modulo === 'dropship' ? 'Notificado' : 'Liberación';
                  const esFinalizado = expediente.estado_expediente === estadoFinal;
                  
                  return (
                    <div
                      key={expediente.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, expediente)}
                      onClick={() => abrirModal(expediente)}
                      className="bg-white rounded-lg border border-gray-200 p-4 cursor-move hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-sm mb-1">
                            {expediente.po_tiquetera}
                          </h4>
                          <p className="text-xs text-gray-500">{expediente.exp_id}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {expediente.prioridad_urgente && (
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                              URGENTE
                            </span>
                          )}
                          {expediente.transito_corto && (
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              TC
                            </span>
                          )}
                          {expediente.ok_pais && (
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                              ✓ OK País
                            </span>
                          )}
                          {expediente.bl_cargado && (
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              BL
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <i className="ri-user-line"></i>
                          <span>{expediente.solicitante}</span>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium min-w-[70px]">Prioridad:</span>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getPrioridadColor(expediente.prioridad, expediente.prioridad_urgente)}`}>
                              {expediente.prioridad}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium min-w-[70px]">Dificultad:</span>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${getDificultadColor(expediente.dificultad)}`}>
                              {expediente.dificultad}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs bg-gray-50 rounded p-2 border border-gray-200">
                          <div className={`font-medium ${esFinalizado ? 'text-green-700' : 'text-blue-700'}`}>
                            ⏱️ {formatearTiempo(tiempoTranscurrido.minutos)}
                          </div>
                          <div className={`${esFinalizado ? 'text-green-600' : 'text-blue-600'}`}>
                            📅 {tiempoTranscurrido.dias} días hábiles
                          </div>
                          {!esFinalizado && (
                            <div className="text-gray-400 mt-1">
                              🔄 En curso...
                            </div>
                          )}
                          {esFinalizado && (
                            <div className="text-green-500 mt-1">
                              ✅ Finalizado
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            verHistorial(expediente);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          title="Ver historial"
                        >
                          <i className="ri-history-line text-sm"></i>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            verDocumentos(expediente);
                          }}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                          title="Ver documentos"
                        >
                          <i className="ri-file-list-line text-sm"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {expedientesEstado.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <i className="ri-inbox-line text-3xl mb-2"></i>
                    <p>Sin expedientes</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
                    console.log(`Procesando documento ${index + 1}:`, url);
                    
                    // Extraer el nombre del archivo de la URL
                    let fileName = `Documento ${index + 1}`;
                    try {
                      const urlParts = url.split('/');
                      const lastPart = urlParts[urlParts.length - 1];
                      // Remover el timestamp si existe (formato: timestamp_nombrearchivo.ext)
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
                          <div className={`w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 flex-shrink-0`}>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Descargando documento:', url);
                          }}
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
              <div className="flex items-center gap-3">
                {isAsignarMode && (
                  <div className="w-9 h-9 flex items-center justify-center bg-amber-100 rounded-lg flex-shrink-0">
                    <i className="ri-user-add-line text-amber-600 text-lg"></i>
                  </div>
                )}
                <h2 className="text-2xl font-bold text-gray-900">
                  {isAsignarMode ? 'Asignar Expediente' : editMode ? 'Editar Expediente' : 'Detalles del Expediente'}
                </h2>
              </div>
              <button
                onClick={cerrarModal}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-2xl text-gray-500"></i>
              </button>
            </div>

            {/* Banner de asignación */}
            {isAsignarMode && (
              <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 flex items-center justify-center bg-amber-100 rounded-full flex-shrink-0 mt-0.5">
                  <i className="ri-alert-line text-amber-600 text-base"></i>
                </div>
                <div>
                  <p className="font-bold text-amber-800 text-sm">Completa los campos para asignar este expediente</p>
                  <p className="text-amber-700 text-xs mt-1">Los campos marcados con <span className="font-bold text-amber-600">★</span> son prioritarios: <strong>Ruta Logística</strong> y <strong>Responsable</strong>. El EXP ID puede completarse después. El estado pasará a <strong>Asignado</strong> automáticamente al guardar.</p>
                </div>
              </div>
            )}

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
                    <p className="text-gray-900">{selectedExpediente.po_tiquetera}</p>
                  )}
                </div>

                <div className={isAsignarMode ? 'ring-2 ring-amber-300 rounded-xl p-3 -m-3' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isAsignarMode && <span className="text-amber-500 mr-1">★</span>}
                    Ruta Logística
                  </label>
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
                    <p className="text-gray-900">{selectedExpediente.tipo_po}</p>
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
                    <p className="text-gray-900">{selectedExpediente.solicitante}</p>
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
                      {ESTADOS.map(estado => (
                        <option key={estado} value={estado}>{estado}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white ${getEstadoColor(selectedExpediente.estado_expediente)}`}>
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
                      {selectedExpediente.prioridad}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prioridad Urgente</label>
                  {editMode ? (
                    <button
                      type="button"
                      onClick={() => handleChange('prioridad_urgente', !selectedExpediente.prioridad_urgente)}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer ${
                        selectedExpediente.prioridad_urgente ? 'bg-red-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          selectedExpediente.prioridad_urgente ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <p className="text-gray-900">{selectedExpediente.prioridad_urgente ? 'Sí' : 'No'}</p>
                  )}
                </div>

                {selectedExpediente.prioridad_urgente && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Motivo de Urgencia</label>
                    <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                      {selectedExpediente.motivo_urgencia || 'N/A'}
                    </p>
                  </div>
                )}

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
                    <p className="text-gray-900">{selectedExpediente.lineas_oc}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EXP ID
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      value={selectedExpediente.exp_id}
                      onChange={(e) => handleChange('exp_id', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    />
                  ) : (
                    <p className="text-gray-900">{selectedExpediente.exp_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Solicitud</label>
                  <p className="text-gray-900">{new Date(selectedExpediente.fecha_solicitud).toLocaleDateString('es-ES')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Requerimiento</label>
                  <p className="text-gray-900">{new Date(selectedExpediente.fecha_requerimiento).toLocaleDateString('es-ES')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Creación</label>
                  <p className="text-gray-900">{new Date(selectedExpediente.fecha_creacion_expediente).toLocaleDateString('es-ES')}</p>
                </div>

                <div className={isAsignarMode ? 'ring-2 ring-amber-300 rounded-xl p-3 -m-3' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isAsignarMode && <span className="text-amber-500 mr-1">★</span>}
                    Responsable Creación
                  </label>
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
                    <p className="text-gray-900">{selectedExpediente.responsable_creacion}</p>
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

                {/* Checkboxes Tránsito Corto y OK País — solo Dropship */}
                {selectedExpediente.tipo_modulo === 'dropship' && (
                  <>
                    <div className={`flex items-center gap-4 rounded-lg p-4 border ${selectedExpediente.transito_corto ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-800 mb-1">
                          Tránsito Corto
                        </label>
                        <p className="text-xs text-gray-500">Expediente de tránsito corto</p>
                      </div>
                      {editMode ? (
                        <button
                          type="button"
                          onClick={() => handleChange('transito_corto', !selectedExpediente.transito_corto)}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                            selectedExpediente.transito_corto ? 'bg-amber-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                              selectedExpediente.transito_corto ? 'translate-x-8' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      ) : (
                        <span className={`text-sm font-medium px-3 py-1 rounded-full ${selectedExpediente.transito_corto ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {selectedExpediente.transito_corto ? 'Sí' : 'No'}
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center gap-4 rounded-lg p-4 border ${selectedExpediente.ok_pais ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-800 mb-1">
                          OK País
                        </label>
                        <p className="text-xs text-gray-500">Marcar cuando el expediente esté cerrado</p>
                      </div>
                      {editMode ? (
                        <button
                          type="button"
                          onClick={() => handleChange('ok_pais', !selectedExpediente.ok_pais)}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                            selectedExpediente.ok_pais ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                              selectedExpediente.ok_pais ? 'translate-x-8' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      ) : (
                        <span className={`text-sm font-medium px-3 py-1 rounded-full ${selectedExpediente.ok_pais ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {selectedExpediente.ok_pais ? '✓ OK País' : 'Pendiente'}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* Checkbox BL — disponible para ambos módulos */}
                <div className={`flex items-center gap-4 rounded-lg p-4 border ${selectedExpediente.bl_cargado ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      BL (Bill of Lading) cargado
                    </label>
                    <p className="text-xs text-gray-500">Marcar si el BL ya fue cargado o está adjunto al expediente</p>
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

                {selectedExpediente.estado_expediente === 'En Revisión' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo de Revisión
                    </label>
                    {editMode ? (
                      <textarea
                        value={selectedExpediente.motivo_revision || ''}
                        onChange={(e) => handleChange('motivo_revision', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                      />
                    ) : (
                      <p className="text-gray-900">{selectedExpediente.motivo_revision || 'N/A'}</p>
                    )}
                  </div>
                )}

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
                      {selectedExpediente.instrucciones_adicionales || 'Sin observaciones'}
                    </p>
                  )}
                </div>

                {editMode && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Agregar Documentos (PDF, Excel, CSV)
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="flex-1 cursor-pointer">
                          <div className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-teal-500 transition-colors flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-teal-600">
                            <i className="ri-upload-cloud-line text-xl"></i>
                            <span>Seleccionar archivos adicionales</span>
                          </div>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.xlsx,.xls,.csv"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      {uploadedFiles.length > 0 && (
                        <div className="space-y-2">
                          {uploadedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                <i className="ri-file-line text-teal-600"></i>
                                <span className="text-sm text-gray-700">{file.name}</span>
                                <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                <i className="ri-close-line text-lg"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t">
                  {!editMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEdit()}
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
                        className={`px-6 py-2 text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                          isAsignarMode
                            ? 'bg-amber-500 hover:bg-amber-600'
                            : 'bg-teal-600 hover:bg-teal-700'
                        }`}
                      >
                        {saving ? (
                          uploadingFiles ? 'Subiendo archivos...' : 'Guardando...'
                        ) : isAsignarMode ? (
                          <><i className="ri-user-add-line"></i> Asignar Expediente</>
                        ) : (
                          'Guardar Cambios'
                        )}
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
