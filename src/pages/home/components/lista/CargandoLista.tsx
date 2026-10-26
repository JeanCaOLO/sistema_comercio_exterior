// Esqueleto de carga de la Lista de Expedientes.

export default function CargandoLista() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Lista de Expedientes</h1>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <p className="text-sm text-teal-600 font-medium">Cargando expedientes...</p>
        </div>
      </div>

      <div className="mb-6 bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-teal-100 rounded-full flex-shrink-0">
          <i className="ri-file-list-3-line text-teal-600 text-xl"></i>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-teal-800">Preparando la lista de expedientes</p>
          <p className="text-xs text-teal-600 mt-0.5">
            Estamos trayendo todos los expedientes (Dropship y ZF) desde la base de datos...
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          ></span>
          <span
            className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          ></span>
          <span
            className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          ></span>
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
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <tr key={i}>
                  <td className="px-3 py-3">
                    <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse"></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 w-20 bg-gray-100 rounded animate-pulse mt-1"></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-3 w-12 bg-gray-100 rounded animate-pulse"></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-3 w-20 bg-gray-100 rounded animate-pulse"></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-3 w-20 bg-gray-100 rounded animate-pulse"></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse"></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-5 w-14 bg-gray-100 rounded-full animate-pulse"></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-5 w-14 bg-gray-100 rounded-full animate-pulse"></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-4 w-14 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 w-12 bg-gray-100 rounded animate-pulse mt-1"></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-3 w-20 bg-gray-100 rounded animate-pulse"></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 bg-gray-100 rounded animate-pulse"></div>
                      <div className="h-6 w-6 bg-gray-100 rounded animate-pulse"></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}