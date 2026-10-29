import type { ReactNode } from 'react';

interface TablaSimpleProps {
  encabezados: string[];
  filas: ReactNode[][];
  limite?: number;
  vacio?: string;
}

const LIMITE_DEFAULT = 300;

export default function TablaSimple({ encabezados, filas, limite = LIMITE_DEFAULT, vacio }: TablaSimpleProps) {
  const visibles = filas.slice(0, limite);
  const restantes = filas.length - visibles.length;

  return (
    <div>
      <div className="overflow-x-auto max-h-[520px] overflow-y-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-800 text-white">
              {encabezados.map((encabezado) => (
                <th key={encabezado} className="text-left font-semibold px-3 py-2.5 whitespace-nowrap text-xs">
                  {encabezado}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((celdas, indice) => (
              <tr
                key={indice}
                className={`${indice % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'} hover:bg-teal-50/40 transition-colors`}
              >
                {celdas.map((celda, posicion) => (
                  <td key={posicion} className="px-3 py-2 border-b border-gray-100 text-gray-700 align-top whitespace-nowrap">
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={encabezados.length} className="px-4 py-12 text-center text-gray-400">
                  <i className="ri-checkbox-circle-line text-2xl block mb-1.5 text-teal-500"></i>
                  {vacio || 'Sin hallazgos en esta sección.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {restantes > 0 && (
        <p className="text-[11px] text-gray-500 mt-2">
          Se muestran {visibles.length} de {filas.length} filas. El Excel exportado trae todas.
        </p>
      )}
    </div>
  );
}