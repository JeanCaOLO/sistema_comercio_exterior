import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface ExpedienteRepo {
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
}

const getEstadoColor = (estado: string): string => {
  switch (estado) {
    case 'No Asignado': return 'bg-gray-400';
    case 'Nuevo': return 'bg-blue-500';
    case 'Asignado': return 'bg-purple-500';
    case 'En Proceso': return 'bg-orange-500';
    case 'En Revisión': return 'bg-yellow-500';
    case 'Recepción de Carga': return 'bg-indigo-500';
    case 'Facturación': return 'bg-pink-500';
    case 'Completado': return 'bg-emerald-500';
    case 'Arribo de Carga': return 'bg-cyan-500';
    case 'Pendiente Proforma': return 'bg-violet-500';
    case 'Espera de Respuesta': return 'bg-amber-400';
    case 'Liberación': return 'bg-green-500';
    case 'Notificado': return 'bg-lime-500';
    case 'Visto Listo': return 'bg-rose-500';
    case 'Documentación': return 'bg-amber-600';
    default: return 'bg-gray-500';
  }
};

const ESTADOS_TODOS = [
  'Documentación', 'No Asignado', 'Asignado', 'En Proceso', 'Espera de Respuesta',
  'Liberación', 'Recepción de Carga', 'Facturación', 'Notificado', 'Visto Listo',
  'Completado', 'Arribo de Carga', 'Pendiente Proforma'
];

