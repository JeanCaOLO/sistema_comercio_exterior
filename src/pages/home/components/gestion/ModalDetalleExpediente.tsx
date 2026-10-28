import { formatearFecha } from '@/lib/fechas';
import type { RutaLogistica } from '@/lib/rutas';
import type { Expediente } from './types';
import { getDificultadColor, getEstadoColor, getPrioridadColor } from './utils';

interface Props {
  show: boolean;
  expediente: Expediente | null;
  editMode: boolean;
  isAsignarMode: boolean;
  estados: string[];
  rutas: RutaLogistica[];
  responsables: string[];
  saving: boolean;
  uploadingFiles: boolean;
  uploadedFiles: File[];
  esAdmin: boolean;
  corregir: (elemento: HTMLTextAreaElement, aplicar: (valor: string) => void) => Promise<void>;
  onClose: () => void;
  onChange: (field: string, value: any) => void;
  onEstadoChange: (nuevoEstado: string) => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onGuardar: () => void;
  onCancelarEdicion: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onDevolver: () => void;
}

const EXTENSIONES_ACEPTADAS = '.pdf,.xlsx,.xls,.xlsm,.csv,.png,.jpg,.jpeg,.webp,.gif,.bmp';

/**
 * Modal de detalle y edición de un ticket (Dropship y ZF).
 */
