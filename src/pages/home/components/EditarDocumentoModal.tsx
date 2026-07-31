import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface RegistroDocumento {
  id: string;
  po_tiquetera: string;
  tipo_po: string;
  solicitante: string;
  tipo_modulo: string;
  estado_expediente: string;
  bl_cargado: boolean;
  doc: string | string[] | null;
  exp_id: string;
  created_at: string;
  responsable_creacion: string;
  prioridad: string;
  prioridad_urgente: boolean;
  origen?: string;
  instrucciones_adicionales?: string | null;
}

interface EditarDocumentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  registro: RegistroDocumento;
  onSaved: () => void;
}

const parseDocUrls = (doc: string | string[] | null): string[] => {
  if (!doc) return [];
  if (Array.isArray(doc)) return doc;
  try {
    const parsed = JSON.parse(doc);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return doc.trim() ? [doc] : [];
  }
};

const extractFileName = (url: string): string => {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/');
    const rawName = segments[segments.length - 1] || 'documento';
    const underscoreIdx = rawName.indexOf('_');
    if (underscoreIdx > 0 && /^\d{13}_/.test(rawName)) {
      return decodeURIComponent(rawName.substring(underscoreIdx + 1));
    }
    return decodeURIComponent(rawName);
  } catch {
    return 'documento';
  }
};

const getFileIconFromUrl = (url: string) => {
  const name = extractFileName(url).toLowerCase();
  if (name.endsWith('.pdf')) return { icon: 'ri-file-pdf-line', color: 'text-red-500', bg: 'bg-red-50' };
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return { icon: 'ri-file-excel-line', color: 'text-green-500', bg: 'bg-green-50' };
  if (name.endsWith('.csv')) return { icon: 'ri-file-text-line', color: 'text-teal-500', bg: 'bg-teal-50' };
  if (name.endsWith('.doc') || name.endsWith('.docx')) return { icon: 'ri-file-word-line', color: 'text-sky-500', bg: 'bg-sky-50' };
  return { icon: 'ri-file-line', color: 'text-gray-500', bg: 'bg-gray-50' };
};

