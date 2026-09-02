interface BarChartTiemposProps {
  data: Array<{
    label: string;
    tiempoMinutos: number;
    tiempoTexto: string;
    cantidad: number;
    fuente: 'real' | 'estimado';
  }>;
  colorTema?: 'teal' | 'sky' | 'violet';
}

export default function BarChartTiempos({ data, colorTema = 'teal' }: BarChartTiemposProps) {
  if (data.length === 0) return null;

  const maxMinutos = Math.max(...data.map(item => item.tiempoMinutos));

  // Color coding por duración: corto = verde, medio = ámbar, largo = rojo
  const colorPorDuracion = (minutos: number, ratio: number) => {
    if (minutos < 60) return 'bg-emerald-500'; // < 1h
    if (minutos < 120) return 'bg-teal-500'; // < 2h
    if (minutos < 360) return 'bg-sky-500'; // < 6h
    if (minutos < 720) return 'bg-amber-500'; // < 12h
    if (minutos < 1440) return 'bg-orange-500'; // < 24h
    if (minutos < 2880) return 'bg-rose-400'; // < 2d
    return 'bg-red-500'; // ≥ 2d
  };

  const colorBadge = (minutos: number) => {
    if (minutos < 60) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (minutos < 120) return 'bg-teal-50 text-teal-700 border-teal-200';
    if (minutos < 360) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (minutos < 720) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (minutos < 1440) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (minutos < 2880) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const ratio = item.tiempoMinutos / maxMinutos;
        const barWidth = Math.max(4, ratio * 100);
        const colorClass = colorPorDuracion(item.tiempoMinutos, ratio);
        const badgeClass = colorBadge(item.tiempoMinutos);

        return (
          <div key={index} className="group">
            {/* Label + tiempo arriba */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-gray-700 truncate pr-3">
                {item.label}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.fuente === 'real' && (
                  <span className="text-[10px] text-gray-400">{item.cantidad} transic.</span>
                )}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${badgeClass}`}>
                  {item.tiempoTexto}
                </span>
              </div>
            </div>

            {/* Barra horizontal */}
            <div className="relative">
              <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
                  style={{ width: `${barWidth}%` }}
                ></div>
              </div>

              {/* Tooltip flotante al pasar el mouse */}
              <div className="absolute top-0 left-0 h-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="h-5 flex items-center px-2">
                  <span className="text-[10px] font-bold text-white drop-shadow-sm">
                    {item.tiempoTexto}
                  </span>
                </div>
              </div>
            </div>

            {/* Indicador de proporción vs máximo */}
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-gray-400">
                {Math.round(ratio * 100)}% del tiempo más largo
              </span>
              {item.fuente === 'estimado' && (
                <span className="text-[10px] text-amber-500 italic">estimado</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Leyenda */}
      <div className="pt-3 mt-2 border-t border-gray-100">
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
          <span className="font-semibold">Leyenda:</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> &lt;1h
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-500"></span> &lt;2h
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span> &lt;6h
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> &lt;12h
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-500"></span> &lt;1d
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-400"></span> &lt;2d
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span> ≥2d
          </span>
        </div>
      </div>
    </div>
  );
}