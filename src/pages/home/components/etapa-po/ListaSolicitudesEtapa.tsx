import { useCallback, useEffect, useState } from 'react';
import {
  listarSolicitudesEtapa,
  obtenerSolicitudEtapaPorId,
  type SolicitudEtapa,
} from '@/lib/etapaPo';
import { ESTADOS_ETD, formatearFechaHora, type EstadoEtd } from '@/lib/etdMotivos';
import { RAGA_ENV_LABEL } from '@/lib/ragaApi';
import ModalDetalleEtapa from './ModalDetalleEtapa';

interface ListaSolicitudesEtapaProps {
  modo: 'aprobaciones' | 'historial';
  puedeAprobar: boolean;
  usuarioId: string;
  usuarioNombre: string;
  incluirQa: boolean;
  onRefrescarContador?: () => void;
  solicitudObjetivoId?: string | null;
  onObjetivoConsumido?: () => void;
}

const FILTROS: { id: EstadoEtd | 'TODAS'; label: string }[] = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'PENDING', label: 'Pendientes' },
  { id: 'APPROVED', label: 'Aprobadas' },
  { id: 'REJECTED', label: 'Rechazadas' },
];

export default function ListaSolicitudesEtapa({
  modo,
  puedeAprobar,
  usuarioId,
  usuarioNombre,
  incluirQa,
  onRefrescarContador,
  solicitudObjetivoId,
  onObjetivoConsumido,
}: ListaSolicitudesEtapaProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudEtapa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<EstadoEtd | 'TODAS'>(modo === 'aprobaciones' ? 'PENDING' : 'TODAS');
  const [seleccionada, setSeleccionada] = useState<SolicitudEtapa | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const lista = await listarSolicitudesEtapa({
        incluirQa,
        status: modo === 'aprobaciones' ? 'PENDING' : undefined,
      });
      setSolicitudes(lista);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las solicitudes.');
      setSolicitudes([]);
    } finally {
      setCargando(false);
    }
  }, [incluirQa, modo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Abrir una solicitud puntual (por ejemplo desde una notificación).
  useEffect(() => {
    if (!solicitudObjetivoId) return;
    let activo = true;
    obtenerSolicitudEtapaPorId(solicitudObjetivoId)
      .then((sol) => {
        if (activo && sol) setSeleccionada(sol);
      })
      .catch(() => { /* se ignora: la lista sigue disponible */ })
      .finally(() => {
        onObjetivoConsumido?.();
      });
    return () => {
      activo = false;
    };
  }, [solicitudObjetivoId, onObjetivoConsumido]);

  const visibles = modo === 'aprobaciones'
    ? solicitudes
    : solicitudes.filter((s) => (filtro === 'TODAS' ? true : s.status === filtro));

  const alResolver = () => {
    cargar();
    onRefrescarContador?.();
  };

  return (
    <div className="space-y-4">
      {modo === 'historial' && (
        <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filtro === f.id ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {cargando ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 flex flex-col items-center justify-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-teal-600"></i>
          <p className="mt-3 text-sm text-gray-500">Cargando solicitudes...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <i className="ri-error-warning-line text-3xl text-red-500 mb-2"></i>
          <p className="text-sm text-gray-700 mb-3">{error}</p>
          <button
            onClick={cargar}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-refresh-line mr-2"></i>Reintentar
          </button>
        </div>
      ) : visibles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-3">
            <i className="ri-kanban-view text-2xl"></i>
          </div>
          <h3 className="text-base font-semibold text-gray-800">Sin solicitudes</h3>
          <p className="text-sm text-gray-500 mt-1">
            {modo === 'aprobaciones'
              ? 'No hay cambios de etapa pendientes de aprobación.'
              : 'Todavía no se registraron cambios de etapa.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map((sol) => {
            const estado = ESTADOS_ETD[sol.status] || ESTADOS_ETD.PENDING;
            const esProd = sol.api_env !== 'qa';
            return (
              <button
                key={sol.id}
                onClick={() => setSeleccionada(sol)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-gray-900">PO {sol.order_number}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estado.clase}`}>
                        <i className={`${estado.icono} mr-1`}></i>
                        {estado.label}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          esProd ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'
                        }`}
                      >
                        {RAGA_ENV_LABEL[sol.api_env === 'qa' ? 'qa' : 'production']}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 truncate">{sol.trading_company || 'Sin compañía'}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
                      <span className="text-gray-600">{sol.etapa_actual_nombre || sol.etapa_actual_id || 'Sin etapa'}</span>
                      <i className="ri-arrow-right-line text-gray-400"></i>
                      <span className="font-semibold text-teal-700">{sol.etapa_nueva_nombre}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      <i className="ri-user-line mr-1"></i>
                      {sol.requested_by_name || 'Usuario'} · {formatearFechaHora(sol.requested_at)}
                    </p>
                    {sol.rejection_comment && (
                      <p className="text-xs text-red-600 mt-1">
                        <i className="ri-close-circle-line mr-1"></i>
                        {sol.rejection_comment}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-sm text-teal-700 font-medium whitespace-nowrap">
                    {sol.status === 'PENDING' && puedeAprobar ? 'Revisar' : 'Ver detalle'}
                    <i className="ri-arrow-right-s-line text-lg"></i>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {seleccionada && (
        <ModalDetalleEtapa
          solicitud={seleccionada}
          puedeAprobar={puedeAprobar}
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
          onCerrar={() => setSeleccionada(null)}
          onResuelto={alResolver}
        />
      )}
    </div>
  );
}