import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { parseDocEntries, esFactura, type DocEntry } from '@/lib/documentos';

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
  documentos_anteriores: unknown;
  documentos_nuevos: unknown;
  created_at: string;
}

interface HistorialDocumentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  registroId: string;
  poTiquetera: string;
  expId: string;
  createdAt: string;
  responsableCreacion: string;
  documentosIniciales: DocEntry[];
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

// El detalle puede venir como objeto (JSONB) o como texto JSON
const getDetalle = (mod: ModificacionRecord): Record<string, any> => {
  const d = mod.detalle;
  if (!d) return {};
  if (typeof d === 'string') {
    try {
      return JSON.parse(d);
    } catch {
      return {};
    }
  }
  return d as Record<string, any>;
};

// Un evento de "creación inicial" es el que registra la carga original de documentos
const esEventoCreacion = (mod: ModificacionRecord): boolean =>
  getDetalle(mod)?.tipo === 'creacion_inicial';

// Divide "PO1 / PO2" en partes limpias
const dividirPOs = (valor: string | null | undefined): string[] =>
  (valor || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

// Limpia un valor de PO para usarlo dentro de un filtro OR de Supabase
const limpiarParaFiltro = (valor: string): string =>
  valor.replace(/[,()%]/g, '').trim();

export default function HistorialDocumentoModal({
  isOpen,
  onClose,
  registroId,
  poTiquetera,
  expId,
  createdAt,
  responsableCreacion,
  documentosIniciales,
}: HistorialDocumentoModalProps) {
  const [eventos, setEventos] = useState<ModificacionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      cargarHistorial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, registroId]);

  const cargarHistorial = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) Eventos asociados directamente al registro actual
      const { data: directos, error: queryError } = await supabase
        .from('documento_modificaciones')
        .select('*')
        .eq('registro_id', registroId)
        .order('created_at', { ascending: true });

      if (queryError) {
        if (queryError.message?.includes('does not exist') || queryError.code === '42P01') {
          setError('La tabla de auditoría aún no fue creada en la base de datos. Ejecutá el SQL de creación en Supabase Dashboard.');
        } else {
          setError('No se pudo cargar el historial: ' + queryError.message);
        }
        setEventos([]);
        return;
      }

      const mapa = new Map<string, ModificacionRecord>();
      (directos || []).forEach((r) => mapa.set(r.id, r as ModificacionRecord));

      const extras: ModificacionRecord[] = [];
      const poPartes = dividirPOs(poTiquetera);

      // 2) Recuperar eventos "huérfanos": cambios que se hicieron sobre la fila
      //    original (todavía en Documentación) antes de consolidar el ticket.
      //    Al consolidar, esa fila se elimina y el ticket recibe otro ID, así que
      //    esos cambios quedan apuntando a un registro que ya no existe. Los
      //    recuperamos por PO para no perder quién subió cada archivo.
      if (poPartes.length > 0) {
        const orFilter = poPartes
          .map((p) => limpiarParaFiltro(p))
          .filter(Boolean)
          .map((p) => `po_tiquetera.ilike.%${p}%`)
          .join(',');

        if (orFilter) {
          const { data: porPO } = await supabase
            .from('documento_modificaciones')
            .select('*')
            .or(orFilter);

          (porPO || []).forEach((r) => {
            const rec = r as ModificacionRecord;
            if (mapa.has(rec.id)) return;
            // Evitar traer historial de OTROS tickets ya consolidados:
            // solo aceptamos filas sin asignar (exp_id 'Por Asignar'/vacío) o del mismo exp_id.
            const exp = (rec.exp_id || '').trim();
            const delMismoTicket = !exp || exp === 'Por Asignar' || (!!expId && exp === expId);
            if (!delMismoTicket) return;
            // Coincidencia real de alguna PO (evita falsos positivos por substring)
            const rowPartes = dividirPOs(rec.po_tiquetera);
            const coincide = rowPartes.some((rp) => poPartes.includes(rp));
            if (!coincide) return;
            extras.push(rec);
          });
        }
      }

      // 3) Eventos guardados con el mismo exp_id pero otro registro_id
      if (expId && expId.trim() && expId.trim() !== 'Por Asignar') {
        const { data: porExp } = await supabase
          .from('documento_modificaciones')
          .select('*')
          .eq('exp_id', expId);
        (porExp || []).forEach((r) => {
          const rec = r as ModificacionRecord;
          if (!mapa.has(rec.id)) extras.push(rec);
        });
      }

      // Unir, deduplicar y ordenar del más ANTIGUO al más reciente
      const todos = [...(directos || []), ...extras]
        .filter((r, i, arr) => arr.findIndex((x) => x.id === (r as ModificacionRecord).id) === i)
        .map((r) => r as ModificacionRecord)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setEventos(todos);
    } catch (err: any) {
      setError(err.message || 'Error inesperado al cargar el historial.');
      setEventos([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItem(prev => (prev === id ? null : id));
  };

  if (!isOpen) return null;

  const cambiosDocs = (mod: ModificacionRecord) => {
    const anteriores = parseDocEntries(mod.documentos_anteriores);
    const nuevos = parseDocEntries(mod.documentos_nuevos);
    const urlsAnteriores = new Set(anteriores.map(e => e.url));
    const urlsNuevos = new Set(nuevos.map(e => e.url));
    const agregados = nuevos.filter(e => !urlsAnteriores.has(e.url));
    const eliminados = anteriores.filter(e => !urlsNuevos.has(e.url));
    return { agregados, eliminados, anteriores, nuevos };
  };

  // ── Separar el evento de creación de las modificaciones reales ──
  const primerEvento = eventos.length > 0 ? eventos[0] : null;
  const primerEventoEsCreacion = primerEvento
    ? (esEventoCreacion(primerEvento) || parseDocEntries(primerEvento.documentos_anteriores).length === 0)
    : false;

  // Evento que se muestra como "creación inicial"
  const eventoCreacion: ModificacionRecord | null = primerEventoEsCreacion ? primerEvento : null;
  // Modificaciones reales (todo menos el evento de creación)
  const modificaciones = eventoCreacion ? eventos.slice(1) : eventos;

  // Documentos que fueron AGREGADOS en alguna modificación posterior.
  // Cualquiera de estos NUNCA debe aparecer en la carga inicial, aunque hoy
  // siga estando en el registro.
  const urlsAgregadasDespues = new Set<string>();
  modificaciones.forEach((mod) => {
    const { agregados } = cambiosDocs(mod);
    agregados.forEach((entry) => {
      if (entry.url) urlsAgregadasDespues.add(entry.url);
    });
  });

  // ── Foto de la carga inicial ──
  // 1) Si existe el evento de creación en auditoría, ese es el estado inicial fiel.
  // 2) Si no, partimos del estado inmediatamente anterior al primer cambio.
  // 3) Como último recurso usamos la lista actual.
  // En todos los casos restamos los documentos que se agregaron después.
  const documentosCreacion: DocEntry[] = (() => {
    let base: DocEntry[];
    if (eventoCreacion) {
      base = parseDocEntries(eventoCreacion.documentos_nuevos);
    } else if (primerEvento) {
      const anteriores = parseDocEntries(primerEvento.documentos_anteriores);
      base = anteriores.length > 0 ? anteriores : documentosIniciales;
    } else {
      base = documentosIniciales;
    }
    return base.filter((entry) => !urlsAgregadasDespues.has(entry.url));
  })();

  const autorCreacion = eventoCreacion?.usuario || responsableCreacion || 'Sistema';
  const fechaCreacion = eventoCreacion?.created_at || createdAt;

  // Total de eventos: creación inicial + modificaciones
  const totalEventos = 1 + modificaciones.length;

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
          ) : (
            <div className="relative">
              {/* Línea de timeline */}
              <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-200"></div>

              <div className="space-y-6">
                {/* ─── CREACIÓN INICIAL (siempre visible, viene del registro) ─── */}
                <div className="relative pl-12">
                  <div className="absolute left-[11px] top-1.5 w-[18px] h-[18px] rounded-full border-2 border-white bg-teal-500 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 flex items-center justify-center bg-teal-100 rounded-full flex-shrink-0">
                            <i className="ri-file-upload-line text-xs text-teal-600"></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{autorCreacion}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0" title={formatDate(fechaCreacion)}>
                          {getTimeAgo(fechaCreacion)}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 leading-relaxed">
                        Cargó <strong>{documentosCreacion.length}</strong> documento(s)
                      </p>

                      {/* Botón para expandir archivos iniciales */}
                      {documentosCreacion.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand('creacion-inicial')}
                          className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                        >
                          <i className={`text-sm ${expandedItem === 'creacion-inicial' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                          {expandedItem === 'creacion-inicial' ? 'Ocultar archivos iniciales' : `Ver ${documentosCreacion.length} archivo(s) inicial(es)`}
                        </button>
                      )}

                      {/* Detalle expandido de archivos iniciales */}
                      {expandedItem === 'creacion-inicial' && documentosCreacion.length > 0 && (
                        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-teal-700 mb-2 flex items-center gap-1.5">
                              <i className="ri-file-list-3-line"></i>
                              Documentos cargados inicialmente ({documentosCreacion.length})
                            </p>
                            <div className="space-y-1.5">
                              {documentosCreacion.map((entry, i) => (
                                <div key={`init-${i}`} className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                                  <i className="ri-file-line text-teal-500 text-sm flex-shrink-0"></i>
                                  <span className="text-xs text-teal-800 truncate flex-1">{extractFileName(entry.url)}</span>
                                  {esFactura(entry) && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                                      <i className="ri-bill-line text-[10px]"></i>
                                      Factura
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ─── MODIFICACIONES (de la tabla documento_modificaciones) ─── */}
                {error && modificaciones.length === 0 && (
                  <div className="relative pl-12">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 flex items-center justify-center bg-amber-100 rounded-full flex-shrink-0">
                          <i className="ri-information-line text-amber-600 text-sm"></i>
                        </div>
                        <div>
                          <p className="text-amber-800 font-medium text-sm mb-1">Auditoría de cambios no disponible</p>
                          <p className="text-amber-700 text-xs">{error}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {modificaciones.length === 0 && !error && (
                  <div className="relative pl-12">
                    <div className="absolute left-[11px] top-2 w-[18px] h-[18px] rounded-full border-2 border-white bg-gray-300 flex items-center justify-center"></div>
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400 italic">Sin modificaciones posteriores registradas</p>
                    </div>
                  </div>
                )}

                {modificaciones.map((mod, idx) => {
                  const isExpanded = expandedItem === mod.id;
                  const { agregados, eliminados } = cambiosDocs(mod);
                  const esReciente = idx === modificaciones.length - 1;

                  return (
                    <div key={mod.id} className="relative pl-12">
                      {/* Punto del timeline */}
                      <div className={`absolute left-[11px] top-1.5 w-[18px] h-[18px] rounded-full border-2 border-white flex items-center justify-center ${
                        esReciente ? 'bg-amber-500' : 'bg-gray-300'
                      }`}>
                        {esReciente && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>

                      {/* Tarjeta del evento */}
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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

                          <p className="text-sm text-gray-700 leading-relaxed">{mod.accion}</p>

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

                        {isExpanded && (agregados.length > 0 || eliminados.length > 0) && (
                          <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 space-y-3">
                            {agregados.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                                  <i className="ri-add-circle-line"></i>
                                  Agregados ({agregados.length})
                                </p>
                                <div className="space-y-1.5">
                                  {agregados.map((entry, i) => (
                                    <div key={`add-${i}`} className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                                      <i className="ri-file-line text-green-500 text-sm flex-shrink-0"></i>
                                      <span className="text-xs text-green-800 truncate flex-1">{extractFileName(entry.url)}</span>
                                      {esFactura(entry) && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                                          <i className="ri-bill-line text-[10px]"></i>
                                          Factura
                                        </span>
                                      )}
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
                                  {eliminados.map((entry, i) => (
                                    <div key={`del-${i}`} className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                                      <i className="ri-file-line text-red-500 text-sm flex-shrink-0"></i>
                                      <span className="text-xs text-red-800 truncate flex-1">{extractFileName(entry.url)}</span>
                                      {esFactura(entry) && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                                          <i className="ri-bill-line text-[10px]"></i>
                                          Factura
                                        </span>
                                      )}
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
            {totalEventos} evento(s) en el historial ({modificaciones.length} modificación(es) + 1 creación)
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