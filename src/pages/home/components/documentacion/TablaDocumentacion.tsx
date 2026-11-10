import { memo } from 'react';
import { EncabezadosDocumentos, CeldasDocumentos } from '@/pages/home/components/DocumentosBadges';
import {
  contarDocumentos,
  formatearFecha,
  formatearFechaCorta,
  tiempoDesdeSincronizacion,
  diasEnBandeja,
  nivelBandeja,
  estaListoParaConsolidar,
} from '@/pages/home/components/documentacion/utils';
import type { DocumentoCAA } from '@/pages/home/components/documentacion/types';

const estiloNivel: Record<string, { clases: string; icono: string; ayuda: string }> = {
  ok: {
    clases: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icono: 'ri-checkbox-blank-circle-fill',
    ayuda: 'Al día (hasta 3 días en bandeja)',
  },
  atencion: {
    clases: 'bg-amber-100 text-amber-800 border-amber-200',
    icono: 'ri-error-warning-fill',
    ayuda: 'Revisar (4 a 7 días en bandeja)',
  },
  critico: {
    clases: 'bg-rose-100 text-rose-800 border-rose-200',
    icono: 'ri-alarm-warning-fill',
    ayuda: 'Crítico (más de 7 días sin consolidar)',
  },
};

const BadgeDiasBandeja = ({ createdAt }: { createdAt: string }) => {
  const dias = diasEnBandeja(createdAt);
  const nivel = nivelBandeja(dias);
  const estilo = estiloNivel[nivel];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${estilo.clases}`}
      title={estilo.ayuda}
    >
      <span className="w-3 h-3 flex items-center justify-center">
        <i className={`${estilo.icono} text-[8px]`}></i>
      </span>
      {dias === 0 ? 'Hoy' : `${dias} d`}
    </span>
  );
};

const ESTADOS_SEMAFORO = [
  { nivel: 'ok', etiqueta: '0-3 días' },
  { nivel: 'atencion', etiqueta: '4-7 días' },
  { nivel: 'critico', etiqueta: 'Más de 7 días' },
];

const LeyendaSemaforo = () => (
  <div className="flex flex-wrap items-center gap-3">
    {ESTADOS_SEMAFORO.map(({ nivel, etiqueta }) => (
      <span key={nivel} className="flex items-center gap-1.5 text-[11px] text-gray-500">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            nivel === 'ok' ? 'bg-emerald-500' : nivel === 'atencion' ? 'bg-amber-500' : 'bg-rose-500'
          }`}
        ></span>
        {etiqueta}
      </span>
    ))}
  </div>
);

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
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{doc.po_tiquetera}</span>
        {estaListoParaConsolidar(doc) && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold whitespace-nowrap"
            title="Ya tiene factura, packing list y BL: listo para consolidar"
          >
            <i className="ri-checkbox-circle-fill text-[9px]"></i>
            Listo
          </span>
        )}
      </div>
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
    <td className="px-3 py-3 whitespace-nowrap">
      {doc.etapa ? (
        <span
          className="inline-flex items-center gap-1.5 max-w-[190px] px-2.5 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-medium"
          title={`Etapa del embarque según Raga · ${tiempoDesdeSincronizacion(doc.raga_sync_at)}`}
        >
          <span className="w-3 h-3 flex items-center justify-center">
            <i className="ri-route-line text-[10px]"></i>
          </span>
          <span className="truncate">{doc.etapa}</span>
        </span>
      ) : (
        <span
          className="text-xs text-gray-400"
          title="La Etapa se completa automáticamente desde Raga cada 2 horas"
        >
          —
        </span>
      )}
    </td>
    <td className="px-3 py-3 whitespace-nowrap">
      {doc.atd ? (
        <div title={`ATD (zarpe real) según Raga · ${tiempoDesdeSincronizacion(doc.raga_sync_at)}`}>
          <div className="text-sm font-medium text-gray-900">{formatearFechaCorta(doc.atd)}</div>
          <div className="text-[10px] text-gray-400">{tiempoDesdeSincronizacion(doc.raga_sync_at)}</div>
        </div>
      ) : doc.etd ? (
        <div title="Raga todavía no registra el ATD (zarpe real). Se muestra el ETD estimado como referencia.">
          <div className="text-xs text-gray-400">Sin ATD</div>
          <div className="text-[10px] text-gray-400">ETD {formatearFechaCorta(doc.etd)}</div>
        </div>
      ) : (
        <span
          className="text-xs text-gray-400"
          title="El ATD se completa automáticamente desde Raga cada 2 horas"
        >
          —
        </span>
      )}
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
    <td className="px-3 py-3 whitespace-nowrap">
      <BadgeDiasBandeja createdAt={doc.created_at} />
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
}: TablaDocumentacionProps) => {
  const totalCriticos = documentos.filter((doc) => nivelBandeja(diasEnBandeja(doc.created_at)) === 'critico').length;

  return (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    {totalCriticos > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-rose-50 border-b border-rose-200">
        <div className="flex items-center gap-2 text-rose-800">
          <span className="w-5 h-5 flex items-center justify-center">
            <i className="ri-alarm-warning-fill text-sm"></i>
          </span>
          <span className="text-sm font-semibold">
            {totalCriticos} registro{totalCriticos === 1 ? '' : 's'} lleva{totalCriticos === 1 ? '' : 'n'} más de 7 días sin consolidar
          </span>
        </div>
        <LeyendaSemaforo />
      </div>
    )}
    {totalCriticos === 0 && (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Antigüedad en bandeja</span>
        <LeyendaSemaforo />
      </div>
    )}
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
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Etapa</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">ATD Raga</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ruta Logística</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Solicitante</th>
            <EncabezadosDocumentos />
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Docs</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Cargado por</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Fecha</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Días en Bandeja</th>
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
};

export default TablaDocumentacion;