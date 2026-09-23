import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { parseDocEntries, esFactura, nombreDeArchivo } from '@/lib/documentos';

interface FacturaRow {
  key: string;
  po: string;
  ruta: string;
  estado: string;
  expId: string;
  origen: 'cca' | 'expediente';
  url: string;
  fileName: string;
}

const ITEMS_PER_PAGE = 25;
const TODAS_LAS_RUTAS = 'Todas';

function getFileIcon(fileName: string) {
  const name = fileName.toLowerCase();
  if (name.endsWith('.pdf')) return { icon: 'ri-file-pdf-line', color: 'text-red-500', bg: 'bg-red-50' };
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return { icon: 'ri-file-excel-line', color: 'text-green-500', bg: 'bg-green-50' };
  if (name.endsWith('.csv')) return { icon: 'ri-file-text-line', color: 'text-teal-500', bg: 'bg-teal-50' };
  if (name.endsWith('.doc') || name.endsWith('.docx')) return { icon: 'ri-file-word-line', color: 'text-sky-500', bg: 'bg-sky-50' };
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].some((e) => name.endsWith(e))) return { icon: 'ri-image-line', color: 'text-orange-500', bg: 'bg-orange-50' };
  return { icon: 'ri-file-line', color: 'text-gray-500', bg: 'bg-gray-50' };
}

