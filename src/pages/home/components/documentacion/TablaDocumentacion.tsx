import { memo } from 'react';
import { EncabezadosDocumentos, CeldasDocumentos } from '@/pages/home/components/DocumentosBadges';
import { contarDocumentos, formatearFecha } from '@/pages/home/components/documentacion/utils';
import type { DocumentoCAA } from '@/pages/home/components/documentacion/types';

interface FilaDocumentacionProps {
  doc: DocumentoCAA;
  seleccionado: boolean;
  onToggle: (id: string) => void;
  onAbrirRepositorio: (doc: DocumentoCAA) => void;
}

const FilaDocumentacion = memo(({ doc, seleccionado, onToggle, onAbrirRepositorio }: FilaDocumentacionProps) => (
  <tr
    onClick={() => onToggle(doc.id)}
    className={`cursor-pointer transition-colors ${seleccionado ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
  >
    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={seleccionado}
        onChange={(e) => { e.stopPropagation(); onToggle(doc.id); }}
        className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
      />
    </td>
    <td className="px-3 py-3">
      <div className="text-sm font-semibold text-gray-900">{doc.po_tiquetera}</div>
      {(doc.numero_bl || doc.numero_contenedor) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          {doc.numero_bl && (
            <span className="text-[11px] text-gray-500 whitespace-nowrap">
              <span className="font-semibold text-gray-600">BL:</span> {doc.numero_bl}
            </span>
          )}
          {doc.numero_contenedor && (
            <span className="text-[11px] text-gray-500 whitespace-nowrap">
              <span className="font-semibold text-gray-600">CONT:</span> {doc.numero_contenedor}
            </span>
          )}
        </div>
      )}
    </td>
    <td className="px-3 py-3 whitespace-nowrap">
      <span className="text-xs text-gray-500 font-mono">{doc.exp_id || 'Por Asignar'}</span>
    </td>
    <td className="px-3 py-3 whitespace-nowrap">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          doc.tipo_modulo === 'dropship' ? 'bg-teal-100 text-teal-800' : 'bg-sky-100 text-sky-800'
        }`}
      >
        {doc.tipo_modulo === 'dropship' ? 'Dropship' : 'ZF'}
      </span>
    </td>
    <td className="px-3 py-3">
      <div className="text-xs text-gray-600 max-w-[200px] truncate" title={doc.tipo_po}>
        {doc.tipo_po}
      </div>
    </td>
    <td className="px-3 py-3 whitespace-nowrap">
      <span className="text-sm text-gray-700">{doc.solicitante || '—'}</span>
    </td>
    <CeldasDocumentos
      doc={doc.doc}
      blCargado={doc.bl_cargado}
      packingListCargado={doc.packing_list_cargado}
      numeroContenedor={doc.numero_contenedor}
      transitoCorto={doc.tc_cargado}
      aplicaTlc={doc.aplica_tlc}
    />
    <td className="px-3 py-3 text-center whitespace-nowrap">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAbrirRepositorio(doc);
        }}
        disabled={contarDocumentos(doc.doc) === 0}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
        title="Ver repositorio de documentos"
      >
        <i className="ri-folder-open-line text-xs"></i>
        {contarDocumentos(doc.doc)}
      </button>
    </td>
    <td className="px-3 py-3 whitespace-nowrap">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full">
          <i className="ri-user-line text-xs text-gray-500"></i>
        </div>
        <span className="text-sm text-gray-700">{doc.responsable_creacion}</span>
      </div>
    </td>
    <td className="px-3 py-3 whitespace-nowrap">
      <span className="text-xs text-gray-500">{formatearFecha(doc.created_at)}</span>
    </td>
  </tr>
));

FilaDocumentacion.displayName = 'FilaDocumentacion';

interface TablaDocumentacionProps {
  documentos: DocumentoCAA[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onAbrirRepositorio: (doc: DocumentoCAA) => void;
}

const TablaDocumentacion = ({
  documentos,
  selectedIds,
  onToggle,
  onToggleAll,
  onAbrirRepositorio,
}: TablaDocumentacionProps) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 w-12">
              <input
                type="checkbox"
                checked={documentos.length > 0 && selectedIds.size === documentos.length}
                onChange={onToggleAll}
                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">POs Asociadas</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">EXP ID</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Módulo</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ruta Logística</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Solicitante</th>
            <EncabezadosDocumentos />
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Docs</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Cargado por</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Fecha</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {documentos.map((doc) => (
            <FilaDocumentacion
              key={doc.id}
              doc={doc}
              seleccionado={selectedIds.has(doc.id)}
              onToggle={onToggle}
              onAbrirRepositorio={onAbrirRepositorio}
            />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default TablaDocumentacion;