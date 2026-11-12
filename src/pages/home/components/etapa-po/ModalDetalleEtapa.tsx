import { useEffect, useState } from 'react';
import {
  aprobarSolicitudEtapa,
  rechazarSolicitudEtapa,
  listarEventosEtapa,
  type SolicitudEtapa,
  type EventoEtapa,
} from '@/lib/etapaPo';
import { ESTADOS_ETD, formatearFechaHora } from '@/lib/etdMotivos';
import { RAGA_ENV_LABEL } from '@/lib/ragaApi';

interface ModalDetalleEtapaProps {
  solicitud: SolicitudEtapa;
  puedeAprobar: boolean;
  usuarioId: string;
  usuarioNombre: string;
  onCerrar: () => void;
  onResuelto: () => void;
}

const ETIQUETA_EVENTO: Record<string, string> = {
  CREATED: 'Solicitud creada',
  APPROVED: 'Aprobada y aplicada en Raga',
  REJECTED: 'Rechazada',
  API_SYNC_ERROR: 'Error al enviar a Raga',
};

const ICONO_EVENTO: Record<string, string> = {
  CREATED: 'ri-add-line',
  APPROVED: 'ri-checkbox-circle-line',
  REJECTED: 'ri-close-circle-line',
  API_SYNC_ERROR: 'ri-error-warning-line',
};

