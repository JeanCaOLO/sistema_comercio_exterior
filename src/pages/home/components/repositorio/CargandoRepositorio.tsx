const CargandoRepositorio = () => (
  <div className="p-8 flex items-center justify-center min-h-[70vh]">
    <div className="text-center max-w-lg w-full">
      <div className="relative inline-flex mb-8">
        <div className="w-24 h-24 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <i className="ri-archive-line text-4xl text-gray-700"></i>
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-800 mb-2">Cargando repositorio</h3>
      <p className="text-gray-500 mb-6">Consultando documentos en la base de datos...</p>

      <div className="space-y-3">
        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-gray-400 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-gray-400 rounded-full animate-pulse" style={{ width: '35%', animationDelay: '0.2s' }}></div>
        </div>
        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-gray-400 rounded-full animate-pulse" style={{ width: '80%', animationDelay: '0.4s' }}></div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded flex-1 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}></div>
          ))}
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex gap-4 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }}>
              {[...Array(5)].map((_, j) => (
                <div key={j} className="h-4 bg-gray-100 rounded flex-1"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default CargandoRepositorio;