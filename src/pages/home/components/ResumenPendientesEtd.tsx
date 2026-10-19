import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarSolicitudesPendientesEtd, type SolicitudEtd } from '@/lib/etdCambios';
import { formatearFechaCorta } from '@/lib/fechas';

// Resumen compacto de solicitudes de ETD pendientes.
// Por diseño solo consulta el entorno de Producción (nunca QA).
export default function ResumenPendientesEtd() {
  const [solicitudes, setSolicitudes] = useState<SolicitudEtd[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await listarSolicitudesPendientesEtd({ incluirQa: false });
      setSolicitudes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las solicitudes pendientes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const resumen = useMemo(() => {
    const total = solicitudes.length;
    const companias = new Set(
      solicitudes.map((s) => (s.trading_company || '').trim()).filter(Boolean)
    );

    const fechas = solicitudes
      .map((s) => new Date(s.requested_at).getTime())
      .filter((t) => !Number.isNaN(t));

    const masAntigua = fechas.length > 0 ? Math.min(...fechas) : null;
    const diasEspera = masAntigua
      ? Math.floor((Date.now() - masAntigua) / (1000 * 60 * 60 * 24))
      : 0;

    const recientes = [...solicitudes]
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())
      .slice(0, 3);

    return { total, companias: companias.size, diasEspera, recientes };
  }, [solicitudes]);

  const irAAprobaciones = () => {
    window.dispatchEvent(new CustomEvent('navigateTo', { detail: { view: 'etd-aprobaciones' } }));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-teal-50 border border-teal-100">
            <i className="ri-time-line text-2xl text-teal-600"></i>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Solicitudes de ETD pendientes</h3>
            <p className="text-sm text-gray-500">Solo entorno de Producción · cambios reales a la espera de aprobación</p>
          </div>
        </div>
        <button
          onClick={irAAprobaciones}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <i className="ri-checkbox-multiple-line"></i>
          Revisar aprobaciones
        </button>
      </div>

      {cargando ? (
        <div className="py-8 text-center">
          <i className="ri-loader-4-line animate-spin text-2xl text-teal-600"></i>
          <p className="mt-2 text-sm text-gray-500">Cargando pendientes...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={cargar} className="mt-2 text-sm font-medium text-red-700 underline cursor-pointer">
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Contadores */}
          <div className="lg:col-span-2 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium text-gray-500">Pendientes</p>
              <p className="text-3xl font-bold text-gray-900 mt-1 leading-none">{resumen.total}</p>
              <p className="text-[11px] text-gray-500 mt-1">en Producción</p>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs font-medium text-red-700">Más antigua</p>
              <p className="text-3xl font-bold text-red-600 mt-1 leading-none">{resumen.total > 0 ? resumen.diasEspera : 0}</p>
              <p className="text-[11px] text-red-600 mt-1">días de espera</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs font-medium text-gray-500">Compañías</p>
              <p className="text-3xl font-bold text-gray-900 mt-1 leading-none">{resumen.companias}</p>
              <p className="text-[11px] text-gray-500 mt-1">involucradas</p>
            </div>
          </div>

          {/* Últimas solicitudes */}
          <div className="lg:col-span-3">
            {resumen.total === 0 ? (
              <div className="h-full flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4">
                <div className="w-9 h-9 flex items-center justify-center rounded-full bg-teal-100 flex-shrink-0">
                  <i className="ri-checkbox-circle-line text-teal-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Todo al día</p>
                  <p className="text-xs text-gray-500">No hay solicitudes de cambio de ETD esperando aprobación.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {resumen.recientes.map((s) => (
                  <button
                    key={s.id}
                    onClick={irAAprobaciones}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-2.5 hover:border-teal-300 hover:bg-teal-50/40 transition-colors cursor-pointer text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {s.order_number}
                        <span className="ml-2 text-xs font-normal text-gray-500">{s.trading_company}</span>
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Solicitó {s.requested_by_name || 'usuario'} · {formatearFechaCorta(s.requested_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500 whitespace-nowrap">{formatearFechaCorta(s.proposed_etd_initial)}</span>
                      <i className="ri-arrow-right-s-line text-gray-400"></i>
                    </div>
                  </button>
                ))}
                {resumen.total > resumen.recientes.length && (
                  <button
                    onClick={irAAprobaciones}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
                  >
                    Ver las {resumen.total} solicitudes pendientes
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}