export default function ModalDetalleEtapa({
  solicitud,
  puedeAprobar,
  usuarioId,
  usuarioNombre,
  onCerrar,
  onResuelto,
}: ModalDetalleEtapaProps) {
  const [eventos, setEventos] = useState<EventoEtapa[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [modoRechazo, setModoRechazo] = useState(false);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');
  const [confirmarAprobacion, setConfirmarAprobacion] = useState(false);

  const estado = ESTADOS_ETD[solicitud.status] || ESTADOS_ETD.PENDING;
  const pendiente = solicitud.status === 'PENDING';
  const esProduccion = solicitud.api_env !== 'qa';

  useEffect(() => {
    let activo = true;
    listarEventosEtapa(solicitud.id)
      .then((lista) => {
        if (activo) setEventos(lista);
      })
      .catch(() => {
        if (activo) setEventos([]);
      });
    return () => {
      activo = false;
    };
  }, [solicitud.id]);

  const aprobar = async () => {
    setProcesando(true);
    setError('');
    try {
      const res = await aprobarSolicitudEtapa({
        solicitud,
        aprobadorId: usuarioId,
        aprobadorNombre: usuarioNombre || 'Administrador',
      });
      if (!res.ok) {
        setError(res.error || 'No se pudo aprobar la solicitud.');
        setConfirmarAprobacion(false);
        return;
      }
      onResuelto();
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado al aprobar.');
      setConfirmarAprobacion(false);
    } finally {
      setProcesando(false);
    }
  };

  const rechazar = async () => {
    if (!comentario.trim()) {
      setError('Escribí el motivo del rechazo.');
      return;
    }
    setProcesando(true);
    setError('');
    try {
      const res = await rechazarSolicitudEtapa({
        solicitud,
        revisorId: usuarioId,
        revisorNombre: usuarioNombre || 'Administrador',
        comentario: comentario.trim(),
      });
      if (!res.ok) {
        setError(res.error || 'No se pudo rechazar la solicitud.');
        return;
      }
      onResuelto();
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado al rechazar.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900">PO {solicitud.order_number}</h3>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estado.clase}`}>
                <i className={`${estado.icono} mr-1`}></i>
                {estado.label}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  esProduccion ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'
                }`}
              >
                {RAGA_ENV_LABEL[solicitud.api_env === 'qa' ? 'qa' : 'production']}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{solicitud.trading_company || 'Sin compañía'}</p>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer flex-shrink-0"
            title="Cerrar"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Etapa actual</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {solicitud.etapa_actual_nombre || solicitud.etapa_actual_id || 'Sin etapa'}
              </p>
            </div>
            <div className="rounded-lg border-2 border-teal-300 bg-teal-50 px-4 py-3">
              <p className="text-xs font-medium text-teal-700 uppercase">Etapa solicitada</p>
              <p className="mt-1 text-sm font-bold text-teal-800">{solicitud.etapa_nueva_nombre}</p>
              <p className="text-xs text-teal-600 mt-0.5">ID: {solicitud.etapa_nueva_id}</p>
            </div>
            <div className="rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Motivo</p>
              <p className="mt-1 text-sm text-gray-800">
                {solicitud.change_reason === 'Otro'
                  ? solicitud.other_reason_detail || 'Otro'
                  : solicitud.change_reason}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Solicitado por</p>
              <p className="mt-1 text-sm text-gray-800">{solicitud.requested_by_name || 'Usuario'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatearFechaHora(solicitud.requested_at)}</p>
            </div>
          </div>

          {(solicitud.api_sync_status === 'ERROR' || solicitud.rejection_comment) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
              <div className="min-w-0">
                <p className="text-sm text-red-700">
                  {solicitud.rejection_comment || solicitud.api_sync_error || 'Error al enviar a Raga.'}
                </p>
                {solicitud.api_sync_error && solicitud.rejection_comment && (
                  <p className="text-xs text-red-600 mt-1">{solicitud.api_sync_error}</p>
                )}
              </div>
            </div>
          )}

          {eventos.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Historial</p>
              <div className="space-y-2">
                {eventos.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2 text-sm">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                      <i className={`${ICONO_EVENTO[ev.event_type] || 'ri-record-circle-line'} text-sm`}></i>
                    </span>
                    <div className="min-w-0">
                      <p className="text-gray-800 font-medium">
                        {ETIQUETA_EVENTO[ev.event_type] || ev.event_type}
                        {ev.actor_name && <span className="text-gray-500 font-normal"> · {ev.actor_name}</span>}
                      </p>
                      {ev.detail && <p className="text-xs text-gray-500 break-words">{ev.detail}</p>}
                      <p className="text-xs text-gray-400">{formatearFechaHora(ev.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {pendiente && !puedeAprobar && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <i className="ri-lock-line text-amber-600 mt-0.5"></i>
              <p className="text-sm text-amber-800">
                Solo un Administrador puede aprobar el cambio de etapa. La etapa no se modificará hasta que se apruebe.
              </p>
            </div>
          )}

          {pendiente && puedeAprobar && modoRechazo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Motivo del rechazo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Explicá por qué no se autoriza el cambio"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              />
            </div>
          )}

          {pendiente && puedeAprobar && confirmarAprobacion && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <i className="ri-alert-line text-amber-600 mt-0.5"></i>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-900">
                    Se va a mover la PO {solicitud.order_number} a la etapa {solicitud.etapa_nueva_nombre} en{' '}
                    {esProduccion ? 'Producción' : 'QA'}.
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Esta acción modifica datos reales en Raga y no se puede deshacer desde el sistema.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-3">
                <button
                  onClick={() => setConfirmarAprobacion(false)}
                  disabled={procesando}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={aprobar}
                  disabled={procesando}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  {procesando ? (
                    <><i className="ri-loader-4-line animate-spin mr-2"></i>Aplicando...</>
                  ) : (
                    <><i className="ri-check-line mr-2"></i>Sí, mover etapa</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {!pendiente && (
          <div className="px-6 pb-6 flex justify-end">
            <button
              onClick={onCerrar}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {pendiente && puedeAprobar && !confirmarAprobacion && (
          <div className="px-6 pb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
            {modoRechazo ? (
              <>
                <button
                  onClick={() => { setModoRechazo(false); setError(''); }}
                  disabled={procesando}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  onClick={rechazar}
                  disabled={procesando || !comentario.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-close-line mr-2"></i>Confirmar rechazo
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setModoRechazo(true); setError(''); }}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-close-circle-line mr-2"></i>Rechazar
                </button>
                <button
                  onClick={() => { setConfirmarAprobacion(true); setError(''); }}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-checkbox-circle-line mr-2"></i>Aprobar cambio
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}