// Colores de los estados que se manejan en el kanban de expedientes.
function getEstadoStyle(estado: string) {
  switch (estado) {
    case 'No Asignado':
      return 'bg-gray-100 text-gray-700';
    case 'Asignado':
      return 'bg-amber-100 text-amber-800';
    case 'En Proceso':
      return 'bg-orange-100 text-orange-800';
    case 'Espera de Respuesta':
      return 'bg-yellow-100 text-yellow-800';
    case 'Liberación':
      return 'bg-teal-100 text-teal-800';
    case 'Recepción de Carga':
      return 'bg-cyan-100 text-cyan-800';
    case 'Facturación':
      return 'bg-rose-100 text-rose-800';
    case 'Notificado':
      return 'bg-lime-100 text-lime-800';
    case 'Visto Listo':
      return 'bg-green-100 text-green-800';
    case 'Completado':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export default function Facturas() {
  const [rows, setRows] = useState<FacturaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchPO, setSearchPO] = useState('');
  const [filtroRuta, setFiltroRuta] = useState(TODAS_LAS_RUTAS);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    cargarFacturas();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchPO, filtroRuta]);

  const cargarFacturas = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resCAA, resExp] = await Promise.all([
        supabase
          .from('documentos_caa')
          .select('id, po_tiquetera, tipo_po, doc, exp_id, estado_expediente, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('expedientes')
          .select('id, po_tiquetera, tipo_po, doc, exp_id, estado_expediente, created_at')
          .order('created_at', { ascending: false }),
      ]);

      if (resCAA.error) console.error('Error al cargar facturas (CAA):', resCAA.error);
      if (resExp.error) console.error('Error al cargar facturas (expedientes):', resExp.error);

      const construirFilas = (data: any[] | null, origen: 'cca' | 'expediente'): FacturaRow[] => {
        const filas: FacturaRow[] = [];
        (data || []).forEach((d) => {
          const facturas = parseDocEntries(d.doc).filter(esFactura);
          facturas.forEach((f, idx) => {
            filas.push({
              key: `${origen}-${d.id}-${idx}`,
              po: d.po_tiquetera || '—',
              ruta: d.tipo_po || '—',
              estado: d.estado_expediente || '—',
              expId: d.exp_id || '—',
              origen,
              url: f.url,
              fileName: nombreDeArchivo(f.url),
            });
          });
        });
        return filas;
      };

      const combinadas = [
        ...construirFilas(resCAA.data as any[], 'cca'),
        ...construirFilas(resExp.data as any[], 'expediente'),
      ];

      setRows(combinadas);
    } catch (err: any) {
      console.error('Error al cargar facturas:', err);
      setError('No se pudieron cargar las facturas. Revisá la conexión e intentá de nuevo.');
      setRows([]);
    } finally {
      setLoading(false);
    }
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
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error('Error al descargar:', err);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  };

  const rutasDisponibles = Array.from(
    new Set(rows.map((r) => r.ruta).filter((r) => r && r !== '—'))
  ).sort();

  const filtradas = rows.filter((row) => {
    if (filtroRuta !== TODAS_LAS_RUTAS && row.ruta !== filtroRuta) return false;
    if (searchPO.trim()) {
      const term = searchPO.trim().toLowerCase();
      if (!row.po.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtradas.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginadas = filtradas.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const startIndex = filtradas.length > 0 ? (safePage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endIndex = Math.min(safePage * ITEMS_PER_PAGE, filtradas.length);

  const totalPOs = new Set(rows.map((r) => r.po)).size;
  const totalRutas = rutasDisponibles.length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">Cargando facturas</h3>
          <p className="text-gray-500 text-sm">Buscando archivos marcados como factura...</p>
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
            <i className="ri-bill-line text-amber-700 text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
            <p className="text-gray-500 text-sm">Facturas con su PO, ruta logística y estado del kanban</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <i className="ri-error-warning-line text-red-500 text-xl"></i>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
          <button
            type="button"
            onClick={cargarFacturas}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Resumen */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-amber-50 rounded-lg">
                <i className="ri-file-list-3-line text-amber-600 text-lg"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
                <p className="text-xs text-gray-500">Archivo(s) de factura</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-teal-50 rounded-lg">
                <i className="ri-file-text-line text-teal-600 text-lg"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalPOs}</p>
                <p className="text-xs text-gray-500">PO(s) con factura</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-orange-50 rounded-lg">
                <i className="ri-route-line text-orange-600 text-lg"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalRutas}</p>
                <p className="text-xs text-gray-500">Ruta(s) logística(s)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-20 h-20 mx-auto flex items-center justify-center bg-amber-50 rounded-full mb-6">
            <i className="ri-bill-line text-4xl text-amber-400"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Todavía no hay facturas marcadas</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Marcá el toggle <strong>"Es factura"</strong> al subir archivos en <strong>Carga CAA</strong>, o editalos desde
            <strong> Repositorio Docs</strong>. Acá vas a ver todas las facturas con su PO, ruta y estado.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[260px]">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  value={searchPO}
                  onChange={(e) => setSearchPO(e.target.value)}
                  placeholder="Buscar por PO..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Ruta:</span>
              <select
                value={filtroRuta}
                onChange={(e) => setFiltroRuta(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent cursor-pointer max-w-[280px]"
              >
                <option value={TODAS_LAS_RUTAS}>Todas las rutas</option>
                {rutasDisponibles.map((ruta) => (
                  <option key={ruta} value={ruta}>
                    {ruta}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-sm text-gray-500 whitespace-nowrap ml-auto">
              <span className="font-bold text-amber-600">{filtradas.length}</span> factura(s)
              <span className="text-gray-400 mx-1">|</span>
              Pág. {safePage} de {Math.max(1, totalPages)}
            </span>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Factura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PO</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ruta Logística</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado (Kanban)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginadas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <i className="ri-file-search-line text-4xl text-gray-300"></i>
                          <p className="text-gray-500 font-medium">No se encontraron facturas con esos filtros</p>
                          <p className="text-gray-400 text-sm">Probá ajustando el PO o la ruta</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginadas.map((row) => {
                      const { icon, color, bg } = getFileIcon(row.fileName);
                      const isDownloading = downloadingId === row.url;
                      return (
                        <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
                                <i className={`${icon} ${color} text-lg`}></i>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate max-w-[280px]" title={row.fileName}>
                                  {row.fileName}
                                </p>
                                <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                                  <i className="ri-bill-line text-[11px]"></i>
                                  Factura
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-semibold text-gray-900">{row.po}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-800">
                              <i className="ri-route-line"></i>
                              {row.ruta}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getEstadoStyle(row.estado)}`}>
                              <i className="ri-kanban-view"></i>
                              {row.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <i className="ri-eye-line"></i>
                                Ver
                              </a>
                              <button
                                type="button"
                                onClick={() => downloadFile(row.url, row.fileName)}
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
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-gray-500">
                Mostrando <strong>{startIndex}-{endIndex}</strong> de <strong>{filtradas.length}</strong> factura(s)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <i className="ri-arrow-left-s-line"></i>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === 'ellipsis' ? (
                      <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-sm text-gray-400">...</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p as number)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          safePage === p ? 'bg-amber-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <i className="ri-arrow-right-s-line"></i>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}