export default function RepositorioDocumentacion() {
  const [documentos, setDocumentos] = useState<ExpedienteRepo[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<ExpedienteRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [filtroModulo, setFiltroModulo] = useState('Todos');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    cargarDocumentos();
  }, []);

  useEffect(() => {
    filtrarDocumentos();
  }, [searchTerm, filtroEstado, filtroModulo, documentos]);

  const cargarDocumentos = async () => {
    try {
      setLoading(true);

      // Cargar de documentos_caa (staging - los que vienen de CCA y aún no son expedientes)
      const { data: dataCAA, error: errorCAA } = await supabase
        .from('documentos_caa')
        .select('*')
        .order('created_at', { ascending: false });

      if (errorCAA) console.error('Error al cargar documentos_caa:', errorCAA);

      // Cargar de expedientes (los que ya fueron promovidos a expedientes reales)
      const { data: dataExp, error: errorExp } = await supabase
        .from('expedientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (errorExp) console.error('Error al cargar expedientes:', errorExp);

      // Combinar ambos: los del staging como "Documentación", los de expedientes con su estado real
      const docsCAA = (dataCAA || []).map((d: any) => ({
        ...d,
        estado_expediente: 'Documentación',
        origen: 'cca',
      }));

      const docsExp = (dataExp || []).map((d: any) => ({
        ...d,
        origen: 'expediente',
      }));

      const combinados = [...docsCAA, ...docsExp].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setDocumentos(combinados);
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      setDocumentos([]);
    } finally {
      setLoading(false);
    }
  };

  const filtrarDocumentos = () => {
    let filtered = [...documentos];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.po_tiquetera.toLowerCase().includes(term) ||
        doc.exp_id.toLowerCase().includes(term) ||
        doc.solicitante.toLowerCase().includes(term) ||
        doc.responsable_creacion.toLowerCase().includes(term) ||
        doc.tipo_po.toLowerCase().includes(term)
      );
    }

    if (filtroEstado !== 'Todos') {
      filtered = filtered.filter(doc => doc.estado_expediente === filtroEstado);
    }

    if (filtroModulo !== 'Todos') {
      filtered = filtered.filter(doc => doc.tipo_modulo === filtroModulo);
    }

    setFilteredDocs(filtered);
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

  const downloadFile = async (url: string, fileName: string) => {
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
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error al descargar:', error);
      window.open(url, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
            <div className="w-20 h-20 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="ri-archive-line text-3xl text-gray-600"></i>
            </div>
          </div>
          <p className="mt-6 text-gray-700 font-semibold text-lg">Cargando repositorio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
            <i className="ri-archive-line text-gray-700 text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Repositorio de Documentación</h1>
            <p className="text-gray-500 text-sm">Archivo completo — todos los documentos cargados desde Carga CAA, sin importar su estado actual</p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {documentos.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-20 h-20 mx-auto flex items-center justify-center bg-gray-50 rounded-full mb-6">
            <i className="ri-inbox-line text-4xl text-gray-400"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No hay documentos en el repositorio</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Una vez que cargues documentos desde <strong>Carga CAA</strong>, aparecerán aquí como archivo permanente de referencia.
          </p>
        </div>
      )}

      {/* Toolbar con filtros */}
      {documentos.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Buscador */}
              <div className="flex-1 min-w-[280px]">
                <div className="relative">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por PO, EXP ID, solicitante, responsable o ruta..."
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Filtro por estado */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Estado:</span>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent cursor-pointer"
                >
                  <option value="Todos">Todos los estados</option>
                  {ESTADOS_TODOS.map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por módulo */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Módulo:</span>
                <select
                  value={filtroModulo}
                  onChange={(e) => setFiltroModulo(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent cursor-pointer"
                >
                  <option value="Todos">Todos</option>
                  <option value="dropship">Dropship</option>
                  <option value="zf">ZF</option>
                </select>
              </div>

              {/* Contador */}
              <span className="text-sm text-gray-500 whitespace-nowrap ml-auto">
                <span className="font-bold text-gray-700">{filteredDocs.length}</span> de {documentos.length} documento(s)
              </span>
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">POs Asociadas</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">EXP ID</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Módulo</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ruta Logística</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Solicitante</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Docs</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">BL</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Cargado por</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Fecha</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <i className="ri-file-search-line text-4xl text-gray-300"></i>
                          <p className="text-gray-500 font-medium">No se encontraron documentos con esos filtros</p>
                          <p className="text-gray-400 text-sm">Probá ajustando la búsqueda o los filtros</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map((doc) => {
                      const isExpanded = expandedRows.has(doc.id);
                      const docUrls = parseDocUrls(doc.doc);
                      const docCount = docUrls.length;
                      return (
                        <>
                          <tr
                            key={doc.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-gray-900">{doc.po_tiquetera}</div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-xs text-gray-500 font-mono">{doc.exp_id}</span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                doc.tipo_modulo === 'dropship'
                                  ? 'bg-teal-100 text-teal-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}>
                                <i className={doc.tipo_modulo === 'dropship' ? 'ri-ship-line' : 'ri-building-line'}></i>
                                {doc.tipo_modulo === 'dropship' ? 'Dropship' : 'ZF'}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getEstadoColor(doc.estado_expediente)}`}>
                                {doc.estado_expediente}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-xs text-gray-600 max-w-[200px] truncate" title={doc.tipo_po}>
                                {doc.tipo_po}
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="text-sm text-gray-700">{doc.solicitante}</span>
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              {docCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(doc.id)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <i className={isExpanded ? 'ri-arrow-up-s-line text-xs' : 'ri-arrow-down-s-line text-xs'}></i>
                                  {docCount}
                                </button>
                              ) : (
                                <span className="text-sm text-gray-400">0</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              {doc.bl_cargado ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  BL
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
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
                          {/* Fila expandible con la lista de archivos */}
                          {isExpanded && docCount > 0 && (
                            <tr key={`${doc.id}-expanded`}>
                              <td colSpan={10} className="px-4 py-0 bg-gray-50/60">
                                <div className="py-3 space-y-2">
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Archivos ({docCount})
                                  </p>
                                  {docUrls.map((url, idx) => {
                                    const fileName = extractFileName(url);
                                    const { icon, color, bg } = getFileIconFromUrl(url);
                                    const isDownloading = downloadingId === url;
                                    const fileIndex = idx + 1;
                                    return (
                                      <div
                                        key={`${doc.id}-file-${idx}`}
                                        className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
                                      >
                                        <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
                                          <i className={`${icon} ${color} text-lg`}></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-800 truncate" title={fileName}>
                                            <span className="text-gray-400 text-xs mr-1.5">#{fileIndex}</span>
                                            {fileName}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                                          >
                                            <i className="ri-eye-line"></i>
                                            Ver
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => downloadFile(url, fileName)}
                                            disabled={isDownloading}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                          >
                                            {isDownloading ? (
                                              <>
                                                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0"></div>
                                                Descargando
                                              </>
                                            ) : (
                                              <>
                                                <i className="ri-download-line"></i>
                                                Descargar
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}