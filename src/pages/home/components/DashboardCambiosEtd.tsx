import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarSolicitudesEtd, diferenciaDias, type SolicitudEtd } from '@/lib/etdCambios';
import { formatearFechaCorta } from '@/lib/fechas';
import { formatearFechaHora } from '@/lib/etdMotivos';
import { descargarExcel } from '@/lib/exportar';
import EstadoEtdBadge from './EstadoEtdBadge';
import AmbienteEtdBadge from './AmbienteEtdBadge';
import ModalDetalleSolicitudEtd from './ModalDetalleSolicitudEtd';
import ModalDetalleMotivoEtd from './ModalDetalleMotivoEtd';

interface DashboardCambiosEtdProps {
  usuarioId: string;
  usuarioNombre: string;
  puedeAprobar: boolean;
  puedeAprobarPropias?: boolean;
  incluirQa?: boolean;
  onIrA?: (seccion: 'solicitar' | 'aprobaciones' | 'historial') => void;
}

type Periodo = 30 | 90 | 365 | 0;

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: 30, label: '30 días' },
  { valor: 90, label: '90 días' },
  { valor: 365, label: '12 meses' },
  { valor: 0, label: 'Todo' },
];

// Días transcurridos desde una fecha/hora hasta hoy.
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

export default function DashboardCambiosEtd({
  usuarioId,
  usuarioNombre,
  puedeAprobar,
  puedeAprobarPropias = false,
  incluirQa = false,
  onIrA,
}: DashboardCambiosEtdProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudEtd[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>(90);
  const [seleccionada, setSeleccionada] = useState<SolicitudEtd | null>(null);
  const [motivoAbierto, setMotivoAbierto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await listarSolicitudesEtd({ incluirQa });
      setSolicitudes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las métricas de ETD.');
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

    const tiemposResolucion = [...aprobadas, ...rechazadas]
      .map((s) => diferenciaDias(s.requested_at, s.reviewed_at))
      .filter((d): d is number => d !== null && d >= 0);

    const antiguedades = pendientes.map((s) => diasDesde(s.requested_at));
    const atrasadas = pendientes.filter((s) => diasDesde(s.requested_at) > 2);

    const desplazamientos = filtradas
      .map((s) => diferenciaDias(s.previous_etd_initial, s.proposed_etd_initial))
      .filter((d): d is number => d !== null);

    const tasaAprobacion = resueltas > 0 ? Math.round((aprobadas.length / resueltas) * 100) : 0;

    return {
      total: filtradas.length,
      pendientes,
      aprobadas,
      rechazadas,
      resueltas,
      tasaAprobacion,
      tiempoPromedio: tiemposResolucion.length > 0 ? promedio(tiemposResolucion) : 0,
      antiguedadPromedio: antiguedades.length > 0 ? promedio(antiguedades) : 0,
      atrasadas,
      desplazamientoPromedio: desplazamientos.length > 0 ? promedio(desplazamientos) : 0,
      qa: filtradas.filter((s) => s.api_env !== 'production').length,
    };
  }, [filtradas]);

  const motivos = useMemo(() => {
    const mapa = new Map<string, number>();
    filtradas.forEach((s) => {
      const clave = s.change_reason || 'Sin motivo';
      mapa.set(clave, (mapa.get(clave) || 0) + 1);
    });
    return Array.from(mapa.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [filtradas]);

  const maxMotivo = Math.max(1, ...motivos.map((m) => m.total));

  const solicitudesDelMotivo = useMemo(() => {
    if (!motivoAbierto) return [];
    return filtradas.filter((s) => (s.change_reason || 'Sin motivo') === motivoAbierto);
  }, [filtradas, motivoAbierto]);

  const descargarResumenMotivos = () => {
    if (motivos.length === 0) return;
    const filas = motivos.map((m) => {
      const delMotivo = filtradas.filter((s) => (s.change_reason || 'Sin motivo') === m.nombre);
      const pos = new Set(delMotivo.map((s) => s.order_number)).size;
      const desplazamientos = delMotivo
        .map((s) => diferenciaDias(s.previous_etd_initial, s.proposed_etd_initial))
        .filter((d): d is number => d !== null);
      return {
        Motivo: m.nombre,
        Solicitudes: m.total,
        'POs involucradas': pos,
        '% del periodo': `${metricas.total > 0 ? Math.round((m.total / metricas.total) * 100) : 0}%`,
        'Pendientes': delMotivo.filter((s) => s.status === 'PENDING').length,
        'Desplazamiento promedio (días)': desplazamientos.length > 0
          ? Math.round(promedio(desplazamientos) * 10) / 10
          : '',
      };
    });
    const etiquetaPeriodo = PERIODOS.find((p) => p.valor === periodo)?.label || 'Todo';
    descargarExcel(`Motivos-Cambio-ETD-${etiquetaPeriodo.replace(/\s+/g, '')}.xlsx`, filas);
  };

  const aging = useMemo(() => {
    const buckets = [
      { label: 'Menos de 2 días', detalle: 'En plazo', total: 0, color: 'bg-emerald-500', texto: 'text-emerald-700' },
      { label: '2 a 4 días', detalle: 'Requiere atención', total: 0, color: 'bg-amber-500', texto: 'text-amber-700' },
      { label: '5 días o más', detalle: 'Atrasada', total: 0, color: 'bg-red-500', texto: 'text-red-700' },
    ];
    metricas.pendientes.forEach((s) => {
      const dias = diasDesde(s.requested_at);
      if (dias < 2) buckets[0].total += 1;
      else if (dias <= 4) buckets[1].total += 1;
      else buckets[2].total += 1;
    });
    return buckets;
  }, [metricas.pendientes]);

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

  const saldoDesplazamiento = Math.round(metricas.desplazamientoPromedio * 10) / 10;

  return (
    <div className="space-y-6">
      {/* Encabezado + filtro de periodo */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Dashboard de Cambios ETD Inicial</h2>
          <p className="text-sm text-gray-500 mt-1">
            Panorama de solicitudes, tiempos de aprobación y motivos de cambio.
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
          <p className="mt-3 text-sm text-gray-500">Calculando métricas de ETD...</p>
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <TarjetaKpi
              titulo="Solicitudes"
              valor={metricas.total}
              detalle={`${metricas.resueltas} ya resueltas en el periodo${incluirQa && metricas.qa > 0 ? ` · ${metricas.qa} de QA` : ''}`}
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
              detalle="ETD Inicial actualizado en Raga"
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

          {/* KPIs secundarios */}
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
              detalle={`Antigüedad media de pendientes: ${Math.round(metricas.antiguedadPromedio * 10) / 10} d`}
              icono="ri-alarm-warning-line"
              colorIcono={metricas.atrasadas.length > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}
              colorValor={metricas.atrasadas.length > 0 ? 'text-red-700' : 'text-gray-900'}
            />
            <TarjetaKpi
              titulo="Desplazamiento ETD"
              valor={`${saldoDesplazamiento > 0 ? '+' : ''}${saldoDesplazamiento} d`}
              detalle="Diferencia media entre ETD actual y el solicitado"
              icono="ri-calendar-line"
              colorIcono="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Distribución por estado + motivos */}
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
                  <h3 className="text-sm font-semibold text-gray-900">Motivos de cambio más frecuentes</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Top 6 del periodo · haz clic para ver las POs</p>
                </div>
                <button
                  onClick={descargarResumenMotivos}
                  disabled={motivos.length === 0}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="ri-download-2-line mr-1"></i>Descargar
                </button>
              </div>
              {motivos.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <i className="ri-pie-chart-line text-3xl mb-2"></i>
                  <p className="text-sm">No hay motivos registrados en este periodo.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {motivos.map((m) => (
                    <button
                      key={m.nombre}
                      onClick={() => setMotivoAbierto(m.nombre)}
                      className="w-full text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-teal-50/60 transition-colors group cursor-pointer"
                      title="Ver las POs de este motivo"
                    >
                      <div className="flex items-center justify-between text-sm gap-3">
                        <span className="text-gray-700 truncate flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{m.nombre}</span>
                          <i className="ri-arrow-right-up-line text-gray-300 text-xs group-hover:text-teal-600 transition-colors flex-shrink-0"></i>
                        </span>
                        <span className="text-gray-900 font-semibold flex-shrink-0">{m.total}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-1.5">
                        <div
                          className="bg-teal-500 h-full rounded-full transition-all duration-500 group-hover:bg-teal-600"
                          style={{ width: `${(m.total / maxMotivo) * 100}%` }}
                        ></div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Antigüedad + pendientes más antiguas */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Antigüedad de los pendientes</h3>
                  <p className="text-xs text-gray-500 mt-0.5">El recordatorio automático se dispara a los 2 días</p>
                </div>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full whitespace-nowrap">
                  {metricas.pendientes.length} abiertas
                </span>
              </div>
              <div className="mt-5 space-y-4">
                {aging.map((b) => (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-700">{b.label}</span>
                      <span className={`font-semibold ${b.texto}`}>{b.total}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`${b.color} h-full rounded-full transition-all duration-500`}
                        style={{
                          width: `${metricas.pendientes.length > 0 ? (b.total / metricas.pendientes.length) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">{b.detalle}</p>
                  </div>
                ))}
              </div>
              {onIrA && (
                <button
                  onClick={() => onIrA('aprobaciones')}
                  className="mt-5 w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-checkbox-multiple-line mr-2"></i>Ir a Aprobaciones Pendientes
                </button>
              )}
            </div>

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
                            <p className="text-xs text-gray-500 mt-1">
                              Solicitado por {s.requested_by_name || '—'} · nuevo ETD {formatearFechaCorta(s.proposed_etd_initial)}
                            </p>
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
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Actividad reciente</h3>
                <p className="text-xs text-gray-500 mt-0.5">Últimas solicitudes registradas</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {onIrA && (
                  <button
                    onClick={() => onIrA('historial')}
                    className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-history-line mr-1"></i>Ver historial
                  </button>
                )}
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <i className="ri-history-line"></i>
                </span>
              </div>
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
                          <span className="text-xs text-gray-500 truncate">{s.change_reason || 'Sin motivo'}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
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

          {/* Accesos rápidos */}
          {onIrA && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-600 text-white flex-shrink-0">
                  <i className="ri-calendar-2-line text-lg"></i>
                </span>
                <div>
                  <p className="text-sm font-semibold text-teal-900">¿Necesitas registrar un cambio de ETD?</p>
                  <p className="text-xs text-teal-700 mt-0.5">
                    La solicitud queda pendiente y no modifica Raga hasta que un aprobador la confirme.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onIrA('solicitar')}
                className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer self-start sm:self-auto"
              >
                <i className="ri-add-line mr-1.5"></i>Nueva solicitud
              </button>
            </div>
          )}
        </>
      )}

      {motivoAbierto && (
        <ModalDetalleMotivoEtd
          motivo={motivoAbierto}
          solicitudes={solicitudesDelMotivo}
          totalPeriodo={metricas.total}
          onClose={() => setMotivoAbierto(null)}
          onAbrirSolicitud={(s) => setSeleccionada(s)}
        />
      )}

      {seleccionada && (
        <ModalDetalleSolicitudEtd
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