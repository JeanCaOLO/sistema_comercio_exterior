import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { verificarTicketsEstancados } from '@/lib/notificaciones';

interface TicketEspera {
  id: string;
  po_tiquetera: string;
  exp_id: string;
  observaciones: string | null;
}

interface MotivoAgrupado {
  categoria: string;
  cantidad: number;
  porcentaje: number;
  ejemplos: string[];
}

// Categorías ordenadas de más específica a más general. La primera coincidencia gana.
const CATEGORIAS: { categoria: string; keywords: string[] }[] = [
  { categoria: 'Permisos / Autorizaciones', keywords: ['permiso', 'senasa', 'ministerio', 'autorizac', 'licencia', 'aprobacion', 'solicitud de permiso'] },
  { categoria: 'Documentos pendientes', keywords: ['documento', 'doc ', 'docs', 'papel', 'faltan', 'faltante', 'documentacion'] },
  { categoria: 'Confirmación del cliente', keywords: ['cliente'] },
  { categoria: 'Confirmación del proveedor', keywords: ['proveedor', 'supplier', 'vendedor'] },
  { categoria: 'Aduana / Autoridades', keywords: ['aduana', 'autoridad', 'portuari', 'aduanal'] },
  { categoria: 'Embarque / Despacho', keywords: ['embarque', 'despacho'] },
  { categoria: 'Pagos / Facturación', keywords: ['pago', 'factura', 'cobro', 'cancelar', 'abono'] },
];

const SIN_OBSERVACION = 'Sin observación';
const OTROS = 'Otros';

// Normaliza: minúsculas y sin tildes para comparar de forma robusta
const normalizar = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const categorizar = (texto: string | null): string => {
  const t = normalizar(texto || '').trim();
  if (!t) return SIN_OBSERVACION;
  for (const cat of CATEGORIAS) {
    if (cat.keywords.some((k) => t.includes(k))) return cat.categoria;
  }
  return OTROS;
};

