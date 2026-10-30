import { formatearEntero } from '@/lib/agenteCarga';

interface FiltroAsignacionProps {
  desde: string;
  hasta: string;
  onDesde: (valor: string) => void;
  onHasta: (valor: string) => void;
  onLimpiar: () => void;
  totalPos: number;
  enRango: number;
  sinFecha: number;
  fueraRango: number;
  activo: boolean;
}

function mesActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { desde: iso(primero), hasta: iso(ultimo) };
}

function mesAnterior(): { desde: string; hasta: string } {
  const hoy = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { desde: iso(primero), hasta: iso(ultimo) };
}

export default function FiltroAsignacion({
  desde,
  hasta,
  onDesde,
  onHasta,
  onLimpiar,
  totalPos,
  enRango,
  sinFecha,
  fueraRango,
  activo,
}: FiltroAsignacionProps) {
  const aplicar = (rango: { desde: string; hasta: string }) => {
    onDesde(rango.desde);
    onHasta(rango.hasta);
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
              <i className="ri-calendar-2-line"></i>
            </span>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Periodo de asignación</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Filtra por la Fecha Asignación Agente de Carga del archivo.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-0">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Desde
              </label>
              <input
                type="date"
                value={desde}
                onChange={(e) => onDesde(e.target.value)}
                className="w-[150px] px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => onHasta(e.target.value)}
                className="w-[150px] px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              <button
                onClick={() => aplicar(mesActual())}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-full text-[11px] font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                Este mes
              </button>
              <button
                onClick={() => aplicar(mesAnterior())}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-full text-[11px] font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                Mes anterior
              </button>
              <button
                onClick={onLimpiar}
                disabled={!activo}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-full text-[11px] font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="ri-close-line mr-1"></i>Todo el histórico
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:justify-end">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">POs en el periodo</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatearEntero(enRango)}
              <span className="text-[11px] font-normal text-gray-400"> de {formatearEntero(totalPos)}</span>
            </p>
          </div>
          {activo && fueraRango > 0 && (
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Fuera del periodo</p>
              <p className="text-sm font-semibold text-gray-700">{formatearEntero(fueraRango)}</p>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Sin fecha de asignación</p>
            <p className={`text-sm font-semibold ${sinFecha > 0 && activo ? 'text-amber-700' : 'text-gray-700'}`}>
              {formatearEntero(sinFecha)}
            </p>
          </div>
        </div>
      </div>

      {activo && sinFecha > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <i className="ri-alert-line text-amber-600 mt-0.5"></i>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            {formatearEntero(sinFecha)} POs no tienen Fecha Asignación Agente de Carga, así que no entran en ningún
            periodo. Si creés que deberían aparecer, revisá esa columna en el Excel.
          </p>
        </div>
      )}
    </section>
  );
}