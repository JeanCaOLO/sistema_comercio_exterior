const CargandoDocumentacion = () => (
  <div className="p-8">
    <div className="mb-6 flex items-center gap-3">
      <div className="w-10 h-10 flex items-center justify-center bg-amber-100 rounded-lg">
        <i className="ri-folder-open-line text-amber-700 text-xl"></i>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documentación</h1>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <p className="text-sm text-amber-600 font-medium">Cargando documentos...</p>
        </div>
      </div>
    </div>

    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 flex items-center justify-center bg-amber-100 rounded-full flex-shrink-0">
        <i className="ri-folder-open-line text-amber-600 text-xl"></i>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-800">Preparando la bandeja de Documentación</p>
        <p className="text-xs text-amber-600 mt-0.5">Estamos trayendo los documentos cargados desde CAA...</p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
        <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
      </div>
    </div>

    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {Array.from({ length: 11 }).map((_, i) => (
                <th key={i} className="px-3 py-3">
                  <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mx-auto"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <tr key={i}>
                {Array.from({ length: 11 }).map((_, j) => (
                  <td key={j} className="px-3 py-3">
                    <div className="h-4 w-full max-w-[90px] bg-gray-100 rounded animate-pulse"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default CargandoDocumentacion;