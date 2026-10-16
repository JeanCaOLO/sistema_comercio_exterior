import { ESTADOS_ETD, type EstadoEtd } from '@/lib/etdMotivos';

interface EstadoEtdBadgeProps {
  estado: EstadoEtd;
}

export default function EstadoEtdBadge({ estado }: EstadoEtdBadgeProps) {
  const cfg = ESTADOS_ETD[estado] || ESTADOS_ETD.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.clase}`}>
      <i className={cfg.icono}></i>
      {cfg.label}
    </span>
  );
}

interface SyncEtdBadgeProps {
  status: string | null;
  error?: string | null;
}

// Muestra el resultado de la sincronización con Raga (OK / Error).
export function SyncEtdBadge({ status, error }: SyncEtdBadgeProps) {
  if (!status) return null;
  if (status === 'OK') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-teal-100 text-teal-800">
        <i className="ri-cloud-line"></i>
        Sincronizado con Raga
      </span>
    );
  }
  return (
    <span
      title={error || 'Error al sincronizar con Raga'}
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-red-100 text-red-800"
    >
      <i className="ri-error-warning-line"></i>
      Error de sincronización
    </span>
  );
}