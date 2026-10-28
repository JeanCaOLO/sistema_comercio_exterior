import { parseDocEntries } from '@/lib/documentos';
import Paginacion from '@/components/feature/Paginacion';
import EditarDocumentoModal from '@/pages/home/components/EditarDocumentoModal';
import HistorialDocumentoModal from '@/pages/home/components/HistorialDocumentoModal';
import CargandoRepositorio from '@/pages/home/components/repositorio/CargandoRepositorio';
import TablaRepositorio from '@/pages/home/components/repositorio/TablaRepositorio';
import { useRepositorio } from '@/pages/home/components/repositorio/useRepositorio';
import { obtenerCargador } from '@/pages/home/components/repositorio/utils';
import {
  ESTADOS_TODOS,
  REGISTROS_POR_PAGINA,
} from '@/pages/home/components/repositorio/types';

export default function RepositorioDocumentacion() {
  const repo = useRepositorio();

  if (repo.cargando && repo.registros.length === 0) {
    return <CargandoRepositorio />;
  }

  const sinResultadosTotales = repo.total === 0 && !repo.hayFiltrosActivos;
  const inicio = repo.total === 0 ? 0 : (repo.pagina - 1) * REGISTROS_POR_PAGINA + 1;
  const fin = Math.min(repo.pagina * REGISTROS_POR_PAGINA, repo.total);

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
            <i className="ri-archive-line text-gray-700 text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Repositorio de Documentación</h1>
            <p className="text-gray-500 text-sm">Archivo completo — todos los documentos cargados desde Carga CAA, sin importar su estado actual</p>
          </div>
        </div>
      </div>

      {repo.error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <i className="ri-error-warning-line text-red-600 text-xl flex-shrink-0"></i>
          <p className="text-red-800 text-sm font-medium flex-1">{repo.error}</p>
          <button
            type="button"
            onClick={() => repo.recargar()}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            Reintentar
          </button>
        </div>
      )}

      {sinResultadosTotales ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-20 h-20 mx-auto flex items-center justify-center bg-gray-50 rounded-full mb-6">
            <i className="ri-inbox-line text-4xl text-gray-400"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No hay documentos en el repositorio</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Una vez que cargues documentos desde <strong>Carga CAA</strong>, aparecerán aquí como archivo permanente de referencia.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[280px]">
                <div className="relative">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input
                    type="text"
                    value={repo.busqueda}
                    onChange={(e) => repo.setBusqueda(e.target.value)}
                    placeholder="Buscar por PO, N° de factura, EXP ID, solicitante, responsable o ruta..."
                    className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
                  />
                  {repo.busqueda && (
                    <button
                      type="button"
                      onClick={() => repo.setBusqueda('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full cursor-pointer"
                    >
                      <i className="ri-close-line text-sm"></i>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Estado:</span>
                <select
                  value={repo.filtroEstado}
                  onChange={(e) => repo.cambiarEstado(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent cursor-pointer"
                >
                  <option value="Todos">Todos los estados</option>
                  {ESTADOS_TODOS.map((estado) => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Módulo:</span>
                <select
                  value={repo.filtroModulo}
                  onChange={(e) => repo.cambiarModulo(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent cursor-pointer"
                >
                  <option value="Todos">Todos</option>
                  <option value="dropship">Dropship</option>
                  <option value="zf">ZF</option>
                </select>
              </div>

              {repo.hayFiltrosActivos && (
                <button
                  type="button"
                  onClick={repo.limpiarFiltros}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-filter-off-line"></i>
                  Limpiar
                </button>
              )}

              <span className="text-sm text-gray-500 whitespace-nowrap ml-auto">
                {repo.cargando && (
                  <i className="ri-loader-4-line animate-spin mr-1.5 text-gray-400"></i>
                )}
                <span className="font-bold text-gray-700">{repo.total}</span> documento(s)
                <span className="text-gray-400 mx-1">|</span>
                Pág. {repo.pagina} de {repo.totalPaginas}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
            <i className="ri-cursor-line"></i>
            Hacé clic en cualquier fila para editar el registro. Los botones de Historial y el desplegable de archivos siguen funcionando aparte.
          </p>

          <TablaRepositorio
            registros={repo.registros}
            filasExpandidas={repo.filasExpandidas}
            downloadingId={repo.downloadingId}
            cargando={repo.cargando}
            hayFiltrosActivos={repo.hayFiltrosActivos}
            onToggleExpandir={repo.toggleExpandir}
            onDescargar={repo.descargar}
            onEditar={repo.abrirEdicion}
            onHistorial={repo.abrirHistorial}
            onLimpiarFiltros={repo.limpiarFiltros}
          />

          <Paginacion
            pagina={repo.pagina}
            totalPaginas={repo.totalPaginas}
            onCambiar={repo.setPagina}
            resumen={`Mostrando ${inicio}-${fin} de ${repo.total} documento(s)`}
            colorActivo="grafito"
          />
        </>
      )}

      {repo.registroEditando && (
        <EditarDocumentoModal
          isOpen={repo.editModalOpen}
          onClose={repo.cerrarEdicion}
          registro={repo.registroEditando}
          onSaved={() => repo.recargar()}
        />
      )}

      {repo.registroHistorial && (
        <HistorialDocumentoModal
          isOpen={repo.historialOpen}
          onClose={repo.cerrarHistorial}
          registroId={repo.registroHistorial.id}
          poTiquetera={repo.registroHistorial.po_tiquetera}
          expId={repo.registroHistorial.exp_id}
          createdAt={repo.registroHistorial.created_at}
          responsableCreacion={obtenerCargador(repo.registroHistorial)}
          documentosIniciales={parseDocEntries(repo.registroHistorial.doc)}
        />
      )}
    </div>
  );
}