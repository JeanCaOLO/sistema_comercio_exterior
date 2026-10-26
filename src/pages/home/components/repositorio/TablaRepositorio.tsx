import { memo, Fragment } from 'react';
import { parseDocEntries } from '@/lib/documentos';
import { EncabezadosDocumentos, CeldasDocumentos, SelloDocumentos } from '@/pages/home/components/DocumentosBadges';
import FilaArchivo from '@/pages/home/components/repositorio/FilaArchivo';
import {
  colorEstado,
  formatearFecha,
  obtenerCargador,
} from '@/pages/home/components/repositorio/utils';
import type { RegistroRepositorio } from '@/pages/home/components/repositorio/types';

interface FilaRepositorioProps {
  registro: RegistroRepositorio;
  expandida: boolean;
  downloadingId: string | null;
  onToggleExpandir: (id: string) => void;
  onDescargar: (url: string, fileName: string) => void;
  onEditar: (registro: RegistroRepositorio) => void;
  onHistorial: (registro: RegistroRepositorio) => void;
}

const FilaRepositorio = memo(({
  registro,
  expandida,
  downloadingId,
  onToggleExpandir,
  onDescargar,
  onEditar,
  onHistorial,
}: FilaRepositorioProps) => {
  const docUrls = parseDocEntries(registro.doc);
  const docCount = docUrls.length;

  return (
    <Fragment>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">{registro.po_tiquetera}</div>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="text-xs text-gray-500 font-mono">{registro.exp_id}</span>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              registro.tipo_modulo === 'dropship' ? 'bg-teal-100 text-teal-800' : 'bg-sky-100 text-sky-800'
            }`}
          >
            <i className={registro.tipo_modulo === 'dropship' ? 'ri-ship-line' : 'ri-building-line'}></i>
            {registro.tipo_modulo === 'dropship' ? 'Dropship' : 'ZF'}
          </span>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${colorEstado(registro.estado_expediente)}`}>
            {registro.estado_expediente}
          </span>
        </td>
        <td className="px-3 py-3">
          <div className="text-xs text-gray-600 max-w-[200px] truncate" title={registro.tipo_po}>
            {registro.tipo_po}
          </div>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="text-sm text-gray-700">{registro.solicitante}</span>
        </td>
        <CeldasDocumentos
          doc={registro.doc}
          blCargado={registro.bl_cargado}
          packingListCargado={registro.packing_list_cargado}
          numeroContenedor={registro.numero_contenedor}
          transitoCorto={registro.tc_cargado}
          aplicaTlc={registro.aplica_tlc}
        />
        <td className="px-3 py-3 text-center whitespace-nowrap">
          <SelloDocumentos
            doc={registro.doc}
            blCargado={registro.bl_cargado}
            packingListCargado={registro.packing_list_cargado}
            numeroContenedor={registro.numero_contenedor}
          />
        </td>
        <td className="px-3 py-3 text-center whitespace-nowrap">
          {docCount > 0 ? (
            <button
              type="button"
              onClick={() => onToggleExpandir(registro.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className={expandida ? 'ri-arrow-up-s-line text-xs' : 'ri-arrow-down-s-line text-xs'}></i>
              {docCount}
            </button>
          ) : (
            <span className="text-sm text-gray-400">0</span>
          )}
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full">
              <i className="ri-user-line text-xs text-gray-500"></i>
            </div>
            <span className="text-sm text-gray-700">{obtenerCargador(registro)}</span>
          </div>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="text-xs text-gray-500">{formatearFecha(registro.created_at)}</span>
        </td>
        <td className="px-3 py-3 text-center whitespace-nowrap">
          <button
            type="button"
            onClick={() => onEditar(registro)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-amber-700 bg-amber-50 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
            title="Editar registro"
          >
            <i className="ri-edit-line"></i>
            Editar
          </button>
        </td>
        <td className="px-3 py-3 text-center whitespace-nowrap">
          <button
            type="button"
            onClick={() => onHistorial(registro)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-gray-600 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
            title="Ver historial de modificaciones"
          >
            <i className="ri-history-line"></i>
            Historial
          </button>
        </td>
      </tr>

      {expandida && docCount > 0 && (
        <tr>
          <td colSpan={18} className="px-4 py-0 bg-gray-50/60">
            <div className="py-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Archivos ({docCount})</p>
              {docUrls.map((entry, idx) => (
                <FilaArchivo
                  key={`${registro.id}-file-${idx}`}
                  entry={entry}
                  indice={idx + 1}
                  descargando={downloadingId === entry.url}
                  onDescargar={onDescargar}
                />
              ))}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
});

FilaRepositorio.displayName = 'FilaRepositorio';

interface TablaRepositorioProps {
  registros: RegistroRepositorio[];
  filasExpandidas: Set<string>;
  downloadingId: string | null;
  cargando: boolean;
  hayFiltrosActivos: boolean;
  onToggleExpandir: (id: string) => void;
  onDescargar: (url: string, fileName: string) => void;
  onEditar: (registro: RegistroRepositorio) => void;
  onHistorial: (registro: RegistroRepositorio) => void;
  onLimpiarFiltros: () => void;
}

const TablaRepositorio = ({
  registros,
  filasExpandidas,
  downloadingId,
  cargando,
  hayFiltrosActivos,
  onToggleExpandir,
  onDescargar,
  onEditar,
  onHistorial,
  onLimpiarFiltros,
}: TablaRepositorioProps) => (
  <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden transition-opacity ${cargando ? 'opacity-60' : 'opacity-100'}`}>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">POs Asociadas</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">EXP ID</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Módulo</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Ruta Logística</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Solicitante</th>
            <EncabezadosDocumentos />
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" title="Requisitos completos: factura, BL, packing list y contenedor">4/4</th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Docs</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Cargado por</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Fecha</th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Acción</th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Historial</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {registros.length === 0 ? (
            <tr>
              <td colSpan={18} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <i className="ri-file-search-line text-4xl text-gray-300"></i>
                  <p className="text-gray-500 font-medium">
                    {hayFiltrosActivos ? 'No se encontraron documentos con esos filtros' : 'Todavía no hay documentos cargados'}
                  </p>
                  {hayFiltrosActivos ? (
                    <button
                      type="button"
                      onClick={onLimpiarFiltros}
                      className="mt-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-filter-off-line mr-1.5"></i>
                      Limpiar filtros
                    </button>
                  ) : (
                    <p className="text-gray-400 text-sm">Los documentos aparecerán cuando se carguen desde Carga CAA</p>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            registros.map((registro) => (
              <FilaRepositorio
                key={registro.id}
                registro={registro}
                expandida={filasExpandidas.has(registro.id)}
                downloadingId={downloadingId}
                onToggleExpandir={onToggleExpandir}
                onDescargar={onDescargar}
                onEditar={onEditar}
                onHistorial={onHistorial}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default TablaRepositorio;