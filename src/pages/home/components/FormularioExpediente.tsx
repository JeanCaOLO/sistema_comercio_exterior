import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

// Feriados de El Salvador
const FERIADOS = [
  '01-01', // Año Nuevo
  '04-02', // Jueves Santo (aproximado, varía cada año)
  '04-03', // Viernes Santo (aproximado, varía cada año)
  '04-11', // Día de Juan Santamaría
  '05-01', // Día del Trabajo
  '07-25', // Anexión del Partido de Nicoya
  '08-02', // Virgen de los Ángeles
  '09-15', // Día de la Independencia
  '12-01', // Abolición del Ejército
  '12-25'  // Navidad
];

// Opciones de motivos de urgencia actualizadas - SIN "OTRO"
const MOTIVOS_URGENCIA = [
  'ARRIBADO NO NOTIFICADO',
  'DOCUMENTOS TARDÍOS',
  'TERRESTRE',
  'TRÁNSITO CORTO'
];

const esFeriado = (fecha: Date): boolean => {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  const fechaStr = `${mes}-${dia}`;
  return FERIADOS.includes(fechaStr);
};

const esFinDeSemana = (fecha: Date): boolean => {
  const dia = fecha.getDay();
  return dia === 0 || dia === 6; // 0 = Domingo, 6 = Sábado
};

const calcularDiasHabiles = (fechaInicio: Date, diasRequeridos: number): Date => {
  let fecha = new Date(fechaInicio);
  let diasContados = 0;
  
  while (diasContados < diasRequeridos) {
    fecha.setDate(fecha.getDate() + 1);
    if (!esFinDeSemana(fecha) && !esFeriado(fecha)) {
      diasContados++;
    }
  }
  
  return fecha;
};

const calcularDificultad = (lineas: number): string => {
  if (lineas <= 51) return 'Baja';
  if (lineas <= 128) return 'Media';
  return 'Alta';
};

const calcularTiempoYDias = (dificultad: string, lineas: number) => {
  let minutosPorLinea = 0;
  let diasBase = 0;
  
  switch (dificultad) {
    case 'Baja':
      minutosPorLinea = 2;
      diasBase = 2;
      break;
    case 'Media':
      minutosPorLinea = 3;
      diasBase = 3;
      break;
    case 'Alta':
      minutosPorLinea = 4;
      diasBase = 5;
      break;
  }
  
  const tiempoMinutos = Math.round(lineas * minutosPorLinea);
  const diasEntrega = diasBase + Math.floor(lineas / 50);
  
  return { tiempoMinutos, diasEntrega };
};

