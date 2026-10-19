import { useEffect, useState, type ReactNode } from 'react';
import {
  aprobarSolicitudEtd,
  rechazarSolicitudEtd,
  listarEventosEtd,
  diferenciaDias,
  type SolicitudEtd,
  type EventoEtd,
} from '@/lib/etdCambios';
import { formatearFechaHora } from '@/lib/etdMotivos';
import { formatearFechaCorta } from '@/lib/fechas';
import EstadoEtdBadge, { SyncEtdBadge } from './EstadoEtdBadge';
import AmbienteEtdBadge from './AmbienteEtdBadge';

interface ModalDetalleSolicitudEtdProps {
  solicitud: SolicitudEtd;
  puedeAprobar: boolean;
  puedeAprobarPropias?: boolean;
  usuarioId: string;
  usuarioNombre: string;
  onClose: () => void;
  onResolved: () => void;
}

export default function ModalDetalleSolicitudEtd({
  solicitud,
  puedeAprobar,
  puedeAprobarPropias = false,
  usuarioId,
  usuarioNombre,
  onClose,
  onResolved,
}: ModalDetalleSolicitudEtdProps) {
  const [eventos, setEventos] = useState<EventoEtd[]>([]);
  const [modo, setModo] = useState<'detalle' | 'confirmar-aprobar' | 'rechazar'>('detalle');
  const [comentario, setComentario] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  useEffect(() => {
    listarEventosEtd(solicitud.id)
      .then(setEventos)
      .catch(() => setEventos([]));
  }, [solicitud.id]);

  const esPropia = solicitud.requested_by && solicitud.requested_by === usuarioId;
  const bloqueadaPorSerPropia = Boolean(esPropia) && !puedeAprobarPropias;
  const puedeResolver = puedeAprobar && solicitud.status === 'PENDING' && !bloqueadaPorSerPropia;
  const diferencia = diferenciaDias(solicitud.previous_etd_initial, solicitud.proposed_etd_initial);

  const confirmarAprobacion = async () => {
    setProcesando(true);
    setError('');
    const res = await aprobarSolicitudEtd({
      solicitud,
      aprobadorId: usuarioId,
      aprobadorNombre: usuarioNombre,
    });
    setProcesando(false);
    if (res.ok) {
      setExito('Cambio aprobado y sincronizado correctamente con Raga.');
      setTimeout(onResolved, 900);
    } else {
      setError(res.error || 'No se pudo aprobar la solicitud.');
      setModo('detalle');
    }
  };

  const confirmarRechazo = async () => {
    if (!comentario.trim()) {
      setError('Debes ingresar el motivo del rechazo.');
      return;
    }
    setProcesando(true);
    setError('');
    const res = await rechazarSolicitudEtd({
      solicitud,
      revisorId: usuarioId,
      revisorNombre: usuarioNombre,
      comentario,
    });
    setProcesando(false);
    if (res.ok) {
      setExito('Solicitud rechazada correctamente.');
      setTimeout(onResolved, 900);
    } else {
      setError(res.error || 'No se pudo rechazar la solicitud.');
      setModo('detalle');
    }
  };

  const Campo = ({ etiqueta, valor, resaltar = false }: { etiqueta: string; valor: ReactNode; resaltar?: boolean }) => (
    <div className={`rounded-lg border px-4 py-3 ${resaltar ? 'border-teal-200 bg-teal-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{etiqueta}</p>
      <div className="mt-1 text-sm font-semibold text-gray-900">{valor}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Detalle de solicitud
              <AmbienteEtdBadge env={solicitud.api_env} />
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">ID: {solicitud.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-2xl text-gray-500"></i>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {exito && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
              <i className="ri-checkbox-circle-line text-emerald-600 mt-0.5"></i>
              <p className="text-sm text-emerald-700">{exito}</p>
            </div>
          )}

          {/* Comparación visual de fechas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Cambio de ETD Inicial</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
              <Campo etiqueta="ETD Inicial vigente" valor={formatearFechaCorta(solicitud.previous_etd_initial || '') || '—'} />
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex flex-col items-center justify-center">
                <i className="ri-arrow-right-line text-2xl text-teal-600"></i>
                <span className="text-xs text-gray-500 mt-1">
                  {diferencia === null
                    ? 'Diferencia no calculable'
                    : diferencia === 0
                    ? 'Sin diferencia'
                    : `${diferencia > 0 ? '+' : ''}${diferencia} día(s)`}
                </span>
              </div>
              <Campo etiqueta="ETD Inicial solicitado" valor={formatearFechaCorta(solicitud.proposed_etd_initial)} resaltar />
            </div>
          </div>

          {/* Datos de la PO y la solicitud */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Datos de la orden</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Campo etiqueta="Número de PO" valor={solicitud.order_number} />
              <Campo etiqueta="Compañía" valor={solicitud.trading_company} />
              <Campo etiqueta="Estado" valor={<EstadoEtdBadge estado={solicitud.status} />} />
              <Campo
                etiqueta="Entorno Raga"
                valor={<AmbienteEtdBadge env={solicitud.api_env} />}
              />
              <Campo etiqueta="Motivo del cambio" valor={solicitud.change_reason} />
              <Campo
                etiqueta="Explicación adicional"
                valor={solicitud.other_reason_detail || '—'}
              />
              <Campo etiqueta="Sincronización Raga" valor={<SyncEtdBadge status={solicitud.api_sync_status} error={solicitud.api_sync_error} /> || '—'} />
              <Campo etiqueta="Solicitante" valor={solicitud.requested_by_name || '—'} />
              <Campo etiqueta="Fecha de solicitud" valor={formatearFechaHora(solicitud.requested_at)} />
              <Campo etiqueta="Revisado por" valor={solicitud.reviewed_by_name || '—'} />
              <Campo etiqueta="Fecha de revisión" valor={formatearFechaHora(solicitud.reviewed_at)} />
            </div>
          </div>

          {solicitud.rejection_comment && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-red-700 uppercase mb-1">Motivo del rechazo</p>
              <p className="text-sm text-red-800">{solicitud.rejection_comment}</p>
            </div>
          )}

          {/* Historial de eventos */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Historial de eventos</h3>
            {eventos.length === 0 ? (
              <p className="text-sm text-gray-400">Sin eventos registrados.</p>
            ) : (
              <ol className="relative border-l border-gray-200 ml-2 space-y-4">
                {eventos.map((ev) => (
                  <li key={ev.id} className="ml-4">
                    <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-teal-500 border-2 border-white"></span>
                    <p className="text-sm font-medium text-gray-900">{ev.event_type}</p>
                    {ev.detail && <p className="text-sm text-gray-600">{ev.detail}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ev.actor_name ? `${ev.actor_name} · ` : ''}
                      {formatearFechaHora(ev.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {bloqueadaPorSerPropia && solicitud.status === 'PENDING' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <i className="ri-shield-user-line mr-2"></i>
              No puedes aprobar ni rechazar tu propia solicitud (separación de funciones).
            </div>
          )}
        </div>

        {/* Acciones */}
        {solicitud.status === 'PENDING' && (
          <div className="border-t border-gray-200 px-6 py-4 flex-shrink-0">
            {modo === 'detalle' && (
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cerrar
                </button>
                {puedeResolver && (
                  <>
                    <button
                      onClick={() => { setError(''); setModo('rechazar'); }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-close-circle-line mr-2"></i>
                      Rechazar cambio
                    </button>
                    <button
                      onClick={() => { setError(''); setModo('confirmar-aprobar'); }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-checkbox-circle-line mr-2"></i>
                      Aprobar cambio
                    </button>
                  </>
                )}
              </div>
            )}

            {modo === 'confirmar-aprobar' && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-gray-700">
                  ¿Confirmas aprobar el cambio? Se actualizará el ETD Inicial en <strong>Raga</strong> a{' '}
                  <strong>{formatearFechaCorta(solicitud.proposed_etd_initial)}</strong> en el entorno{' '}
                  <strong>{solicitud.api_env === 'production' ? 'Producción' : 'QA'}</strong>. Esta acción no se puede deshacer.
                </p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => setModo('detalle')}
                    disabled={procesando}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarAprobacion}
                    disabled={procesando}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    {procesando ? (
                      <><i className="ri-loader-4-line animate-spin mr-2"></i>Procesando...</>
                    ) : (
                      <><i className="ri-check-line mr-2"></i>Sí, aprobar</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {modo === 'rechazar' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Comentario de rechazo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Explica el motivo del rechazo (obligatorio)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm"
                />
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setModo('detalle')}
                    disabled={procesando}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarRechazo}
                    disabled={procesando || !comentario.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {procesando ? (
                      <><i className="ri-loader-4-line animate-spin mr-2"></i>Rechazando...</>
                    ) : (
                      <><i className="ri-close-line mr-2"></i>Confirmar rechazo</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {solicitud.status !== 'PENDING' && (
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}