import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarCambios, TIPOS_CAMBIO, type SolicitudCambio, type TipoCambioOrden } from '@/lib/cambiosOrden';
import { diferenciaDias } from '@/lib/etdCambios';
import { formatearFechaHora } from '@/lib/etdMotivos';
import EstadoEtdBadge from '@/pages/home/components/EstadoEtdBadge';
import AmbienteEtdBadge from '@/pages/home/components/AmbienteEtdBadge';
import ModalDetalleCambio from './ModalDetalleCambio';

type VistaCambios =
  | 'etd-solicitar'
  | 'carga-lista-solicitar'
  | 'incoterm-solicitar'
  | 'etd-aprobaciones'
  | 'etd-historial';

interface DashboardCambiosProps {
  usuarioId: string;
  usuarioNombre: string;
  puedeAprobar: boolean;
  puedeAprobarPropias?: boolean;
  incluirQa?: boolean;
  onIrA?: (vista: VistaCambios) => void;
}

type Periodo = 30 | 90 | 365 | 0;

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: 30, label: '30 días' },
  { valor: 90, label: '90 días' },
  { valor: 365, label: '12 meses' },
  { valor: 0, label: 'Todo' },
];

const TIPOS: TipoCambioOrden[] = ['etd_inicial', 'carga_lista', 'incoterm'];

function diasDesde(valor: string | null | undefined): number {
  if (!valor) return 0;
  const ms = Date.now() - new Date(valor).getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor(ms / 86400000));
}

function promedio(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

interface TarjetaKpiProps {
  titulo: string;
  valor: string | number;
  detalle: string;
  icono: string;
  colorIcono: string;
  colorValor?: string;
}

function TarjetaKpi({ titulo, valor, detalle, icono, colorIcono, colorValor = 'text-gray-900' }: TarjetaKpiProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</p>
          <p className={`text-3xl font-bold mt-2 ${colorValor}`}>{valor}</p>
          <p className="text-xs text-gray-500 mt-1.5 leading-snug">{detalle}</p>
        </div>
        <span className={`w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0 ${colorIcono}`}>
          <i className={`${icono} text-lg`}></i>
        </span>
      </div>
    </div>
  );
}

const ACCESOS: { vista: VistaCambios; label: string; icono: string; tipo: TipoCambioOrden }[] = [
  { vista: 'etd-solicitar', label: 'Solicitar ETD Inicial', icono: 'ri-calendar-2-line', tipo: 'etd_inicial' },
  { vista: 'carga-lista-solicitar', label: 'Solicitar Carga Lista', icono: 'ri-file-list-2-line', tipo: 'carga_lista' },
  { vista: 'incoterm-solicitar', label: 'Solicitar Incoterm', icono: 'ri-exchange-dollar-line', tipo: 'incoterm' },
];

