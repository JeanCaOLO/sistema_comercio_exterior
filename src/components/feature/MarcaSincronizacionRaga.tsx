// Marca visual "Actualizado por Raga" con la fecha de la última sincronización.
// Se muestra en el detalle del ticket (Dropship) sin intervenir en la edición.

import { useRagaSyncExpediente } from '@/hooks/useRagaSyncExpediente';

interface Props {
  expedienteId: string | null | undefined;
  habilitado?: boolean;
  className?: string;
}

function formatearFechaHora(iso: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function haceCuanto(iso: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';

  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000);
  if (minutos < 1) return 'hace instantes';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'hace 1 día';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
}

export default function MarcaSincronizacionRaga({
  expedienteId,
  habilitado = true,
  className = '',
}: Props) {
  const sync = useRagaSyncExpediente(expedienteId, habilitado);

  if (sync.cargando) return null;
  if (sync.error) return null;
  if (!sync.actualizado && !sync.ultimaConsulta) return null;

  const fechaBase = sync.fechaActualizacion || sync.ultimaConsulta;
  const textoFecha = formatearFechaHora(fechaBase);
  const relativo = haceCuanto(fechaBase);
  const conError = !sync.actualizado && sync.resultado === 'ERROR';

  if (sync.actualizado) {
    return (
      <div
        className={`rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3 ${className}`}
        title={sync.detalle || undefined}
      >
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100 flex-shrink-0 mt-0.5">
          <i className="ri-check-double-line text-emerald-600 text-base"></i>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-bold text-emerald-800">Actualizado por Raga</p>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              {relativo}
            </span>
          </div>
          <p className="text-xs text-emerald-700 mt-1">
            Última sincronización: <strong className="font-semibold">{textoFecha}</strong>
          </p>
          {sync.campos.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-emerald-700">Datos traídos:</span>
              {sync.campos.map((campo) => (
                <span
                  key={campo}
                  className="text-[11px] font-medium text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap"
                >
                  {campo}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (conError) {
    return (
      <div
        className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 ${className}`}
        title={sync.detalle || undefined}
      >
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-100 flex-shrink-0 mt-0.5">
          <i className="ri-error-warning-line text-amber-600 text-base"></i>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-800">Raga no respondió en la última consulta</p>
          <p className="text-xs text-amber-700 mt-1">
            Último intento: <strong className="font-semibold">{textoFecha}</strong> · {relativo}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-3 ${className}`}
      title={sync.detalle || undefined}
    >
      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
        <i className="ri-refresh-line text-gray-500 text-base"></i>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-700">Consultado en Raga</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Última consulta: {textoFecha} · {relativo} · sin cambios nuevos
        </p>
      </div>
    </div>
  );
}