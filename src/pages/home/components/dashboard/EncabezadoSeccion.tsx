interface EncabezadoSeccionProps {
  icono: string;
  titulo: string;
  descripcion: string;
  chips?: string[];
  colorIcono?: string;
}

export default function EncabezadoSeccion({
  icono,
  titulo,
  descripcion,
  chips,
  colorIcono = 'bg-teal-600'
}: EncabezadoSeccionProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 mt-2">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 flex items-center justify-center rounded-lg flex-shrink-0 ${colorIcono}`}>
          <i className={`${icono} text-white text-xl`}></i>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{descripcion}</p>
        </div>
      </div>

      {chips && chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {chips.map((chip) => (
            <span
              key={chip}
              className="px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 whitespace-nowrap"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}