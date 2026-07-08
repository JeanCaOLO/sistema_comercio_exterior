import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface DocumentoCAA {
  id: string;
  po_tiquetera: string;
  tipo_po: string;
  solicitante: string;
  tipo_modulo: string;
  bl_cargado: boolean;
  doc: string | string[] | null;
  created_at: string;
  responsable_creacion: string;
}

export default function Documentacion() {
  const [documentos, setDocumentos] = useState<DocumentoCAA[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetModulo, setTargetModulo] = useState<'dropship' | 'zf'>('dropship');
  const [generando, setGenerando] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [usuarioActual, setUsuarioActual] = useState('Sistema');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    cargarDocumentos();
    obtenerUsuarioActual();
  }, []);

  const obtenerUsuarioActual = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('email', user.email)
          .maybeSingle();
        if (usuario) setUsuarioActual(usuario.nombre);
      }
    } catch (error) {
      console.error('Error al obtener usuario:', error);
    }
  };

  const cargarDocumentos = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('documentos_caa')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const documentos = data || [];
      setDocumentos(documentos);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      setDocumentos([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === documentos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documentos.map(d => d.id)));
    }
  };

  const getDocCount = (doc: string | string[] | null): number => {
    if (!doc) return 0;
    if (Array.isArray(doc)) return doc.length;
    try {
      const parsed = JSON.parse(doc);
      return Array.isArray(parsed) ? parsed.length : 1;
    } catch {
      return doc.trim() ? 1 : 0;
    }
  };

  const generarTickets = async () => {
    if (selectedIds.size === 0) {
      setErrorMessage('Selecciona al menos un documento para generar ticket.');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }

    setGenerando(true);
    setShowError(false);
    setShowSuccess(false);

    try {
      const ahora = new Date().toISOString();
      const hoy = ahora.split('T')[0];

      const { data: { user } } = await supabase.auth.getUser();
      let nombreUsuario = 'Sistema';
      if (user) {
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('email', user.email)
          .single();
        if (usuario) nombreUsuario = usuario.nombre;
      }

      const ids = Array.from(selectedIds);

      // Obtener los documentos completos desde documentos_caa
      const { data: docsCAA, error: fetchError } = await supabase
        .from('documentos_caa')
        .select('*')
        .in('id', ids);

      if (fetchError) throw new Error(`Error al leer documentos: ${fetchError.message}`);
      if (!docsCAA || docsCAA.length === 0) throw new Error('No se encontraron los documentos seleccionados.');

      // === CONSOLIDAR: merger todas las POs y docs en UN solo ticket ===

      const todasLasPOs: string[] = [];
      const todosLosDocs: string[] = [];
      let algunBL = false;

      for (const doc of docsCAA) {
        // Parsear POs — cada fila puede tener múltiples POs separadas por " / "
        if (doc.po_tiquetera) {
          const pos = doc.po_tiquetera.split('/').map((p: string) => p.trim()).filter(Boolean);
          todasLasPOs.push(...pos);
        }

        // Parsear documentos
        if (doc.doc) {
          let docUrls: string[] = [];
          if (Array.isArray(doc.doc)) {
            docUrls = doc.doc;
          } else if (typeof doc.doc === 'string') {
            try {
              const parsed = JSON.parse(doc.doc);
              docUrls = Array.isArray(parsed) ? parsed : [doc.doc];
            } catch {
              docUrls = doc.doc.trim() ? [doc.doc] : [];
            }
          }
          todosLosDocs.push(...docUrls);
        }

        if (doc.bl_cargado) algunBL = true;
      }

      // Dedeuplicar
      const poUnicas = [...new Set(todasLasPOs)];
      const docsUnicos = [...new Set(todosLosDocs)];

      // Usar la metadata del primer documento como base
      const primerDoc = docsCAA[0];
      const { id: _id, ...basePayload } = primerDoc;

      // Crear UN solo expediente consolidado
      const { data: nuevoExp, error: insertExpError } = await supabase
        .from('expedientes')
        .insert([{
          ...basePayload,
          po_tiquetera: poUnicas.join(' / '),
          doc: docsUnicos,
          bl_cargado: algunBL,
          estado_expediente: 'No Asignado',
          tipo_modulo: targetModulo,
          fecha_creacion_expediente: hoy,
          created_at: ahora
        }])
        .select('id')
        .single();

      if (insertExpError) throw new Error(`Error al crear el ticket consolidado: ${insertExpError.message}`);

      const nuevoExpId = nuevoExp?.id;
      if (!nuevoExpId) throw new Error('No se pudo obtener el ID del ticket creado.');

      // Registrar historial
      await supabase.from('expedientes_historial').insert([{
        expediente_id: nuevoExpId,
        campo_modificado: 'Estado',
        valor_anterior: 'Documentación',
        valor_nuevo: 'No Asignado',
        usuario: nombreUsuario,
        fecha_cambio: ahora
      }]);

      // Abrir registro de tiempo
      await supabase.from('expedientes_tiempos_estados').insert([{
        expediente_id: nuevoExpId,
        estado_anterior: 'Documentación',
        estado_nuevo: 'No Asignado',
        fecha_inicio: ahora,
        fecha_fin: null,
        minutos_transcurridos: null
      }]);

      // Eliminar los documentos procesados de la tabla staging
      await supabase
        .from('documentos_caa')
        .delete()
        .in('id', ids);

      setSuccessMessage(`¡Ticket consolidado generado! 1 expediente con ${poUnicas.length} PO(s) y ${docsUnicos.length} documento(s) enviado a ${targetModulo === 'dropship' ? 'Dropship' : 'ZF'}.`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
      setSelectedIds(new Set());
      await cargarDocumentos();
    } catch (error: any) {
      console.error('Error al generar ticket:', error);
      setErrorMessage(error.message || 'Error al generar el ticket.');
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setGenerando(false);
    }
  };

  const eliminarSeleccionados = async () => {
    if (selectedIds.size === 0) return;

    setDeleting(true);
    setShowError(false);

    try {
      const { error } = await supabase
        .from('documentos_caa')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      setSuccessMessage(`${selectedIds.size} documento(s) eliminado(s) de Documentación.`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
      setShowDeleteConfirm(false);
      await cargarDocumentos();
    } catch (error: any) {
      console.error('Error al eliminar:', error);
      setErrorMessage(error.message || 'Error al eliminar los documentos.');
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="relative inline-flex">
            <div className="w-20 h-20 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="ri-folder-open-line text-3xl text-amber-600"></i>
            </div>
          </div>
          <p className="mt-6 text-gray-700 font-semibold text-lg">Cargando documentación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 flex items-center justify-center bg-amber-100 rounded-lg">
            <i className="ri-folder-open-line text-amber-700 text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documentación</h1>
            <p className="text-gray-500 text-sm">Documentos cargados desde CAA — selecciona y genera tickets al módulo que necesites</p>
          </div>
        </div>
      </div>

      {/* Success */}
      {showSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <i className="ri-checkbox-circle-line text-green-600 text-xl"></i>
          <p className="text-green-800 font-semibold text-sm">{successMessage}</p>
        </div>
      )}

      {/* Error */}
      {showError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
          <i className="ri-error-warning-line text-red-600 text-xl"></i>
          <p className="text-red-800 font-semibold text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Empty state */}
      {documentos.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-20 h-20 mx-auto flex items-center justify-center bg-amber-50 rounded-full mb-6">
            <i className="ri-inbox-line text-4xl text-amber-400"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No hay documentos pendientes</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Los documentos que cargues desde <strong>Carga CAA</strong> aparecerán aquí. Desde este módulo podrás seleccionarlos y enviarlos como tickets al Kanban de Dropship o ZF.
          </p>
        </div>
      )}

      {/* Toolbar */}
      {documentos.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-4">
            {/* Selector de módulo destino */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Enviar a:</span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTargetModulo('dropship')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    targetModulo === 'dropship'
                      ? 'bg-teal-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <i className="ri-ship-line mr-1.5"></i>
                  Dropship
                </button>
                <button
                  type="button"
                  onClick={() => setTargetModulo('zf')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    targetModulo === 'zf'
                      ? 'bg-sky-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <i className="ri-building-line mr-1.5"></i>
                  ZF
                </button>
              </div>
            </div>

            <div className="flex-1"></div>

            {/* Contador */}
            <span className="text-sm text-gray-500 whitespace-nowrap">
              <span className="font-bold text-amber-600">{selectedIds.size}</span> de {documentos.length} seleccionado(s)
            </span>

            {/* Botón eliminar */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 text-red-600 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <i className="ri-delete-bin-line mr-1.5"></i>
              Eliminar
            </button>

            {/* Botón generar ticket */}
            <button
              type="button"
              onClick={generarTickets}
              disabled={selectedIds.size === 0 || generando}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${
                targetModulo === 'dropship'
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {generando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0"></div>
                  Generando...
                </>
              ) : (
                <>
                  <i className="ri-send-plane-line"></i>
                  Consolidar en 1 Ticket ({selectedIds.size} filas)
                </>
              )}
            </button>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === documentos.length && documentos.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">POs Asociadas</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Módulo</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ruta Logística</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">BL</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Docs</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Cargado por</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Fecha</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documentos.map((doc) => {
                    const isSelected = selectedIds.has(doc.id);
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => toggleSelect(doc.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => { e.stopPropagation(); toggleSelect(doc.id); }}
                            className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm font-semibold text-gray-900">{doc.po_tiquetera}</div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            doc.tipo_modulo === 'dropship'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}>
                            {doc.tipo_modulo === 'dropship' ? 'Dropship' : 'ZF'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-xs text-gray-600 max-w-[200px] truncate" title={doc.tipo_po}>
                            {doc.tipo_po}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {doc.bl_cargado ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              BL
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-700">{getDocCount(doc.doc)}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full">
                              <i className="ri-user-line text-xs text-gray-500"></i>
                            </div>
                            <span className="text-sm text-gray-700">{doc.responsable_creacion}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="text-xs text-gray-500">{formatDate(doc.created_at)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal confirmación eliminar */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-full flex-shrink-0">
                  <i className="ri-alert-line text-red-600 text-xl"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">¿Eliminar documentos?</h3>
                  <p className="text-sm text-gray-500">
                    Se eliminarán <strong>{selectedIds.size}</strong> documento(s) de Documentación. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-5 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={eliminarSeleccionados}
                  disabled={deleting}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}