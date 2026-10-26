// Modal de detalle y edición de un expediente desde la Lista.

import { formatearFecha } from '@/lib/fechas';
import type { RutaLogistica } from '@/lib/rutas';
import type { Expediente } from './types';
import { ESTADOS_DROPSHIP, ESTADOS_ZF, getDificultadColor, getEstadoColor, getPrioridadColor } from './utils';
import InterruptorCampo from './InterruptorCampo';
import CamposModuloLista from './CamposModuloLista';

type CorregirFn = (
  elemento: HTMLTextAreaElement,
  aplicar: (valor: string) => void
) => Promise<void>;

interface Props {
  expediente: Expediente;
  editMode: boolean;
  saving: boolean;
  uploadingFiles: boolean;
  rutas: RutaLogistica[];
  responsables: string[];
  onClose: () => void;
  onEdit: () => void;
  onCancelarEdicion: () => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onChange: (field: string, value: any) => void;
  corregir: CorregirFn;
}

export default function ModalDetalleLista({
  expediente,
  editMode,
  saving,
  uploadingFiles,
  rutas,
  responsables,
  onClose,
  onEdit,
  onCancelarEdicion,
  onSave,
  onDelete,
  onChange,
  corregir,
}: Props) {
  const estados = expediente.tipo_modulo === 'dropship' ? ESTADOS_DROPSHIP : ESTADOS_ZF;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {editMode ? 'Editar Expediente' : 'Detalles del Expediente'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Tipo:{' '}
              <span
                className={`font-semibold ${
                  expediente.tipo_modulo === 'dropship' ? 'text-blue-600' : 'text-purple-600'
                }`}
              >
                {expediente.tipo_modulo === 'dropship' ? 'Dropship' : 'ZF'}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-2xl text-gray-500"></i>
          </button>
        </div>

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
                <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  {expediente.po_tiquetera}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ruta Logística</label>
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
                <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  {expediente.tipo_po}
                </p>
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
                  onChange={(e) => onChange('estado_expediente', e.target.value)}
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
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(
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
                  {expediente.prioridad_urgente ? 'URGENTE' : expediente.prioridad}
                </span>
              )}
            </div>

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
                <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  {expediente.lineas_oc}
                </p>
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
                <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  {expediente.exp_id}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Solicitud
              </label>
              <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {formatearFecha(expediente.fecha_solicitud)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Requerimiento
              </label>
              <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {formatearFecha(expediente.fecha_requerimiento)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Creación
              </label>
              <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {formatearFecha(expediente.fecha_creacion_expediente)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <p className="text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  {expediente.responsable_creacion}
                </p>
              )}
            </div>

            {/* Campos propios del módulo (ETD / ZF con Recibo de Delzof) */}
            <CamposModuloLista
              expediente={expediente}
              editMode={editMode}
              onChange={onChange}
              corregir={corregir}
            />

            <InterruptorCampo
              titulo="BL (Bill of Lading) cargado"
              descripcion="Estado del Bill of Lading para este expediente"
              activo={!!expediente.bl_cargado}
              editable={editMode}
              onChange={(v) => onChange('bl_cargado', v)}
              claseOn="bg-blue-600"
              fondoOn="bg-blue-50 border-blue-200"
              badgeOn="bg-blue-100 text-blue-700"
              etiquetaOn="BL Cargado"
              etiquetaOff="Sin BL"
            />

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

            <InterruptorCampo
              titulo="Packing List cargado"
              descripcion="Marcar cuando el packing list ya fue subido al expediente"
              activo={!!expediente.packing_list_cargado}
              editable={editMode}
              onChange={(v) => onChange('packing_list_cargado', v)}
              claseOn="bg-teal-600"
              fondoOn="bg-teal-50 border-teal-200"
              badgeOn="bg-teal-100 text-teal-700"
              etiquetaOn="Packing List cargado"
              etiquetaOff="Sin Packing List"
              className="md:col-span-2"
            />

            <InterruptorCampo
              titulo="Aplica TLC (Tratado de Libre Comercio)"
              descripcion="Indica si la documentación aplica para TLC"
              activo={!!expediente.aplica_tlc}
              editable={editMode}
              onChange={(v) => onChange('aplica_tlc', v)}
              claseOn="bg-green-600"
              fondoOn="bg-green-50 border-green-200"
              badgeOn="bg-green-100 text-green-700"
              etiquetaOn="TLC Aplica"
              etiquetaOff="Sin TLC"
            />

            <InterruptorCampo
              titulo="Tránsito Corto (TC)"
              descripcion="Indica si la PO/Documentación es de tránsito corto"
              activo={!!expediente.transito_corto}
              editable={editMode}
              onChange={(v) => onChange('transito_corto', v)}
              claseOn="bg-amber-500"
              fondoOn="bg-amber-50 border-amber-200"
              badgeOn="bg-amber-100 text-amber-700"
              etiquetaOn="TC Activado"
              etiquetaOff="Sin TC"
            />

            {expediente.prioridad_urgente && expediente.motivo_urgencia && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de Urgencia
                </label>
                <p className="text-gray-900 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                  {expediente.motivo_urgencia}
                </p>
              </div>
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
                  <p className="text-gray-900 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
                    {expediente.motivo_revision || 'N/A'}
                  </p>
                )}
              </div>
            )}

            {expediente.instrucciones_adicionales && (
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
                    {expediente.instrucciones_adicionales}
                  </p>
                )}
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
                    onClick={onSave}
                    disabled={saving || uploadingFiles}
                    className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving
                      ? uploadingFiles
                        ? 'Subiendo archivos...'
                        : 'Guardando...'
                      : 'Guardar Cambios'}
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