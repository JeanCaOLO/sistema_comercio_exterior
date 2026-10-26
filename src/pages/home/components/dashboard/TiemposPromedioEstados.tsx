// Tarjeta de tiempos promedio entre estados, con selector de módulo.

import BarChartTiempos from '@/pages/home/components/BarChartTiempos';
import { formatearTiempo } from './utils';
import type { FiltroModuloTiempos, TiempoEntreEstados } from './types';

interface Props {
  tiempos: TiempoEntreEstados[];
  filtroModulo: FiltroModuloTiempos;
  onFiltroModulo: (filtro: FiltroModuloTiempos) => void;
}

const MODULOS: { clave: FiltroModuloTiempos; etiqueta: string }[] = [
  { clave: 'todos', etiqueta: 'Todos los módulos' },
  { clave: 'dropship', etiqueta: 'Solo Dropship' },
  { clave: 'zf', etiqueta: 'Solo ZF' },
];

const colorModulo = (modulo: FiltroModuloTiempos): 'teal' | 'sky' | 'violet' => {
  if (modulo === 'dropship') return 'sky';
  if (modulo === 'zf') return 'violet';
  return 'teal';
};

export default function TiemposPromedioEstados({ tiempos, filtroModulo, onFiltroModulo }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4 gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Tiempos Promedio Entre Estados</h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          {tiempos.length > 0 && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                tiempos[0]?.fuente === 'real'
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <i
                className={`mr-1 ${
                  tiempos[0]?.fuente === 'real' ? 'ri-database-2-line' : 'ri-calculator-line'
                }`}
              ></i>
              {tiempos[0]?.fuente === 'real' ? 'Datos reales' : 'Estimación'}
            </span>
          )}
        </div>
      </div>

      {/* Filtro por módulo */}
      <div className="flex flex-wrap gap-2 mb-5">
        {MODULOS.map((mod) => (
          <button
            key={mod.clave}
            onClick={() => onFiltroModulo(mod.clave)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              filtroModulo === mod.clave
                ? mod.clave === 'dropship'
                  ? 'bg-sky-600 text-white'
                  : mod.clave === 'zf'
                    ? 'bg-violet-600 text-white'
                    : 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {mod.etiqueta}
          </button>
        ))}
        {filtroModulo !== 'todos' && (
          <span
            className={`ml-auto self-center text-xs px-2.5 py-1 rounded-full font-semibold ${
              filtroModulo === 'dropship' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
            }`}
          >
            <i className="ri-filter-3-line mr-1"></i>
            Flujo {filtroModulo === 'dropship' ? 'Dropship' : 'ZF'}
          </span>
        )}
      </div>

      {tiempos.length > 0 ? (
        <div className="space-y-2">
          {tiempos[0]?.fuente === 'estimado' && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <i className="ri-information-line text-amber-600 mt-0.5 flex-shrink-0"></i>
              <p className="text-xs text-amber-800">
                Los cambios de estado registrados por la app mostrarán tiempos exactos por
                transición. Estos valores son una estimación basada en el tiempo total de cada
                expediente.
              </p>
            </div>
          )}
          <BarChartTiempos
            data={tiempos.map((item) => ({
              label: `${item.desde} → ${item.hasta}`,
              tiempoMinutos: item.minutosPromedio,
              tiempoTexto: formatearTiempo(item.minutosPromedio),
              cantidad: item.cantidad,
              fuente: item.fuente,
            }))}
            colorTema={colorModulo(filtroModulo)}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full mb-4">
            <i className="ri-time-line text-3xl text-gray-400"></i>
          </div>
          <p className="text-gray-600 font-medium">Sin datos de transición todavía</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">
            Los tiempos se registran automáticamente cuando los expedientes cambian de estado en la
            app
          </p>
        </div>
      )}
    </div>
  );
}