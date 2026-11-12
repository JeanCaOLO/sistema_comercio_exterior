import { esValorFecha } from '@/lib/cambiosFechasPo';
import { formatearFechaCorta } from '@/lib/fechas';

export interface FilaFecha {
  id: string;
  // Clave técnica de Raga (null cuando la PO no trae esa columna).
  clave: string | null;
  etiqueta: string;
  valor: string;
  incluida: boolean;
  nuevo: string;
  esFechaDetectada: boolean;
  disponible: boolean;
  // La PO no trae esta fecha: se carga por primera vez.
  columnaNueva?: boolean;
  // 'texto' para datos que no son fechas (ruta logística, carrier, etc.).
  tipoDato?: 'fecha' | 'texto';
}

interface TablaFechasPoProps {
  filas: FilaFecha[];
  onToggle: (id: string) => void;
  onCambiarNuevo: (id: string, valor: string) => void;
  onSeleccionarTodas: () => void;
  onLimpiar: () => void;
  mostrarTodas: boolean;
  onToggleMostrarTodas: () => void;
}

function mostrarValor(valor: string): string {
  if (!valor) return 'Sin fecha';
  if (esValorFecha(valor)) {
    const limpia = valor.slice(0, 10);
    return formatearFechaCorta(limpia);
  }
  return valor;
}

export default function TablaFechasPo({
  filas,
  onToggle,
  onCambiarNuevo,
  onSeleccionarTodas,
  onLimpiar,
  mostrarTodas,
  onToggleMostrarTodas,
}: TablaFechasPoProps) {
  const seleccionadas = filas.filter((f) => f.incluida && f.disponible).length;
  const sinDisponibles = filas.filter((f) => !f.disponible).length;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Fechas que se pueden actualizar</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Marcá las fechas que querés cambiar. Solo se enviarán las seleccionadas.
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            <i className="ri-information-line mr-1"></i>
            Si la orden todavía no tiene una fecha, podés cargarla igual: se envía como dato nuevo.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onToggleMostrarTodas}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
              mostrarTodas
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
            }`}
          >
            <i className={mostrarTodas ? 'ri-eye-off-line mr-1' : 'ri-eye-line mr-1'}></i>
            {mostrarTodas ? 'Volver a las fechas' : 'Ver otras columnas'}
          </button>
          <button
            type="button"
            onClick={onSeleccionarTodas}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 bg-white hover:border-teal-400 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-checkbox-multiple-line mr-1"></i>
            Seleccionar todas
          </button>
          {seleccionadas > 0 && (
            <button
              type="button"
              onClick={onLimpiar}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-12"> </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Fecha</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Valor actual</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Nuevo valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filas.map((fila) => (
              <tr
                key={fila.id}
                className={`transition-colors ${
                  !fila.disponible ? 'bg-gray-50/60' : fila.incluida ? 'bg-teal-50/40' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 align-middle">
                  <input
                    type="checkbox"
                    checked={fila.incluida}
                    disabled={!fila.disponible}
                    onChange={() => onToggle(fila.id)}
                    className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Incluir ${fila.etiqueta}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${fila.disponible ? 'text-gray-900' : 'text-gray-500'}`}>
                      {fila.etiqueta}
                    </span>
                    {!fila.disponible && (
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-200/70 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        no disponible
                      </span>
                    )}
                    {fila.disponible && fila.columnaNueva && (
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        sin fecha en Raga · se carga
                      </span>
                    )}
                    {fila.disponible && !fila.esFechaDetectada && (
                      <span className="text-[10px] font-semibold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        campo adicional
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm ${fila.valor ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                    {fila.disponible ? mostrarValor(fila.valor) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {fila.tipoDato === 'texto' ? (
                    <input
                      type="text"
                      value={fila.nuevo}
                      disabled={!fila.incluida || !fila.disponible}
                      onChange={(e) => onCambiarNuevo(fila.id, e.target.value)}
                      placeholder="Nuevo valor"
                      maxLength={120}
                      className="w-full max-w-[190px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    />
                  ) : (
                    <input
                      type="date"
                      value={fila.nuevo}
                      disabled={!fila.incluida || !fila.disponible}
                      onChange={(e) => onCambiarNuevo(fila.id, e.target.value)}
                      className="w-full max-w-[190px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    />
                  )}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-400">
                  <i className="ri-calendar-close-line text-3xl block mb-2"></i>
                  No se pudieron leer las fechas de esta PO.
                  <span className="block mt-1 text-xs">
                    Probá con &quot;Ver otras columnas&quot; para elegir el dato a mano.
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sinDisponibles > 0 && !mostrarTodas && (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200">
          <p className="text-[11px] text-gray-500">
            <i className="ri-information-line mr-1"></i>
            {sinDisponibles === 1
              ? 'Una de las fechas no se pudo asociar a la orden, por eso aparece deshabilitada.'
              : `${sinDisponibles} fechas no se pudieron asociar a la orden, por eso aparecen deshabilitadas.`}
          </p>
        </div>
      )}
    </div>
  );
}