import { useState } from 'react';

interface ResumenReporteProps {
  resumen: string;
}

export default function ResumenReporte({ resumen }: ResumenReporteProps) {
  const [copiado, setCopiado] = useState('');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resumen);
      setCopiado('Resumen copiado.');
    } catch {
      setCopiado('No se pudo copiar automáticamente. Selecciona el texto y usa Ctrl+C.');
    }
    setTimeout(() => setCopiado(''), 3000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">Resumen para copiar</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Texto listo para pegar en un correo o mensaje con los hallazgos del corte.
          </p>
        </div>
        <button
          onClick={copiar}
          className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-file-copy-line mr-1"></i>Copiar resumen
        </button>
      </div>
      <div className="p-4">
        <textarea
          readOnly
          value={resumen}
          rows={14}
          spellCheck={false}
          className="w-full rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2.5 text-xs font-mono text-gray-700 leading-relaxed outline-none resize-y"
        />
        {copiado && (
          <p className="text-[11px] text-teal-700 mt-2 flex items-center gap-1">
            <i className="ri-check-line"></i>{copiado}
          </p>
        )}
      </div>
    </div>
  );
}