export default function FormularioExpediente({ onClose, tipoModulo = 'dropship' }: { onClose: () => void; tipoModulo?: 'dropship' | 'zf' }) {
  const obtenerFechaActual = () => {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };
  
  const [formData, setFormData] = useState({
    poTiquetera: '',
    tipoPO: '',
    solicitante: '',
    fechaSolicitud: obtenerFechaActual(),
    prioridad: '',
    prioridadSi: false,
    motivoUrgencia: '',
    dificultad: '',
    tiempoMinutos: '',
    diasEntrega: '',
    fechaRequerimiento: obtenerFechaActual(),
    exp: '',
    lineasOC: '',
    fechaCreacionExp: obtenerFechaActual(),
    estadoExpediente: 'Asignado',
    motivoRevision: '',
    responsableCreacion: '',
    observaciones: '',
    etd: '', // Para Dropship
    etaReal: '', // Para ZF
    transitoCorto: false, // Para Dropship
    blCargado: false
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [solicitantes, setSolicitantes] = useState<string[]>([]);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [usuarioActualEmail, setUsuarioActualEmail] = useState('');
  const [usuarioActualNombre, setUsuarioActualNombre] = useState('');

  useEffect(() => {
    cargarUsuarios();
    obtenerUsuarioActual();
  }, []);

  // Calcular automáticamente dificultad cuando cambian las líneas OC
  useEffect(() => {
    if (formData.lineasOC && parseInt(formData.lineasOC) > 0) {
      const lineas = parseInt(formData.lineasOC);
      const dificultad = calcularDificultad(lineas);
      const { tiempoMinutos, diasEntrega } = calcularTiempoYDias(dificultad, lineas);
      
      setFormData(prev => ({
        ...prev,
        dificultad,
        tiempoMinutos: tiempoMinutos.toString(),
        diasEntrega: diasEntrega.toString()
      }));
    }
  }, [formData.lineasOC]);

  const cargarUsuarios = async () => {
    try {
      console.log('🔄 Cargando usuarios desde Supabase...');
      
      // Consulta más simple y directa
      const { data, error } = await supabase
        .from('usuarios')
        .select('nombre, rol, estado')
        .order('nombre', { ascending: true });

      console.log('📊 Respuesta de Supabase:', { data, error });

      if (error) {
        console.error('❌ Error al cargar usuarios:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No hay usuarios en la base de datos');
        return;
      }

      console.log('✅ Total usuarios obtenidos:', data.length);
      
      // Filtrar usuarios activos en el cliente
      const usuariosActivos = data.filter(u => u.estado === 'Activo');
      console.log('✅ Usuarios activos:', usuariosActivos.length);
      console.log('📋 Lista de usuarios activos:', usuariosActivos);

      if (usuariosActivos.length === 0) {
        console.warn('⚠️ No hay usuarios con estado "Activo"');
        return;
      }

      // Extraer nombres para solicitantes (todos los usuarios activos)
      const nombresSolicitantes = usuariosActivos.map(u => u.nombre);
      
      // Extraer nombres para responsables (solo Gestores y Administradores)
      const nombresResponsables = usuariosActivos
        .filter(u => {
          const rol = (u.rol || '').toLowerCase();
          return rol.includes('gestor') || rol.includes('administrador');
        })
        .map(u => u.nombre);

      console.log('👥 Solicitantes:', nombresSolicitantes);
      console.log('👤 Responsables:', nombresResponsables);

      // Actualizar estados
      setSolicitantes(nombresSolicitantes);
      setResponsables(nombresResponsables.length > 0 ? nombresResponsables : nombresSolicitantes);

      console.log('✅ Estados actualizados - Solicitantes:', nombresSolicitantes.length, 'Responsables:', nombresResponsables.length);
    } catch (error) {
      console.error('❌ Error crítico al cargar usuarios:', error);
    }
  };

  const obtenerUsuarioActual = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsuarioActualEmail(user.email || '');
        
        // Buscar el nombre del usuario en la tabla usuarios
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('email', user.email)
          .single();
        
        if (usuario) {
          setUsuarioActualNombre(usuario.nombre);
          // Establecer el solicitante Y responsable automáticamente
          setFormData(prev => ({
            ...prev,
            solicitante: usuario.nombre,
            responsableCreacion: usuario.nombre
          }));
        }
      }
    } catch (error) {
      console.error('Error al obtener usuario actual:', error);
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
      // Intentar subir archivos directamente
      // El bucket "expedientes-documentos" debe existir previamente en Supabase Storage
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShowError(false);
    setUploadingFiles(uploadedFiles.length > 0);

    try {
      console.log('📝 Creando expediente...');
      
      // Validación: si BL cargado pero sin documentos adjuntos
      if (formData.blCargado && uploadedFiles.length === 0) {
        setErrorMessage('Marcaste BL cargado pero no adjuntaste documentos. Sube el BL antes de continuar.');
        setShowError(true);
        setLoading(false);
        setUploadingFiles(false);
        return;
      }
      
      // Crear el expediente primero
      const { data: expedienteData, error: expedienteError } = await supabase
        .from('expedientes')
        .insert([
          {
            po_tiquetera: formData.poTiquetera,
            tipo_po: formData.tipoPO,
            solicitante: formData.solicitante,
            fecha_solicitud: formData.fechaSolicitud,
            prioridad: formData.prioridad,
            prioridad_urgente: formData.prioridadSi,
            motivo_urgencia: formData.prioridadSi ? formData.motivoUrgencia : null,
            dificultad: formData.dificultad,
            tiempo_minutos: parseInt(formData.tiempoMinutos),
            dias_entrega: parseInt(formData.diasEntrega),
            fecha_requerimiento: formData.fechaRequerimiento,
            exp_id: formData.exp || null,
            doc: null,
            lineas_oc: parseInt(formData.lineasOC),
            fecha_creacion_expediente: formData.fechaCreacionExp,
            estado_expediente: 'Asignado',
            motivo_revision: null,
            responsable_creacion: formData.responsableCreacion,
            instrucciones_adicionales: formData.observaciones || null,
            fecha_apertura: new Date().toISOString(),
            tipo_modulo: tipoModulo,
            etd: tipoModulo === 'dropship' && formData.etd ? formData.etd : null,
            eta_real: tipoModulo === 'zf' && formData.etaReal ? formData.etaReal : null,
            transito_corto: formData.transitoCorto,
            ok_pais: false,
            bl_cargado: formData.blCargado
          }
        ])
        .select()
        .single();

      if (expedienteError) throw expedienteError;

      console.log('✅ Expediente creado con ID:', expedienteData.id);

      // Subir archivos si hay
      if (uploadedFiles.length > 0 && expedienteData) {
        console.log('📤 Subiendo', uploadedFiles.length, 'archivo(s)...');
        
        try {
          const documentosUrls = await uploadFilesToSupabase(expedienteData.id);
          console.log('✅ Archivos subidos:', documentosUrls.length);
          console.log('URLs:', documentosUrls);
          
          // Actualizar el expediente con las URLs como array JSON
          const { error: updateError } = await supabase
            .from('expedientes')
            .update({ doc: documentosUrls })
            .eq('id', expedienteData.id);

          if (updateError) {
            console.error('❌ Error al actualizar documentos:', updateError);
            throw updateError;
          } else {
            console.log('✅ Documentos guardados correctamente en la base de datos');
          }
        } catch (uploadError) {
          console.error('❌ Error al subir archivos:', uploadError);
          setErrorMessage('Expediente creado, pero hubo un error al subir los documentos');
          setShowError(true);
          setTimeout(() => setShowError(false), 5000);
        }
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          poTiquetera: '',
          tipoPO: '',
          solicitante: usuarioActualNombre,
          fechaSolicitud: obtenerFechaActual(),
          prioridad: '',
          prioridadSi: false,
          motivoUrgencia: '',
          dificultad: '',
          tiempoMinutos: '',
          diasEntrega: '',
          fechaRequerimiento: obtenerFechaActual(),
          exp: '',
          lineasOC: '',
          fechaCreacionExp: obtenerFechaActual(),
          estadoExpediente: 'Asignado',
          motivoRevision: '',
          responsableCreacion: '',
          observaciones: '',
          etd: '',
          etaReal: '',
          transitoCorto: false,
          blCargado: false
        });
        setUploadedFiles([]);
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('❌ Error al crear expediente:', error);
      setErrorMessage(error.message || 'Error al guardar el expediente');
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setLoading(false);
      setUploadingFiles(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-xl flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Crear Nuevo Expediente</h1>
            <p className="text-gray-500 mt-2">Complete todos los campos para registrar una nueva solicitud</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-2xl text-gray-500"></i>
          </button>
        </div>

        <div className="px-8 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {showSuccess && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <i className="ri-checkbox-circle-line text-green-600 text-2xl"></i>
              <div>
                <p className="text-green-800 font-semibold">¡Expediente creado exitosamente!</p>
                <p className="text-green-600 text-sm">El registro ha sido guardado correctamente</p>
              </div>
            </div>
          )}

          {showError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <i className="ri-error-warning-line text-red-600 text-2xl"></i>
              <div>
                <p className="text-red-800 font-semibold">Error al crear expediente</p>
                <p className="text-red-600 text-sm">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <i className="ri-file-text-line text-teal-600"></i>
                Identificación de la Solicitud
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PO <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="poTiquetera"
                    value={formData.poTiquetera}
                    onChange={handleChange}
                    required
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                    placeholder="Ingrese uno o más números de PO (uno por línea o separados por comas)"
                  />
                  <p className="text-xs text-gray-500 mt-1">Puede ingresar múltiples POs separados por comas o en líneas diferentes</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ruta Logística <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="tipoPO"
                    value={formData.tipoPO}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  >
                    <option value="">Seleccione tipo</option>
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
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Solicitante <span className="text-red-500">*</span>
                  </label>
                  <div className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 font-medium">
                    {formData.solicitante || 'Cargando...'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">El solicitante se asigna automáticamente según tu usuario</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Solicitud <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="fechaSolicitud"
                    value={formData.fechaSolicitud}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridad <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="prioridad"
                    value={formData.prioridad}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  >
                    <option value="">Seleccione prioridad</option>
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridad Urgente
                  </label>
                  <div className="flex items-center gap-3 h-11">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, prioridadSi: !prev.prioridadSi }))}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer ${
                        formData.prioridadSi ? 'bg-red-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          formData.prioridadSi ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-medium ${formData.prioridadSi ? 'text-red-600' : 'text-gray-500'}`}>
                      {formData.prioridadSi ? 'URGENTE' : 'Normal'}
                    </span>
                  </div>
                </div>
                
                {formData.prioridadSi && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo de Urgencia <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="motivoUrgencia"
                      value={formData.motivoUrgencia}
                      onChange={handleChange}
                      required={formData.prioridadSi}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                    >
                      <option value="">Seleccione el motivo de urgencia</option>
                      {MOTIVOS_URGENCIA.map((motivo, index) => (
                        <option key={index} value={motivo}>{motivo}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <i className="ri-time-line text-teal-600"></i>
                Clasificación y Tiempos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Líneas OC <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="lineasOC"
                    value={formData.lineasOC}
                    onChange={handleChange}
                    required
                    min="0"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Ej: 25"
                  />
                  <p className="text-xs text-gray-500 mt-1">La dificultad se calcula automáticamente según las líneas</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dificultad (Automática)
                  </label>
                  <div className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 font-medium">
                    {formData.dificultad || 'Ingrese líneas OC'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Baja: ≤51 | Media: 52-128 | Alta: &gt;128
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Requerimiento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="fechaRequerimiento"
                    value={formData.fechaRequerimiento}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <i className="ri-folder-line text-teal-600"></i>
                Datos del Expediente
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EXP (ID Expediente)
                  </label>
                  <input
                    type="text"
                    name="exp"
                    value={formData.exp}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Ej: EXP-2025-001"
                  />
                  <p className="text-xs text-gray-500 mt-1">Puedes agregar el ID del expediente después si lo necesitas</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Creación del Expediente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="fechaCreacionExp"
                    value={formData.fechaCreacionExp}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  />
                </div>
                
                {/* Campo ETD solo para Dropship */}
                {tipoModulo === 'dropship' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ETD
                    </label>
                    <input
                      type="date"
                      name="etd"
                      value={formData.etd}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                    />
                  </div>
                )}

                {/* Checkbox Tránsito Corto - disponible para Dropship y ZF */}
                <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-amber-800 mb-1">
                        Tránsito Corto
                      </label>
                      <p className="text-xs text-amber-600">Marcar si el expediente es de tránsito corto</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, transitoCorto: !prev.transitoCorto }))}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        formData.transitoCorto ? 'bg-amber-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          formData.transitoCorto ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                
                {/* Campo ETA Real solo para ZF */}
                {tipoModulo === 'zf' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ETA Real
                    </label>
                    <input
                      type="date"
                      name="etaReal"
                      value={formData.etaReal}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                    />
                  </div>
                )}
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documentos (PDF, Excel, CSV)
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="flex-1 cursor-pointer">
                        <div className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-teal-500 transition-colors flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-teal-600">
                          <i className="ri-upload-cloud-line text-xl"></i>
                          <span>Seleccionar archivos</span>
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

                {/* Checkbox BL Cargado */}
                <div className="md:col-span-2">
                  <div className="flex items-center gap-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-blue-800 mb-1">
                        BL (Bill of Lading) cargado
                      </label>
                      <p className="text-xs text-blue-600">Marca esta opción si el BL ya fue cargado o está adjunto</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, blCargado: !prev.blCargado }))}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        formData.blCargado ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          formData.blCargado ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {formData.blCargado && uploadedFiles.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <i className="ri-alert-line"></i>
                      Marcaste BL cargado pero no adjuntaste documentos. Recuerda subir el BL antes de guardar.
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado del Expediente
                  </label>
                  <div className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 font-medium">
                    Asignado
                  </div>
                  <p className="text-xs text-gray-500 mt-1">El estado inicial siempre es "Asignado"</p>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Responsable <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="responsableCreacion"
                    value={formData.responsableCreacion}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  >
                    <option value="">Seleccione responsable</option>
                    {responsables.map(nombre => (
                      <option key={nombre} value={nombre}>{nombre}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Se asigna automáticamente según tu usuario, pero puedes cambiarlo si es necesario</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <i className="ri-file-list-line text-teal-600"></i>
                Detalles Adicionales
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                  placeholder="Ingrese cualquier observación adicional relevante para el expediente..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 sticky bottom-0 bg-white pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || uploadingFiles}
                className="px-8 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (uploadingFiles ? 'Subiendo archivos...' : 'Guardando...') : 'Crear Expediente'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
