import { useEffect, useMemo, useState } from 'react';
import PanelIndicador, { BadgeIndicador } from '@/pages/home/components/PanelIndicador';
import TarjetaDesglose from '@/pages/home/components/TarjetaDesglose';
import { descargarExcel } from '@/lib/exportar';
import {
  cargarKpiDocumentacionCompleta,
  etiquetaModulo,
  RESULTADO_DOCUMENTACION_VACIO,
  type FilaDocumentacionPo,
  type ResultadoDocumentacionCompleta
} from '@/lib/kpisDocumentacion';

type FiltroDetalle = 'todas' | 'dropship' | 'zf' | 'sin-expediente';

const Marca = ({ activo }: { activo: boolean }) => (
  <span
    className={`inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ${
      activo ? 'bg-teal-100 text-teal-700' : 'bg-red-50 text-red-400'
    }`}
  >
    <i className={activo ? 'ri-checkbox-circle-fill text-lg' : 'ri-close-circle-line text-lg'}></i>
  </span>
);

export default function KpiDocumentacionCompleta() {
  const [resultado, setResultado] = useState<ResultadoDocumentacionCompleta>(RESULTADO_DOCUMENTACION_VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDetalle>('todas');
  const [busqueda, setBusqueda] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await cargarKpiDocumentacionCompleta();
      setResultado(data);
    } catch (err: any) {
      console.error('Error al cargar el indicador de factura sola:', err);
      setError(err?.message || 'No se pudo cargar la información de documentación.');
      setResultado(RESULTADO_DOCUMENTACION_VACIO);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const sinEtapa = resultado.totalEtapa === 0;
  const sinDatos = sinEtapa || resultado.total === 0;

  const tono = sinEtapa ? 'gray' : resultado.total > 0 ? 'amber' : 'teal';

  const colorPct =
    tono === 'teal' ? 'text-teal-600' : tono === 'gray' ? 'text-gray-400' : 'text-amber-600';
  const colorBarra =
    tono === 'teal' ? 'bg-teal-500' : tono === 'gray' ? 'bg-gray-300' : 'bg-amber-500';

  const badge: BadgeIndicador | null = sinEtapa
    ? null
    : resultado.total > 0
    ? {
        tono: 'alerta',
        texto: `${resultado.total} PO${resultado.total !== 1 ? 's' : ''} solo con factura cargada`,
        subtexto: 'Faltan BL, packing list y contenedor'
      }
    : {
        tono: 'ok',
        texto: 'Ninguna PO con factura sola',
        subtexto: 'Toda la etapa ya tiene otros documentos cargados'
      };

  const filasFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return resultado.filas
      .filter((f) => {
        if (filtro === 'dropship') return (f.tipo_modulo || '').toLowerCase() === 'dropship';
        if (filtro === 'zf') return (f.tipo_modulo || '').toLowerCase() === 'zf';
        if (filtro === 'sin-expediente') return f.sinExpediente;
        return true;
      })
      .filter((f) => {
        if (!term) return true;
        return (
          f.po_tiquetera.toLowerCase().includes(term) ||
          f.exp_id.toLowerCase().includes(term) ||
          f.solicitante.toLowerCase().includes(term)
        );
      });
  }, [busqueda, filtro, resultado.filas]);

  const descargar = () => {
    const filas = filasFiltradas.map((f) => ({
      'PO': f.po_tiquetera,
      'EXP ID': f.exp_id || '-',
      'Módulo': etiquetaModulo(f.tipo_modulo),
      'Origen': f.origen === 'ticket' ? 'Ticket creado' : 'Bandeja Documentación',
      'Estado': f.estado,
      'Expediente creado': f.sinExpediente ? 'No' : 'Sí',
      'Solicitante': f.solicitante || '—',
      'Factura': f.tieneFactura ? 'Sí' : 'No',
      'BL': f.tieneBl ? 'Sí' : 'No',
      'Packing List': f.tienePackingList ? 'Sí' : 'No',
      'Contenedor': f.tieneContenedor ? 'Sí' : 'No',
      'Documentos en el registro': f.cantidadDocumentos,
      'Documentos pendientes': f.faltantes.length > 0 ? f.faltantes.join(', ') : '-'
    }));
    descargarExcel(
      `reporte-pos-solo-factura-${new Date().toISOString().split('T')[0]}.xlsx`,
      filas
    );
  };

  return (
    <>
      <PanelIndicador
        icono="ri-bill-line"
        tono={tono}
        titulo="POs con Solo Factura Cargada"
        meta={
          <>
            Solo se toman en cuenta las POs en etapa de documentación que tienen la
            <strong> factura cargada y ningún otro documento</strong> (sin BL, sin packing list y sin contenedor),
            <strong> incluyendo las que todavía no generaron expediente</strong>
          </>
        }
        badge={badge}
        accion={{
          texto: 'Ver detalle de POs',
          icono: 'ri-file-chart-line',
          onClick: () => setDetalleAbierto(true),
          disabled: sinDatos
        }}
      >
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <i className="ri-error-warning-line text-red-600 text-lg"></i>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={cargar}
              className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Reintentar
            </button>
          </div>
        )}

        {cargando ? (
          <div className="flex items-center gap-2 py-8 justify-center text-gray-500">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            <span className="text-sm">Buscando POs con factura sola...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <TarjetaDesglose
                etiqueta="% de la Etapa con Factura Sola"
                valor={sinEtapa ? '—' : resultado.porcentajeEtapa}
                sufijo={sinEtapa ? undefined : '%'}
                valorClass={colorPct}
                barra={sinEtapa ? null : { porcentaje: resultado.porcentajeEtapa, colorClass: colorBarra }}
                footer={
                  sinEtapa
                    ? 'No hay POs en etapa de documentación'
                    : `${resultado.total} de ${resultado.totalEtapa} PO${resultado.totalEtapa !== 1 ? 's' : ''} en etapa de documentación`
                }
              />

              <TarjetaDesglose
                etiqueta="POs con Solo Factura"
                valor={resultado.total}
                sufijo="PO"
                valorClass={resultado.total > 0 ? 'text-amber-600' : 'text-teal-600'}
                linea={{
                  icono: resultado.total > 0 ? 'ri-error-warning-fill' : 'ri-checkbox-circle-fill',
                  texto: resultado.total > 0 ? 'Sin BL, packing list ni contenedor' : 'Nada pendiente por este criterio',
                  colorClass: resultado.total > 0 ? 'text-amber-700' : 'text-teal-700'
                }}
                nota="Haz clic para ver el detalle"
                resaltado={resultado.total > 0}
                onClick={sinDatos ? undefined : () => { setFiltro('todas'); setDetalleAbierto(true); }}
              />

              <TarjetaDesglose
                etiqueta="Documentos por Completar"
                valor={resultado.documentosPendientes}
                sufijo="docs"
                valorClass={resultado.documentosPendientes > 0 ? 'text-red-600' : 'text-gray-400'}
                linea={{ icono: 'ri-file-copy-2-line', texto: 'BL + packing list + contenedor por PO', colorClass: 'text-gray-600' }}
                footer="Uno por cada requisito faltante"
              />

              <TarjetaDesglose
                etiqueta="Universo de la Etapa"
                valor={resultado.totalEtapa}
                sufijo="PO"
                valorClass="text-gray-800"
                linea={{ icono: 'ri-inbox-archive-line', texto: 'Tickets no asignados + bandeja', colorClass: 'text-gray-600' }}
                footer="Base sobre la que se mide el indicador"
              />

              <TarjetaDesglose
                etiqueta="Factura sin Expediente"
                valor={resultado.sinExpediente}
                sufijo="PO"
                valorClass={resultado.sinExpediente > 0 ? 'text-orange-600' : 'text-gray-800'}
                linea={{
                  icono: 'ri-user-received-2-line',
                  texto: 'Con factura pero sin expediente creado',
                  colorClass: resultado.sinExpediente > 0 ? 'text-orange-700' : 'text-gray-600'
                }}
                nota={resultado.sinExpediente > 0 ? 'Haz clic para ver el detalle' : undefined}
                notaClass="text-orange-600"
                onClick={resultado.sinExpediente > 0 ? () => { setFiltro('sin-expediente'); setDetalleAbierto(true); } : undefined}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="ri-truck-line text-gray-500"></i>
                    <span className="text-xs font-semibold text-gray-700 truncate">Dropship</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800 whitespace-nowrap">{resultado.porModulo.dropship} PO</span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="ri-earth-line text-gray-500"></i>
                    <span className="text-xs font-semibold text-gray-700 truncate">Zona Franca</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800 whitespace-nowrap">{resultado.porModulo.zf} PO</span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="ri-ticket-2-line text-gray-500"></i>
                    <span className="text-xs font-semibold text-gray-700 truncate">Vía ticket creado</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800 whitespace-nowrap">{resultado.porOrigen.ticket} PO</span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="ri-inbox-line text-gray-500"></i>
                    <span className="text-xs font-semibold text-gray-700 truncate">Vía bandeja</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800 whitespace-nowrap">{resultado.porOrigen.bandeja} PO</span>
                </div>
              </div>
            </div>

            {!sinEtapa && resultado.total === 0 && (
              <div className="mt-4 flex items-start gap-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                <i className="ri-information-line text-teal-600 text-lg flex-shrink-0"></i>
                <p className="text-xs text-teal-800">
                  Ninguna de las {resultado.totalEtapa} POs en etapa tiene únicamente la factura cargada:
                  o no tienen factura todavía, o ya sumaron BL, packing list o contenedor.
                </p>
              </div>
            )}
          </>
        )}
      </PanelIndicador>

      {detalleAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">POs con Solo Factura Cargada</h2>
                <p className="text-sm text-gray-500 mt-1">
                  POs en etapa de documentación con factura y ningún otro documento cargado
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={descargar}
                  disabled={filasFiltradas.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-download-2-line"></i>
                  Descargar Excel
                </button>
                <button
                  onClick={() => setDetalleAbierto(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl text-gray-500"></i>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{resultado.total}</p>
                  <p className="text-xs text-gray-500">POs con factura sola</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{resultado.documentosPendientes}</p>
                  <p className="text-xs text-gray-500">Documentos por completar</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{resultado.sinExpediente}</p>
                  <p className="text-xs text-gray-500">Con factura sin expediente</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.porModulo.dropship}</p>
                  <p className="text-xs text-gray-500">Dropship</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.porModulo.zf}</p>
                  <p className="text-xs text-gray-500">Zona Franca</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3 flex-shrink-0">
              <div className="flex gap-2">
                {(['todas', 'dropship', 'zf', 'sin-expediente'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      filtro === f
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'todas'
                      ? `Todas (${resultado.total})`
                      : f === 'dropship'
                      ? `Dropship (${resultado.porModulo.dropship})`
                      : f === 'zf'
                      ? `ZF (${resultado.porModulo.zf})`
                      : `Sin expediente (${resultado.sinExpediente})`}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[220px] max-w-sm ml-auto">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar PO, EXP ID o solicitante..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">PO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Módulo / Origen</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Expediente</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Factura</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">BL</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Packing List</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Contenedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Documentos pendientes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filasFiltradas.map((fila: FilaDocumentacionPo) => (
                    <tr key={fila.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{fila.po_tiquetera}</p>
                        <p className="text-xs text-gray-500 whitespace-nowrap">{fila.exp_id || 'Sin EXP ID'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            fila.tipo_modulo?.toLowerCase() === 'dropship'
                              ? 'bg-teal-100 text-teal-800'
                              : fila.tipo_modulo?.toLowerCase() === 'zf'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {etiquetaModulo(fila.tipo_modulo)}
                        </span>
                        <p className="text-[11px] text-gray-500 mt-1 whitespace-nowrap">
                          {fila.origen === 'ticket' ? 'Ticket creado' : 'Bandeja Documentación'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fila.estado}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {fila.sinExpediente ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-[11px] font-semibold">
                            <i className="ri-user-received-2-line"></i> Sin expediente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-[11px] font-semibold">
                            <i className="ri-checkbox-circle-line"></i> Creado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center"><Marca activo={fila.tieneFactura} /></td>
                      <td className="px-4 py-3 text-center"><Marca activo={fila.tieneBl} /></td>
                      <td className="px-4 py-3 text-center"><Marca activo={fila.tienePackingList} /></td>
                      <td className="px-4 py-3 text-center"><Marca activo={fila.tieneContenedor} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {fila.faltantes.map((doc) => (
                            <span
                              key={doc}
                              className="inline-block px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-[11px] font-medium whitespace-nowrap"
                            >
                              {doc}
                            </span>
                          ))}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {fila.cantidadDocumentos} documento{fila.cantidadDocumentos !== 1 ? 's' : ''} en el registro
                        </p>
                      </td>
                    </tr>
                  ))}
                  {filasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                        <i className="ri-inbox-line text-4xl mb-2"></i>
                        <p className="text-sm">No hay POs para mostrar con este filtro</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}