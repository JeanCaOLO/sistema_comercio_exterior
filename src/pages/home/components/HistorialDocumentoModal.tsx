import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface ModificacionRecord {
  id: string;
  registro_id: string;
  tabla_origen: string;
  exp_id: string | null;
  po_tiquetera: string | null;
  usuario: string;
  usuario_email: string | null;
  accion: string;
  detalle: any;
  documentos_anteriores: string[] | null;
  documentos_nuevos: string[] | null;
  created_at: string;
}

interface HistorialDocumentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  registroId: string;
  poTiquetera: string;
  expId: string;
}

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

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTimeAgo = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Ahora mismo';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return formatDate(dateStr);
};

export default function HistorialDocumentoModal({ isOpen, onClose, registroId, poTiquetera, expId }: HistorialDocumentoModalProps) {
  const [modificaciones, setModificaciones] = useState<ModificacionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      cargarHistorial();
    }
  }, [isOpen, registroId]);

  const cargarHistorial = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('documento_modificaciones')
        .select('*')
        .eq('registro_id', registroId)
        .order('created_at', { ascending: false });

      if (queryError) {
        // Si la tabla no existe, mostramos mensaje amigable
        if (queryError.message?.includes('does not exist') || queryError.code === '42P01') {
          setError('La tabla de auditoría aún no fue creada en la base de datos. Ejecutá el SQL de creación en Supabase Dashboard.');
        } else {
          setError('No se pudo cargar el historial: ' + queryError.message);
        }
        setModificaciones([]);
      } else {
        setModificaciones(data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado al cargar el historial.');
      setModificaciones([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItem(prev => prev === id ? null : id);
  };

  if (!isOpen) return null;

  const cambiosDocs = (mod: ModificacionRecord) => {
    const anteriores = mod.documentos_anteriores || [];
    const nuevos = mod.documentos_nuevos || [];
    const agregados = nuevos.filter((u: string) => !anteriores.includes(u));
    const eliminados = anteriores.filter((u: string) => !nuevos.includes(u));
    return { agregados, eliminados, anteriores, nuevos };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg">
              <i className="ri-history-line text-gray-700 text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Historial de Modificaciones</h2>
              <p className="text-xs text-gray-500">
                {poTiquetera}
                {expId && ` — ${expId}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm text-gray-500">Cargando historial...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <div className="w-12 h-12 flex items-center justify-center bg-amber-100 rounded-full mx-auto mb-3">
                <i className="ri-information-line text-amber-600 text-2xl"></i>
              </div>
              <p className="text-amber-800 font-medium mb-1">Historial no disponible</p>
              <p className="text-amber-700 text-sm max-w-md mx-auto">{error}</p>
            </div>
          ) : modificaciones.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 flex items-center justify-center bg-gray-50 rounded-full mx-auto mb-4">
                <i className="ri-file-search-line text-3xl text-gray-300"></i>
              </div>
              <h3 className="text-base font-bold text-gray-700 mb-1">Sin modificaciones registradas</h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                Este registro aún no ha sido modificado. Cuando alguien edite los documentos, el historial aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Línea de timeline */}
              <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-200"></div>

              <div className="space-y-6">
                {modificaciones.map((mod, idx) => {
                  const isExpanded = expandedItem === mod.id;
                  const { agregados, eliminados } = cambiosDocs(mod);
                  const esUltimo = idx === modificaciones.length - 1;

                  return (
                    <div key={mod.id} className="relative pl-12">
                      {/* Punto del timeline */}
                      <div className={`absolute left-[11px] top-1.5 w-[18px] h-[18px] rounded-full border-2 border-white flex items-center justify-center ${
                        esUltimo ? 'bg-amber-500' : 'bg-gray-300'
                      }`}>
                        {esUltimo && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>

                      {/* Tarjeta del evento */}
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {/* Header de la tarjeta */}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full flex-shrink-0">
                                <i className="ri-user-line text-xs text-gray-500"></i>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{mod.usuario}</p>
                                {mod.usuario_email && (
                                  <p className="text-xs text-gray-400 truncate">{mod.usuario_email}</p>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0" title={formatDate(mod.created_at)}>
                              {getTimeAgo(mod.created_at)}
                            </span>
                          </div>

                          {/* Acción realizada */}
                          <p className="text-sm text-gray-700 leading-relaxed">{mod.accion}</p>

                          {/* Botón para expandir detalles */}
                          {(agregados.length > 0 || eliminados.length > 0) && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(mod.id)}
                              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                            >
                              <i className={`text-sm ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                              {isExpanded ? 'Ocultar detalle de archivos' : 'Ver detalle de archivos'}
                            </button>
                          )}
                        </div>

                        {/* Detalle expandido de archivos */}
                        {isExpanded && (agregados.length > 0 || eliminados.length > 0) && (
                          <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 space-y-3">
                            {agregados.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                                  <i className="ri-add-circle-line"></i>
                                  Agregados ({agregados.length})
                                </p>
                                <div className="space-y-1.5">
                                  {agregados.map((url: string, i: number) => (
                                    <div key={`add-${i}`} className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                                      <i className="ri-file-line text-green-500 text-sm flex-shrink-0"></i>
                                      <span className="text-xs text-green-800 truncate">{extractFileName(url)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {eliminados.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                                  <i className="ri-indeterminate-circle-line"></i>
                                  Eliminados ({eliminados.length})
                                </p>
                                <div className="space-y-1.5">
                                  {eliminados.map((url: string, i: number) => (
                                    <div key={`del-${i}`} className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                                      <i className="ri-file-line text-red-500 text-sm flex-shrink-0"></i>
                                      <span className="text-xs text-red-800 truncate">{extractFileName(url)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-400">
            <i className="ri-information-line mr-1"></i>
            {modificaciones.length} modificación(es) registrada(s)
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}