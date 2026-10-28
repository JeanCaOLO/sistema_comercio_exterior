import { parseDocEntries } from '@/lib/documentos';
import ModalDocumentosExpediente from '@/pages/home/components/ModalDocumentosExpediente';
import Paginacion from '@/components/feature/Paginacion';
import CargandoDocumentacion from '@/pages/home/components/documentacion/CargandoDocumentacion';
import BarraFiltrosDocumentacion from '@/pages/home/components/documentacion/BarraFiltrosDocumentacion';
import TablaDocumentacion from '@/pages/home/components/documentacion/TablaDocumentacion';
import ModalConfirmarEliminarDocumentos from '@/pages/home/components/documentacion/ModalConfirmarEliminarDocumentos';
import ModalPreguntaMcg from '@/pages/home/components/documentacion/ModalPreguntaMcg';
import { useDocumentacion } from '@/pages/home/components/documentacion/useDocumentacion';

export default function Documentacion() {
  const doc = useDocumentacion();

  if (doc.loading) return <CargandoDocumentacion />;

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 flex items-center justify-center bg-amber-100 rounded-lg">
            <i className="ri-inbox-archive-line text-amber-700 text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bandeja</h1>
            <p className="text-gray-500 text-sm">Documentos cargados desde CAA — selecciona y genera tickets al módulo que necesites</p>
          </div>
        </div>
      </div>

      {doc.showSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <i className="ri-checkbox-circle-line text-green-600 text-xl"></i>
          <p className="text-green-800 font-semibold text-sm">{doc.successMessage}</p>
        </div>
      )}

      {doc.showError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
          <i className="ri-error-warning-line text-red-600 text-xl"></i>
          <p className="text-red-800 font-semibold text-sm">{doc.errorMessage}</p>
        </div>
      )}

      {doc.documentos.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-20 h-20 mx-auto flex items-center justify-center bg-amber-50 rounded-full mb-6">
            <i className="ri-inbox-line text-4xl text-amber-400"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No hay documentos pendientes</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Los documentos que cargues desde <strong>Carga CAA</strong> aparecerán aquí. Desde este módulo podrás seleccionarlos y enviarlos como tickets al Kanban de Dropship o ZF.
          </p>
        </div>
      )}

      {doc.documentos.length > 0 && (
        <>
          <BarraFiltrosDocumentacion
            searchPO={doc.searchPO}
            onSearchChange={doc.setSearchPO}
            filtroRuta={doc.filtroRuta}
            onRutaChange={doc.setFiltroRuta}
            rutasDisponibles={doc.rutasDisponibles}
            filtroRapido={doc.filtroRapido}
            onFiltroRapidoChange={doc.setFiltroRapido}
            targetModulo={doc.targetModulo}
            onModuloChange={doc.setTargetModulo}
            selectedCount={doc.selectedIds.size}
            filteredCount={doc.documentosFiltrados.length}
            totalCount={doc.documentos.length}
            hayFiltrosActivos={doc.hayFiltrosActivos}
            pagina={doc.paginacion.paginaSegura}
            totalPaginas={doc.paginacion.totalPaginas}
            puedeEliminar={doc.puedeEliminar}
            onEliminar={() => doc.setShowDeleteConfirm(true)}
            onGenerar={() => doc.setShowMCGPrompt(true)}
            generando={doc.generando}
          />

          {doc.documentosFiltrados.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <i className="ri-file-search-line text-4xl text-gray-300"></i>
              <p className="text-gray-500 font-medium mt-3">No hay documentos con esos filtros</p>
              <p className="text-gray-400 text-sm mt-1">Probá ajustando la búsqueda o los filtros</p>
            </div>
          ) : (
            <TablaDocumentacion
              documentos={doc.paginacion.visibles}
              selectedIds={doc.selectedIds}
              onToggle={doc.toggleSelect}
              onToggleAll={doc.toggleSelectAll}
              onAbrirRepositorio={doc.setFilaDocumentos}
            />
          )}

          <Paginacion
            pagina={doc.paginacion.paginaSegura}
            totalPaginas={doc.paginacion.totalPaginas}
            onCambiar={doc.setCurrentPage}
            resumen={`Mostrando ${doc.paginacion.inicio}-${doc.paginacion.fin} de ${doc.documentosFiltrados.length} documento(s)`}
          />
        </>
      )}

      {doc.showDeleteConfirm && (
        <ModalConfirmarEliminarDocumentos
          cantidad={doc.selectedIds.size}
          eliminando={doc.deleting}
          onCancelar={() => doc.setShowDeleteConfirm(false)}
          onConfirmar={doc.confirmarEliminar}
        />
      )}

      <ModalDocumentosExpediente
        show={!!doc.filaDocumentos}
        onClose={() => doc.setFilaDocumentos(null)}
        poTiquetera={doc.filaDocumentos?.po_tiquetera}
        expId={doc.filaDocumentos?.exp_id || 'Por Asignar'}
        documentos={doc.filaDocumentos ? parseDocEntries(doc.filaDocumentos.doc) : []}
        downloadingId={doc.downloadingId}
        onDescargar={doc.descargarDocumento}
      />

      {doc.showMCGPrompt && (
        <ModalPreguntaMcg
          cantidad={doc.selectedIds.size}
          generando={doc.generando}
          onCancelar={() => doc.setShowMCGPrompt(false)}
          onResponder={(marcar) => {
            doc.setShowMCGPrompt(false);
            doc.generarTicket(marcar);
          }}
        />
      )}
    </div>
  );
}