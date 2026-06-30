import { useState, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

interface POItem {
  id: string;
  value: string;
}

interface SolicitudCreada {
  pos: string[];
  id: string;
  modulo: string;
}

export default function CargaDocumentosCAA() {
  const [tipoModulo, setTipoModulo] = useState<'dropship' | 'zf' | null>(null);
  const [tipoRuta, setTipoRuta] = useState<string>('');
  const [blCargado, setBlCargado] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pos, setPos] = useState<POItem[]>([{ id: crypto.randomUUID(), value: '' }]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [solicitudesCreadas, setSolicitudesCreadas] = useState<SolicitudCreada[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'xlsx', 'xls', 'csv', 'doc', 'docx'].includes(ext || '');
    });
    setFiles(prev => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ['pdf', 'xlsx', 'xls', 'csv', 'doc', 'docx'].includes(ext || '');
      });
      setFiles(prev => [...prev, ...selected]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addPO = () => {
    setPos(prev => [...prev, { id: crypto.randomUUID(), value: '' }]);
  };

  const updatePO = (id: string, value: string) => {
    setPos(prev => prev.map(po => po.id === id ? { ...po, value } : po));
  };

  const removePO = (id: string) => {
    if (pos.length === 1) return;
    setPos(prev => prev.filter(po => po.id !== id));
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return { icon: 'ri-file-pdf-line', color: 'text-red-500', bg: 'bg-red-50' };
    if (['xlsx', 'xls'].includes(ext || '')) return { icon: 'ri-file-excel-line', color: 'text-green-500', bg: 'bg-green-50' };
    if (ext === 'csv') return { icon: 'ri-file-text-line', color: 'text-teal-500', bg: 'bg-teal-50' };
    if (['doc', 'docx'].includes(ext || '')) return { icon: 'ri-file-word-line', color: 'text-sky-500', bg: 'bg-sky-50' };
    return { icon: 'ri-file-line', color: 'text-gray-500', bg: 'bg-gray-50' };
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async () => {
    setError(null);
    const posValidas = pos.map(p => p.value.trim()).filter(v => v !== '');

    if (!tipoModulo) {
      setError('Selecciona el tipo de módulo (Dropship o ZF).');
      return;
    }
    if (!tipoRuta) {
      setError('Selecciona la ruta logística.');
      return;
    }
    if (files.length === 0) {
      setError('Debes adjuntar al menos un documento.');
      return;
    }
    if (posValidas.length === 0) {
      setError('Debes ingresar al menos una PO.');
      return;
    }

    setSubmitting(true);

    try {
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      let nombreUsuario = 'Sistema';

      if (user?.email) {
        const { data: usuarioData } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('email', user.email)
          .maybeSingle();
        if (usuarioData) nombreUsuario = usuarioData.nombre;
      }

      // Subir archivos a Storage
      const urlsDocumentos: string[] = [];
      for (const file of files) {
        const tempId = crypto.randomUUID();
        const fileName = `caa/${tempId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('expedientes-documentos')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          if (uploadError.message.includes('not found') || uploadError.message.includes('does not exist')) {
            throw new Error('El bucket de almacenamiento no está configurado. Crea el bucket "expedientes-documentos" en Supabase Storage.');
          }
          throw new Error(`Error subiendo ${file.name}: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('expedientes-documentos')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          urlsDocumentos.push(urlData.publicUrl);
        }
      }

      // Crear UN solo expediente con todas las POs unidas
      const ahora = new Date().toISOString();
      const hoy = new Date().toISOString().split('T')[0];
      const posCombinadas = posValidas.join(' / ');

      const { data: expediente, error: insertError } = await supabase
        .from('expedientes')
        .insert([{
          po_tiquetera: posCombinadas,
          tipo_po: tipoRuta,
          solicitante: nombreUsuario,
          fecha_solicitud: hoy,
          prioridad: 'Media',
          prioridad_urgente: false,
          motivo_urgencia: null,
          dificultad: 'Media',
          tiempo_minutos: 0,
          dias_entrega: 0,
          fecha_requerimiento: hoy,
          exp_id: 'Por Asignar',
          doc: urlsDocumentos,
          lineas_oc: 0,
          bl_cargado: blCargado,
          fecha_creacion_expediente: hoy,
          estado_expediente: 'No Asignado',
          responsable_creacion: nombreUsuario,
          instrucciones_adicionales: null,
          tipo_modulo: tipoModulo,
          created_at: ahora
        }])
        .select()
        .single();

      if (insertError) throw new Error(`Error al crear el expediente: ${insertError.message}`);

      // Registrar tiempo inicial en estado "No Asignado"
      await supabase.from('expedientes_tiempos_estados').insert([{
        expediente_id: expediente.id,
        estado_anterior: null,
        estado_nuevo: 'No Asignado',
        fecha_inicio: ahora,
        fecha_fin: null,
        minutos_transcurridos: null
      }]);

      // Registrar en historial
      await supabase.from('expedientes_historial').insert([{
        expediente_id: expediente.id,
        campo_modificado: 'Estado',
        valor_anterior: '',
        valor_nuevo: 'No Asignado',
        usuario: nombreUsuario,
        fecha_cambio: ahora
      }]);

      setSolicitudesCreadas([{ pos: posValidas, id: expediente.id, modulo: tipoModulo }]);
      // Reset form
      setFiles([]);
      setPos([{ id: crypto.randomUUID(), value: '' }]);
      setTipoModulo(null);
      setTipoRuta('');
      setBlCargado(false);
    } catch (err: any) {
      setError(err.message || 'Error al crear las solicitudes.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSolicitudesCreadas([]);
    setError(null);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 flex items-center justify-center bg-teal-100 rounded-lg">
            <i className="ri-file-upload-line text-teal-700 text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carga de Documentos CAA</h1>
            <p className="text-gray-500 text-sm">Sube documentos y asócialos a POs — se crearán solicitudes automáticamente en el Kanban</p>
          </div>
        </div>
      </div>

      {/* Éxito */}
      {solicitudesCreadas.length > 0 && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-green-100 rounded-full flex-shrink-0">
              <i className="ri-checkbox-circle-line text-green-600 text-2xl"></i>
            </div>
            <div className="flex-1">
              <h3 className="text-green-800 font-bold text-lg mb-2">¡Solicitud creada!</h3>
              <p className="text-green-700 text-sm mb-4">
                El expediente está ahora en la columna <strong>"No Asignado"</strong> del Kanban{' '}
                <strong>{solicitudesCreadas[0]?.modulo === 'dropship' ? 'Dropship' : 'ZF'}</strong> con{' '}
                <strong>{solicitudesCreadas[0]?.pos.length} PO(s)</strong> y los documentos adjuntos.
              </p>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${solicitudesCreadas[0]?.modulo === 'dropship' ? 'bg-teal-100 text-teal-700' : 'bg-sky-100 text-sky-700'}`}>
                    {solicitudesCreadas[0]?.modulo === 'dropship' ? 'Dropship' : 'ZF'}
                  </span>
                  <span className="text-xs text-gray-400">ID: {solicitudesCreadas[0]?.id.slice(0, 8)}...</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {solicitudesCreadas[0]?.pos.map((p, i) => (
                    <span key={i} className="text-sm font-semibold bg-green-50 text-green-800 px-3 py-1 rounded-full border border-green-200">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={resetForm}
                className="mt-4 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line mr-2"></i>
                Cargar más documentos
              </button>
            </div>
          </div>
        </div>
      )}

      {solicitudesCreadas.length === 0 && (
        <div className="space-y-6">
          {/* Paso 1: Tipo de módulo */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 flex items-center justify-center bg-teal-600 text-white rounded-full text-xs font-bold flex-shrink-0">1</span>
              <h2 className="text-base font-bold text-gray-900">Selecciona el tipo de módulo</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <button
                type="button"
                onClick={() => setTipoModulo('dropship')}
                className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer text-left ${
                  tipoModulo === 'dropship'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {tipoModulo === 'dropship' && (
                  <div className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center bg-teal-500 rounded-full">
                    <i className="ri-check-line text-white text-xs"></i>
                  </div>
                )}
                <div className={`w-10 h-10 flex items-center justify-center rounded-lg mb-3 ${tipoModulo === 'dropship' ? 'bg-teal-100' : 'bg-gray-100'}`}>
                  <i className={`ri-ship-line text-xl ${tipoModulo === 'dropship' ? 'text-teal-700' : 'text-gray-500'}`}></i>
                </div>
                <h3 className={`font-bold text-sm ${tipoModulo === 'dropship' ? 'text-teal-800' : 'text-gray-800'}`}>Dropship</h3>
                <p className={`text-xs mt-1 ${tipoModulo === 'dropship' ? 'text-teal-600' : 'text-gray-500'}`}>
                  Expedientes del flujo Dropship
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTipoModulo('zf')}
                className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer text-left ${
                  tipoModulo === 'zf'
                    ? 'border-sky-500 bg-sky-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {tipoModulo === 'zf' && (
                  <div className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center bg-sky-500 rounded-full">
                    <i className="ri-check-line text-white text-xs"></i>
                  </div>
                )}
                <div className={`w-10 h-10 flex items-center justify-center rounded-lg mb-3 ${tipoModulo === 'zf' ? 'bg-sky-100' : 'bg-gray-100'}`}>
                  <i className={`ri-building-line text-xl ${tipoModulo === 'zf' ? 'text-sky-700' : 'text-gray-500'}`}></i>
                </div>
                <h3 className={`font-bold text-sm ${tipoModulo === 'zf' ? 'text-sky-800' : 'text-gray-800'}`}>Zona Franca (ZF)</h3>
                <p className={`text-xs mt-1 ${tipoModulo === 'zf' ? 'text-sky-600' : 'text-gray-500'}`}>
                  Expedientes del flujo ZF
                </p>
              </button>
            </div>

            {/* Ruta Logística */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ruta Logística <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                { key: 'ZF - OVERSEAS', label: 'ZF - OVERSEAS LOGISTICS OPERATIONS' },
                { key: 'Directo CR - CONSORCIO', label: 'Directo CR - CONSORCIO FERRETERO DE SAN JOSE, S.A.' },
                { key: 'Directo CR - EPA CR', label: 'Directo CR - FERRETERIA EPA, S.A.' },
                { key: 'Directo GT - EPA GT', label: 'Directo GT - FERRETERIA EPA, S.A.' },
                { key: 'Directo SV - EPA SV', label: 'Directo SV - FERRETERIA EPA, C.A.' },
                { key: 'Directo VE - FEBECA', label: 'Directo VE - FEBECA C.A.' },
                { key: 'Directo VE - EPA VE', label: 'Directo VE - FERRETERIA EPA, C.A.' },
                { key: 'GL GT - EPA GT', label: 'GL GT - FERRETERIA EPA, S.A. (Guatemala)' },
                { key: 'GL SV - EPA SV', label: 'GL SV - FERRETERIA EPA, S.A. DE C.V.' },
              ].map(ruta => (
                  <button
                    key={ruta.key}
                    type="button"
                    onClick={() => setTipoRuta(ruta.key)}
                    title={ruta.label}
                    className={`py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all cursor-pointer text-left leading-tight ${
                      tipoRuta === ruta.key
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {ruta.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Paso 2: Documentos */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 flex items-center justify-center bg-teal-600 text-white rounded-full text-xs font-bold flex-shrink-0">2</span>
              <h2 className="text-base font-bold text-gray-900">Adjunta los documentos CAA</h2>
              <span className="text-xs text-gray-400">(PDF, Excel, CSV, Word)</span>
            </div>

            {/* Checkbox BL */}
            <div className="flex items-center gap-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <button
                type="button"
                onClick={() => setBlCargado(!blCargado)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                  blCargado ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    blCargado ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <div className="flex-1">
                <label className="text-sm font-semibold text-blue-800 cursor-pointer" onClick={() => setBlCargado(!blCargado)}>
                  ¿El documento cargado es un BL (Bill of Lading)?
                </label>
                <p className="text-xs text-blue-600 mt-0.5">Marca esta opción si adjuntaste el Bill of Lading</p>
              </div>
            </div>

            {/* Zona de drag & drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
              }`}
            >
              <div className={`w-14 h-14 flex items-center justify-center rounded-full mb-3 ${isDragging ? 'bg-teal-100' : 'bg-gray-100'}`}>
                <i className={`ri-upload-cloud-2-line text-3xl ${isDragging ? 'text-teal-600' : 'text-gray-400'}`}></i>
              </div>
              <p className={`font-medium text-sm ${isDragging ? 'text-teal-700' : 'text-gray-600'}`}>
                {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz click para seleccionar'}
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF · Excel · CSV · Word</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Lista de archivos */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{files.length} archivo(s) seleccionado(s)</p>
                {files.map((file, index) => {
                  const { icon, color, bg } = getFileIcon(file.name);
                  return (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
                        <i className={`${icon} ${color} text-lg`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer flex-shrink-0"
                      >
                        <i className="ri-close-line text-lg"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Paso 3: POs */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 flex items-center justify-center bg-teal-600 text-white rounded-full text-xs font-bold flex-shrink-0">3</span>
                <h2 className="text-base font-bold text-gray-900">POs asociadas</h2>
                <span className="text-xs text-gray-400">(todas las POs van en el mismo expediente)</span>
              </div>
              <button
                type="button"
                onClick={addPO}
                className="flex items-center gap-1.5 px-3 py-1.5 text-teal-700 bg-teal-50 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line text-base"></i>
                Agregar PO
              </button>
            </div>

            <div className="space-y-3">
              {pos.map((po, index) => (
                <div key={po.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-500">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={po.value}
                    onChange={(e) => updatePO(po.id, e.target.value)}
                    placeholder="Ej: PO-2024-00123"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                  {pos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePO(po.id)}
                      className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                    >
                      <i className="ri-delete-bin-line text-lg"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <i className="ri-information-line"></i>
              Se creará <strong className="text-gray-600">1 expediente</strong> en el Kanban de {tipoModulo === 'dropship' ? 'Dropship' : tipoModulo === 'zf' ? 'ZF' : 'el módulo seleccionado'} con las {pos.filter(p => p.value.trim()).length || 0} PO(s) y todos los documentos adjuntos.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <i className="ri-error-warning-line text-red-500 text-xl flex-shrink-0 mt-0.5"></i>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Resumen + Submit */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Resumen de la solicitud</h3>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className={`text-lg font-bold mb-1 ${tipoModulo ? (tipoModulo === 'dropship' ? 'text-teal-600' : 'text-sky-600') : 'text-gray-400'}`}>
                  {tipoModulo ? (tipoModulo === 'dropship' ? 'Dropship' : 'ZF') : '—'}
                </div>
                <p className="text-xs text-gray-500">Módulo</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className={`text-lg font-bold mb-1 ${tipoRuta ? 'text-teal-600' : 'text-gray-400'}`}>
                  {tipoRuta || '—'}
                </div>
                <p className="text-xs text-gray-500">Ruta</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className={`text-lg font-bold mb-1 ${files.length > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                  {files.length}
                </div>
                <p className="text-xs text-gray-500">Documento(s)</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className={`text-lg font-bold mb-1 ${pos.filter(p => p.value.trim()).length > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                  {pos.filter(p => p.value.trim()).length}
                </div>
                <p className="text-xs text-gray-500">PO(s)</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className={`text-lg font-bold mb-1 ${blCargado ? 'text-blue-600' : 'text-gray-400'}`}>
                  {blCargado ? 'Sí' : 'No'}
                </div>
                <p className="text-xs text-gray-500">BL</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0"></div>
                  Creando solicitudes...
                </>
              ) : (
                <>
                  <i className="ri-send-plane-line text-lg"></i>
                  Crear expediente en el Kanban
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}