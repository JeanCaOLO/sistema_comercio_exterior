// Campos propios de cada módulo dentro del detalle del expediente.
// Dropship: ETD, Finiquito, MCG, Incidente. ZF: ETA Real y Recibo de Delzof.

import { formatearFecha } from '@/lib/fechas';
import type { Expediente } from './types';
import InterruptorCampo from './InterruptorCampo';

type CorregirFn = (
  elemento: HTMLTextAreaElement,
  aplicar: (valor: string) => void
) => Promise<void>;

interface Props {
  expediente: Expediente;
  editMode: boolean;
  onChange: (field: string, value: any) => void;
  corregir: CorregirFn;
}

export default function CamposModuloLista({
  expediente,
  editMode,
  onChange,
  corregir,
}: Props) {
  if (expediente.tipo_modulo === 'zf') {
    return (
      <>
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
        </div>

        <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
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
    );
  }

  return (
    <>
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

      <InterruptorCampo
        titulo="Finiquito"
        descripcion="Marcar si el expediente tiene finiquito"
        activo={!!expediente.finiquito}
        editable={editMode}
        onChange={(v) => onChange('finiquito', v)}
        claseOn="bg-orange-500"
        fondoOn="bg-orange-50 border-orange-200"
        badgeOn="bg-orange-100 text-orange-700"
        etiquetaOn="Sí"
        etiquetaOff="No"
      />

      <InterruptorCampo
        titulo="MCG"
        descripcion="Marcar si aplica MCG"
        activo={!!expediente.mcg}
        editable={editMode}
        onChange={(v) => onChange('mcg', v)}
        claseOn="bg-indigo-500"
        fondoOn="bg-indigo-50 border-indigo-200"
        badgeOn="bg-indigo-100 text-indigo-700"
        etiquetaOn="Sí"
        etiquetaOff="No"
      />

      <InterruptorCampo
        titulo="Incidente"
        descripcion="Marcar si el expediente presenta un incidente"
        activo={!!expediente.incidente}
        editable={editMode}
        onChange={(v) => onChange('incidente', v)}
        claseOn="bg-red-500"
        fondoOn="bg-red-50 border-red-200"
        badgeOn="bg-red-100 text-red-700"
        etiquetaOn="Sí"
        etiquetaOff="No"
      />

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
  );
}