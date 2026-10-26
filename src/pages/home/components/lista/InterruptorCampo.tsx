// Interruptor reutilizable con tarjeta de estado (un check operativo por bloque).

interface Props {
  titulo: string;
  descripcion: string;
  activo: boolean;
  editable: boolean;
  onChange: (valor: boolean) => void;
  claseOn: string;
  fondoOn: string;
  badgeOn: string;
  etiquetaOn: string;
  etiquetaOff: string;
  className?: string;
}

export default function InterruptorCampo({
  titulo,
  descripcion,
  activo,
  editable,
  onChange,
  claseOn,
  fondoOn,
  badgeOn,
  etiquetaOn,
  etiquetaOff,
  className = '',
}: Props) {
  return (
    <div
      className={`flex items-center gap-4 rounded-lg p-4 border ${
        activo ? fondoOn : 'bg-gray-50 border-gray-200'
      } ${className}`}
    >
      <div className="flex-1">
        <label className="block text-sm font-semibold text-gray-800 mb-1">{titulo}</label>
        <p className="text-xs text-gray-500">{descripcion}</p>
      </div>

      {editable ? (
        <button
          type="button"
          onClick={() => onChange(!activo)}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
            activo ? claseOn : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              activo ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
        </button>
      ) : (
        <span
          className={`text-sm font-medium px-3 py-1 rounded-full whitespace-nowrap ${
            activo ? badgeOn : 'bg-gray-100 text-gray-500'
          }`}
        >
          {activo ? etiquetaOn : etiquetaOff}
        </span>
      )}
    </div>
  );
}