export default function TopMotivosEspera() {
  const [motivos, setMotivos] = useState<MotivoAgrupado[]>([]);
  const [tickets, setTickets] = useState<TicketEspera[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [mostrarObservaciones, setMostrarObservaciones] = useState(false);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('expedientes')
        .select('id, po_tiquetera, exp_id, instrucciones_adicionales')
        .eq('tipo_modulo', 'dropship')
        .in('estado_expediente', ['Espera de Respuesta', 'Espera de respuesta']);

      if (queryError) throw queryError;

      const tickets: TicketEspera[] = (data || []).map((t: any) => ({
        id: t.id,
        po_tiquetera: t.po_tiquetera || '',
        exp_id: t.exp_id || '',
        observaciones: t.instrucciones_adicionales,
      }));

      setTickets(tickets);
      setTotalTickets(tickets.length);

      // Agrupar por categoría
      const conteo: Record<string, { cantidad: number; ejemplos: string[] }> = {};
      tickets.forEach((t) => {
        const cat = categorizar(t.observaciones);
        if (!conteo[cat]) conteo[cat] = { cantidad: 0, ejemplos: [] };
        conteo[cat].cantidad += 1;
        if (t.observaciones && t.observaciones.trim() && conteo[cat].ejemplos.length < 3) {
          conteo[cat].ejemplos.push(t.observaciones.trim());
        }
      });

      const agrupados: MotivoAgrupado[] = Object.entries(conteo)
        .map(([categoria, info]) => ({
          categoria,
          cantidad: info.cantidad,
          porcentaje: tickets.length > 0 ? Math.round((info.cantidad / tickets.length) * 100) : 0,
          ejemplos: info.ejemplos,
        }))
        .sort((a, b) => b.cantidad - a.cantidad);

      setMotivos(agrupados);
    } catch (err: any) {
      console.error('Error al cargar motivos de espera:', err);
      setError(err.message || 'Error al cargar los motivos');
      setMotivos([]);
      setTotalTickets(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    verificarTicketsEstancados();
    const interval = setInterval(() => {
      verificarTicketsEstancados();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const listaMostrada = mostrarTodos ? motivos : motivos.slice(0, 10);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-12 h-12 flex items-center justify-center bg-amber-500 rounded-xl">
          <i className="ri-question-answer-line text-white text-2xl"></i>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Motivos de Espera de Respuesta (Dropship)</h3>
          <p className="text-sm text-gray-600">Por qué los tickets están esperando respuesta, agrupados por tema</p>
        </div>
      </div>

      {/* Total */}
      <div className="mt-4 mb-6 flex items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-amber-800 font-semibold">
          <i className="ri-hourglass-line"></i>
          {totalTickets} ticket{totalTickets !== 1 ? 's' : ''} en espera
        </span>
        <span className="text-gray-500">con observaciones analizadas</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
            <p className="mt-3 text-sm text-gray-500">Analizando observaciones...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 flex items-center justify-center bg-red-50 rounded-full mb-3">
            <i className="ri-error-warning-line text-red-500 text-2xl"></i>
          </div>
          <p className="text-gray-700 font-medium">No se pudieron cargar los motivos</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
          <button
            onClick={cargarDatos}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line"></i>
            Reintentar
          </button>
        </div>
      ) : motivos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 flex items-center justify-center bg-gray-100 rounded-full mb-3">
            <i className="ri-inbox-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-gray-500 font-medium">No hay tickets Dropship en espera de respuesta</p>
          <p className="text-sm text-gray-400 mt-1">Cuando haya tickets en ese estado, aquí verás sus motivos agrupados.</p>
        </div>
      ) : (
        <>
          {/* Lista Top 10 */}
          <div className="space-y-3">
            {listaMostrada.map((motivo, index) => (
              <div
                key={motivo.categoria}
                className={`rounded-xl border p-4 transition-colors ${
                  index === 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-white font-bold text-sm flex-shrink-0 ${
                        index === 0 ? 'bg-amber-500' : 'bg-gray-400'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{motivo.categoria}</p>
                      {motivo.ejemplos.length > 0 && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          <span className="text-gray-400">Ej:</span> {motivo.ejemplos[0]}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-sm font-bold text-gray-900">{motivo.cantidad}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">({motivo.porcentaje}%)</span>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${index === 0 ? 'bg-amber-500' : 'bg-teal-500'}`}
                      style={{ width: `${motivo.porcentaje}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Botón ver más/menos */}
          {motivos.length > 10 && (
            <div className="mt-5 flex justify-center">
              <button
                onClick={() => setMostrarTodos(!mostrarTodos)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className={mostrarTodos ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}></i>
                {mostrarTodos ? 'Mostrar solo Top 10' : `Ver todos (${motivos.length} motivos)`}
              </button>
            </div>
          )}

          {/* Lista de observaciones completas (desplegable) */}
          <div className="mt-8">
            <button
              onClick={() => setMostrarObservaciones(!mostrarObservaciones)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg">
                  <i className="ri-file-text-line text-gray-600 text-lg"></i>
                </div>
                <div className="text-left">
                  <h4 className="text-lg font-bold text-gray-900">Observaciones Completas</h4>
                  <span className="text-xs text-gray-500">({tickets.length} ticket{tickets.length !== 1 ? 's' : ''})</span>
                </div>
              </div>
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 flex-shrink-0">
                <i className={`${mostrarObservaciones ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-gray-600`}></i>
              </div>
            </button>

            {mostrarObservaciones && (
              <div className="space-y-2 mt-3">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-gray-100 bg-gray-50/60 p-3.5 flex items-start gap-3"
                  >
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5">
                      <i className="ri-chat-3-line text-gray-400"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{t.po_tiquetera || 'Sin PO'}</span>
                        {t.exp_id && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">{t.exp_id}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {t.observaciones && t.observaciones.trim()
                          ? t.observaciones.trim()
                          : <span className="text-gray-400 italic">Sin observación</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}