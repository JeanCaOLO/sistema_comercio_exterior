import { esFactura, type DocEntry } from '@/lib/documentos';
import { esImagen, iconoArchivo, nombreArchivo } from '@/pages/home/components/repositorio/utils';

interface FilaArchivoProps {
  entry: DocEntry;
  indice: number;
  descargando: boolean;
  onDescargar: (url: string, fileName: string) => void;
}

const FilaArchivo = ({ entry, indice, descargando, onDescargar }: FilaArchivoProps) => {
  const url = entry.url;
  const factura = esFactura(entry);
  const fileName = nombreArchivo(url);
  const { icon, color, bg } = iconoArchivo(url);

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        factura ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'
      }`}
    >
      {esImagen(url) ? (
        <img src={url} alt={fileName} className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
      ) : (
        <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
          <i className={`${icon} ${color} text-lg`}></i>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate" title={fileName}>
          <span className="text-gray-400 text-xs mr-1.5">#{indice}</span>
          {fileName}
        </p>
        {factura && (
          <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
            <i className="ri-bill-line text-[11px]"></i>
            Factura
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-eye-line"></i>
          Ver
        </a>
        <button
          type="button"
          onClick={() => onDescargar(url, fileName)}
          disabled={descargando}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {descargando ? (
            <>
              <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0"></div>
              Descargando
            </>
          ) : (
            <>
              <i className="ri-download-line"></i>
              Descargar
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FilaArchivo;