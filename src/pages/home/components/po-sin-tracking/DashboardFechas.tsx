import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarSolicitudesFechas, type SolicitudCambioFechas } from '@/lib/cambiosFechasPo';
import { diferenciaDias } from '@/lib/etdCambios';
import { formatearFechaHora } from '@/lib/etdMotivos';
import EstadoEtdBadge from '@/pages/home/components/EstadoEtdBadge';
import AmbienteEtdBadge from '@/pages/home/components/AmbienteEtdBadge';
import ModalDetalleFechas from './ModalDetalleFechas';
import type { VistaPoTracking } from './types';

interface DashboardFechasProps {
  usuarioId: string;
  usuarioNombre: string;
  puedeAprobar: boolean;
  puedeAprobarPropias?: boolean;
  incluirQa?: boolean;
  onIrA?: (vista: VistaPoTracking) => void;
}

type Periodo = 30 | 90 | 365 | 0;

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: 30, label: '30 días' },
  { valor: 90, label: '90 días' },
  { valor: 365, label: '12 meses' },
  { valor: 0, label: 'Todo' },
];

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

export default function DashboardFechas({
  usuarioId,
  usuarioNombre,
  puedeAprobar,
  puedeAprobarPropias = false,
  incluirQa = false,
  onIrA,
}: DashboardFechasProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudCambioFechas[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>(90);
  const [seleccionada, setSeleccionada] = useState<SolicitudCambioFechas | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await listarSolicitudesFechas({ incluirQa });
      setSolicitudes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las métricas de fechas.');
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

    const fechasActualizadas = aprobadas.reduce((acc, s) => acc + s.cambios.length, 0);
    const atrasadas = pendientes.filter((s) => diasDesde(s.requested_at) > 2);

    return {
      total: filtradas.length,
      pendientes,
      aprobadas,
      rechazadas,
      resueltas,
      fechasActualizadas,
      tasaAprobacion: resueltas > 0 ? Math.round((aprobadas.length / resueltas) * 100) : 0,
      tiempoPromedio: tiempos.length > 0 ? promedio(tiempos) : 0,
      atrasadas,
      qa: filtradas.filter((s) => s.api_env !== 'production').length,
    };
  }, [filtradas]);

  const fechasMasModificadas = useMemo(() => {
    const mapa = new Map<string, { etiqueta: string; total: number }>();
    filtradas.forEach((s) => {
      s.cambios.forEach((c) => {
        const actual = mapa.get(c.campo) || { etiqueta: c.etiqueta, total: 0 };
        actual.total += 1;
        mapa.set(c.campo, actual);
      });
    });
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [filtradas]);

  const maxCampo = Math.max(1, ...fechasMasModificadas.map((f) => f.total));

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
          <h2 className="text-xl font-semibold text-gray-900">Dashboard · Cambios PO sin Tracking</h2>
          <p className="text-sm text-gray-500 mt-1">
            Solicitudes de modificación de fechas de órdenes: volumen, tiempos y aprobaciones.
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
          <p className="mt-3 text-sm text-gray-500">Calculando métricas de cambios de fechas...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <TarjetaKpi
              titulo="Solicitudes"
              valor={metricas.total}
              detalle={`${metricas.resueltas} resueltas${incluirQa && metricas.qa > 0 ? ` · ${metricas.qa} de QA` : ''}`}
              icono="ri-calendar-schedule-line"
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
              detalle={`${metricas.fechasActualizadas} fechas actualizadas en Raga`}
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
              titulo="Fechas modificadas"
              valor={metricas.fechasActualizadas}
              detalle="Total de fechas aprobadas y sincronizadas"
              icono="ri-calendar-check-line"
              colorIcono="bg-sky-50 text-sky-600"
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
                  <h3 className="text-sm font-semibold text-gray-900">Fechas más solicitadas</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Qué fechas de las órdenes se modifican con más frecuencia</p>
                </div>
              </div>
              {fechasMasModificadas.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <i className="ri-calendar-line text-4xl mb-2"></i>
                  <p className="text-sm">Sin solicitudes en el periodo seleccionado.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {fechasMasModificadas.map((f) => (
                    <div key={f.etiqueta}>
                      <div className="flex items-center justify-between text-sm gap-3 mb-1.5">
                        <span className="text-gray-700 truncate">{f.etiqueta}</span>
                        <span className="text-gray-900 font-bold flex-shrink-0">{f.total}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-teal-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${(f.total / maxCampo) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    onClick={() => onIrA('aprobaciones')}
                    className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-checkbox-multiple-line mr-2"></i>Ir a Aprobaciones
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
                    onClick={() => onIrA('historial')}
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
                            <EstadoEtdBadge estado={s.status} />
                            <span className="text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              {s.cambios.length} fecha(s)
                            </span>
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-600 text-white flex-shrink-0">
                    <i className="ri-calendar-schedule-line text-lg"></i>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-teal-900">Cargar fechas de una nueva PO</p>
                    <p className="text-xs text-teal-700 mt-0.5">
                      Ninguna fecha se modifica en la orden hasta que un aprobador lo confirme.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onIrA('solicitar')}
                  className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer flex-shrink-0"
                >
                  <i className="ri-add-line mr-1.5"></i>Nueva solicitud de fechas
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {seleccionada && (
        <ModalDetalleFechas
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