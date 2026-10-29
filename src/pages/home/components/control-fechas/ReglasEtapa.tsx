import { CAMPOS_REGLA, REGLAS_ETAPA } from '@/lib/controlFechas';

export default function ReglasEtapa() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-base font-bold text-gray-900">Reglas de fechas por etapa</h3>
        <p className="text-[11px] text-gray-500">
          <span className="font-semibold text-emerald-600">✓</span> la fecha debe estar ·{' '}
          <span className="font-semibold text-gray-400">—</span> la fecha no debe estar
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Etapa</th>
              {CAMPOS_REGLA.map((campo) => (
                <th key={campo} className="text-center font-semibold px-3 py-2.5 whitespace-nowrap text-xs">
                  {campo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REGLAS_ETAPA.map((regla) => (
              <tr key={regla.clave} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium text-gray-800 whitespace-nowrap">{regla.label}</td>
                {CAMPOS_REGLA.map((campo) => {
                  const requerida = regla.requeridas.includes(campo);
                  const opcional = regla.label === 'Booking' && campo === 'ETD Variable';
                  return (
                    <td key={campo} className="text-center px-3 py-2">
                      {requerida ? (
                        <span
                          className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold"
                          title={opcional ? 'Opcional mientras no tenga contenedor válido y naviera' : undefined}
                        >
                          <i className="ri-check-line"></i>
                          {opcional && <span className="text-[10px] text-gray-400">*</span>}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-gray-50/60 border-t border-gray-100">
              <td colSpan={CAMPOS_REGLA.length + 1} className="px-4 py-2 text-[11px] text-gray-500">
                * En Booking, el ETD Variable puede faltar mientras la PO no tenga naviera.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}