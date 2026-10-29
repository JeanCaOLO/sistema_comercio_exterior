import { formatearEntero, formatearFecha, type ResultadoControl } from '@/lib/controlFechas';

interface TarjetasHallazgosProps {
  resultado: ResultadoControl;
  tabActiva: string;
  onSeleccionar: (tab: string) => void;
}

export default function TarjetasHallazgos({ resultado, tabActiva, onSeleccionar }: TarjetasHallazgosProps) {
  const diferenciasEtapa = resultado.controlEtapa.filter((item) => !item.ok).length;

  const tarjetas = [
    {
      id: 'a',
      titulo: 'Sin fechas ETD/ETA',
      valor: resultado.faltantes.length,
      detalle: 'Con contenedor y naviera',
      icono: 'ri-calendar-close-line',
      iconoClase: 'bg-gray-100 text-gray-600',
      valorClase: 'text-gray-900',
    },
    {
      id: 'b',
      titulo: 'ETD Variable vencido',
      valor: resultado.etdVencido.length,
      detalle: `≤ ${formatearFecha(resultado.limite)}${resultado.excluirReales ? ' · sin ATD' : ''}`,
      icono: 'ri-timer-flash-line',
      iconoClase: 'bg-orange-50 text-orange-600',
      valorClase: 'text-orange-700',
    },
    {
      id: 'c',
      titulo: 'ETA Variable vencida',
      valor: resultado.etaVencido.length,
      detalle: `≤ ${formatearFecha(resultado.limite)}${resultado.excluirReales ? ' · sin ATA' : ''}`,
      icono: 'ri-alarm-warning-line',
      iconoClase: 'bg-rose-50 text-rose-600',
      valorClase: 'text-rose-700',
    },
    {
      id: 'e',
      titulo: 'Fechas fuera de regla',
      valor: diferenciasEtapa,
      detalle: `de ${formatearEntero(resultado.controlEtapa.length)} POs evaluadas por etapa`,
      icono: 'ri-list-check-2',
      iconoClase: 'bg-amber-50 text-amber-600',
      valorClase: 'text-amber-700',
    },
    {
      id: 'f',
      titulo: 'ATA menor a ATD',
      valor: resultado.ataMenorAtd.length,
      detalle: 'Arribo real antes del zarpe real',
      icono: 'ri-arrow-left-right-line',
      iconoClase: 'bg-teal-50 text-teal-700',
      valorClase: 'text-teal-800',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {tarjetas.map((t) => {
        const activa = tabActiva === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSeleccionar(t.id)}
            className={`text-left bg-white rounded-xl border p-4 transition-colors cursor-pointer ${
              activa ? 'border-teal-400 ring-1 ring-teal-200' : 'border-gray-200 hover:border-teal-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 leading-snug">
                {t.titulo}
              </p>
              <span className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${t.iconoClase}`}>
                <i className={`${t.icono} text-sm`}></i>
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1.5 ${t.valorClase}`}>{formatearEntero(t.valor)}</p>
            <p className="text-[11px] text-gray-500 mt-1 leading-snug">{t.detalle}</p>
          </button>
        );
      })}
    </div>
  );
}