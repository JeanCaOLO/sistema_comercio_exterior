import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calcularResumenBl,
  listarCambiosBl,
  listarTicketsPendientesBl,
  type EventoCambioBl,
  type TicketPendienteBl,
} from '@/lib/blContenedor';
import { formatearFechaHora } from '@/lib/etdMotivos';
import EstadoBlBadge from './EstadoBlBadge';
import PendientesBl from './PendientesBl';
import ModalDetalleCambioBl from './ModalDetalleCambioBl';
import type { VistaBlContenedor } from './types';

interface DashboardBlContenedorProps {
  onIrA: (vista: VistaBlContenedor) => void;
  onCargar: (po: string) => void;
}

type Periodo = 7 | 30 | 90 | 0;

const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: 7, label: '7 días' },
  { valor: 30, label: '30 días' },
  { valor: 90, label: '90 días' },
  { valor: 0, label: 'Todo' },
];

interface KpiProps {
  titulo: string;
  valor: string | number;
  detalle: string;
  icono: string;
  claseIcono: string;
  claseValor?: string;
}

function Kpi({ titulo, valor, detalle, icono, claseIcono, claseValor = 'text-gray-900' }: KpiProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</p>
          <p className={`text-3xl font-bold mt-2 ${claseValor}`}>{valor}</p>
          <p className="text-xs text-gray-500 mt-1.5 leading-snug">{detalle}</p>
        </div>
        <span className={`w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0 ${claseIcono}`}>
          <i className={`${icono} text-lg`}></i>
        </span>
      </div>
    </div>
  );
}

