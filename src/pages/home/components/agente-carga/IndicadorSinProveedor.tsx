import { PAISES_INFO, formatearEntero, formatearPct } from '@/lib/agenteCarga';

interface PaisSinAsignar {
  pais: string;
  cantidad: number;
}

interface IndicadorSinProveedorProps {
  sinAsignar: number;
  total: number;
  porPais: PaisSinAsignar[];
  incluirSinAsignar: boolean;
  onToggle: () => void;
  onVerDetalle: () => void;
}

export default function IndicadorSinProveedor({
  sinAsignar,
  total,
  porPais,
  incluirSinAsignar,
  onToggle,
  onVerDetalle,
}: IndicadorSinProveedorProps) {
  const pct = total > 0 ? (sinAsignar / total) * 100 : 0;
  const hayPendientes = sinAsignar > 0;
  const maxPais = Math.max(1, ...porPais.map((p) => p.cantidad));

  return (
    <div
      className={`rounded-xl border p-5 ${
        hayPendientes ? 'bg-amber-50/70 border-amber-200' : 'bg-teal-50/70 border-teal-200'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-5">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span
            className={`w-11 h-11 flex items-center justify-center rounded-lg flex-shrink-0 ${
              hayPendientes ? 'bg-amber-500 text-white' : 'bg-teal-600 text-white'
            }`}
          >
            <i className={`${hayPendientes ? 'ri-user-unfollow-line' : 'ri-user-follow-line'} text-xl`}></i>
          </span>

          <div className="min-w-0">
            <h3 className={`text-sm font-bold ${hayPendientes ? 'text-amber-900' : 'text-teal-900'}`}>
              POs sin Proveedor de Servicio asignado
            </h3>
            <p className={`text-xs mt-1 max-w-xl leading-relaxed ${hayPendientes ? 'text-amber-800' : 'text-teal-800'}`}>
              {hayPendientes ? (
                <>
                  De <strong>{formatearEntero(total)}</strong> POs cargadas,{' '}
                  <strong>{formatearEntero(sinAsignar)}</strong> todavía no tienen proveedor de servicio. Son las
                  que falta completar en el archivo de origen.
                </>
              ) : (
                <>Todas las POs cargadas tienen Proveedor de Servicio asignado. No hay pendientes por completar.</>
              )}
            </p>

            {hayPendientes && porPais.length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {porPais.map((p) => (
                  <span
                    key={p.pais}
                    title={`${p.cantidad} POs sin proveedor con destino ${PAISES_INFO[p.pais]?.nombre || p.pais}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white/80 border border-amber-200 px-2 py-1 text-[11px] text-amber-900"
                  >
                    <span className="font-bold">{PAISES_INFO[p.pais]?.abbr || p.pais}</span>
                    <span className="text-amber-700">{p.cantidad}</span>
                    <span className="w-10 h-1.5 rounded-full bg-amber-200/70 overflow-hidden inline-flex">
                      <span
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${(p.cantidad / maxPais) * 100}%` }}
                      ></span>
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end gap-4 flex-shrink-0">
          <div className="text-right">
            <p className={`text-3xl font-bold leading-none ${hayPendientes ? 'text-amber-900' : 'text-teal-900'}`}>
              {formatearEntero(sinAsignar)}
            </p>
            <p className={`text-[11px] mt-1 ${hayPendientes ? 'text-amber-700' : 'text-teal-700'}`}>
              {formatearPct(pct)} del total cargado
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {hayPendientes && (
              <button
                onClick={onVerDetalle}
                className="px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-eye-line mr-1"></i>Ver las POs
              </button>
            )}
            <button
              onClick={onToggle}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                hayPendientes
                  ? 'border-amber-300 text-amber-900 hover:bg-white/70'
                  : 'border-teal-300 text-teal-900 hover:bg-white/70'
              }`}
            >
              <i className={`${incluirSinAsignar ? 'ri-checkbox-circle-line' : 'ri-checkbox-blank-circle-line'} mr-1`}></i>
              {incluirSinAsignar ? 'Incluidas en el análisis' : 'Incluir en el análisis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}