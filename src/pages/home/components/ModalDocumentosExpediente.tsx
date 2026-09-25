import { type DocEntry, esFactura, nombreDeArchivo } from '@/lib/documentos';

interface ModalDocumentosExpedienteProps {
  show: boolean;
  onClose: () => void;
  poTiquetera?: string;
  expId?: string;
  documentos: DocEntry[];
  downloadingId: string | null;
  onDescargar: (url: string, fileName: string) => void;
}

const EXTENSIONES_IMAGEN = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

const obtenerIcono = (extension?: string): { icon: string; color: string } => {
  if (extension === 'pdf') return { icon: 'ri-file-pdf-line', color: 'text-red-600' };
  if (['xlsx', 'xls'].includes(extension || '')) return { icon: 'ri-file-excel-line', color: 'text-green-600' };
  if (extension === 'csv') return { icon: 'ri-file-text-line', color: 'text-blue-600' };
  if (EXTENSIONES_IMAGEN.includes(extension || '')) return { icon: 'ri-image-line', color: 'text-orange-600' };
  return { icon: 'ri-file-line', color: 'text-gray-600' };
};

export default function ModalDocumentosExpediente({
  show,
  onClose,
  poTiquetera,
  expId,
  documentos,
  downloadingId,
  onDescargar,
}: ModalDocumentosExpedienteProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Documentos del Expediente</h3>
            <p className="text-sm text-gray-500 mt-1">
              PO: {poTiquetera} | EXP: {expId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {documentos.length === 0 ? (
            <div className="text-center py-12">
              <i className="ri-file-list-line text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg font-medium">No hay documentos adjuntos</p>
              <p className="text-gray-400 text-sm mt-2">Los documentos que agregues aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documentos.map((entry, index) => {
                const fileName = nombreDeArchivo(entry.url);
                const extension = fileName.split('.').pop()?.toLowerCase();
                const esImagen = EXTENSIONES_IMAGEN.includes(extension || '');
                const { icon, color } = obtenerIcono(extension);
                const esFacturaDoc = esFactura(entry);

                return (
                  <div
                    key={`${entry.url}-${index}`}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {esImagen ? (
                        <a href={entry.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <img src={entry.url} alt={fileName} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                        </a>
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 flex-shrink-0">
                          <i className={`${icon} text-2xl ${color}`}></i>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-900 truncate hover:text-teal-700 hover:underline"
                            title={fileName}
                          >
                            {fileName}
                          </a>
                          {esFacturaDoc && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-semibold whitespace-nowrap flex-shrink-0">
                              <i className="ri-receipt-line"></i>
                              Factura
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">Documento {index + 1}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDescargar(entry.url, fileName);
                      }}
                      disabled={downloadingId === entry.url}
                      className="ml-3 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloadingId === entry.url ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0"></div>
                          <span className="text-sm font-medium">Descargando...</span>
                        </>
                      ) : (
                        <>
                          <i className="ri-download-line"></i>
                          <span className="text-sm font-medium">Descargar</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}