// Lista de Expedientes: solo orquesta estado, filtros y modales.
// La lógica vive en ./lista (hook, servicios, utilidades y componentes).

import ModalDocumentosExpediente from '@/pages/home/components/ModalDocumentosExpediente';
import { useListaExpedientes } from './lista/useListaExpedientes';
import CargandoLista from './lista/CargandoLista';
import FiltrosLista from './lista/FiltrosLista';
import TablaExpedientes from './lista/TablaExpedientes';
import ModalHistorialLista from './lista/ModalHistorialLista';
import ModalDetalleLista from './lista/ModalDetalleLista';

export default function ListaExpedientes() {
  const {
    expedientes,
    loading,
    filteredExpedientes,
    paginatedExpedientes,
    todasPersonas,
    responsables,
    rutas,
    currentTime,
    searchTerm,
    setSearchTerm,
    filterPersona,
    setFilterPersona,
    filterPrioridad,
    setFilterPrioridad,
    filterEstado,
    setFilterEstado,
    filterTipoModulo,
    setFilterTipoModulo,
    hayFiltros,
    currentPage,
    setCurrentPage,
    totalPages,
    showSuccess,
    showError,
    errorMessage,
    selectedExpediente,
    showModal,
    editMode,
    saving,
    uploadingFiles,
    abrirModal,
    cerrarModal,
    handleChange,
    setEditMode,
    cancelarEdicion,
    guardarCambios,
    handleDelete,
    corregir,
    showHistorial,
    setShowHistorial,
    historialData,
    expedienteSeleccionado,
    cargadorNoAutorizado,
    verHistorial,
    showDocumentos,
    setShowDocumentos,
    documentosExpediente,
    downloadingId,
    descargarDocumento,
    verDocumentos,
  } = useListaExpedientes();

  if (loading) {
    return <CargandoLista />;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Lista de Expedientes</h1>
        <p className="text-gray-500 mt-2">
          Vista completa de todos los expedientes (Dropship y ZF) ordenados por fecha de creación
        </p>
      </div>

      {showSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <i className="ri-checkbox-circle-line text-green-600 text-xl"></i>
          <p className="text-green-800 font-semibold text-sm">¡Operación exitosa!</p>
        </div>
      )}

      {showError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
          <i className="ri-error-warning-line text-red-600 text-xl"></i>
          <p className="text-red-800 font-semibold text-sm">
            {errorMessage || 'Error al realizar la operación'}
          </p>
        </div>
      )}

      <FiltrosLista
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterTipoModulo={filterTipoModulo}
        onTipoModuloChange={setFilterTipoModulo}
        filterPersona={filterPersona}
        onPersonaChange={setFilterPersona}
        personas={todasPersonas}
        filterPrioridad={filterPrioridad}
        onPrioridadChange={setFilterPrioridad}
        filterEstado={filterEstado}
        onEstadoChange={setFilterEstado}
        filteredCount={filteredExpedientes.length}
        totalCount={expedientes.length}
        currentPage={currentPage}
        totalPages={totalPages}
        hayFiltros={hayFiltros}
      />

      <TablaExpedientes
        expedientes={paginatedExpedientes}
        filteredCount={filteredExpedientes.length}
        currentPage={currentPage}
        totalPages={totalPages}
        currentTime={currentTime}
        onPageChange={setCurrentPage}
        onSelect={abrirModal}
        onHistorial={verHistorial}
        onDocumentos={verDocumentos}
      />

      <ModalHistorialLista
        show={showHistorial}
        onClose={() => setShowHistorial(false)}
        expediente={expedienteSeleccionado}
        historial={historialData}
        cargadorNoAutorizado={cargadorNoAutorizado}
      />

      <ModalDocumentosExpediente
        show={showDocumentos}
        onClose={() => setShowDocumentos(false)}
        poTiquetera={expedienteSeleccionado?.po_tiquetera}
        expId={expedienteSeleccionado?.exp_id}
        documentos={documentosExpediente}
        downloadingId={downloadingId}
        onDescargar={descargarDocumento}
      />

      {showModal && selectedExpediente && (
        <ModalDetalleLista
          expediente={selectedExpediente}
          editMode={editMode}
          saving={saving}
          uploadingFiles={uploadingFiles}
          rutas={rutas}
          responsables={responsables}
          onClose={cerrarModal}
          onEdit={() => setEditMode(true)}
          onCancelarEdicion={cancelarEdicion}
          onSave={guardarCambios}
          onDelete={handleDelete}
          onChange={handleChange}
          corregir={corregir}
        />
      )}
    </div>
  );
}