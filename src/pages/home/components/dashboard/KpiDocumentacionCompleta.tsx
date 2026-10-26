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

type FiltroDetalle = 'todas' | 'completas' | 'incompletas';

const REQUISITOS: { clave: 'conFactura' | 'conBl' | 'conPackingList' | 'conContenedor'; etiqueta: string; icono: string }[] = [
  { clave: 'conFactura', etiqueta: 'Factura', icono: 'ri-bill-line' },
  { clave: 'conBl', etiqueta: 'BL', icono: 'ri-file-shield-2-line' },
  { clave: 'conPackingList', etiqueta: 'Packing List', icono: 'ri-file-list-3-line' },
  { clave: 'conContenedor', etiqueta: 'Contenedor', icono: 'ri-box-3-line' }
];

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
      console.error('Error al cargar KPI de documentación completa:', err);
      setError(err?.message || 'No se pudo cargar la información de documentación.');
      setResultado(RESULTADO_DOCUMENTACION_VACIO);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const sinDatos = resultado.total === 0;

  const tono = sinDatos
    ? 'gray'
    : resultado.porcentaje >= 80
    ? 'teal'
    : resultado.porcentaje >= 50
    ? 'indigo'
    : 'red';

  const colorPct =
    tono === 'teal'
      ? 'text-teal-600'
      : tono === 'indigo'
      ? 'text-indigo-600'
      : tono === 'gray'
      ? 'text-gray-400'
      : 'text-red-600';

  const colorBarra =
    tono === 'teal' ? 'bg-teal-500' : tono === 'indigo' ? 'bg-indigo-500' : 'bg-red-500';

  const badge: BadgeIndicador | null = sinDatos
    ? null
    : resultado.incompletas > 0
    ? {
        tono: 'alerta',
        texto: `${resultado.incompletas} PO${resultado.incompletas !== 1 ? 's' : ''} con documentación incompleta`,
        subtexto: 'Requiere factura, BL, packing list y contenedor'
      }
    : { tono: 'ok', texto: 'Documentación completa', subtexto: 'Todas las POs tienen los 4 requisitos' };

  const filasFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return resultado.filas
      .filter((f) => {
        if (filtro === 'completas') return f.completa;
        if (filtro === 'incompletas') return !f.completa;
        return true;
      })
      .filter((f) => {
        if (!term) return true;
        return (
          f.po_tiquetera.toLowerCase().includes(term) ||
          f.exp_id.toLowerCase().includes(term) ||
          f.solicitante.toLowerCase().includes(term) ||
          f.numeroBl.toLowerCase().includes(term) ||
          f.numeroContenedor.toLowerCase().includes(term)
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
      'Solicitante': f.solicitante || '—',
      'Factura': f.tieneFactura ? 'Sí' : 'No',
      'BL': f.tieneBl ? 'Sí' : 'No',
      'N° BL': f.numeroBl || '-',
      'Packing List': f.tienePackingList ? 'Sí' : 'No',
      'Contenedor': f.tieneContenedor ? 'Sí' : 'No',
      'N° Contenedor': f.numeroContenedor || '-',
      'Documentación completa': f.completa ? 'Sí' : 'No',
      'Faltantes': f.faltantes.length > 0 ? f.faltantes.join(', ') : '-'
    }));
    descargarExcel(
      `reporte-documentacion-completa-${new Date().toISOString().split('T')[0]}.xlsx`,
      filas
    );
  };

  return (
    <>
      <PanelIndicador
        icono="ri-folder-check-line"
        tono={tono}
        titulo="Documentación Completa por PO"
        meta={
          <>
            POs en etapa de documentación (tickets no asignados + bandeja) con los 4 documentos:
            <strong> factura, BL, packing list y número de contenedor</strong>
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
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            <span className="text-sm">Calculando documentación de las POs...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <TarjetaDesglose
                etiqueta="Documentación Completa"
                valor={sinDatos ? '—' : resultado.porcentaje}
                sufijo={sinDatos ? undefined : '%'}
                valorClass={colorPct}
                barra={sinDatos ? null : { porcentaje: resultado.porcentaje, colorClass: colorBarra }}
                footer={`${resultado.total} PO${resultado.total !== 1 ? 's' : ''} en etapa de documentación`}
              />

              <TarjetaDesglose
                etiqueta="POs Completas"
                valor={resultado.completas}
                sufijo="PO"
                valorClass="text-teal-600"
                linea={{ icono: 'ri-checkbox-circle-fill', texto: 'Tienen los 4 requisitos', colorClass: 'text-teal-700' }}
                footer="Listas para avanzar"
                onClick={sinDatos ? undefined : () => { setFiltro('completas'); setDetalleAbierto(true); }}
              />

              <TarjetaDesglose
                etiqueta="POs Incompletas"
                valor={resultado.incompletas}
                sufijo="PO"
                valorClass={resultado.incompletas > 0 ? 'text-red-600' : 'text-gray-400'}
                linea={{
                  icono: 'ri-error-warning-fill',
                  texto: 'Falta al menos un documento',
                  colorClass: resultado.incompletas > 0 ? 'text-red-700' : 'text-gray-400'
                }}
                nota="Haz clic para ver el detalle"
                resaltado={resultado.incompletas > 0}
                onClick={sinDatos ? undefined : () => { setFiltro('incompletas'); setDetalleAbierto(true); }}
              />

              <TarjetaDesglose
                etiqueta="Cobertura de Requisitos"
                valor={sinDatos ? '—' : Math.round(((resultado.conFactura + resultado.conBl + resultado.conPackingList + resultado.conContenedor) / (resultado.total * 4)) * 100)}
                sufijo={sinDatos ? undefined : '%'}
                valorClass="text-gray-800"
                linea={{ icono: 'ri-bar-chart-box-line', texto: 'Promedio de los 4 requisitos', colorClass: 'text-gray-600' }}
                footer="Cada requisito pesa igual"
              />
            </div>

            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              {REQUISITOS.map((req) => {
                const cantidad = resultado[req.clave];
                const pct = resultado.total > 0 ? Math.round((cantidad / resultado.total) * 100) : 0;
                return (
                  <div key={req.clave} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <i className={`${req.icono} text-gray-500`}></i>
                        <span className="text-xs font-semibold text-gray-700 truncate">{req.etiqueta}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-800 whitespace-nowrap">{cantidad}/{resultado.total}</span>
                    </div>
                    <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-teal-500 transition-all duration-700" style={{ width: `${pct}%` }}></div>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{pct}% de las POs</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PanelIndicador>

      {detalleAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Detalle de Documentación por PO</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Factura, BL, packing list y contenedor de cada PO en etapa de documentación
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.total}</p>
                  <p className="text-xs text-gray-500">POs evaluadas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-600">{resultado.completas}</p>
                  <p className="text-xs text-gray-500">Completas</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${resultado.incompletas > 0 ? 'text-red-600' : 'text-gray-400'}`}>{resultado.incompletas}</p>
                  <p className="text-xs text-gray-500">Incompletas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.porcentaje}%</p>
                  <p className="text-xs text-gray-500">Cumplimiento</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3 flex-shrink-0">
              <div className="flex gap-2">
                {(['todas', 'completas', 'incompletas'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      filtro === f
                        ? f === 'incompletas'
                          ? 'bg-red-500 text-white'
                          : f === 'completas'
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'todas'
                      ? `Todas (${resultado.total})`
                      : f === 'completas'
                      ? `Completas (${resultado.completas})`
                      : `Incompletas (${resultado.incompletas})`}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[220px] max-w-sm ml-auto">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar PO, EXP ID, BL o contenedor..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Factura</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">BL</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Packing List</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Contenedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">N° BL / Contenedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filasFiltradas.map((fila: FilaDocumentacionPo) => (
                    <tr key={fila.id} className={`hover:bg-gray-50 transition-colors ${!fila.completa ? 'bg-red-50/30' : ''}`}>
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
                      <td className="px-4 py-3 text-center"><Marca activo={fila.tieneFactura} /></td>
                      <td className="px-4 py-3 text-center"><Marca activo={fila.tieneBl} /></td>
                      <td className="px-4 py-3 text-center"><Marca activo={fila.tienePackingList} /></td>
                      <td className="px-4 py-3 text-center"><Marca activo={fila.tieneContenedor} /></td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-700 whitespace-nowrap">{fila.numeroBl || '—'}</p>
                        <p className="text-xs text-gray-500 whitespace-nowrap">{fila.numeroContenedor || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {fila.completa ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full whitespace-nowrap">
                            <i className="ri-checkbox-circle-fill"></i> Completa
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full whitespace-nowrap">
                              <i className="ri-close-circle-fill"></i> Incompleta
                            </span>
                            <p className="text-[11px] text-gray-500 mt-1 max-w-[180px]">Falta: {fila.faltantes.join(', ')}</p>
                          </div>
                        )}
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