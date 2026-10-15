import { useState, useRef, useEffect } from 'react';

export interface OpcionMultiSelect {
  value: string;
  label: string;
}

interface MultiSelectFiltroProps {
  opciones: OpcionMultiSelect[];
  seleccionados: string[];
  onChange: (valores: string[]) => void;
  placeholder?: string;
  icono?: string;
}

/**
 * Filtro de selección múltiple con checkboxes.
 * - Muestra un resumen del estado (placeholder / 1 opción / N opciones).
 * - Permite marcar y desmarcar varias opciones sin cerrar el panel.
 * - Incluye acciones rápidas: "Todas" y "Limpiar".
 */
export default function MultiSelectFiltro({
  opciones,
  seleccionados,
  onChange,
  placeholder = 'Todas',
  icono = 'ri-filter-3-line',
}: MultiSelectFiltroProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  const toggle = (value: string) => {
    if (seleccionados.includes(value)) {
      onChange(seleccionados.filter(v => v !== value));
    } else {
      onChange([...seleccionados, value]);
    }
  };

  const textoResumen = (() => {
    if (seleccionados.length === 0) return placeholder;
    if (seleccionados.length === 1) {
      return opciones.find(o => o.value === seleccionados[0])?.label ?? '1 opción';
    }
    return `${seleccionados.length} seleccionadas`;
  })();

  const haySeleccion = seleccionados.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full px-4 py-2 border rounded-lg text-sm text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
          haySeleccion
            ? 'border-teal-400 bg-teal-50 text-teal-800'
            : 'border-gray-300 bg-white text-gray-700'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <i className={`${icono} text-sm flex-shrink-0 ${haySeleccion ? 'text-teal-600' : 'text-gray-400'}`}></i>
          <span className="truncate">{textoResumen}</span>
          {haySeleccion && (
            <span className="ml-1 bg-teal-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
              {seleccionados.length}
            </span>
          )}
        </span>
        <i className={`ri-arrow-down-s-line text-base flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}></i>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={() => onChange(opciones.map(o => o.value))}
              className="text-xs font-medium text-teal-600 hover:text-teal-700 cursor-pointer"
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={!haySeleccion}
              className="text-xs font-medium text-gray-500 hover:text-red-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Limpiar
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {opciones.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">Sin opciones disponibles</p>
            )}
            {opciones.map(opcion => {
              const activo = seleccionados.includes(opcion.value);
              return (
                <button
                  key={opcion.value}
                  type="button"
                  onClick={() => toggle(opcion.value)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      activo ? 'bg-teal-600 border-teal-600' : 'bg-white border-gray-300'
                    }`}
                  >
                    {activo && <i className="ri-check-line text-white text-[10px]"></i>}
                  </span>
                  <span className={`truncate ${activo ? 'text-teal-800 font-medium' : 'text-gray-700'}`}>
                    {opcion.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}