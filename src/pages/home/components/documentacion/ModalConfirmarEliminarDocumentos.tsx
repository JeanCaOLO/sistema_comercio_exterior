interface ModalConfirmarEliminarDocumentosProps {
  cantidad: number;
  eliminando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

const ModalConfirmarEliminarDocumentos = ({
  cantidad,
  eliminando,
  onCancelar,
  onConfirmar,
}: ModalConfirmarEliminarDocumentosProps) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-full flex-shrink-0">
            <i className="ri-alert-line text-red-600 text-xl"></i>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">¿Eliminar documentos?</h3>
            <p className="text-sm text-gray-500">
              Se eliminarán <strong>{cantidad}</strong> documento(s) de Documentación. Esta acción no se puede deshacer.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancelar}
            className="px-5 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={eliminando}
            className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default ModalConfirmarEliminarDocumentos;