const getFileIconFromFile = (fileName: string) => {
  const name = fileName.toLowerCase();
  if (name.endsWith('.pdf')) return { icon: 'ri-file-pdf-line', color: 'text-red-500', bg: 'bg-red-50' };
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return { icon: 'ri-file-excel-line', color: 'text-green-500', bg: 'bg-green-50' };
  if (name.endsWith('.csv')) return { icon: 'ri-file-text-line', color: 'text-teal-500', bg: 'bg-teal-50' };
  if (name.endsWith('.doc') || name.endsWith('.docx')) return { icon: 'ri-file-word-line', color: 'text-sky-500', bg: 'bg-sky-50' };
  return { icon: 'ri-file-line', color: 'text-gray-500', bg: 'bg-gray-50' };
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const sanitizeFileName = (name: string): string => {
  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex > 0 ? name.substring(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.substring(dotIndex) : '';
  const sanitized = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return sanitized + ext;
};

export default function EditarDocumentoModal({ isOpen, onClose, registro, onSaved }: EditarDocumentoModalProps) {
  const [documentosActuales, setDocumentosActuales] = useState<string[]>([]);
  const [documentosEliminados, setDocumentosEliminados] = useState<string[]>([]);
  const [nuevosArchivos, setNuevosArchivos] = useState<File[]>([]);
  const [blCargado, setBlCargado] = useState(false);
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializar estado cuando cambia el registro o se abre el modal
  useEffect(() => {
    if (isOpen) {
      const urls = parseDocUrls(registro.doc);
      setDocumentosActuales(urls);
      setDocumentosEliminados([]);
      setNuevosArchivos([]);
      setBlCargado(registro.bl_cargado || false);
      setComentario(registro.instrucciones_adicionales || '');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, registro.id]);

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
    setNuevosArchivos(prev => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ['pdf', 'xlsx', 'xls', 'csv', 'doc', 'docx'].includes(ext || '');
      });
      setNuevosArchivos(prev => [...prev, ...selected]);
    }
  };

  const quitarDocumentoExistente = (url: string) => {
    setDocumentosActuales(prev => prev.filter(u => u !== url));
    setDocumentosEliminados(prev => [...prev, url]);
  };

  const restaurarDocumento = (url: string) => {
    setDocumentosEliminados(prev => prev.filter(u => u !== url));
    setDocumentosActuales(prev => [...prev, url]);
  };

  const quitarNuevoArchivo = (index: number) => {
    setNuevosArchivos(prev => prev.filter((_, i) => i !== index));
  };

  const handleGuardar = async () => {
    setError(null);
    setSuccessMsg(null);

    if (documentosActuales.length === 0 && nuevosArchivos.length === 0) {
      setError('El registro debe tener al menos un documento.');
      return;
    }

    setSaving(true);

    try {
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      let nombreUsuario = 'Sistema';
      let emailUsuario = '';

      if (user?.email) {
        emailUsuario = user.email;
        const { data: usuarioData } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('email', user.email)
          .maybeSingle();
        if (usuarioData) nombreUsuario = usuarioData.nombre;
      }

      // Subir nuevos archivos
      const nuevasUrls: string[] = [];
      for (const file of nuevosArchivos) {
        const tempId = crypto.randomUUID();
        const fileName = `caa/${tempId}/${Date.now()}_${sanitizeFileName(file.name)}`;
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
          nuevasUrls.push(urlData.publicUrl);
        }
      }

      // Construir array final de documentos
      const documentosFinales = [...documentosActuales, ...nuevasUrls];
      const docJson = JSON.stringify(documentosFinales);

      // Datos de auditoría
      const docsAnteriores = parseDocUrls(registro.doc);
      const acciones: string[] = [];

      if (nuevosArchivos.length > 0) {
        acciones.push(`Agregó ${nuevosArchivos.length} documento(s)`);
      }
      if (documentosEliminados.length > 0) {
        acciones.push(`Eliminó ${documentosEliminados.length} documento(s)`);
      }
      if (blCargado !== registro.bl_cargado) {
        acciones.push(`Cambió BL de ${registro.bl_cargado ? 'Sí' : 'No'} a ${blCargado ? 'Sí' : 'No'}`);
      }
      if (comentario !== (registro.instrucciones_adicionales || '')) {
        acciones.push('Editó el comentario');
      }

      const accionDescripcion = acciones.length > 0 ? acciones.join('; ') : 'Sin cambios en documentos';

      const auditRecord = {
        registro_id: registro.id,
        tabla_origen: registro.origen === 'cca' ? 'documentos_caa' : 'expedientes',
        exp_id: registro.exp_id,
        po_tiquetera: registro.po_tiquetera,
        usuario: nombreUsuario,
        usuario_email: emailUsuario,
        accion: accionDescripcion,
        detalle: {
          documentos_agregados: nuevosArchivos.length,
          documentos_eliminados: documentosEliminados.length,
          bl_modificado: blCargado !== registro.bl_cargado,
          comentario_modificado: comentario !== (registro.instrucciones_adicionales || ''),
        },
        documentos_anteriores: docsAnteriores,
        documentos_nuevos: documentosFinales,
      };

      // Actualizar en la tabla de origen
      const tablaOrigen = registro.origen === 'cca' ? 'documentos_caa' : 'expedientes';

      const updateData: Record<string, any> = {
        doc: docJson,
        bl_cargado: blCargado,
        instrucciones_adicionales: comentario.trim() || null,
      };

      const { error: updateError } = await supabase
        .from(tablaOrigen)
        .update(updateData)
        .eq('id', registro.id);

      if (updateError) throw new Error(`Error al actualizar en ${tablaOrigen}: ${updateError.message}`);

      // Si el registro es de expedientes, también verificar si existe en documentos_caa
      // y viceversa, para mantener sincronización
      if (registro.origen === 'expediente' && registro.exp_id && registro.exp_id !== 'Por Asignar') {
        const { data: docCaaMatch } = await supabase
          .from('documentos_caa')
          .select('id')
          .eq('exp_id', registro.exp_id)
          .maybeSingle();

        if (docCaaMatch) {
          await supabase
            .from('documentos_caa')
            .update({ doc: docJson, bl_cargado: blCargado, instrucciones_adicionales: comentario.trim() || null })
            .eq('id', docCaaMatch.id);

          // Registrar también en auditoría para documentos_caa
          try {
            await supabase.from('documento_modificaciones').insert([{
              ...auditRecord,
              registro_id: docCaaMatch.id,
              tabla_origen: 'documentos_caa',
            }]);
          } catch (auditErr: any) {
            console.error('[Auditoría] Error al insertar en documento_modificaciones (CCA match):', auditErr.message || auditErr);
          }
        }
      }

      if (registro.origen === 'cca' && registro.exp_id && registro.exp_id !== 'Por Asignar') {
        const { data: expMatch } = await supabase
          .from('expedientes')
          .select('id')
          .eq('exp_id', registro.exp_id)
          .maybeSingle();

        if (expMatch) {
          await supabase
            .from('expedientes')
            .update({ doc: docJson, bl_cargado: blCargado, instrucciones_adicionales: comentario.trim() || null })
            .eq('id', expMatch.id);

          try {
            await supabase.from('documento_modificaciones').insert([{
              ...auditRecord,
              registro_id: expMatch.id,
              tabla_origen: 'expedientes',
            }]);
          } catch (auditErr: any) {
            console.error('[Auditoría] Error al insertar en documento_modificaciones (expediente match):', auditErr.message || auditErr);
          }
        }
      }

      // Insertar auditoría principal
      try {
        const { error: auditInsertError } = await supabase.from('documento_modificaciones').insert([auditRecord]);
        if (auditInsertError) {
          console.error('[Auditoría] Error al insertar en documento_modificaciones:', auditInsertError.message);
        }
      } catch (auditErr: any) {
        console.error('[Auditoría] Error al insertar en documento_modificaciones (principal):', auditErr.message || auditErr);
        // No bloqueamos el guardado, pero avisamos en el mensaje de éxito
        setSuccessMsg('Registro actualizado correctamente. (El historial de modificaciones no se pudo guardar — revisá la consola para más detalles).');
        setSaving(false);
        setTimeout(() => {
          onSaved();
          onClose();
        }, 2000);
        return;
      }

      setSuccessMsg('Registro actualizado correctamente.');

      // Cerrar después de breve delay
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1200);

    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleCerrar = () => {
    setDocumentosActuales([]);
    setDocumentosEliminados([]);
    setNuevosArchivos([]);
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  if (!isOpen) return null;

  const totalDocumentos = documentosActuales.length + nuevosArchivos.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={handleCerrar}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-amber-100 rounded-lg">
              <i className="ri-edit-line text-amber-700 text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Editar Registro de Documentos</h2>
              <p className="text-xs text-gray-500">{registro.po_tiquetera} — {registro.exp_id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCerrar}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Info del registro */}
          <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-gray-500">Módulo</p>
              <p className="text-sm font-semibold text-gray-800">{registro.tipo_modulo === 'dropship' ? 'Dropship' : 'ZF'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Ruta</p>
              <p className="text-sm font-semibold text-gray-800 truncate" title={registro.tipo_po}>{registro.tipo_po}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Estado</p>
              <p className="text-sm font-semibold text-gray-800">{registro.estado_expediente}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Solicitante</p>
              <p className="text-sm font-semibold text-gray-800">{registro.solicitante}</p>
            </div>
          </div>

          {/* BL Toggle */}
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
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
            <div>
              <p className="text-sm font-semibold text-blue-800">Documento BL (Bill of Lading)</p>
              <p className="text-xs text-blue-600">{blCargado ? 'Marcado como BL' : 'No es un BL'}</p>
            </div>
          </div>

          {/* Documentos actuales */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">
                Documentos actuales
                <span className="ml-2 text-xs font-normal text-gray-400">({documentosActuales.length})</span>
              </h3>
            </div>

            {documentosActuales.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <i className="ri-file-search-line text-3xl text-gray-300 block mb-2"></i>
                <p className="text-sm text-gray-400">No hay documentos en este registro</p>
                <p className="text-xs text-gray-300 mt-1">Agregá archivos nuevos en la sección de abajo</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documentosActuales.map((url, idx) => {
                  const fileName = extractFileName(url);
                  const { icon, color, bg } = getFileIconFromUrl(url);
                  return (
                    <div key={`exist-${idx}`} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
                        <i className={`${icon} ${color} text-lg`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate" title={fileName}>
                          {fileName}
                        </p>
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                        title="Ver documento"
                      >
                        <i className="ri-eye-line"></i>
                      </a>
                      <button
                        type="button"
                        onClick={() => quitarDocumentoExistente(url)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                        title="Quitar documento"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Documentos eliminados (se pueden restaurar antes de guardar) */}
            {documentosEliminados.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
                  <i className="ri-arrow-go-back-line"></i>
                  Documentos marcados para eliminar ({documentosEliminados.length})
                  <span className="text-gray-400 font-normal">— Click para restaurar</span>
                </p>
                <div className="space-y-1.5">
                  {documentosEliminados.map((url, idx) => {
                    const fileName = extractFileName(url);
                    return (
                      <button
                        key={`del-${idx}`}
                        type="button"
                        onClick={() => restaurarDocumento(url)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-left hover:bg-green-50 hover:border-green-200 transition-colors cursor-pointer group"
                      >
                        <i className="ri-delete-back-line text-red-400 group-hover:text-green-500 text-sm"></i>
                        <span className="text-xs text-red-600 group-hover:text-green-600 truncate flex-1">{fileName}</span>
                        <span className="text-xs text-red-400 group-hover:text-green-500 whitespace-nowrap">Restaurar</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Agregar nuevos documentos */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              Agregar documentos
              <span className="ml-2 text-xs font-normal text-gray-400">(PDF, Excel, CSV, Word)</span>
            </h3>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-300 hover:border-amber-400 hover:bg-gray-50'
              }`}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-full mb-2 ${isDragging ? 'bg-amber-100' : 'bg-gray-100'}`}>
                <i className={`ri-upload-cloud-2-line text-2xl ${isDragging ? 'text-amber-600' : 'text-gray-400'}`}></i>
              </div>
              <p className={`font-medium text-sm ${isDragging ? 'text-amber-700' : 'text-gray-600'}`}>
                {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz click para agregar'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Nuevos archivos seleccionados */}
            {nuevosArchivos.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                  <i className="ri-add-circle-line"></i>
                  {nuevosArchivos.length} archivo(s) nuevo(s) para subir
                </p>
                {nuevosArchivos.map((file, idx) => {
                  const { icon, color, bg } = getFileIconFromFile(file.name);
                  return (
                    <div key={`new-${idx}`} className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
                        <i className={`${icon} ${color} text-lg`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => quitarNuevoArchivo(idx)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                      >
                        <i className="ri-close-line text-lg"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comentario */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">Comentario / Instrucciones</h3>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Notas, instrucciones adicionales o información relevante..."
              maxLength={500}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-400">
                <i className="ri-information-line mr-1"></i>
                Este campo es opcional
              </span>
              <span className={`text-xs font-medium ${comentario.length > 450 ? 'text-amber-600' : 'text-gray-400'}`}>
                {comentario.length}/500
              </span>
            </div>
          </div>

          {/* Resumen de cambios */}
          {(documentosEliminados.length > 0 || nuevosArchivos.length > 0 || blCargado !== registro.bl_cargado || comentario !== (registro.instrucciones_adicionales || '')) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-amber-800 mb-2">Resumen de cambios</h3>
              <ul className="space-y-1.5">
                {nuevosArchivos.length > 0 && (
                  <li className="flex items-center gap-2 text-sm text-amber-700">
                    <i className="ri-add-circle-line text-green-600"></i>
                    Se agregarán <strong>{nuevosArchivos.length}</strong> documento(s) nuevo(s)
                  </li>
                )}
                {documentosEliminados.length > 0 && (
                  <li className="flex items-center gap-2 text-sm text-amber-700">
                    <i className="ri-indeterminate-circle-line text-red-500"></i>
                    Se eliminarán <strong>{documentosEliminados.length}</strong> documento(s)
                  </li>
                )}
                {blCargado !== registro.bl_cargado && (
                  <li className="flex items-center gap-2 text-sm text-amber-700">
                    <i className="ri-swap-line text-blue-500"></i>
                    BL: {registro.bl_cargado ? 'Sí → No' : 'No → Sí'}
                  </li>
                )}
                {comentario !== (registro.instrucciones_adicionales || '') && (
                  <li className="flex items-center gap-2 text-sm text-amber-700">
                    <i className="ri-edit-line text-purple-500"></i>
                    Comentario modificado
                  </li>
                )}
                <li className="flex items-center gap-2 text-sm text-amber-700 pt-1 border-t border-amber-200">
                  <i className="ri-file-line text-gray-500"></i>
                  Total final: <strong>{totalDocumentos}</strong> documento(s)
                </li>
              </ul>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <i className="ri-error-warning-line text-red-500 text-xl flex-shrink-0 mt-0.5"></i>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <i className="ri-checkbox-circle-line text-green-500 text-xl flex-shrink-0 mt-0.5"></i>
              <p className="text-green-700 text-sm">{successMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-400">
            <i className="ri-shield-check-line mr-1"></i>
            Los cambios quedan registrados con tu usuario
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCerrar}
              disabled={saving}
              className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={saving || (documentosActuales.length === 0 && nuevosArchivos.length === 0)}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="ri-save-line"></i>
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}