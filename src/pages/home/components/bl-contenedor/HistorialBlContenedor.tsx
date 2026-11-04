import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  filasExportables,
  listarCambiosBl,
  type EventoCambioBl,
} from '@/lib/blContenedor';
import { descargarExcel } from '@/lib/exportar';
import { formatearFechaHora } from '@/lib/etdMotivos';
import EstadoBlBadge from './EstadoBlBadge';
import ModalDetalleCambioBl from './ModalDetalleCambioBl';

const POR_PAGINA = 12;

function CampoCambio({ anterior, nuevo }: { anterior: string | null; nuevo: string | null }) {
  if (!nuevo) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div className="text-xs">
      {anterior && anterior !== nuevo && (
        <>
          <span className="font-mono text-gray-400 line-through break-all">{anterior}</span>
          <i className="ri-arrow-right-line text-gray-300 mx-1"></i>
        </>
      )}
      <span className="font-mono font-semibold text-gray-800 break-all">{nuevo}</span>
    </div>
  );
}

export default function HistorialBlContenedor() {
  const [eventos, setEventos] = useState<EventoCambioBl[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState<EventoCambioBl | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [entorno, setEntorno] = useState('');
  const [agente, setAgente] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [orden, setOrden] = useState<'reciente' | 'antigua'>('reciente');
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await listarCambiosBl();
      setEventos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
      setEventos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const agentes = useMemo(
    () => Array.from(new Set(eventos.map((e) => e.requested_by_name || e.requested_by_email || '').filter(Boolean))).sort(),
    [eventos]
  );

  const motivos = useMemo(
    () => Array.from(new Set(eventos.map((e) => e.change_reason).filter(Boolean))).sort(),
    [eventos]
  );

  const filtrados = useMemo(() => {
    let lista = [...eventos];
    const q = busqueda.trim().toLowerCase();
    if (q) {
      lista = lista.filter((e) => [
        e.order_number,
        e.trading_company,
        e.new_bl,
        e.new_container,
        e.previous_bl,
        e.previous_container,
        e.requested_by_name,
      ].join(' ').toLowerCase().includes(q));
    }
    if (estado) lista = lista.filter((e) => e.status === estado);
    if (entorno === 'production') lista = lista.filter((e) => e.api_env === 'production');
    if (entorno === 'qa') lista = lista.filter((e) => e.api_env !== 'production');
    if (agente) lista = lista.filter((e) => (e.requested_by_name || e.requested_by_email) === agente);
    if (desde) lista = lista.filter((e) => e.requested_at.slice(0, 10) >= desde);
    if (hasta) lista = lista.filter((e) => e.requested_at.slice(0, 10) <= hasta);

    lista.sort((a, b) => {
      const da = new Date(a.requested_at).getTime();
      const db = new Date(b.requested_at).getTime();
      return orden === 'reciente' ? db - da : da - db;
    });
    return lista;
  }, [eventos, busqueda, estado, entorno, agente, desde, hasta, orden]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const limpiar = () => {
    setBusqueda('');
    setEstado('');
    setEntorno('');
    setAgente('');
    setDesde('');
    setHasta('');
    setOrden('reciente');
    setPagina(1);
  };

  const exportar = () => {
    descargarExcel('Historial-BL-Contenedor.xlsx', filasExportables(filtrados));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Historial de BL y Contenedor</h2>
          <p className="text-sm text-gray-500 mt-1">
            Registro completo de lo que cargaron los agentes, con el antes y el después de cada dato.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={exportar}
            disabled={filtrados.length === 0}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line mr-1.5"></i>Excel
          </button>
          <button
            onClick={() => void cargar()}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-refresh-line mr-1.5"></i>Actualizar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <input
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            placeholder="PO, BL, contenedor o agente"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <select
            value={estado}
            onChange={(e) => { setEstado(e.target.value); setPagina(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">Todos los resultados</option>
            <option value="APLICADO">Aplicado</option>
            <option value="PARCIAL">Parcial</option>
            <option value="ERROR">Error</option>
          </select>
          <select
            value={agente}
            onChange={(e) => { setAgente(e.target.value); setPagina(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">Todos los agentes</option>
            {agentes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={entorno}
            onChange={(e) => { setEntorno(e.target.value); setPagina(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">Todos los entornos</option>
            <option value="production">Producción</option>
            <option value="qa">QA</option>
          </select>
          <input
            type="date"
            value={desde}
            onChange={(e) => { setDesde(e.target.value); setPagina(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <input
            type="date"
            value={hasta}
            onChange={(e) => { setHasta(e.target.value); setPagina(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600 flex items-center gap-2">
            <i className="ri-filter-3-line"></i>
            {filtrados.length} de {eventos.length}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
          <button
            onClick={() => { setOrden(orden === 'reciente' ? 'antigua' : 'reciente'); setPagina(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className={orden === 'reciente' ? 'ri-sort-desc' : 'ri-sort-asc'}></i>
            {orden === 'reciente' ? ' Más recientes primero' : ' Más antiguos primero'}
          </button>
          <button onClick={limpiar} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap">
            <i className="ri-filter-off-line mr-1"></i>Limpiar filtros
          </button>
        </div>
        {motivos.length > 0 && (
          <p className="mt-2 text-[11px] text-gray-400">
            Motivos registrados: {motivos.length}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => void cargar()} className="mt-2 text-sm font-medium text-red-700 underline cursor-pointer">
              Reintentar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="py-16 text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-teal-600"></i>
            <p className="mt-3 text-sm text-gray-500">Cargando el historial...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Referencia', 'PO', 'Compañía', 'Campos', 'BL', 'Contenedor', 'Motivo', 'Cargado por', 'Fecha', 'Estado', ''].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibles.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                      {e.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {e.order_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px]">
                      <span className="line-clamp-1" title={e.trading_company || ''}>{e.trading_company || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(e.campos_aplicados || []).length === 0 ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          (e.campos_aplicados || []).map((c) => (
                            <span key={c} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 whitespace-nowrap">
                              {c}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <CampoCambio anterior={e.previous_bl} nuevo={e.new_bl} />
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <CampoCambio anterior={e.previous_container} nuevo={e.new_container} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px]">
                      <span className="line-clamp-2 break-words" title={e.change_reason}>{e.change_reason}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {e.requested_by_name || e.requested_by_email || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {formatearFechaHora(e.requested_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <EstadoBlBadge estado={e.status} size="xs" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => setDetalle(e)}
                        className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                        title="Ver detalle"
                      >
                        <i className="ri-eye-line text-lg"></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-14 text-center text-gray-400">
                      <i className="ri-history-line text-4xl mb-2"></i>
                      <p className="text-sm">No hay cambios registrados con los filtros aplicados.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!cargando && filtrados.length > POR_PAGINA && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtrados.length)} de {filtrados.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-arrow-left-s-line"></i>
            </button>
            <span className="px-3 text-sm text-gray-700">{paginaActual} / {totalPaginas}</span>
            <button
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaActual === totalPaginas}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-arrow-right-s-line"></i>
            </button>
          </div>
        </div>
      )}

      {detalle && <ModalDetalleCambioBl evento={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}