export default function DashboardBlContenedor({ onIrA, onCargar }: DashboardBlContenedorProps) {
  const [eventos, setEventos] = useState<EventoCambioBl[]>([]);
  const [pendientes, setPendientes] = useState<TicketPendienteBl[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [detalle, setDetalle] = useState<EventoCambioBl | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [cambios, tickets] = await Promise.all([
        listarCambiosBl(),
        listarTicketsPendientesBl(),
      ]);
      setEventos(cambios);
      setPendientes(tickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las métricas.');
      setEventos([]);
      setPendientes([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    if (periodo === 0) return eventos;
    const limite = Date.now() - periodo * 86400000;
    return eventos.filter((e) => new Date(e.requested_at).getTime() >= limite);
  }, [eventos, periodo]);

  const diasGrafico = periodo === 7 ? 7 : 14;
  const resumen = useMemo(() => calcularResumenBl(filtrados, diasGrafico), [filtrados, diasGrafico]);

  const recientes = useMemo(
    () => [...filtrados]
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())
      .slice(0, 6),
    [filtrados]
  );

  const maxDia = Math.max(1, ...resumen.porDia.map((d) => d.total));
  const maxAgente = Math.max(1, ...resumen.agentes.map((a) => a.total));
  const maxMotivo = Math.max(1, ...resumen.motivos.map((m) => m.total));

  const totalEstados = resumen.total || 1;
  const pctAplicado = (resumen.aplicados / totalEstados) * 100;
  const pctParcial = (resumen.parciales / totalEstados) * 100;
  const pctError = (resumen.errores / totalEstados) * 100;
  const gradiente = resumen.total === 0
    ? 'conic-gradient(#e5e7eb 0% 100%)'
    : `conic-gradient(
        #10b981 0% ${pctAplicado}%,
        #f59e0b ${pctAplicado}% ${pctAplicado + pctParcial}%,
        #ef4444 ${pctAplicado + pctParcial}% ${pctAplicado + pctParcial + pctError}%
      )`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Dashboard · BL y Contenedor</h2>
          <p className="text-sm text-gray-500 mt-1">
            Control de los datos de embarque que cargan los agentes de carga y se envían a Raga.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-full">
            {PERIODOS.map((p) => (
              <button
                key={p.valor}
                onClick={() => setPeriodo(p.valor)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  periodo === p.valor ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => void cargar()}
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
            <button onClick={() => void cargar()} className="mt-2 text-sm font-medium text-red-700 underline cursor-pointer">
              Reintentar
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-teal-600"></i>
          <p className="mt-3 text-sm text-gray-500">Calculando métricas de BL y contenedor...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi
              titulo="Cambios enviados"
              valor={resumen.total}
              detalle="Cargas registradas en el periodo"
              icono="ri-send-plane-line"
              claseIcono="bg-teal-50 text-teal-600"
            />
            <Kpi
              titulo="BL actualizados"
              valor={resumen.blActualizados}
              detalle="Números de BL cargados en Raga"
              icono="ri-file-text-line"
              claseIcono="bg-sky-50 text-sky-600"
              claseValor="text-sky-700"
            />
            <Kpi
              titulo="Contenedores"
              valor={resumen.contenedoresActualizados}
              detalle="Números de contenedor cargados"
              icono="ri-box-3-line"
              claseIcono="bg-indigo-50 text-indigo-600"
              claseValor="text-indigo-700"
            />
            <Kpi
              titulo="Tickets actualizados"
              valor={resumen.ticketsActualizados}
              detalle="Expedientes del sistema sincronizados"
              icono="ri-loop-left-line"
              claseIcono="bg-emerald-50 text-emerald-600"
              claseValor="text-emerald-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi
              titulo="PO impactadas"
              valor={resumen.posImpactadas}
              detalle="Órdenes distintas con datos nuevos"
              icono="ri-file-list-3-line"
              claseIcono="bg-gray-100 text-gray-600"
            />
            <Kpi
              titulo="Tickets por completar"
              valor={pendientes.length}
              detalle="Dropship y ZF en operación sin BL o contenedor"
              icono="ri-error-warning-line"
              claseIcono={pendientes.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'}
              claseValor={pendientes.length > 0 ? 'text-amber-700' : 'text-gray-900'}
            />
            <Kpi
              titulo="Errores de envío"
              valor={resumen.errores + resumen.parciales}
              detalle="Raga rechazó o aplicó solo una parte"
              icono="ri-close-circle-line"
              claseIcono={resumen.errores + resumen.parciales > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}
              claseValor={resumen.errores + resumen.parciales > 0 ? 'text-red-700' : 'text-gray-900'}
            />
            <Kpi
              titulo="Último cambio"
              valor={resumen.ultimoCambio ? resumen.ultimoCambio.order_number : '—'}
              detalle={resumen.ultimoCambio
                ? formatearFechaHora(resumen.ultimoCambio.requested_at)
                : 'Sin movimientos registrados'}
              icono="ri-time-line"
              claseIcono="bg-gray-100 text-gray-600"
              claseValor="text-lg"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 xl:col-span-2">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Actividad diaria</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Cargas enviadas a Raga en los últimos {diasGrafico} días</p>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {resumen.total} en total
                </span>
              </div>
              <div className="flex items-end gap-1.5 h-40">
                {resumen.porDia.map((dia) => (
                  <div key={dia.fecha} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group">
                    <span className="text-[10px] font-semibold text-gray-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {dia.total}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all ${dia.total > 0 ? 'bg-teal-500 group-hover:bg-teal-600' : 'bg-gray-100'}`}
                      style={{ height: `${Math.max(dia.total > 0 ? 8 : 3, (dia.total / maxDia) * 100)}%` }}
                      title={`${dia.fecha}: ${dia.total} cambio(s)`}
                    ></div>
                    <span className="text-[9px] text-gray-400 mt-1.5 whitespace-nowrap">{dia.etiqueta}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900">Resultado de los envíos</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-4">Sobre {resumen.total} cargas del periodo</p>
              <div className="flex flex-col items-center">
                <div className="relative w-36 h-36 rounded-full" style={{ background: gradiente }}>
                  <div className="absolute inset-[22px] bg-white rounded-full flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{resumen.total}</span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">Cargas</span>
                  </div>
                </div>
                <div className="mt-5 w-full space-y-2.5">
                  {[
                    { label: 'Aplicados', total: resumen.aplicados, color: 'bg-emerald-500' },
                    { label: 'Parciales', total: resumen.parciales, color: 'bg-amber-500' },
                    { label: 'Con error', total: resumen.errores, color: 'bg-red-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-600">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span>
                        {item.label}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {item.total}
                        <span className="text-xs font-normal text-gray-400 ml-1.5">
                          {resumen.total > 0 ? Math.round((item.total / resumen.total) * 100) : 0}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Agentes más activos</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Quién está cargando los datos de embarque</p>
                </div>
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
                  <i className="ri-team-line"></i>
                </span>
              </div>
              {resumen.agentes.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">Sin registros en el periodo.</p>
              ) : (
                <div className="space-y-3.5">
                  {resumen.agentes.map((agente) => (
                    <div key={agente.etiqueta}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-sm text-gray-700 truncate">{agente.etiqueta}</span>
                        <span className="text-sm font-bold text-gray-900 flex-shrink-0">{agente.total}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-teal-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${(agente.total / maxAgente) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Motivos de cambio</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Por qué se cargan o corrigen los datos</p>
                </div>
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-sky-50 text-sky-600 flex-shrink-0">
                  <i className="ri-question-answer-line"></i>
                </span>
              </div>
              {resumen.motivos.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">Sin registros en el periodo.</p>
              ) : (
                <div className="space-y-3.5">
                  {resumen.motivos.map((motivo) => (
                    <div key={motivo.etiqueta}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-sm text-gray-700 truncate" title={motivo.etiqueta}>{motivo.etiqueta}</span>
                        <span className="text-sm font-bold text-gray-900 flex-shrink-0">{motivo.total}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-sky-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${(motivo.total / maxMotivo) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <PendientesBl tickets={pendientes} cargando={false} onCargar={onCargar} />

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Últimos cambios</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Cargas y correcciones recientes</p>
                </div>
                <button
                  onClick={() => onIrA('historial')}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-history-line mr-1"></i>Ver historial
                </button>
              </div>
              {recientes.length === 0 ? (
                <div className="py-14 text-center text-gray-400">
                  <i className="ri-inbox-line text-4xl mb-2"></i>
                  <p className="text-sm">Aún no hay cargas de BL o contenedor.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recientes.map((evento) => (
                    <button
                      key={evento.id}
                      onClick={() => setDetalle(evento)}
                      className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{evento.order_number}</span>
                            <EstadoBlBadge estado={evento.status} size="xs" />
                          </div>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                            {evento.new_bl ? `BL ${evento.new_bl}` : ''}
                            {evento.new_bl && evento.new_container ? ' · ' : ''}
                            {evento.new_container ? `Cont. ${evento.new_container}` : ''}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {evento.requested_by_name || '—'} · {formatearFechaHora(evento.requested_at)}
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

          <div className="bg-teal-50 border border-teal-100 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-600 text-white flex-shrink-0">
                <i className="ri-ship-2-line text-lg"></i>
              </span>
              <div>
                <p className="text-sm font-semibold text-teal-900">Cargar BL y contenedor de una PO</p>
                <p className="text-xs text-teal-700 mt-0.5 max-w-xl">
                  El dato se envía directo a Raga y, si existe un ticket con esa PO, se completa en el sistema.
                </p>
              </div>
            </div>
            <button
              onClick={() => onIrA('actualizar')}
              className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer flex-shrink-0"
            >
              <i className="ri-add-line mr-1.5"></i>Nueva carga
            </button>
          </div>
        </>
      )}

      {detalle && (
        <ModalDetalleCambioBl evento={detalle} onClose={() => setDetalle(null)} />
      )}
    </div>
  );
}