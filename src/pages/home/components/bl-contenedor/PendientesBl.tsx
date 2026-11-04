import { poPrincipal, type TicketPendienteBl } from '@/lib/blContenedor';

interface PendientesBlProps {
  tickets: TicketPendienteBl[];
  cargando: boolean;
  onCargar: (po: string) => void;
}

export default function PendientesBl({ tickets, cargando, onCargar }: PendientesBlProps) {
  const sinBl = tickets.filter((t) => !t.numero_bl).length;
  const sinContenedor = tickets.filter((t) => !t.numero_contenedor).length;
  const sinAmbos = tickets.filter((t) => !t.numero_bl && !t.numero_contenedor).length;
  const visibles = tickets.slice(0, 7);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Tickets por completar</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Expedientes Dropship en operación a los que les falta BL o contenedor.
            </p>
          </div>
          <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
            <i className="ri-error-warning-line"></i>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {tickets.length} pendientes
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
            {sinBl} sin BL
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
            {sinContenedor} sin contenedor
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-600">
            {sinAmbos} sin ambos
          </span>
        </div>
      </div>

      {cargando ? (
        <div className="py-12 text-center">
          <i className="ri-loader-4-line animate-spin text-2xl text-teal-600"></i>
        </div>
      ) : visibles.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <i className="ri-checkbox-circle-line text-4xl mb-2"></i>
          <p className="text-sm">Todos los tickets en operación tienen BL y contenedor.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {visibles.map((t) => {
            const po = poPrincipal(t.po_tiquetera);
            return (
              <div key={t.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{t.exp_id || 'Sin EXP'}</p>
                    <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      {t.estado_expediente || '—'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 break-words">PO: {t.po_tiquetera}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {!t.numero_bl && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-700">Falta BL</span>
                    )}
                    {!t.numero_contenedor && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Falta contenedor</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onCargar(po)}
                  disabled={!po}
                  className="px-3 py-1.5 border border-teal-200 text-teal-700 bg-teal-50 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors whitespace-nowrap cursor-pointer flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="ri-add-line mr-1"></i>Cargar
                </button>
              </div>
            );
          })}
          {tickets.length > visibles.length && (
            <div className="px-5 py-2.5 bg-gray-50 text-[11px] text-gray-500">
              y {tickets.length - visibles.length} ticket(s) más con datos pendientes.
            </div>
          )}
        </div>
      )}
    </div>
  );
}