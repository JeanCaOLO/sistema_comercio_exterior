// Marca compacta "Raga" para las tarjetas del tablero y la lista de expedientes.
// Indica si el ticket fue actualizado por la sincronización con Raga.

import { useEstadoRagaTicket } from '@/hooks/useEstadoRagaTicket';

interface Props {
  expedienteId: string | null | undefined;
  className?: string;
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

export default function MarcaRagaTicket({ expedienteId, className = '' }: Props) {
  const { marca } = useEstadoRagaTicket(expedienteId);

  if (!marca) return null;

  const relativo = haceCuanto(marca.ultimaOk);

  if (marca.actualizado) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold whitespace-nowrap ${className}`}
        title={`Actualizado por Raga${relativo ? ` ${relativo}` : ''}${marca.detalle ? ` · ${marca.detalle}` : ''}`}
      >
        <span className="w-3 h-3 flex items-center justify-center flex-shrink-0">
          <i className="ri-check-double-line text-[10px]"></i>
        </span>
        Raga
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-500 text-[10px] font-medium whitespace-nowrap ${className}`}
      title={`Consultado en Raga sin datos nuevos${relativo ? ` ${relativo}` : ''}`}
    >
      <span className="w-3 h-3 flex items-center justify-center flex-shrink-0">
        <i className="ri-refresh-line text-[10px]"></i>
      </span>
      Raga
    </span>
  );
}