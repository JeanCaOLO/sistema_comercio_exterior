import type { MovimientoHistorial } from './types';
import { etiquetaModulo, fechaHora, texto } from './utils';

interface Props {
  movimientos: MovimientoHistorial[];
  total: number;
}

const chipModulo = (modulo: string): string =>
  modulo === 'dropship'
    ? 'bg-sky-100 text-sky-800'
    : modulo === 'zf'
    ? 'bg-violet-100 text-violet-800'
    : 'bg-gray-100 text-gray-700';

export default function TablaMovimientos({ movimientos, total }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Todos los movimientos</h2>
        <span className="text-sm text-gray-500">
          {movimientos.length} de {total} movimientos
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Fecha y hora</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO / EXP</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Módulo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado actual</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Campo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Cambio</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Usuario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                  <i className="ri-inbox-line text-4xl mb-2"></i>
                  <p className="text-sm">No hay movimientos con los filtros seleccionados</p>
                </td>
              </tr>
            ) : (
              movimientos.map((mov, index) => (
                <tr
                  key={mov.id || `${mov.expedienteId}-${index}`}
                  className="hover:bg-gray-50 transition-colors align-top"
                >
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {fechaHora(mov.fechaCambio)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{mov.po}</div>
                    <div className="text-xs text-gray-500 whitespace-nowrap">EXP {mov.expId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${chipModulo(mov.modulo)}`}>
                      {etiquetaModulo(mov.modulo)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{mov.estadoActual}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-100">
                      {mov.campoModificado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs min-w-[260px]">
                    <div className="text-red-700 break-all">
                      <span className="font-medium">Ant.:</span> {texto(mov.valorAnterior) || 'N/A'}
                    </div>
                    <div className="text-emerald-700 break-all mt-0.5">
                      <span className="font-medium">Nuevo:</span> {texto(mov.valorNuevo) || 'N/A'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {mov.usuario}
                    {mov.usuarioEmail && (
                      <div className="text-[11px] text-gray-400">{mov.usuarioEmail}</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}