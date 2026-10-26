interface PaginacionProps {
  pagina: number;
  totalPaginas: number;
  onCambiar: (pagina: number) => void;
  /** Texto descriptivo a la izquierda, por ejemplo "Mostrando 1-25 de 340" */
  resumen?: string;
  /** Color de la página activa */
  colorActivo?: 'ambar' | 'grafito';
}

const construirPaginas = (paginaActual: number, totalPaginas: number): (number | 'ellipsis')[] => {
  const paginas = Array.from({ length: totalPaginas }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaActual) <= 2);

  return paginas.reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
    acc.push(p);
    return acc;
  }, []);
};

export default function Paginacion({
  pagina,
  totalPaginas,
  onCambiar,
  resumen,
  colorActivo = 'ambar',
}: PaginacionProps) {
  if (totalPaginas <= 1) return null;

  const claseActivo = colorActivo === 'grafito' ? 'bg-gray-700 text-white' : 'bg-amber-600 text-white';

  return (
    <div className="flex items-center justify-between gap-4 pt-4 flex-wrap">
      {resumen ? (
        <span className="text-sm text-gray-500">{resumen}</span>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onCambiar(Math.max(1, pagina - 1))}
          disabled={pagina <= 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Página anterior"
        >
          <i className="ri-arrow-left-s-line"></i>
        </button>
        {construirPaginas(pagina, totalPaginas).map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-sm text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onCambiar(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                pagina === p ? claseActivo : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onCambiar(Math.min(totalPaginas, pagina + 1))}
          disabled={pagina >= totalPaginas}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Página siguiente"
        >
          <i className="ri-arrow-right-s-line"></i>
        </button>
      </div>
    </div>
  );
}