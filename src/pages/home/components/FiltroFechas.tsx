interface FiltroFechasProps {
  inicio: string;
  fin: string;
  onChange: (inicio: string, fin: string) => void;
}

export default function FiltroFechas({ inicio, fin, onChange }: FiltroFechasProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 font-medium flex items-center gap-1 whitespace-nowrap">
          <i className="ri-calendar-line"></i>
          Desde
        </span>
        <input
          type="date"
          value={inicio}
          onChange={(e) => onChange(e.target.value, fin)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Hasta</span>
        <input
          type="date"
          value={fin}
          onChange={(e) => onChange(inicio, e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
        />
      </div>
      {(inicio || fin) && (
        <button
          onClick={() => onChange('', '')}
          className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-close-circle-line"></i>
          Limpiar
        </button>
      )}
    </div>
  );
}