export default function ModalDetalleExpediente({
  show,
  expediente,
  editMode,
  isAsignarMode,
  estados,
  rutas,
  responsables,
  saving,
  uploadingFiles,
  uploadedFiles,
  esAdmin,
  corregir,
  onClose,
  onChange,
  onEstadoChange,
  onEdit,
  onDelete,
  onGuardar,
  onCancelarEdicion,
  onFileChange,
  onRemoveFile,
  onDevolver,
}: Props) {
  if (!show || !expediente) return null;

  const esDropship = expediente.tipo_modulo === 'dropship';
  const esZf = expediente.tipo_modulo === 'zf';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isAsignarMode && (
              <div className="w-9 h-9 flex items-center justify-center bg-amber-100 rounded-lg flex-shrink-0">
                <i className="ri-user-add-line text-amber-600 text-lg"></i>
              </div>
            )}
            <h2 className="text-2xl font-bold text-gray-900">
              {isAsignarMode
                ? 'Asignar Expediente'
                : editMode
                  ? 'Editar Expediente'
                  : 'Detalles del Expediente'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-2xl text-gray-500"></i>
          </button>
        </div>

        {/* Banner de asignación */}
        {isAsignarMode && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-amber-100 rounded-full flex-shrink-0 mt-0.5">
              <i className="ri-alert-line text-amber-600 text-base"></i>
            </div>
            <div>
              <p className="font-bold text-amber-800 text-sm">
                Completa los campos para asignar este expediente
              </p>
              <p className="text-amber-700 text-xs mt-1">
                Los campos marcados con <span className="font-bold text-amber-600">★</span> son
                prioritarios: <strong>Ruta Logística</strong> y <strong>Responsable</strong>. El EXP
                ID puede completarse después. El estado pasará a <strong>Asignado</strong>{' '}
                automáticamente al guardar.
              </p>
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PO/Tiquetera</label>
              {editMode ? (
                <input
                  type="text"
                  value={expediente.po_tiquetera}
                  onChange={(e) => onChange('po_tiquetera', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              ) : (
                <p className="text-gray-900">{expediente.po_tiquetera}</p>
              )}
            </div>

            <div className={isAsignarMode ? 'ring-2 ring-amber-300 rounded-xl p-3 -m-3' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isAsignarMode && <span className="text-amber-500 mr-1">★</span>}
                Ruta Logística
              </label>
              {editMode ? (
                <select
                  value={expediente.tipo_po}
                  onChange={(e) => onChange('tipo_po', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                >
                  {rutas.map((ruta) => (
                    <option key={ruta.id} value={ruta.key}>
                      {ruta.label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900">{expediente.tipo_po}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Solicitante
                <span className="ml-2 text-xs font-normal text-gray-400">(inmutable)</span>
              </label>
              <div className="flex items-center gap-2 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <i className="ri-lock-line text-gray-400 text-sm"></i>
                <span className="text-gray-900">{expediente.solicitante}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Quien consolidó y creó el ticket desde Documentación. No se puede modificar.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cargador de Documentos
                <span className="ml-2 text-xs font-normal text-gray-400">(inmutable)</span>
              </label>
              <div className="flex items-center gap-2 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <i className="ri-lock-line text-gray-400 text-sm"></i>
                <span className="text-gray-900">{expediente.cargador_documentos || 'N/A'}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Quien cargó los documentos y la PO desde Carga CAA. No se puede modificar.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
              {editMode ? (
                <select
                  value={expediente.estado_expediente}
                  onChange={(e) => onEstadoChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                >
                  {estados.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white ${getEstadoColor(
                    expediente.estado_expediente
                  )}`}
                >
                  {expediente.estado_expediente}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prioridad</label>
              {editMode ? (
                <select
                  value={expediente.prioridad}
                  onChange={(e) => onChange('prioridad', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                >
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                </select>
              ) : (
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getPrioridadColor(
                    expediente.prioridad,
                    expediente.prioridad_urgente
                  )}`}
                >
                  {expediente.prioridad}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridad Urgente
              </label>
              {editMode ? (
                <button
                  type="button"
                  onClick={() => onChange('prioridad_urgente', !expediente.prioridad_urgente)}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer ${
                    expediente.prioridad_urgente ? 'bg-red-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      expediente.prioridad_urgente ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              ) : (
                <p className="text-gray-900">{expediente.prioridad_urgente ? 'Sí' : 'No'}</p>
              )}
            </div>

            {expediente.prioridad_urgente && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de Urgencia
                </label>
                <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  {expediente.motivo_urgencia || 'N/A'}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dificultad</label>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getDificultadColor(
                  expediente.dificultad
                )}`}
              >
                {expediente.dificultad}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Líneas OC</label>
              {editMode ? (
                <input
                  type="number"
                  value={expediente.lineas_oc}
                  onChange={(e) => onChange('lineas_oc', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              ) : (
                <p className="text-gray-900">{expediente.lineas_oc}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">EXP ID</label>
              {editMode ? (
                <input
                  type="text"
                  value={expediente.exp_id}
                  onChange={(e) => onChange('exp_id', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              ) : (
                <p className="text-gray-900">{expediente.exp_id}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Solicitud
              </label>
              <p className="text-gray-900">{formatearFecha(expediente.fecha_solicitud)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Requerimiento
              </label>
              <p className="text-gray-900">{formatearFecha(expediente.fecha_requerimiento)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Creación
              </label>
              <p className="text-gray-900">
                {formatearFecha(expediente.fecha_creacion_expediente)}
              </p>
            </div>

            <div className={isAsignarMode ? 'ring-2 ring-amber-300 rounded-xl p-3 -m-3' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isAsignarMode && <span className="text-amber-500 mr-1">★</span>}
                Responsable Creación
              </label>
              {editMode ? (
                <>
                  <select
                    value={expediente.responsable_creacion}
                    onChange={(e) => onChange('responsable_creacion', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  >
                    {responsables.map((nombre) => (
                      <option key={nombre} value={nombre}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <i className="ri-history-line"></i>
                    Al cambiar el responsable, el historial conservará quién lo tenía antes.
                  </p>
                </>
              ) : (
                <p className="text-gray-900">{expediente.responsable_creacion}</p>
              )}
            </div>

            {/* Campo ETD solo para Dropship */}
            {esDropship && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ETD</label>
                {editMode ? (
                  <input
                    type="date"
                    value={expediente.etd || ''}
                    onChange={(e) => onChange('etd', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                    {expediente.etd ? formatearFecha(expediente.etd) : 'No especificado'}
                  </p>
                )}
              </div>
            )}

            {/* Checkbox Tránsito Corto — Dropship y ZF */}
            <div
              className={`flex items-center gap-4 rounded-lg p-4 border ${
                expediente.transito_corto
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Tránsito Corto
                </label>
                <p className="text-xs text-gray-500">Expediente de tránsito corto</p>
              </div>
              {editMode ? (
                <button
                  type="button"
                  onClick={() => onChange('transito_corto', !expediente.transito_corto)}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                    expediente.transito_corto ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      expediente.transito_corto ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              ) : (
                <span
                  className={`text-sm font-medium px-3 py-1 rounded-full ${
                    expediente.transito_corto
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {expediente.transito_corto ? 'Sí' : 'No'}
                </span>
              )}
            </div>

            {/* OK País, Finiquito, MCG e Incidente — solo Dropship */}
            {esDropship && (
              <>
                <div
                  className={`flex items-center gap-4 rounded-lg p-4 border ${
                    expediente.ok_pais
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      OK País
                    </label>
                    <p className="text-xs text-gray-500">
                      Marcar cuando el expediente esté cerrado
                    </p>
                  </div>
                  {editMode ? (
                    <button
                      type="button"
                      onClick={() => onChange('ok_pais', !expediente.ok_pais)}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        expediente.ok_pais ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          expediente.ok_pais ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full ${
                        expediente.ok_pais
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {expediente.ok_pais ? '✓ OK País' : 'Pendiente'}
                    </span>
                  )}
                </div>

                <div
                  className={`flex items-center gap-4 rounded-lg p-4 border ${
                    expediente.finiquito
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      Finiquito
                    </label>
                    <p className="text-xs text-gray-500">Marcar si el expediente tiene finiquito</p>
                  </div>
                  {editMode ? (
                    <button
                      type="button"
                      onClick={() => onChange('finiquito', !expediente.finiquito)}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        expediente.finiquito ? 'bg-orange-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          expediente.finiquito ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full ${
                        expediente.finiquito
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {expediente.finiquito ? 'Sí' : 'No'}
                    </span>
                  )}
                </div>

                <div
                  className={`flex items-center gap-4 rounded-lg p-4 border ${
                    expediente.mcg
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">MCG</label>
                    <p className="text-xs text-gray-500">Marcar si aplica MCG</p>
                  </div>
                  {editMode ? (
                    <button
                      type="button"
                      onClick={() => onChange('mcg', !expediente.mcg)}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        expediente.mcg ? 'bg-indigo-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          expediente.mcg ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full ${
                        expediente.mcg
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {expediente.mcg ? 'Sí' : 'No'}
                    </span>
                  )}
                </div>

                <div
                  className={`flex items-center gap-4 rounded-lg p-4 border ${
                    expediente.incidente
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      Incidente
                    </label>
                    <p className="text-xs text-gray-500">
                      Marcar si el expediente presenta un incidente
                    </p>
                  </div>
                  {editMode ? (
                    <button
                      type="button"
                      onClick={() => onChange('incidente', !expediente.incidente)}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        expediente.incidente ? 'bg-red-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          expediente.incidente ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full ${
                        expediente.incidente
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {expediente.incidente ? 'Sí' : 'No'}
                    </span>
                  )}
                </div>

                {expediente.incidente && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comentario del Incidente
                    </label>
                    {editMode ? (
                      <textarea
                        value={expediente.comentario_incidente || ''}
                        onChange={(e) => {
                          onChange('comentario_incidente', e.target.value);
                          corregir(e.target, (v) => onChange('comentario_incidente', v));
                        }}
                        rows={3}
                        maxLength={500}
                        spellCheck="true"
                        lang="es"
                        className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm resize-none"
                        placeholder="Describe el incidente..."
                      />
                    ) : (
                      <p className="text-gray-900 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                        {expediente.comentario_incidente || 'Sin comentario'}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* BL cargado — ambos módulos */}
            <div
              className={`flex items-center gap-4 rounded-lg p-4 border ${
                expediente.bl_cargado ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  BL (Bill of Lading) cargado
                </label>
                <p className="text-xs text-gray-500">
                  Marcar si el BL ya fue cargado o está adjunto al expediente
                </p>
              </div>
              {editMode ? (
                <button
                  type="button"
                  onClick={() => onChange('bl_cargado', !expediente.bl_cargado)}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                    expediente.bl_cargado ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      expediente.bl_cargado ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              ) : (
                <span
                  className={`text-sm font-medium px-3 py-1 rounded-full ${
                    expediente.bl_cargado
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {expediente.bl_cargado ? 'BL Cargado' : 'Sin BL'}
                </span>
              )}
            </div>

            {/* N° de BL y N° de Contenedor — solo lectura: los alimenta el sistema de carga */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                N° de BL
                <span className="ml-2 text-xs font-normal text-gray-400">(automático)</span>
              </label>
              <div className="flex items-center gap-2 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <i className="ri-lock-line text-gray-400 text-sm"></i>
                <span className="text-sm text-gray-900 font-mono">
                  {expediente.numero_bl || 'Pendiente de sincronizar'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                N° de Contenedor
                <span className="ml-2 text-xs font-normal text-gray-400">(automático)</span>
              </label>
              <div className="flex items-center gap-2 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <i className="ri-lock-line text-gray-400 text-sm"></i>
                <span className="text-sm text-gray-900 font-mono">
                  {expediente.numero_contenedor || 'Pendiente de sincronizar'}
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <i className="ri-information-line"></i>
                El N° de BL y el N° de contenedor llegan desde el sistema de carga. Aquí solo se
                consultan.
              </p>
            </div>

            {/* Packing List cargado — ambos módulos */}
            <div
              className={`md:col-span-2 flex items-center gap-4 rounded-lg p-4 border ${
                expediente.packing_list_cargado
                  ? 'bg-teal-50 border-teal-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Packing List cargado
                </label>
                <p className="text-xs text-gray-500">
                  Marcar cuando el packing list ya fue subido al expediente
                </p>
              </div>
              {editMode ? (
                <button
                  type="button"
                  onClick={() => onChange('packing_list_cargado', !expediente.packing_list_cargado)}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                    expediente.packing_list_cargado ? 'bg-teal-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      expediente.packing_list_cargado ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              ) : (
                <span
                  className={`text-sm font-medium px-3 py-1 rounded-full ${
                    expediente.packing_list_cargado
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {expediente.packing_list_cargado ? 'Packing List cargado' : 'Sin Packing List'}
                </span>
              )}
            </div>

            {/* TLC — ambos módulos */}
            <div
              className={`flex items-center gap-4 rounded-lg p-4 border ${
                expediente.aplica_tlc ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Aplica TLC (Tratado de Libre Comercio)
                </label>
                <p className="text-xs text-gray-500">
                  Marcar si esta documentación aplica para TLC
                </p>
              </div>
              {editMode ? (
                <button
                  type="button"
                  onClick={() => onChange('aplica_tlc', !expediente.aplica_tlc)}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                    expediente.aplica_tlc ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      expediente.aplica_tlc ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              ) : (
                <span
                  className={`text-sm font-medium px-3 py-1 rounded-full ${
                    expediente.aplica_tlc
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {expediente.aplica_tlc ? 'TLC Aplica' : 'Sin TLC'}
                </span>
              )}
            </div>

            {/* ETA Real — Dropship y ZF (base del KPI Liberado vs ETA) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ETA Real</label>
              {editMode ? (
                <input
                  type="date"
                  value={expediente.eta_real || ''}
                  onChange={(e) => onChange('eta_real', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                />
              ) : (
                <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  {expediente.eta_real ? formatearFecha(expediente.eta_real) : 'No especificado'}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Fecha real de arribo. Sin este dato el expediente no entra al indicador de ETA.
              </p>
            </div>

            {/* Recibo de Delzof — solo ZF */}
            {esZf && (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 md:col-span-2">
                  <div className="flex items-center gap-2 mb-3">
                    <i className="ri-receipt-line text-amber-600 text-base"></i>
                    <p className="text-sm font-semibold text-amber-800">Recibo de Delzof</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-amber-800 mb-1.5">
                        Fecha del recibo
                      </label>
                      {editMode ? (
                        <input
                          type="date"
                          value={expediente.recibo_delzof_fecha || ''}
                          onChange={(e) => onChange('recibo_delzof_fecha', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm cursor-pointer"
                        />
                      ) : (
                        <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded-lg border border-amber-200">
                          {expediente.recibo_delzof_fecha
                            ? formatearFecha(expediente.recibo_delzof_fecha)
                            : 'No registrado'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-amber-800 mb-1.5">
                        N° / Referencia
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={expediente.recibo_delzof_numero || ''}
                          onChange={(e) => onChange('recibo_delzof_numero', e.target.value)}
                          placeholder="Ej: REC-2025-00458"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                        />
                      ) : (
                        <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded-lg border border-amber-200 font-mono">
                          {expediente.recibo_delzof_numero || 'Sin referencia'}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-700 mt-2 flex items-center gap-1">
                    <i className="ri-information-line"></i>
                    La fecha del recibo es la base del KPI ETA Variable − 7.
                  </p>
                </div>
              </>
            )}

            {expediente.estado_expediente === 'En Revisión' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de Revisión
                </label>
                {editMode ? (
                  <textarea
                    value={expediente.motivo_revision || ''}
                    onChange={(e) => {
                      onChange('motivo_revision', e.target.value);
                      corregir(e.target, (v) => onChange('motivo_revision', v));
                    }}
                    rows={3}
                    spellCheck="true"
                    lang="es"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                  />
                ) : (
                  <p className="text-gray-900">{expediente.motivo_revision || 'N/A'}</p>
                )}
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones</label>
              {editMode ? (
                <textarea
                  value={expediente.instrucciones_adicionales || ''}
                  onChange={(e) => {
                    onChange('instrucciones_adicionales', e.target.value);
                    corregir(e.target, (v) => onChange('instrucciones_adicionales', v));
                  }}
                  rows={6}
                  spellCheck="true"
                  lang="es"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                  placeholder="Agregue observaciones adicionales..."
                />
              ) : (
                <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  {expediente.instrucciones_adicionales || 'Sin observaciones'}
                </p>
              )}
            </div>

            {editMode && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agregar Documentos (PDF, Excel, CSV e imágenes)
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer">
                      <div className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-teal-500 transition-colors flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-teal-600">
                        <i className="ri-upload-cloud-line text-xl"></i>
                        <span>Seleccionar archivos adicionales</span>
                      </div>
                      <input
                        type="file"
                        multiple
                        accept={EXTENSIONES_ACEPTADAS}
                        onChange={onFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <i className="ri-file-line text-teal-600"></i>
                            <span className="text-sm text-gray-700">{file.name}</span>
                            <span className="text-xs text-gray-500">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveFile(index)}
                            className="text-red-500 hover:text-red-700 cursor-pointer"
                          >
                            <i className="ri-close-line text-lg"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t">
              {!editMode ? (
                <>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-edit-line mr-2"></i>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(expediente.id)}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line mr-2"></i>
                    Eliminar
                  </button>
                  {esAdmin && expediente.estado_expediente === 'No Asignado' && (
                    <button
                      type="button"
                      onClick={onDevolver}
                      className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-arrow-go-back-line mr-2"></i>
                      Devolver a Documentación
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Cerrar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onCancelarEdicion}
                    className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={onGuardar}
                    disabled={saving || uploadingFiles}
                    className={`px-6 py-2 text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                      isAsignarMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-teal-600 hover:bg-teal-700'
                    }`}
                  >
                    {saving ? (
                      uploadingFiles ? (
                        'Subiendo archivos...'
                      ) : (
                        'Guardando...'
                      )
                    ) : isAsignarMode ? (
                      <>
                        <i className="ri-user-add-line"></i> Asignar Expediente
                      </>
                    ) : (
                      'Guardar Cambios'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}