import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarSolicitudesEtd, type SolicitudEtd } from '@/lib/etdCambios';
import { formatearFechaHora } from '@/lib/etdMotivos';
import { formatearFechaCorta } from '@/lib/fechas';
import EstadoEtdBadge, { SyncEtdBadge } from './EstadoEtdBadge';
import ModalDetalleSolicitudEtd from './ModalDetalleSolicitudEtd';

interface HistorialEtdProps {
  usuarioId: string;
  usuarioNombre: string;
  puedeAprobar: boolean;
}

const POR_PAGINA = 12;

export default function HistorialEtd({ usuarioId, usuarioNombre, puedeAprobar }: HistorialEtdProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudEtd[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionada, setSeleccionada] = useState<SolicitudEtd | null>(null);

  const [po, setPo] = useState('');
  const [compania, setCompania] = useState('');
  const [estado, setEstado] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [aprobador, setAprobador] = useState('');
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await listarSolicitudesEtd();
      setSolicitudes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const companias = useMemo(
    () => Array.from(new Set(solicitudes.map((s) => s.trading_company).filter(Boolean))).sort(),
    [solicitudes]
  );

  const filtradas = useMemo(() => {
    let lista = [...solicitudes];
    const q = po.trim().toLowerCase();
    if (q) lista = lista.filter((s) => s.order_number.toLowerCase().includes(q));
    if (compania) lista = lista.filter((s) => s.trading_company === compania);
    if (estado) lista = lista.filter((s) => s.status === estado);
    if (fechaInicio) lista = lista.filter((s) => s.requested_at.slice(0, 10) >= fechaInicio);
    if (fechaFin) lista = lista.filter((s) => s.requested_at.slice(0, 10) <= fechaFin);
    if (solicitante.trim()) {
      const v = solicitante.trim().toLowerCase();
      lista = lista.filter((s) => (s.requested_by_name || '').toLowerCase().includes(v));
    }
    if (aprobador.trim()) {
      const v = aprobador.trim().toLowerCase();
      lista = lista.filter((s) => (s.reviewed_by_name || '').toLowerCase().includes(v));
    }
    lista.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
    return lista;
  }, [solicitudes, po, compania, estado, fechaInicio, fechaFin, solicitante, aprobador]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const limpiarFiltros = () => {
    setPo(''); setCompania(''); setEstado('');
    setFechaInicio(''); setFechaFin(''); setSolicitante(''); setAprobador(''); setPagina(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Historial de Solicitudes</h2>
          <p className="text-sm text-gray-500 mt-1">Registro completo e inmutable de solicitudes y decisiones.</p>
        </div>
        <button
          onClick={cargar}
          className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer self-start sm:self-auto"
        >
          <i className="ri-refresh-line mr-2"></i>Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            value={po}
            onChange={(e) => { setPo(e.target.value); setPagina(1); }}
            placeholder="Número de PO"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <select
            value={compania}
            onChange={(e) => { setCompania(e.target.value); setPagina(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">Todas las compañías</option>
            {companias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={estado}
            onChange={(e) => { setEstado(e.target.value); setPagina(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendiente de aprobación</option>
            <option value="APPROVED">Aprobada</option>
            <option value="REJECTED">Rechazada</option>
          </select>
          <input
            value={solicitante}
            onChange={(e) => { setSolicitante(e.target.value); setPagina(1); }}
            placeholder="Solicitante"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <input
            value={aprobador}
            onChange={(e) => { setAprobador(e.target.value); setPagina(1); }}
            placeholder="Aprobador / revisor"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => { setFechaInicio(e.target.value); setPagina(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => { setFechaFin(e.target.value); setPagina(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <button onClick={limpiarFiltros} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap text-left px-1">
            <i className="ri-filter-off-line mr-1"></i>Limpiar filtros
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={cargar} className="mt-2 text-sm font-medium text-red-700 underline cursor-pointer">Reintentar</button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="py-16 text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-teal-600"></i>
            <p className="mt-3 text-sm text-gray-500">Cargando historial...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['ID', 'Número PO', 'Compañía', 'ETD anterior', 'Nueva fecha', 'Motivo', 'Solicitante', 'Aprobador / Revisor', 'Fecha solicitud', 'Fecha decisión', 'Estado', 'API Raga', 'Acciones'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibles.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">{s.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{s.order_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{s.trading_company}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{s.previous_etd_initial ? formatearFechaCorta(s.previous_etd_initial) : '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-teal-700 whitespace-nowrap">{formatearFechaCorta(s.proposed_etd_initial)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px]"><span className="line-clamp-1">{s.change_reason}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{s.requested_by_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{s.reviewed_by_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaHora(s.requested_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaHora(s.reviewed_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><EstadoEtdBadge estado={s.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><SyncEtdBadge status={s.api_sync_status} error={s.api_sync_error} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => setSeleccionada(s)}
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
                    <td colSpan={13} className="px-6 py-14 text-center text-gray-400">
                      <i className="ri-history-line text-4xl mb-2"></i>
                      <p className="text-sm">No hay solicitudes registradas con los filtros aplicados.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {!cargando && filtradas.length > POR_PAGINA && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtradas.length)} de {filtradas.length}
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

      {seleccionada && (
        <ModalDetalleSolicitudEtd
          solicitud={seleccionada}
          puedeAprobar={puedeAprobar && seleccionada.status === 'PENDING'}
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          onClose={() => setSeleccionada(null)}
          onResolved={() => { setSeleccionada(null); cargar(); }}
        />
      )}
    </div>
  );
}