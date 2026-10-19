interface AmbienteEtdBadgeProps {
  env: string | null | undefined;
  size?: 'xs' | 'sm';
  mostrarIcono?: boolean;
}

/**
 * Etiqueta visual del entorno de Raga en el que opera una solicitud de ETD.
 * - Producción: rojo (cambio real, sin red de seguridad)
 * - QA: ámbar (entorno de pruebas)
 */
export default function AmbienteEtdBadge({ env, size = 'sm', mostrarIcono = true }: AmbienteEtdBadgeProps) {
  const esProduccion = env === 'production';

  const base = esProduccion
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';

  const tamano = size === 'xs'
    ? 'px-1.5 py-0.5 text-[10px] gap-1'
    : 'px-2 py-1 text-xs gap-1.5';

  return (
    <span
      title={esProduccion ? 'Entorno Producción: modifica datos reales en Raga' : 'Entorno QA: datos de prueba'}
      className={`inline-flex items-center rounded-full border font-bold uppercase tracking-wide whitespace-nowrap ${base} ${tamano}`}
    >
      {mostrarIcono && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${esProduccion ? 'bg-red-600' : 'bg-amber-500'}`}></span>
      )}
      {esProduccion ? 'Prod' : 'QA'}
    </span>
  );
}