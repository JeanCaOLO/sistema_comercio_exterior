import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listarSolicitudesFechas,
  listarPendientesFechas,
  obtenerSolicitudFechasPorId,
  type SolicitudCambioFechas,
} from '@/lib/cambiosFechasPo';
import { formatearFechaHora } from '@/lib/etdMotivos';
import EstadoEtdBadge, { SyncEtdBadge } from '@/pages/home/components/EstadoEtdBadge';
import AmbienteEtdBadge from '@/pages/home/components/AmbienteEtdBadge';
import ModalDetalleFechas from './ModalDetalleFechas';

interface ListaCambiosFechasProps {
  modo: 'aprobaciones' | 'historial';
  usuarioId: string;
  usuarioNombre: string;
  puedeAprobar: boolean;
  puedeAprobarPropias?: boolean;
  // Solo usuario autorizado puede aprobar cambios de ruta logística.
  puedeCambiarRuta?: boolean;
  incluirQa?: boolean;
  onRefrescarContador?: () => void;
  solicitudObjetivoId?: string | null;
  onObjetivoConsumido?: () => void;
}

const POR_PAGINA = 10;

export default function ListaCambiosFechas({
  modo,
  usuarioId,
  usuarioNombre,
  puedeAprobar,
  puedeAprobarPropias = false,
  puedeCambiarRuta = false,
  incluirQa = false,
  onRefrescarContador,
  solicitudObjetivoId = null,
  onObjetivoConsumido,
}: ListaCambiosFechasProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudCambioFechas[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionada, setSeleccionada] = useState<SolicitudCambioFechas | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [compania, setCompania] = useState('');
  const [estado, setEstado] = useState('');
  const [entorno, setEntorno] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [aprobador, setAprobador] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [orden, setOrden] = useState<'reciente' | 'antigua'>('reciente');
  const [pagina, setPagina] = useState(1);

  const esAprobaciones = modo === 'aprobaciones';

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = esAprobaciones
        ? await listarPendientesFechas({ incluirQa })
        : await listarSolicitudesFechas({ incluirQa });
      setSolicitudes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las solicitudes.');
    } finally {
      setCargando(false);
    }
  }, [esAprobaciones, incluirQa]);

  useEffect(() => { cargar(); }, [cargar]);

  // Abre automáticamente la solicitud indicada (clic en una notificación).
  useEffect(() => {
    if (!solicitudObjetivoId || cargando) return;

    const enLista = solicitudes.find((s) => s.id === solicitudObjetivoId);
    if (enLista) {
      setSeleccionada(enLista);
      onObjetivoConsumido?.();
      return;
    }

    let activo = true;
    obtenerSolicitudFechasPorId(solicitudObjetivoId)
      .then((solicitud) => {
        if (!activo) return;
        if (solicitud) setSeleccionada(solicitud);
        onObjetivoConsumido?.();
      })
      .catch(() => {
        if (activo) onObjetivoConsumido?.();
      });

    return () => {
      activo = false;
    };
  }, [solicitudObjetivoId, cargando, solicitudes, onObjetivoConsumido]);

  const companias = useMemo(
    () => Array.from(new Set(solicitudes.map((s) => s.trading_company).filter(Boolean))).sort(),
    [solicitudes]
  );

  const filtradas = useMemo(() => {
    let lista = [...solicitudes];
    const q = busqueda.trim().toLowerCase();
    if (q) lista = lista.filter((s) => s.order_number.toLowerCase().includes(q) || s.detalle.toLowerCase().includes(q));
    if (compania) lista = lista.filter((s) => s.trading_company === compania);
    if (estado) lista = lista.filter((s) => s.status === estado);
    if (entorno === 'production') lista = lista.filter((s) => s.api_env === 'production');
    if (entorno === 'qa') lista = lista.filter((s) => s.api_env !== 'production');
    if (solicitante.trim()) {
      const v = solicitante.trim().toLowerCase();
      lista = lista.filter((s) => (s.requested_by_name || '').toLowerCase().includes(v));
    }
    if (aprobador.trim()) {
      const v = aprobador.trim().toLowerCase();
      lista = lista.filter((s) => (s.reviewed_by_name || '').toLowerCase().includes(v));
    }
    if (fechaInicio) lista = lista.filter((s) => s.requested_at.slice(0, 10) >= fechaInicio);
    if (fechaFin) lista = lista.filter((s) => s.requested_at.slice(0, 10) <= fechaFin);
    lista.sort((a, b) => {
      const da = new Date(a.requested_at).getTime();
      const db = new Date(b.requested_at).getTime();
      return orden === 'reciente' ? db - da : da - db;
    });
    return lista;
  }, [solicitudes, busqueda, compania, estado, entorno, solicitante, aprobador, fechaInicio, fechaFin, orden]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const limpiarFiltros = () => {
    setBusqueda(''); setCompania(''); setEstado(''); setEntorno('');
    setSolicitante(''); setAprobador(''); setFechaInicio(''); setFechaFin('');
    setOrden('reciente'); setPagina(1);
  };

  const trasResolver = () => {
    setSeleccionada(null);
    cargar();
    onRefrescarContador?.();
  };

  const totalProduccion = solicitudes.filter((s) => s.api_env === 'production').length;
  const totalQa = solicitudes.length - totalProduccion;
  const colspan = esAprobaciones ? 9 : 11;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {esAprobaciones ? 'Aprobaciones de Fechas PO' : 'Historial de Cambios de Fechas'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {esAprobaciones
              ? 'Cambios de fechas de POs sin tracking a la espera de resolución.'
              : 'Registro completo de solicitudes y decisiones de cambio de fechas.'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {esAprobaciones && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-2">
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-900">{solicitudes.length}</p>
                <p className="text-xs text-gray-500">Pendientes</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>Prod {totalProduccion}
                </span>
                {incluirQa && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>QA {totalQa}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
          <button
            onClick={cargar}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-refresh-line mr-2"></i>Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <input
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            placeholder="PO o detalle del cambio"
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
          {!esAprobaciones && (
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
          )}
          <input
            value={solicitante}
            onChange={(e) => { setSolicitante(e.target.value); setPagina(1); }}
            placeholder="Solicitante"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          {!esAprobaciones && (
            <input
              value={aprobador}
              onChange={(e) => { setAprobador(e.target.value); setPagina(1); }}
              placeholder="Aprobador / revisor"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          )}
          {incluirQa ? (
            <select
              value={entorno}
              onChange={(e) => { setEntorno(e.target.value); setPagina(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Todos los entornos</option>
              <option value="production">Producción</option>
              <option value="qa">QA</option>
            </select>
          ) : (
            <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600 flex items-center gap-2">
              <i className="ri-shield-check-line text-teal-600"></i>
              Solo Producción
            </div>
          )}
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
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
          <button
            onClick={() => { setOrden(orden === 'reciente' ? 'antigua' : 'reciente'); setPagina(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className={orden === 'reciente' ? 'ri-sort-desc' : 'ri-sort-asc'}></i>
            {orden === 'reciente' ? ' Más recientes primero' : ' Más antiguas primero'}
          </button>
          <button onClick={limpiarFiltros} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap">
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
            <p className="mt-3 text-sm text-gray-500">Cargando solicitudes...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    'ID', 'Número PO', 'Entorno', 'Compañía', 'Fechas solicitadas', 'Motivo',
                    'Solicitante', 'Fecha solicitud',
                    ...(esAprobaciones ? [] : ['Aprobador / Revisor', 'Fecha decisión', 'API Raga']),
                    'Estado', 'Acciones',
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibles.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">{s.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{s.order_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><AmbienteEtdBadge env={s.api_env} /></td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{s.trading_company}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 max-w-[300px]">
                      <span className="line-clamp-2 break-words">{s.detalle}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full mt-1">
                        <i className="ri-calendar-line"></i>
                        {s.cambios.length} fecha(s)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px]">
                      <span className="line-clamp-1">{s.change_reason}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{s.requested_by_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaHora(s.requested_at)}</td>
                    {!esAprobaciones && (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{s.reviewed_by_name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatearFechaHora(s.reviewed_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <SyncEtdBadge status={s.api_sync_status} error={s.api_sync_error} />
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap"><EstadoEtdBadge estado={s.status} /></td>
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
                    <td colSpan={colspan} className="px-6 py-14 text-center text-gray-400">
                      <i className={esAprobaciones ? 'ri-checkbox-circle-line text-4xl mb-2' : 'ri-history-line text-4xl mb-2'}></i>
                      <p className="text-sm">
                        {esAprobaciones
                          ? 'No hay solicitudes pendientes con los filtros aplicados.'
                          : 'No hay solicitudes registradas con los filtros aplicados.'}
                      </p>
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
        <ModalDetalleFechas
          solicitud={seleccionada}
          puedeAprobar={puedeAprobar && seleccionada.status === 'PENDING'}
          puedeAprobarPropias={puedeAprobarPropias}
          puedeCambiarRuta={puedeCambiarRuta}
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          onClose={() => setSeleccionada(null)}
          onResolved={trasResolver}
        />
      )}
    </div>
  );
}