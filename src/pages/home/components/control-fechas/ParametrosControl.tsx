import { formatearEntero } from '@/lib/controlFechas';

interface EtapaConteo {
  etapa: string;
  total: number;
}

interface ParametrosControlProps {
  fechaCorte: string;
  onFechaCorte: (valor: string) => void;
  excluirReales: boolean;
  onToggleReales: () => void;
  etapas: EtapaConteo[];
  etapasExcluidas: string[];
  onToggleEtapa: (etapa: string) => void;
  proveedoresTexto: string;
  onProveedores: (valor: string) => void;
  deshabilitado?: boolean;
}

export default function ParametrosControl({
  fechaCorte,
  onFechaCorte,
  excluirReales,
  onToggleReales,
  etapas,
  etapasExcluidas,
  onToggleEtapa,
  proveedoresTexto,
  onProveedores,
  deshabilitado,
}: ParametrosControlProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 flex-shrink-0">
            <i className="ri-equalizer-line"></i>
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Parámetros del análisis</h3>
            <p className="text-[11px] text-gray-500">Se guardan junto con la carga, así el reporte es reproducible.</p>
          </div>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Fecha de corte</span>
            <input
              type="date"
              value={fechaCorte}
              onChange={(e) => onFechaCorte(e.target.value)}
              disabled={deshabilitado}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 cursor-pointer disabled:opacity-50"
            />
          </label>
          <button
            onClick={onToggleReales}
            disabled={deshabilitado}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
              excluirReales
                ? 'border-teal-300 bg-teal-50 text-teal-800'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            title="Si está activo, no se marcan como vencidas las POs que ya tienen ATD (zarpe real) o ATA (arribo real)"
          >
            <i className={`${excluirReales ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'}`}></i>
            Excluir POs con ATD/ATA
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-2">
            Etapas incluidas en el control
          </p>
          <div className="flex flex-wrap gap-1.5">
            {etapas.map((fila) => {
              const excluida = etapasExcluidas.includes(fila.etapa);
              return (
                <button
                  key={fila.etapa}
                  onClick={() => onToggleEtapa(fila.etapa)}
                  disabled={deshabilitado}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                    excluida
                      ? 'border-gray-200 bg-gray-50 text-gray-400 line-through'
                      : 'border-teal-200 bg-teal-50 text-teal-800'
                  }`}
                >
                  <i className={`${excluida ? 'ri-close-line' : 'ri-check-line'} text-[11px]`}></i>
                  {fila.etapa} <span className="text-gray-400">{formatearEntero(fila.total)}</span>
                </button>
              );
            })}
            {etapas.length === 0 && <span className="text-xs text-gray-400">Sin etapas detectadas.</span>}
          </div>
        </div>

        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Proveedores excluidos (separados por coma)
          </span>
          <input
            type="text"
            value={proveedoresTexto}
            onChange={(e) => onProveedores(e.target.value)}
            disabled={deshabilitado}
            placeholder="Ej: HENAN LORY SANITARY WARE CO.,LTD."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:opacity-50"
          />
        </label>
      </div>
    </div>
  );
}