export default function DashboardCambios({
  usuarioId,
  usuarioNombre,
  puedeAprobar,
  puedeAprobarPropias = false,
  incluirQa = false,
  onIrA,
}: DashboardCambiosProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudCambio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>(90);
  const [seleccionada, setSeleccionada] = useState<SolicitudCambio | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await listarCambios({ incluirQa });
      setSolicitudes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las métricas de cambios.');
    } finally {
      setCargando(false);
    }
  }, [incluirQa]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = useMemo(() => {
    if (periodo === 0) return solicitudes;
    const limite = Date.now() - periodo * 86400000;
    return solicitudes.filter((s) => new Date(s.requested_at).getTime() >= limite);
  }, [solicitudes, periodo]);

  const metricas = useMemo(() => {
    const pendientes = filtradas.filter((s) => s.status === 'PENDING');
    const aprobadas = filtradas.filter((s) => s.status === 'APPROVED');
    const rechazadas = filtradas.filter((s) => s.status === 'REJECTED');
    const resueltas = aprobadas.length + rechazadas.length;

    const tiempos = [...aprobadas, ...rechazadas]
      .map((s) => diferenciaDias(s.requested_at, s.reviewed_at))
      .filter((d): d is number => d !== null && d >= 0);

    const atrasadas = pendientes.filter((s) => diasDesde(s.requested_at) > 2);

    return {
      total: filtradas.length,
      pendientes,
      aprobadas,
      rechazadas,
      resueltas,
      tasaAprobacion: resueltas > 0 ? Math.round((aprobadas.length / resueltas) * 100) : 0,
      tiempoPromedio: tiempos.length > 0 ? promedio(tiempos) : 0,
      atrasadas,
      qa: filtradas.filter((s) => s.api_env !== 'production').length,
    };
  }, [filtradas]);

  const porTipo = useMemo(() => TIPOS.map((tipo) => {
    const delTipo = filtradas.filter((s) => s.tipo === tipo);
    const aprobadas = delTipo.filter((s) => s.status === 'APPROVED').length;
    const rechazadas = delTipo.filter((s) => s.status === 'REJECTED').length;
    const resueltas = aprobadas + rechazadas;
    return {
      tipo,
      total: delTipo.length,
      pendientes: delTipo.filter((s) => s.status === 'PENDING').length,
      tasa: resueltas > 0 ? Math.round((aprobadas / resueltas) * 100) : 0,
    };
  }), [filtradas]);

  const maxTipo = Math.max(1, ...porTipo.map((t) => t.total));

  const pendientesAntiguas = useMemo(
    () => [...metricas.pendientes]
      .sort((a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime())
      .slice(0, 5),
    [metricas.pendientes]
  );

  const recientes = useMemo(
    () => [...filtradas]
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())
      .slice(0, 6),
    [filtradas]
  );

  const totalEstados = metricas.total || 1;
  const pctPend = (metricas.pendientes.length / totalEstados) * 100;
  const pctAprob = (metricas.aprobadas.length / totalEstados) * 100;
  const pctRech = (metricas.rechazadas.length / totalEstados) * 100;
  const gradiente = metricas.total === 0
    ? 'conic-gradient(#e5e7eb 0% 100%)'
    : `conic-gradient(
        #f59e0b 0% ${pctPend}%,
        #10b981 ${pctPend}% ${pctPend + pctAprob}%,
        #ef4444 ${pctPend + pctAprob}% ${pctPend + pctAprob + pctRech}%
      )`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Dashboard de Cambios de Órdenes</h2>
          <p className="text-sm text-gray-500 mt-1">
            ETD Inicial, carga lista teórica e incoterm en un solo lugar: solicitudes, tiempos y aprobaciones.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-full">
            {PERIODOS.map((p) => (
              <button
                key={p.valor}
                onClick={() => setPeriodo(p.valor)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  periodo === p.valor ? 'bg-white text-teal-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={cargar}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-refresh-line mr-1.5"></i>Actualizar
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

      {cargando ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-teal-600"></i>
          <p className="mt-3 text-sm text-gray-500">Calculando métricas de cambios...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <TarjetaKpi
              titulo="Solicitudes"
              valor={metricas.total}
              detalle={`${metricas.resueltas} resueltas${incluirQa && metricas.qa > 0 ? ` · ${metricas.qa} de QA` : ''}`}
              icono="ri-file-list-3-line"
              colorIcono="bg-teal-50 text-teal-600"
            />
            <TarjetaKpi
              titulo="Pendientes"
              valor={metricas.pendientes.length}
              detalle="Esperando aprobación o rechazo"
              icono="ri-time-line"
              colorIcono="bg-amber-50 text-amber-600"
              colorValor="text-amber-700"
            />
            <TarjetaKpi
              titulo="Aprobadas"
              valor={metricas.aprobadas.length}
              detalle="Sincronizadas con Raga"
              icono="ri-checkbox-circle-line"
              colorIcono="bg-emerald-50 text-emerald-600"
              colorValor="text-emerald-700"
            />
            <TarjetaKpi
              titulo="Rechazadas"
              valor={metricas.rechazadas.length}
              detalle="Sin modificación en Raga"
              icono="ri-close-circle-line"
              colorIcono="bg-red-50 text-red-600"
              colorValor="text-red-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <TarjetaKpi
              titulo="Tasa de aprobación"
              valor={`${metricas.tasaAprobacion}%`}
              detalle={`${metricas.aprobadas.length} de ${metricas.resueltas} resueltas`}
              icono="ri-percent-line"
              colorIcono="bg-teal-50 text-teal-600"
              colorValor="text-teal-700"
            />
            <TarjetaKpi
              titulo="Tiempo de resolución"
              valor={`${Math.round(metricas.tiempoPromedio * 10) / 10} d`}
              detalle="Promedio desde la solicitud a la decisión"
              icono="ri-timer-line"
              colorIcono="bg-gray-100 text-gray-600"
            />
            <TarjetaKpi
              titulo="Atrasadas (+2 días)"
              valor={metricas.atrasadas.length}
              detalle="Recordatorio automático activo"
              icono="ri-alarm-warning-line"
              colorIcono={metricas.atrasadas.length > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}
              colorValor={metricas.atrasadas.length > 0 ? 'text-red-700' : 'text-gray-900'}
            />
            <TarjetaKpi
              titulo="Tipos activos"
              valor={porTipo.filter((t) => t.total > 0).length}
              detalle="ETD Inicial, carga lista e incoterm"
              icono="ri-stack-line"
              colorIcono="bg-indigo-50 text-indigo-600"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900">Distribución por estado</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-4">Sobre {metricas.total} solicitudes del periodo</p>
              <div className="flex flex-col items-center">
                <div className="relative w-36 h-36 rounded-full" style={{ background: gradiente }}>
                  <div className="absolute inset-[22px] bg-white rounded-full flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{metricas.total}</span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">Total</span>
                  </div>
                </div>
                <div className="mt-5 w-full space-y-2.5">
                  {[
                    { label: 'Pendientes', total: metricas.pendientes.length, color: 'bg-amber-500' },
                    { label: 'Aprobadas', total: metricas.aprobadas.length, color: 'bg-emerald-500' },
                    { label: 'Rechazadas', total: metricas.rechazadas.length, color: 'bg-red-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-600">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span>
                        {item.label}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {item.total}
                        <span className="text-xs font-normal text-gray-400 ml-1.5">
                          {metricas.total > 0 ? Math.round((item.total / metricas.total) * 100) : 0}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 xl:col-span-2">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Solicitudes por tipo de cambio</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Volumen y efectividad de cada tipo</p>
                </div>
              </div>
              <div className="space-y-4">
                {porTipo.map((t) => {
                  const cfg = TIPOS_CAMBIO[t.tipo];
                  return (
                    <div key={t.tipo}>
                      <div className="flex items-center justify-between text-sm gap-3 mb-1.5">
                        <span className="flex items-center gap-2 text-gray-700 min-w-0">
                          <span className={`w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 ${cfg.clase}`}>
                            <i className={`${cfg.icono} text-xs`}></i>
                          </span>
                          <span className="truncate">{cfg.labelCorto}</span>
                        </span>
                        <span className="flex items-center gap-3 flex-shrink-0 text-xs">
                          <span className="text-amber-700 font-semibold">{t.pendientes} pend.</span>
                          <span className="text-gray-900 font-bold">{t.total}</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-teal-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${(t.total / maxTipo) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {t.total > 0 ? `${t.tasa}% de aprobación sobre las resueltas` : 'Sin solicitudes en el periodo'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Pendientes más antiguas</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Prioriza estas solicitudes</p>
                </div>
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
                  <i className="ri-alarm-warning-line"></i>
                </span>
              </div>
              {pendientesAntiguas.length === 0 ? (
                <div className="py-14 text-center text-gray-400">
                  <i className="ri-checkbox-circle-line text-4xl mb-2"></i>
                  <p className="text-sm">Todo al día: no hay solicitudes pendientes.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pendientesAntiguas.map((s) => {
                    const dias = diasDesde(s.requested_at);
                    const vencida = dias > 2;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSeleccionada(s)}
                        className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{s.order_number}</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${TIPOS_CAMBIO[s.tipo].clase}`}>
                                {TIPOS_CAMBIO[s.tipo].labelCorto}
                              </span>
                              <AmbienteEtdBadge env={s.api_env} size="xs" mostrarIcono={false} />
                              <span className="text-xs text-gray-500 truncate">{s.trading_company}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{s.detalle}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Solicitado por {s.requested_by_name || '—'}</p>
                          </div>
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                              vencida ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {dias === 0 ? 'Hoy' : `${dias} d`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {onIrA && (
                <div className="px-5 py-4 border-t border-gray-100">
                  <button
                    onClick={() => onIrA('etd-aprobaciones')}
                    className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-checkbox-multiple-line mr-2"></i>Ir a Aprobaciones Pendientes
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Actividad reciente</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Últimas solicitudes registradas</p>
                </div>
                {onIrA && (
                  <button
                    onClick={() => onIrA('etd-historial')}
                    className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-history-line mr-1"></i>Ver historial
                  </button>
                )}
              </div>
              {recientes.length === 0 ? (
                <div className="py-14 text-center text-gray-400">
                  <i className="ri-inbox-line text-4xl mb-2"></i>
                  <p className="text-sm">Aún no hay solicitudes en este periodo.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recientes.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSeleccionada(s)}
                      className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{s.order_number}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${TIPOS_CAMBIO[s.tipo].clase}`}>
                              {TIPOS_CAMBIO[s.tipo].labelCorto}
                            </span>
                            <EstadoEtdBadge estado={s.status} />
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{s.detalle}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {s.trading_company} · {formatearFechaHora(s.requested_at)}
                          </p>
                        </div>
                        <i className="ri-arrow-right-s-line text-gray-300 text-lg flex-shrink-0"></i>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {onIrA && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-600 text-white flex-shrink-0">
                  <i className="ri-add-line text-lg"></i>
                </span>
                <div>
                  <p className="text-sm font-semibold text-teal-900">Registrar una nueva solicitud de cambio</p>
                  <p className="text-xs text-teal-700 mt-0.5">
                    Ningún cambio modifica la orden hasta que un aprobador lo confirme.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {ACCESOS.map((a) => (
                  <button
                    key={a.vista}
                    onClick={() => onIrA(a.vista)}
                    className="flex items-center gap-3 px-4 py-3 bg-white border border-teal-200 rounded-lg hover:border-teal-400 hover:shadow-sm transition-all cursor-pointer text-left"
                  >
                    <span className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${TIPOS_CAMBIO[a.tipo].clase}`}>
                      <i className={`${a.icono}`}></i>
                    </span>
                    <span className="text-sm font-medium text-gray-900">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {seleccionada && (
        <ModalDetalleCambio
          solicitud={seleccionada}
          puedeAprobar={puedeAprobar && seleccionada.status === 'PENDING'}
          puedeAprobarPropias={puedeAprobarPropias}
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          onClose={() => setSeleccionada(null)}
          onResolved={() => { setSeleccionada(null); cargar(); }}
        />
      )}
    </div>
  );
}