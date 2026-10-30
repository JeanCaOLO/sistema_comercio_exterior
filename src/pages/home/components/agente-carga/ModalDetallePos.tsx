import { useEffect, useMemo, useState } from 'react';
import { PAISES_INFO, formatearMoneda, type PoCarga } from '@/lib/agenteCarga';
import { descargarExcel } from '@/lib/exportar';

interface ModalDetallePosProps {
  titulo: string;
  subtitulo: string;
  pos: PoCarga[];
  onClose: () => void;
}

export default function ModalDetallePos({ titulo, subtitulo, pos, onClose }: ModalDetallePosProps) {
  const [busqueda, setBusqueda] = useState('');
  const [visibles, setVisibles] = useState(150);

  useEffect(() => { setVisibles(150); }, [busqueda]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return pos;
    return pos.filter((p) =>
      [p.po, p.proveedor, p.etapa, p.rutaLogistica]
        .join(' ')
        .toLowerCase()
        .includes(texto)
    );
  }, [pos, busqueda]);

  const mostradas = filtradas.slice(0, visibles);

  const exportar = () => {
    descargarExcel(
      `POs-${titulo.replace(/[^\w]+/g, '-')}.xlsx`,
      filtradas.map((p) => ({
        PO: p.po,
        'Proveedor de Servicio': p.proveedorServicio,
        'Agente de Carga': p.agenteCarga,
        Proveedor: p.proveedor,
        'País Destino': PAISES_INFO[p.paisDestino]?.nombre || p.paisDestino,
        'Puerto de Arribo': p.puertoArribo,
        'Ruta Logística': p.rutaLogistica,
        Etapa: p.etapa,
        'ETD Inicial': p.etdInicial || '',
        'Fecha Asignación': p.fechaAsignacion || '',
        'Monto Total': p.montoTotal ?? '',
      }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-xl border border-gray-200 my-8">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
              <i className="ri-file-list-3-line text-lg"></i>
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 truncate">{titulo}</h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitulo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer flex-shrink-0"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por PO, proveedor o etapa..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {filtradas.length} de {pos.length} POs
            </span>
            <button
              onClick={exportar}
              disabled={filtradas.length === 0}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-download-2-line mr-1"></i>Excel
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm border-collapse min-w-[880px]">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">PO</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Proveedor de Servicio</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">País</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Etapa</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">ETD Inicial</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Fecha Asignación</th>
                <th className="px-4 py-2.5 font-semibold text-right whitespace-nowrap">Monto Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mostradas.map((p) => (
                <tr key={p.po} className="hover:bg-teal-50/40 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{p.po}</td>
                  <td className="px-4 py-2.5 text-gray-700">
                    <p className="truncate max-w-[220px]" title={p.proveedorServicio}>{p.proveedorServicio}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded bg-gray-100 text-gray-700 text-[11px] font-semibold px-1.5 py-0.5">
                      {PAISES_INFO[p.paisDestino]?.abbr || p.paisDestino}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{p.etapa || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{p.etdInicial || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{p.fechaAsignacion || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">
                    {p.montoTotal ? formatearMoneda(p.montoTotal) : '—'}
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <i className="ri-inbox-line text-3xl mb-2 block"></i>
                    No hay POs que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtradas.length > visibles && (
            <div className="py-4 text-center border-t border-gray-100">
              <button
                onClick={() => setVisibles((v) => v + 150)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                Ver más POs ({filtradas.length - visibles} restantes)
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}