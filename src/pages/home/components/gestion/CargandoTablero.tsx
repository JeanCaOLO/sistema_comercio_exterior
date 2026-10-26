import { ESTADOS_DROPSHIP, ESTADOS_ZF, type TipoModulo } from './types';

interface Props {
  tipoModulo: TipoModulo;
  titulo: string;
}

/**
 * Esqueleto del tablero mientras se cargan los expedientes.
 */
export default function CargandoTablero({ tipoModulo, titulo }: Props) {
  const estados = tipoModulo === 'dropship' ? ESTADOS_DROPSHIP : ESTADOS_ZF;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{titulo}</h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            <p className="text-sm text-teal-600 font-medium">Cargando tickets...</p>
          </div>
        </div>
      </div>

      <div className="mb-6 bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-teal-100 rounded-full flex-shrink-0">
          <i className="ri-ship-line text-teal-600 text-xl"></i>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-teal-800">
            Preparando el tablero de {tipoModulo === 'dropship' ? 'Dropship' : 'ZF'}
          </p>
          <p className="text-xs text-teal-600 mt-0.5">
            Estamos trayendo los expedientes desde la base de datos...
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          ></span>
          <span
            className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          ></span>
          <span
            className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          ></span>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {estados.map((estado) => (
          <div
            key={estado}
            className="flex-shrink-0 w-80 bg-gray-50 rounded-xl border border-gray-200"
          >
            <div className="px-4 py-3 rounded-t-xl flex items-center justify-between bg-gray-200 animate-pulse">
              <div className="h-4 w-24 bg-gray-300 rounded animate-pulse"></div>
              <div className="h-5 w-8 bg-gray-300 rounded-full animate-pulse"></div>
            </div>

            <div className="p-3 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-3 w-20 bg-gray-100 rounded animate-pulse"></div>
                    </div>
                    <div className="h-5 w-10 bg-gray-100 rounded-full animate-pulse"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-3 w-3/4 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse"></div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                    <div className="h-6 w-6 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-6 w-6 bg-gray-100 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}