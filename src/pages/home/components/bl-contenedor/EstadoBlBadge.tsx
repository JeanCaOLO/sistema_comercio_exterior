import { ESTADOS_CAMBIO_BL, type EstadoCambioBl } from '@/lib/blContenedor';

interface EstadoBlBadgeProps {
  estado: EstadoCambioBl;
  size?: 'xs' | 'sm';
}

export default function EstadoBlBadge({ estado, size = 'sm' }: EstadoBlBadgeProps) {
  const config = ESTADOS_CAMBIO_BL[estado] || ESTADOS_CAMBIO_BL.ERROR;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${config.clase} ${
        size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <i className={`${config.icono} text-[13px]`}></i>
      {config.label}
    </span>
  );
}