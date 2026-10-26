import { useEffect, useMemo, useState } from 'react';
import { diferenciaDias, type SolicitudEtd } from '@/lib/etdCambios';
import { formatearFechaCorta } from '@/lib/fechas';
import { descargarExcel } from '@/lib/exportar';
import EstadoEtdBadge from './EstadoEtdBadge';
import AmbienteEtdBadge from './AmbienteEtdBadge';

interface ModalDetalleMotivoEtdProps {
  motivo: string;
  solicitudes: SolicitudEtd[];
  totalPeriodo: number;
  onClose: () => void;
  onAbrirSolicitud: (solicitud: SolicitudEtd) => void;
}

// Detalle de las POs que se cambiaron por un motivo concreto.
export default function ModalDetalleMotivoEtd({
  motivo,
  solicitudes,
  totalPeriodo,
  onClose,
  onAbrirSolicitud,
}: ModalDetalleMotivoEtdProps) {
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [onClose]);

  const filas = useMemo(() => {
    return solicitudes
      .map((s) => ({
        solicitud: s,
        desplazamiento: diferenciaDias(s.previous_etd_initial, s.proposed_etd_initial),
      }))
      .sort((a, b) => new Date(b.solicitud.requested_at).getTime() - new Date(a.solicitud.requested_at).getTime());
  }, [solicitudes]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return filas;
    return filas.filter(({ solicitud }) =>
      [solicitud.order_number, solicitud.trading_company, solicitud.requested_by_name]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(texto))
    );
  }, [filas, busqueda]);

  const participacion = totalPeriodo > 0 ? Math.round((solicitudes.length / totalPeriodo) * 100) : 0;
  const posUnicas = new Set(solicitudes.map((s) => s.order_number)).size;
  const pendientes = solicitudes.filter((s) => s.status === 'PENDING').length;
  const desplazamientos = filas
    .map((f) => f.desplazamiento)
    .filter((d): d is number => d !== null);
  const desplazamientoPromedio = desplazamientos.length > 0
    ? Math.round((desplazamientos.reduce((a, b) => a + b, 0) / desplazamientos.length) * 10) / 10
    : 0;

  const descargar = () => {
    const datos = filtradas.map(({ solicitud, desplazamiento }) => ({
      Motivo: motivo,
      PO: solicitud.order_number,
      'Compañía': solicitud.trading_company,
      'ETD anterior': solicitud.previous_etd_initial ? formatearFechaCorta(solicitud.previous_etd_initial) : '—',
      'ETD solicitado': formatearFechaCorta(solicitud.proposed_etd_initial),
      'Desplazamiento (días)': desplazamiento ?? '',
      Estado: solicitud.status === 'PENDING' ? 'Pendiente' : solicitud.status === 'APPROVED' ? 'Aprobada' : 'Rechazada',
      'Solicitado por': solicitud.requested_by_name || '—',
      'Fecha de solicitud': formatearFechaCorta(solicitud.requested_at),
      'Detalle adicional': solicitud.other_reason_detail || '',
      Entorno: solicitud.api_env === 'production' ? 'Producción' : 'QA',
    }));
    const limpio = motivo.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    descargarExcel(`POs-Motivo-${limpio || 'ETD'}.xlsx`, datos);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-teal-700">Motivo de cambio</p>
            <h3 className="text-lg font-semibold text-gray-900 mt-0.5 truncate">{motivo}</h3>
            <p className="text-xs text-gray-500 mt-1">
              {solicitudes.length} solicitud{solicitudes.length === 1 ? '' : 'es'} · {posUnicas} PO{posUnicas === 1 ? '' : 's'} · {participacion}% del periodo
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer flex-shrink-0"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Resumen */}
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 px-3 py-2.5">
            <p className="text-[11px] font-medium text-gray-500">Solicitudes</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{solicitudes.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-3 py-2.5">
            <p className="text-[11px] font-medium text-gray-500">Pendientes</p>
            <p className={`text-xl font-bold mt-0.5 ${pendientes > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{pendientes}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-3 py-2.5">
            <p className="text-[11px] font-medium text-gray-500">Desplaz. medio</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {desplazamientoPromedio > 0 ? '+' : ''}{desplazamientoPromedio} d
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-3 py-2.5">
            <p className="text-[11px] font-medium text-gray-500">Participación</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{participacion}%</p>
          </div>
        </div>

        {/* Buscador + descarga */}
        <div className="px-5 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por PO, compañía o solicitante"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 box-border"
            />
          </div>
          <button
            onClick={descargar}
            disabled={filtradas.length === 0}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed self-start sm:self-auto"
          >
            <i className="ri-download-2-line mr-1.5"></i>Descargar reporte
          </button>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto">
          {filtradas.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <i className="ri-inbox-line text-4xl mb-2"></i>
              <p className="text-sm">No hay POs que coincidan con la búsqueda.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2.5 font-medium">PO</th>
                  <th className="px-4 py-2.5 font-medium">Compañía</th>
                  <th className="px-4 py-2.5 font-medium">ETD</th>
                  <th className="px-4 py-2.5 font-medium">Desplaz.</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Solicitó</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtradas.map(({ solicitud, desplazamiento }) => (
                  <tr
                    key={solicitud.id}
                    onClick={() => onAbrirSolicitud(solicitud)}
                    className="hover:bg-teal-50/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{solicitud.order_number}</span>
                        <AmbienteEtdBadge env={solicitud.api_env} size="xs" mostrarIcono={false} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[170px] truncate">{solicitud.trading_company || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      <span className="text-gray-400">
                        {solicitud.previous_etd_initial ? formatearFechaCorta(solicitud.previous_etd_initial) : '—'}
                      </span>
                      <i className="ri-arrow-right-line text-gray-300 mx-1"></i>
                      <span className="font-medium text-gray-900">{formatearFechaCorta(solicitud.proposed_etd_initial)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {desplazamiento === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            desplazamiento === 0
                              ? 'bg-gray-100 text-gray-600'
                              : desplazamiento > 0
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {desplazamiento > 0 ? '+' : ''}{desplazamiento} d
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><EstadoEtdBadge estado={solicitud.status} /></td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">
                      {solicitud.requested_by_name || '—'}
                      <span className="block text-[11px] text-gray-400">{formatearFechaCorta(solicitud.requested_at)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <i className="ri-arrow-right-s-line text-gray-300 text-lg"></i>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Mostrando {filtradas.length} de {solicitudes.length} · clic en una fila para ver el detalle completo
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}