import { PAISES_INFO, formatearEntero, formatearPct, type AnalisisAsignacion } from '@/lib/agenteCarga';

const COLORES = ['bg-teal-600', 'bg-emerald-500', 'bg-amber-500', 'bg-teal-400', 'bg-gray-400', 'bg-gray-300'];

interface DistribucionCargaProps {
  analisis: AnalisisAsignacion;
  onVerDetalle: (proveedorServicio: string, pais: string | null) => void;
}

export default function DistribucionCarga({ analisis, onVerDetalle }: DistribucionCargaProps) {
  const maxPais = Math.max(1, ...analisis.columnas.map((c) => analisis.totalPorPais[c] || 0));
  const topProveedores = analisis.filas.slice(0, 6);
  const maxProveedor = Math.max(1, ...topProveedores.map((f) => f.total));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Distribución por país destino</h3>
            <p className="text-xs text-gray-500 mt-0.5">Cantidad de POs y peso relativo sobre el total</p>
          </div>
          <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
            <i className="ri-pie-chart-line"></i>
          </span>
        </div>

        <div className="mt-5 space-y-3.5">
          {analisis.columnas.map((pais, index) => {
            const cantidad = analisis.totalPorPais[pais] || 0;
            const pct = analisis.pctPorPais[pais] || 0;
            return (
              <button
                key={pais}
                onClick={() => onVerDetalle('', pais)}
                className="w-full text-left group cursor-pointer"
                title={`Ver POs de ${PAISES_INFO[pais]?.nombre || pais}`}
              >
                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-gray-700 flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 flex-shrink-0">
                      {PAISES_INFO[pais]?.abbr || pais}
                    </span>
                    <span className="truncate group-hover:text-teal-700 transition-colors">{PAISES_INFO[pais]?.nombre || pais}</span>
                  </span>
                  <span className="text-gray-900 font-semibold flex-shrink-0">
                    {formatearEntero(cantidad)}
                    <span className="text-xs font-normal text-gray-400 ml-1.5">{formatearPct(pct)}</span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-1.5">
                  <div
                    className={`${COLORES[index % COLORES.length]} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${(cantidad / maxPais) * 100}%` }}
                  ></div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Top proveedores de servicio</h3>
            <p className="text-xs text-gray-500 mt-0.5">Los de mayor volumen asignado · clic para ver sus POs</p>
          </div>
          <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
            <i className="ri-bar-chart-horizontal-line"></i>
          </span>
        </div>

        <div className="mt-5 space-y-3.5">
          {topProveedores.map((fila) => (
            <button
              key={fila.proveedorServicio}
              onClick={() => onVerDetalle(fila.proveedorServicio, null)}
              className="w-full text-left group cursor-pointer"
              title={`Ver las ${fila.total} POs de ${fila.proveedorServicio}`}
            >
              <div className="flex items-center justify-between text-sm gap-3">
                <span className="text-gray-700 truncate group-hover:text-teal-700 transition-colors">{fila.proveedorServicio}</span>
                <span className="text-gray-900 font-semibold flex-shrink-0">{formatearEntero(fila.total)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-1.5">
                <div
                  className="bg-teal-500 group-hover:bg-teal-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(fila.total / maxProveedor) * 100}%` }}
                ></div>
              </div>
            </button>
          ))}
        </div>

        {analisis.agenteMasUsadoTotal > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Agente de carga con más POs</p>
            <p className="text-xs font-semibold text-gray-800 truncate">
              {analisis.agenteMasUsado} · {formatearEntero(analisis.agenteMasUsadoTotal)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}