import { useCallback, useEffect, useState } from 'react';
import {
  crearCoberturaVacia,
  ejecutarBarridoRaga,
  obtenerCoberturaEmbarque,
  obtenerResumenControl,
  obtenerUltimaCorrida,
  proximaEjecucionAutomatica,
  type CoberturaEmbarque,
  type CorridaSincronizacion,
  type ProgresoBarrido,
  type ResumenBarrido,
} from '@/lib/ragaSync';
import CoberturaEmbarqueRaga from './CoberturaEmbarqueRaga';

interface SincronizacionRagaProps {
  onSincronizado?: () => void;
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-CR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SincronizacionRaga({ onSincronizado }: SincronizacionRagaProps) {
  const [ultima, setUltima] = useState<CorridaSincronizacion | null>(null);
  const [control, setControl] = useState({ rastreados: 0, conDatos: 0, conError: 0 });
  const [cobertura, setCobertura] = useState<CoberturaEmbarque>(crearCoberturaVacia);
  const [cargandoCobertura, setCargandoCobertura] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResumenBarrido | null>(null);
  const [progreso, setProgreso] = useState<ProgresoBarrido | null>(null);
  const [error, setError] = useState('');
  const [verDetalle, setVerDetalle] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const cargarEstado = useCallback(async () => {
    const [corrida, resumen, coberturaActual] = await Promise.all([
      obtenerUltimaCorrida(),
      obtenerResumenControl(),
      obtenerCoberturaEmbarque(),
    ]);
    setUltima(corrida);
    setControl(resumen);
    setCobertura(coberturaActual);
    setCargandoCobertura(false);
  }, []);

  useEffect(() => {
    cargarEstado();
  }, [cargarEstado]);

  // Refresca la tarjeta cuando la sincronización automática termina.
  useEffect(() => {
    const alTerminar = (event: Event) => {
      const detalle = (event as CustomEvent<ResumenBarrido>).detail;
      if (detalle) setResultado(detalle);
      setProgreso(null);
      cargarEstado();
      onSincronizado?.();
    };
    window.addEventListener('ragaSyncCompletada', alTerminar);
    return () => window.removeEventListener('ragaSyncCompletada', alTerminar);
  }, [cargarEstado, onSincronizado]);

  const sincronizarAhora = async () => {
    setCargando(true);
    setError('');
    setResultado(null);
    setProgreso(null);
    try {
      const res = await ejecutarBarridoRaga({
        force: true,
        limite: 20,
        onProgreso: setProgreso,
      });
      if (!res.ok) {
        setError(res.error || 'No se pudo sincronizar con Raga.');
        return;
      }
      setResultado(res);
      await cargarEstado();
      if (res.tickets_actualizados > 0) onSincronizado?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al sincronizar.');
    } finally {
      setCargando(false);
      setProgreso(null);
    }
  };

  const proxima = proximaEjecucionAutomatica();
  const actualizadosUltima = ultima?.tickets_actualizados || 0;

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex items-start gap-3 min-w-0 text-left cursor-pointer flex-1 rounded-lg"
        >
          <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
            <i className="ri-refresh-line text-xl"></i>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900">Sincronización automática con Raga</h3>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium whitespace-nowrap">
                barrido cada 6 h
              </span>
              <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[11px] font-medium whitespace-nowrap">
                Dropship
              </span>
            </div>

            {abierto ? (
              <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                Recorre <strong className="font-semibold text-gray-700">todos</strong> los tickets en{' '}
                <strong className="font-semibold text-gray-700">Asignado</strong>,{' '}
                <strong className="font-semibold text-gray-700">En Proceso</strong> y{' '}
                <strong className="font-semibold text-gray-700">Liberación</strong>, en lotes con pausa entre uno y
                otro dentro de una ventana de 6 horas, y completa el N° de BL, el N° de Contenedor, el ETD con el
                ATD y la ETA Real con el ATA. A las 6 horas vuelve a barrer para retomar los que aún no tenían el dato.
              </p>
            ) : (
              <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-gray-500">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <i className="ri-history-line"></i>
                  Última corrida: <strong className="font-semibold text-gray-700">{formatearFecha(ultima?.iniciado_at)}</strong>
                </span>
                <span className="flex items-center gap-1 whitespace-nowrap text-emerald-600">
                  <i className="ri-check-double-line"></i>
                  {actualizadosUltima} actualizados
                </span>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <i className="ri-database-2-line"></i>
                  {control.rastreados} rastreados
                </span>
                {proxima && (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <i className="ri-time-line"></i>
                    Próxima: {formatearFecha(proxima.toISOString())}
                  </span>
                )}
              </div>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setVerDetalle((v) => !v);
              setAbierto(true);
            }}
            className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <i className="ri-information-line"></i>
            Detalle
          </button>
          <button
            type="button"
            onClick={sincronizarAhora}
            disabled={cargando}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={cargando ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'}></i>
            {cargando
              ? (progreso ? `Lote ${progreso.lote} de ${progreso.maxLotes}…` : 'Consultando Raga…')
              : 'Sincronizar ahora'}
          </button>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-label={abierto ? 'Ocultar detalle de sincronización' : 'Mostrar detalle de sincronización'}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <i className={abierto ? 'ri-arrow-up-s-line text-base' : 'ri-arrow-down-s-line text-base'}></i>
          </button>
        </div>
      </div>

      {abierto && (
        <>
          <div className="flex items-center gap-4 mt-3 flex-wrap text-[11px] text-gray-500">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <i className="ri-history-line"></i>
              Última corrida: <strong className="font-semibold text-gray-700">{formatearFecha(ultima?.iniciado_at)}</strong>
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <i className="ri-checkbox-circle-line text-teal-600"></i>
              {actualizadosUltima} ticket(s) actualizados
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <i className="ri-database-2-line"></i>
              {control.rastreados} ticket(s) rastreados
            </span>
            {control.conError > 0 && (
              <span className="flex items-center gap-1 whitespace-nowrap text-amber-600">
                <i className="ri-error-warning-line"></i>
                {control.conError} con error
              </span>
            )}
            {proxima && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <i className="ri-time-line"></i>
                Próxima: {formatearFecha(proxima.toISOString())}
              </span>
            )}
          </div>

          <CoberturaEmbarqueRaga cobertura={cobertura} cargando={cargandoCobertura} />

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <i className="ri-error-warning-line text-red-600 text-sm mt-0.5"></i>
              <p className="text-xs text-red-800">{error}</p>
            </div>
          )}

          {resultado && !error && (
            <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-teal-900">
                {resultado.lotes === 0
                  ? (resultado.motivo || 'No había tickets pendientes de consultar.')
                  : `${resultado.tickets_actualizados} ticket(s) actualizados, ${resultado.tickets_sin_cambios} sin cambios y ${resultado.errores} con error.`}
              </p>
              {resultado.lotes > 0 && (
                <p className="text-[11px] text-teal-700 mt-0.5">
                  {resultado.tickets_revisados} ticket(s) revisados · {resultado.consultas_api} consulta(s) a la API ·{' '}
                  {resultado.lotes} lote(s)
                  {resultado.pendientes_restantes > 0
                    ? ` · quedan ${resultado.pendientes_restantes} para el próximo lote`
                    : ' · barrido completo'}
                </p>
              )}
              {(resultado.detalle || []).filter((d) => (d.cambios ? Object.keys(d.cambios).length > 0 : false)).length > 0 && (
                <ul className="mt-2 space-y-1">
                  {(resultado.detalle || [])
                    .filter((d) => (d.cambios ? Object.keys(d.cambios).length > 0 : false))
                    .slice(0, 5)
                    .map((d) => (
                      <li key={d.expediente_id} className="text-[11px] text-teal-800 flex items-start gap-1.5">
                        <i className="ri-arrow-right-s-line mt-0.5"></i>
                        <span>
                          <strong className="font-semibold">{d.po || 'Sin PO'}:</strong>{' '}
                          {Object.keys(d.cambios || {}).join(', ')}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}

          {verDetalle && (
            <div className="mt-4 border-t border-gray-100 pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Última corrida</p>
                <ul className="space-y-1 text-[11px] text-gray-600">
                  <li className="flex justify-between gap-2"><span>Inicio</span><span className="font-medium text-gray-800">{formatearFecha(ultima?.iniciado_at)}</span></li>
                  <li className="flex justify-between gap-2"><span>Tickets revisados</span><span className="font-medium text-gray-800">{ultima?.tickets_revisados ?? 0}</span></li>
                  <li className="flex justify-between gap-2"><span>Consultas a la API</span><span className="font-medium text-gray-800">{ultima?.consultas_api ?? 0}</span></li>
                  <li className="flex justify-between gap-2"><span>Actualizados</span><span className="font-medium text-gray-800">{ultima?.tickets_actualizados ?? 0}</span></li>
                  <li className="flex justify-between gap-2"><span>Sin cambios</span><span className="font-medium text-gray-800">{ultima?.tickets_sin_cambios ?? 0}</span></li>
                  <li className="flex justify-between gap-2"><span>Errores</span><span className="font-medium text-gray-800">{ultima?.errores ?? 0}</span></li>
                  <li className="flex justify-between gap-2"><span>Origen</span><span className="font-medium text-gray-800">{ultima?.origen === 'manual' ? 'Manual' : 'Automático'}</span></li>
                  <li className="flex justify-between gap-2"><span>Estado</span><span className="font-medium text-gray-800">{ultima?.estado || '—'}</span></li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Cómo se protege la API</p>
                <ul className="space-y-1.5 text-[11px] text-gray-600">
                  <li className="flex items-start gap-1.5"><i className="ri-check-line text-teal-600 mt-0.5"></i>Ningún ticket se consulta dos veces dentro de la misma ventana de 6 horas.</li>
                  <li className="flex items-start gap-1.5"><i className="ri-check-line text-teal-600 mt-0.5"></i>El barrido avanza en lotes de hasta 20 tickets, con pausa de 90 s entre lote y lote.</li>
                  <li className="flex items-start gap-1.5"><i className="ri-check-line text-teal-600 mt-0.5"></i>Si quedan tickets sin el dato, se retoman a los 10 minutos y también en la pasada de 6 horas.</li>
                  <li className="flex items-start gap-1.5"><i className="ri-check-line text-teal-600 mt-0.5"></i>Nunca corren dos sincronizaciones en paralelo.</li>
                  <li className="flex items-start gap-1.5"><i className="ri-check-line text-teal-600 mt-0.5"></i>Solo escribe lo que cambió y lo deja en el historial del ticket.</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}