import { formatearEntero, formatearMoneda, formatearPct, type AnalisisAsignacion } from '@/lib/agenteCarga';

interface TarjetasResumenProps {
  analisis: AnalisisAsignacion;
}

export default function TarjetasResumen({ analisis }: TarjetasResumenProps) {
  const pctZf = analisis.total > 0 ? (analisis.posZf / analisis.total) * 100 : 0;

  const tarjetas = [
    {
      titulo: 'POs analizadas',
      valor: formatearEntero(analisis.total),
      detalle: 'POs únicas del archivo cargado',
      icono: 'ri-file-list-3-line',
      colorIcono: 'bg-teal-50 text-teal-600',
      colorValor: 'text-gray-900',
    },
    {
      titulo: 'Proveedores de servicio',
      valor: formatearEntero(analisis.proveedores),
      detalle: analisis.topProveedor !== '—'
        ? `Mayor volumen: ${analisis.topProveedor} (${analisis.topProveedorTotal})`
        : 'Sin datos',
      icono: 'ri-truck-line',
      colorIcono: 'bg-gray-100 text-gray-600',
      colorValor: 'text-gray-900',
    },
    {
      titulo: 'Países destino',
      valor: formatearEntero(analisis.paisesActivos),
      detalle: `Zona Franca: ${formatearEntero(analisis.posZf)} POs (${formatearPct(pctZf)})`,
      icono: 'ri-earth-line',
      colorIcono: 'bg-emerald-50 text-emerald-600',
      colorValor: 'text-gray-900',
    },
    {
      titulo: 'Monto total involucrado',
      valor: formatearMoneda(analisis.montoTotal),
      detalle: 'Suma de Monto Total de las POs cargadas',
      icono: 'ri-money-dollar-circle-line',
      colorIcono: 'bg-amber-50 text-amber-600',
      colorValor: 'text-gray-900',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {tarjetas.map((t) => (
        <div key={t.titulo} className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{t.titulo}</p>
              <p className={`text-2xl font-bold mt-2 ${t.colorValor}`}>{t.valor}</p>
              <p className="text-xs text-gray-500 mt-1.5 leading-snug truncate" title={t.detalle}>{t.detalle}</p>
            </div>
            <span className={`w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0 ${t.colorIcono}`}>
              <i className={`${t.icono} text-lg`}></i>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}