import { useEffect, useState } from 'react';
import type { Estado, FilaComparada, ResultadoComparacion } from '@/lib/comparadorDocumentos';
import {
  exportarResultadoExcel,
  formatearMonto,
  formatearNumero,
  seccionATexto,
  tablaATexto,
} from '@/lib/comparadorDocumentos';
import PanelEnviarProveedor from './PanelEnviarProveedor';

interface ResultadoComparadorProps {
  resultado: ResultadoComparacion;
  tolerancia: number;
  nombreArchivo?: string;
  factura?: string;
  po?: string;
  onTolerancia: (valor: number) => void;
  onNueva: () => void;
}

type Filtro = 'dif' | 'soloA' | 'soloB' | 'qty' | 'uni' | 'pre' | 'ok' | 'rep' | 'all';

const ETIQUETAS_ESTADO: Record<Estado, { texto: string; clase: string }> = {
  soloA: { texto: 'Solo en factura', clase: 'bg-red-50 text-red-700 border-red-200' },
  soloB: { texto: 'Solo en PO', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  qty: { texto: 'Cantidad', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  uni: { texto: 'Unidad', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  pre: { texto: 'Precio', clase: 'bg-red-50 text-red-700 border-red-200' },
};

export default function ResultadoComparador({ resultado, tolerancia, nombreArchivo = 'comparacion', factura = '', po = '', onTolerancia, onNueva }: ResultadoComparadorProps) {
  const [filtro, setFiltro] = useState<Filtro>('dif');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [avisoExcel, setAvisoExcel] = useState<string | null>(null);
  const [panelProveedor, setPanelProveedor] = useState(false);

  const { conteo } = resultado;

  useEffect(() => {
    setFiltro(resultado.conteo.dif ? 'dif' : 'all');
  }, [resultado]);

  const copiar = async (texto: string, clave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
    } catch {
      setCopiado('error');
    }
    setTimeout(() => setCopiado(null), 2000);
  };

  const filtrar = (fila: FilaComparada) => {
    if (filtro === 'all') return true;
    if (filtro === 'dif') return fila.estados.length > 0;
    if (filtro === 'ok') return fila.estados.length === 0;
    if (filtro === 'rep') return fila.na > 1 || fila.nb > 1;
    return fila.estados.includes(filtro);
  };

  const visibles = resultado.filas.filter(filtrar);
  const limitadas = visibles.slice(0, 2000);

  const chips: { clave: Filtro; texto: string; valor: number }[] = [
    { clave: 'dif', texto: 'Con diferencias', valor: conteo.dif },
    { clave: 'soloA', texto: 'Solo en factura de proveedor', valor: conteo.soloA },
    { clave: 'soloB', texto: 'Solo en PO de Siglo', valor: conteo.soloB },
    { clave: 'qty', texto: 'Bultos distintos', valor: conteo.qty },
    { clave: 'uni', texto: 'Unidad distinta', valor: conteo.uni },
    { clave: 'pre', texto: 'Precio distinto', valor: conteo.pre },
    { clave: 'ok', texto: 'Sin diferencias', valor: conteo.ok },
    { clave: 'rep', texto: 'Repetidas', valor: conteo.rep },
    { clave: 'all', texto: 'Todos', valor: conteo.all },
  ];

  const hallazgos = [
    conteo.soloA ? `${conteo.soloA} referencia(s) están solo en la factura de proveedor y no en el PO de Siglo` : '',
    conteo.soloB ? `${conteo.soloB} referencia(s) están solo en el PO de Siglo y no en la factura` : '',
    conteo.qty ? `${conteo.qty} con bultos/cantidad distintos` : '',
    conteo.uni ? `${conteo.uni} con unidad distinta` : '',
    conteo.pre ? `${conteo.pre} con precio unitario distinto` : '',
  ].filter(Boolean);

  const resumen = [
    { texto: 'En ambos documentos', valor: conteo.ambos, icon: 'ri-links-line', clase: 'text-teal-600 bg-teal-50' },
    { texto: 'Solo en factura', valor: conteo.soloA, icon: 'ri-file-excel-2-line', clase: 'text-red-600 bg-red-50' },
    { texto: 'Solo en PO Siglo', valor: conteo.soloB, icon: 'ri-file-list-3-line', clase: 'text-amber-600 bg-amber-50' },
    { texto: 'Con diferencias', valor: conteo.dif, icon: 'ri-error-warning-line', clase: 'text-amber-700 bg-amber-50' },
  ];

  const exportarExcel = () => {
    try {
      exportarResultadoExcel(resultado, nombreArchivo);
      setAvisoExcel('Excel generado');
    } catch {
      setAvisoExcel('No se pudo generar el Excel');
    }
    setTimeout(() => setAvisoExcel(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Banner de resultado */}
      {conteo.dif ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
              <i className="ri-error-warning-line text-lg"></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                Se encontraron diferencias en {conteo.dif} referencia(s)
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-amber-800">
                {hallazgos.map((texto) => (
                  <li key={texto} className="flex items-start gap-1.5">
                    <i className="ri-subtract-line mt-0.5 flex-shrink-0"></i>
                    <span>{texto}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 flex items-start gap-3">
          <span className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
            <i className="ri-checkbox-circle-line text-lg"></i>
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Todo coincide: las {conteo.ambos} referencias están en ambos documentos
              {resultado.comparaCantidad ? ' con la misma cantidad,' : ''}
              {resultado.comparaUnidad ? ' la misma unidad y' : ''} el mismo precio.
            </p>
            {conteo.rep > 0 && (
              <p className="mt-1 text-xs text-amber-700">
                Ojo: hay {conteo.rep} referencia(s) repetida(s), revísalas abajo (no se eliminaron).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Resumen numérico y totales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {resumen.map((item) => (
          <div key={item.texto} className="bg-white border border-gray-200 rounded-xl px-3 py-3 flex items-center gap-3">
            <span className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${item.clase}`}>
              <i className={`${item.icon} text-lg`}></i>
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold text-gray-900 leading-tight">{item.valor}</p>
              <p className="text-[11px] text-gray-500 truncate">{item.texto}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">Factura:</span> {resultado.refsA} referencias
          {resultado.comparaCantidad && resultado.comparaPrecio ? ` · total ${formatearMonto(resultado.totalA)}` : ''}
        </p>
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">PO Siglo:</span> {resultado.refsB} referencias
          {resultado.comparaCantidad && resultado.comparaPrecio ? ` · total ${formatearMonto(resultado.totalB)}` : ''}
        </p>
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">Repetidas:</span> {resultado.repetidasA} en factura · {resultado.repetidasB} en PO
        </p>
        {resultado.comparaCantidad && resultado.comparaPrecio && (
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">Diferencia de monto:</span> {formatearMonto(resultado.totalB - resultado.totalA)}
          </p>
        )}
        {!resultado.comparaCantidad && <p className="text-xs text-amber-700">No se encontró cantidad en ambos documentos</p>}
        {!resultado.comparaPrecio && <p className="text-xs text-amber-700">No se encontró precio en ambos documentos</p>}
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
          <label htmlFor="tolerancia" className="text-xs text-gray-500 whitespace-nowrap">Tolerancia de precio</label>
          <input
            id="tolerancia"
            type="number"
            min={0}
            step={0.01}
            value={tolerancia}
            onChange={(event) => onTolerancia(Math.max(0, Number(event.target.value) || 0))}
            className="w-20 text-sm text-gray-800 border border-gray-300 rounded-md px-2 py-1"
          />
        </div>
        <button
          type="button"
          onClick={() => copiar(resultado.secciones.map(seccionATexto).join('\n\n'), 'todo')}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-file-copy-line"></i>
          {copiado === 'todo' ? '¡Copiado!' : 'Copiar todo el reporte'}
        </button>
        <button
          type="button"
          onClick={exportarExcel}
          title="Descarga un Excel con el resumen, cada hallazgo y la comparación completa"
          className="flex items-center gap-2 px-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-file-excel-2-line"></i>
          {avisoExcel ?? 'Exportar a Excel'}
        </button>
        <button
          type="button"
          onClick={() => setPanelProveedor(true)}
          title="Descarga el reporte en PDF y prepara el correo para el proveedor"
          className="flex items-center gap-2 px-3 py-2 bg-white border border-red-300 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-file-pdf-2-line"></i>
          PDF y enviar al proveedor
        </button>
        <button
          type="button"
          onClick={onNueva}
          className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-restart-line"></i>
          Nueva comparación
        </button>
      </div>

      {/* Reporte por hallazgo */}
      {resultado.secciones.map((seccion, indice) => (
        <section key={seccion.titulo} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">{seccion.titulo}</p>
            <button
              type="button"
              onClick={() => copiar(seccionATexto(seccion), `sec-${indice}`)}
              className="flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 font-medium cursor-pointer whitespace-nowrap"
            >
              <i className="ri-file-copy-line"></i>
              {copiado === `sec-${indice}` ? '¡Copiado!' : 'Copiar esta tabla'}
            </button>
          </header>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {seccion.encabezados.map((encabezado, columna) => (
                    <th
                      key={encabezado}
                      className={`font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap ${columna ? 'text-right' : 'text-left'}`}
                    >
                      {encabezado}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seccion.filas.map((fila, indiceFila) => (
                  <tr key={`${seccion.titulo}-${indiceFila}`} className="odd:bg-white even:bg-gray-50/60">
                    {fila.map((valor, columna) => (
                      <td
                        key={columna}
                        className={`px-3 py-1.5 border-b border-gray-50 whitespace-nowrap ${columna ? 'text-right text-gray-700' : 'text-left font-medium text-gray-900'}`}
                      >
                        {valor}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Comparación completa */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-800">Comparación completa</p>
            <p className="text-xs text-gray-500">Todas las referencias, con filtros por tipo de hallazgo</p>
          </div>
          <button
            type="button"
            onClick={() => copiar(tablaATexto(visibles), 'tabla')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-file-copy-line"></i>
            {copiado === 'tabla' ? '¡Copiado!' : 'Copiar tabla (Excel)'}
          </button>
        </header>

        <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-gray-100">
          {chips.map((chip) => (
            <button
              key={chip.clave}
              type="button"
              onClick={() => setFiltro(chip.clave)}
              className={`px-2.5 py-1 rounded-full border text-xs transition-colors cursor-pointer whitespace-nowrap ${
                filtro === chip.clave
                  ? 'bg-teal-600 border-teal-600 text-white font-medium'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-700'
              }`}
            >
              {chip.texto}: {chip.valor}
            </button>
          ))}
        </div>

        <div className="overflow-auto max-h-[520px]">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Referencia</th>
                <th className="text-left font-semibold text-gray-600 px-3 py-2 border-b border-gray-200">Descripción</th>
                <th className="text-left font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Estado</th>
                <th className="text-right font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Bultos factura</th>
                <th className="text-right font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Bultos PO</th>
                <th className="text-left font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">U/M</th>
                <th className="text-right font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Precio factura</th>
                <th className="text-right font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Precio PO</th>
                <th className="text-right font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Monto factura</th>
                <th className="text-right font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Monto PO</th>
                <th className="text-right font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Dif. monto</th>
                <th className="text-right font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Dif.</th>
                <th className="text-right font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Dif. %</th>
                <th className="text-left font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {limitadas.map((fila, indice) => {
                const tienePrecios = !isNaN(fila.pa) && !isNaN(fila.pb);
                const diferencia = tienePrecios ? fila.pb - fila.pa : NaN;
                const porcentaje = tienePrecios && fila.pa !== 0 ? (diferencia / fila.pa) * 100 : NaN;
                const marca = (estado: Estado) => (fila.estados.includes(estado) ? 'text-red-700 font-semibold' : 'text-gray-700');
                return (
                  <tr key={`${fila.ref}-${indice}`} className="odd:bg-white even:bg-gray-50/60">
                    <td className="px-3 py-1.5 border-b border-gray-50 font-semibold text-gray-900 whitespace-nowrap">{fila.ref}</td>
                    <td className="px-3 py-1.5 border-b border-gray-50 text-gray-500 min-w-[200px]">{fila.descripcion}</td>
                    <td className="px-3 py-1.5 border-b border-gray-50">
                      <div className="flex flex-wrap gap-1">
                        {fila.estados.length === 0 && (
                          <span className="px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium">OK</span>
                        )}
                        {fila.estados.map((estado) => (
                          <span key={estado} className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${ETIQUETAS_ESTADO[estado].clase}`}>
                            {ETIQUETAS_ESTADO[estado].texto}
                          </span>
                        ))}
                        {(fila.na > 1 || fila.nb > 1) && (
                          <span className="px-1.5 py-0.5 rounded border bg-gray-100 text-gray-600 border-gray-200 text-[10px] font-medium whitespace-nowrap">
                            Repetida (×{fila.na} / ×{fila.nb})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 py-1.5 border-b border-gray-50 text-right ${marca('qty')}`}>{formatearNumero(fila.qa)}</td>
                    <td className={`px-3 py-1.5 border-b border-gray-50 text-right ${marca('qty')}`}>{formatearNumero(fila.qb)}</td>
                    <td className={`px-3 py-1.5 border-b border-gray-50 whitespace-nowrap ${marca('uni')}`}>
                      {fila.ua || '—'} <span className="text-gray-300">/</span> {fila.ub || '—'}
                    </td>
                    <td className={`px-3 py-1.5 border-b border-gray-50 text-right ${marca('pre')}`}>{formatearMonto(fila.pa)}</td>
                    <td className={`px-3 py-1.5 border-b border-gray-50 text-right ${marca('pre')}`}>{formatearMonto(fila.pb)}</td>
                    <td className="px-3 py-1.5 border-b border-gray-50 text-right text-gray-700">{formatearMonto(fila.ma)}</td>
                    <td className="px-3 py-1.5 border-b border-gray-50 text-right text-gray-700">{formatearMonto(fila.mb)}</td>
                    <td className={`px-3 py-1.5 border-b border-gray-50 text-right whitespace-nowrap ${
                      !isNaN(fila.ma) && !isNaN(fila.mb) && Math.abs(fila.mb - fila.ma) > 0.005
                        ? 'text-red-700 font-semibold'
                        : 'text-gray-600'
                    }`}>
                      {!isNaN(fila.ma) && !isNaN(fila.mb) ? formatearMonto(fila.mb - fila.ma) : ''}
                    </td>
                    <td className="px-3 py-1.5 border-b border-gray-50 text-right text-gray-600">{formatearMonto(diferencia)}</td>
                    <td className="px-3 py-1.5 border-b border-gray-50 text-right text-gray-600">
                      {isNaN(porcentaje) ? '' : `${porcentaje.toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-1.5 border-b border-gray-50 text-gray-400 whitespace-nowrap">
                      {fila.fa} <span className="text-gray-300">/</span> {fila.fb}
                    </td>
                  </tr>
                );
              })}
              {!limitadas.length && (
                <tr>
                  <td colSpan={14} className="px-3 py-6 text-center text-gray-500">
                    No hay referencias en este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {visibles.length > 2000 && (
          <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
            Mostrando 2000 de {visibles.length} referencias. Usa los filtros para acotar el resultado.
          </p>
        )}
      </section>

      <PanelEnviarProveedor
        abierto={panelProveedor}
        onCerrar={() => setPanelProveedor(false)}
        resultado={resultado}
        factura={factura || nombreArchivo}
        po={po}
      />
    </div>
  );
}