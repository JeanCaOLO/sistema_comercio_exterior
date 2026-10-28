// Selector de alcance del Dashboard: todos los KPIs, solo Dropship o solo Zona Franca.

import type { VistaEstados } from './types';

interface Props {
  vista: VistaEstados;
  onVista: (vista: VistaEstados) => void;
  conteos: Record<VistaEstados, number>;
}

const OPCIONES: { clave: VistaEstados; etiqueta: string; icono: string }[] = [
  { clave: 'general', etiqueta: 'Todos', icono: 'ri-layout-grid-line' },
  { clave: 'dropship', etiqueta: 'Dropship', icono: 'ri-ship-2-line' },
  { clave: 'zf', etiqueta: 'Zona Franca', icono: 'ri-building-4-line' },
];

export default function SelectorModulo({ vista, onVista, conteos }: Props) {
  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Analizar
      </span>
      <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full p-1">
        {OPCIONES.map((opcion) => {
          const activo = vista === opcion.clave;
          return (
            <button
              key={opcion.clave}
              onClick={() => onVista(opcion.clave)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activo
                  ? 'bg-white text-teal-700 border border-teal-200'
                  : 'text-gray-600 hover:text-gray-900 border border-transparent'
              }`}
            >
              <i className={`${opcion.icono} text-base`}></i>
              <span>{opcion.etiqueta}</span>
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                  activo ? 'bg-teal-50 text-teal-700' : 'bg-white/70 text-gray-500'
                }`}
              >
                {conteos[opcion.clave]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}