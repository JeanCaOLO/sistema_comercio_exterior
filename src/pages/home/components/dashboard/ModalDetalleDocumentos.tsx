import { ReactNode, useEffect, useMemo, useState } from 'react';
import { descargarExcel } from '@/lib/exportar';
import { etiquetaModulo, type FilaDocumentacionPo } from '@/lib/kpisDocumentacion';

type FiltroDetalle = 'todas' | 'dropship' | 'zf' | 'sin-expediente';

interface ModalDetalleDocumentosProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  subtitulo: string;
  filas: FilaDocumentacionPo[];
  resumen: ReactNode;
  nombreArchivo: string;
  tono?: 'amber' | 'teal';
}

const Marca = ({ activo }: { activo: boolean }) => (
  <span
    className={`inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ${
      activo ? 'bg-teal-100 text-teal-700' : 'bg-red-50 text-red-400'
    }`}
  >
    <i className={activo ? 'ri-checkbox-circle-fill text-lg' : 'ri-close-circle-line text-lg'}></i>
  </span>
);

const ESTILOS = {
  amber: {
    boton: 'bg-amber-500 hover:bg-amber-600',
    filtroActivo: 'bg-amber-500 text-white',
    foco: 'focus:ring-amber-500',
    filaHover: 'hover:bg-amber-50/40'
  },
  teal: {
    boton: 'bg-teal-600 hover:bg-teal-700',
    filtroActivo: 'bg-teal-600 text-white',
    foco: 'focus:ring-teal-500',
    filaHover: 'hover:bg-teal-50/40'
  }
} as const;

export default function ModalDetalleDocumentos({
  abierto,
  onCerrar,
  titulo,
  subtitulo,
  filas,
  resumen,
  nombreArchivo,
  tono = 'amber'
}: ModalDetalleDocumentosProps) {
  const [filtro, setFiltro] = useState<FiltroDetalle>('todas');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (abierto) {
      setFiltro('todas');
      setBusqueda('');
    }
  }, [abierto]);

  const estilo = ESTILOS[tono];

  const filasFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return filas
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
  }, [busqueda, filas, filtro]);

  const contar = (clave: FiltroDetalle) => {
    if (clave === 'dropship')
      return filas.filter((f) => (f.tipo_modulo || '').toLowerCase() === 'dropship').length;
    if (clave === 'zf') return filas.filter((f) => (f.tipo_modulo || '').toLowerCase() === 'zf').length;
    if (clave === 'sin-expediente') return filas.filter((f) => f.sinExpediente).length;
    return filas.length;
  };

  const descargar = () => {
    const datos = filasFiltradas.map((f) => ({
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
    descargarExcel(nombreArchivo, datos);
  };

  if (!abierto) return null;

  const etiquetaFiltro: Record<FiltroDetalle, string> = {
    todas: `Todas (${contar('todas')})`,
    dropship: `Dropship (${contar('dropship')})`,
    zf: `ZF (${contar('zf')})`,
    'sin-expediente': `Sin expediente (${contar('sin-expediente')})`
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
            <p className="text-sm text-gray-500 mt-1">{subtitulo}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={descargar}
              disabled={filasFiltradas.length === 0}
              className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${estilo.boton}`}
            >
              <i className="ri-download-2-line"></i>
              Descargar Excel
            </button>
            <button
              onClick={onCerrar}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-2xl text-gray-500"></i>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{resumen}</div>
        </div>

        <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {(['todas', 'dropship', 'zf', 'sin-expediente'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filtro === f ? estilo.filtroActivo : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {etiquetaFiltro[f]}
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
              className={`w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:border-transparent ${estilo.foco}`}
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
              {filasFiltradas.map((fila) => (
                <tr key={fila.id} className={`transition-colors ${estilo.filaHover}`}>
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
                      {fila.faltantes.length === 0 ? (
                        <span className="inline-block px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-[11px] font-medium whitespace-nowrap">
                          Documentación completa
                        </span>
                      ) : (
                        fila.faltantes.map((doc) => (
                          <span
                            key={doc}
                            className="inline-block px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-[11px] font-medium whitespace-nowrap"
                          >
                            {doc}
                          </span>
                        ))
                      )}
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
  );
}