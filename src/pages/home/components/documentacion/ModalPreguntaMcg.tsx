interface ModalPreguntaMcgProps {
  cantidad: number;
  generando: boolean;
  onCancelar: () => void;
  onResponder: (marcar: boolean) => void;
}

const ModalPreguntaMcg = ({ cantidad, generando, onCancelar, onResponder }: ModalPreguntaMcgProps) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
      <div className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center bg-indigo-100 rounded-full flex-shrink-0">
            <i className="ri-question-line text-indigo-600 text-xl"></i>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">¿Marcar MCG?</h3>
            <p className="text-sm text-gray-500 mt-1">
              ¿Deseas marcar la opción <strong>MCG</strong> en el ticket que vas a consolidar ({cantidad} fila(s))?
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 flex-wrap">
          <button
            type="button"
            onClick={onCancelar}
            className="px-5 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onResponder(false)}
            disabled={generando}
            className="px-5 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            No marcar MCG
          </button>
          <button
            type="button"
            onClick={() => onResponder(true)}
            disabled={generando}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Sí, marcar MCG
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default ModalPreguntaMcg;