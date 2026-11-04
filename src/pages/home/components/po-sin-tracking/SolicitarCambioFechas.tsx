import { useState } from 'react';
import {
  buscarPurchaseOrder,
  normalizarListaPos,
  normalizarFecha,
  RAGA_ENV_LABEL,
  type RagaEnv,
} from '@/lib/ragaApi';
import {
  crearSolicitudFechas,
  obtenerPendienteFechas,
  detectarCamposFecha,
  columnasSimplesPo,
  esValorFecha,
  MOTIVOS_CAMBIO_FECHAS,
  type CambioFecha,
} from '@/lib/cambiosFechasPo';
import { formatearFechaCorta } from '@/lib/fechas';
import TablaFechasPo, { type FilaFecha } from './TablaFechasPo';

interface SolicitarCambioFechasProps {
  usuarioId: string;
  usuarioNombre: string;
  puedeElegirEntorno?: boolean;
}

function mostrarValor(valor: string): string {
  if (!valor) return 'Sin fecha';
  if (esValorFecha(valor)) return formatearFechaCorta(valor.slice(0, 10));
  return valor;
}

function mensajeDeError(err: unknown): string {
  if (!err) return 'No se pudo registrar la solicitud.';
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string };
    const codigo = e.code || '';
    const mensaje = e.message || '';
    if (codigo === '42501' || /row-level security|violates row-level/i.test(mensaje)) {
      return 'No tienes permisos para registrar solicitudes de cambio de fechas. Contactá al administrador.';
    }
    if (codigo === '23505' || /duplicate key|unique/i.test(mensaje)) {
      return 'Ya existe una solicitud pendiente de cambio de fechas para esta PO.';
    }
    if (mensaje) return e.details ? `${mensaje} (${e.details})` : mensaje;
  }
  return 'No se pudo registrar la solicitud.';
}

export default function SolicitarCambioFechas({
  usuarioId,
  usuarioNombre,
  puedeElegirEntorno = false,
}: SolicitarCambioFechasProps) {
  const [entorno, setEntorno] = useState<RagaEnv>('production');
  const entornoActivo: RagaEnv = puedeElegirEntorno ? entorno : 'production';

  const [poInput, setPoInput] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [listaPos, setListaPos] = useState<Record<string, any>[]>([]);
  const [indice, setIndice] = useState(0);

  const [filas, setFilas] = useState<FilaFecha[]>([]);
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [otroDetalle, setOtroDetalle] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState('');

  const po = listaPos[indice] || null;
  const orderNumber = String(po?.order_number || po?.po_number || poInput || '');
  const tradingCompany = String(po?.trading_company || '');

  const construirFilas = (payload: Record<string, any> | null, todas: boolean, previas: FilaFecha[]): FilaFecha[] => {
    const catalogo = detectarCamposFecha(payload);
    const base = todas ? columnasSimplesPo(payload) : catalogo;
    const clavesFecha = new Set(catalogo.map((c) => c.clave).filter(Boolean));
    return base.map((c) => {
      // Se conserva lo que el usuario ya había marcado, buscando por clave
      // técnica y, si la columna no existe en la PO, por identificador.
      const anterior = previas.find(
        (p) => (c.clave && p.clave === c.clave) || (!c.clave && p.id === c.id)
      );
      return {
        id: c.id,
        clave: c.clave,
        etiqueta: c.etiqueta,
        valor: c.valor,
        incluida: c.disponible ? (anterior?.incluida ?? false) : false,
        nuevo: c.disponible ? (anterior?.nuevo ?? '') : '',
        esFechaDetectada: c.clave ? clavesFecha.has(c.clave) : false,
        disponible: c.disponible,
        columnaNueva: 'columnaNueva' in c ? Boolean((c as { columnaNueva?: boolean }).columnaNueva) : false,
      };
    });
  };

  const limpiarResultado = () => {
    setListaPos([]);
    setIndice(0);
    setFilas([]);
    setMostrarTodas(false);
    setMotivo('');
    setOtroDetalle('');
    setErrorForm('');
  };

  const cambiarEntorno = (nuevo: RagaEnv) => {
    if (!puedeElegirEntorno || nuevo === entornoActivo) return;
    setEntorno(nuevo);
    limpiarResultado();
    setErrorBusqueda('');
    setExito('');
  };

  const buscar = async () => {
    const numero = poInput.trim();
    if (!numero) {
      setErrorBusqueda('Ingresa un número de PO para buscar.');
      return;
    }
    setBuscando(true);
    setErrorBusqueda('');
    setExito('');
    limpiarResultado();

    const res = await buscarPurchaseOrder(numero, entornoActivo);
    setBuscando(false);
    if (!res.ok) {
      setErrorBusqueda(res.error || 'No se pudo consultar la PO en Raga.');
      return;
    }
    const lista = normalizarListaPos(res.data);
    if (lista.length === 0) {
      setErrorBusqueda(`No se encontró la PO "${numero}" en Raga.`);
      return;
    }
    setListaPos(lista);
    setIndice(0);
    setFilas(construirFilas(lista[0], false, []));
  };

  const seleccionarOrden = (nuevoIndice: number) => {
    setIndice(nuevoIndice);
    setFilas(construirFilas(listaPos[nuevoIndice], mostrarTodas, []));
  };

  const alternarTodas = () => {
    const siguiente = !mostrarTodas;
    setMostrarTodas(siguiente);
    setFilas((prev) => construirFilas(po, siguiente, prev));
  };

  const toggleFila = (id: string) => {
    setFilas((prev) => prev.map((f) => (
      f.id === id && f.disponible ? { ...f, incluida: !f.incluida } : f
    )));
  };

  const cambiarNuevo = (id: string, valor: string) => {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, nuevo: valor } : f)));
  };

  const seleccionarTodas = () => {
    setFilas((prev) => prev.map((f) => (f.disponible ? { ...f, incluida: true } : f)));
  };

  const limpiarSeleccion = () => {
    setFilas((prev) => prev.map((f) => ({ ...f, incluida: false, nuevo: '' })));
  };

  const cambiosSeleccionados = (): CambioFecha[] =>
    filas
      .filter((f) => f.incluida && f.nuevo && f.clave)
      .map((f) => ({
        campo: f.clave as string,
        etiqueta: f.etiqueta,
        valorAnterior: f.valor ? f.valor : null,
        valorNuevo: f.nuevo,
      }));

  const validar = async (): Promise<string> => {
    if (!orderNumber) return 'No hay una PO válida seleccionada.';
    const seleccionadasValidas = filas.filter((f) => f.incluida && f.disponible);
    if (seleccionadasValidas.length === 0) return 'Selecciona al menos una fecha para cambiar.';
    const sinValor = seleccionadasValidas.filter((f) => !f.nuevo);
    if (sinValor.length > 0) {
      return `Indica la nueva fecha de: ${sinValor.map((f) => f.etiqueta).join(', ')}.`;
    }
    const sinCambio = seleccionadas.filter((f) => {
      const actual = normalizarFecha(f.valor) || f.valor.trim();
      const nuevo = normalizarFecha(f.nuevo) || f.nuevo.trim();
      return actual === nuevo;
    });
    if (sinCambio.length > 0) {
      return `La nueva fecha debe ser diferente a la actual en: ${sinCambio.map((f) => f.etiqueta).join(', ')}.`;
    }
    if (!motivo) return 'Selecciona el motivo del cambio.';
    if (motivo === 'Otro' && !otroDetalle.trim()) return 'Debes especificar el motivo del cambio.';

    const pendiente = await obtenerPendienteFechas(orderNumber, tradingCompany, entornoActivo);
    if (pendiente) return 'Ya existe una solicitud pendiente de cambio de fechas para esta PO.';
    return '';
  };

  const abrirConfirmacion = async () => {
    setErrorForm('');
    setExito('');
    try {
      const err = await validar();
      if (err) {
        setErrorForm(err);
        return;
      }
      setConfirmando(true);
    } catch (e) {
      setErrorForm(mensajeDeError(e));
    }
  };

  const enviar = async () => {
    setEnviando(true);
    setErrorForm('');
    try {
      await crearSolicitudFechas({
        order_number: orderNumber,
        trading_company: tradingCompany,
        cambios: cambiosSeleccionados(),
        change_reason: motivo,
        other_reason_detail: motivo === 'Otro' ? otroDetalle.trim() : null,
        requested_by: usuarioId || null,
        requested_by_name: usuarioNombre || null,
        api_env: entornoActivo,
      });
      setConfirmando(false);
      setExito('Solicitud registrada. Queda pendiente de aprobación y la orden NO se modificó.');
      limpiarResultado();
      setPoInput('');
    } catch (err) {
      setConfirmando(false);
      setErrorForm(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const seleccionadas = filas.filter((f) => f.incluida && f.disponible);

  return (
    <div className="space-y-6">
      {/* Búsqueda de PO */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {puedeElegirEntorno && (
          <div className="mb-5 pb-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <i className="ri-server-line text-gray-500"></i>
                <span className="text-sm font-medium text-gray-700">Entorno de Raga</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    entornoActivo === 'production' ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'
                  }`}
                >
                  {RAGA_ENV_LABEL[entornoActivo]}
                </span>
              </div>
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-full w-fit">
                <button
                  onClick={() => cambiarEntorno('production')}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    entornoActivo === 'production' ? 'bg-red-600 text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <i className="ri-rocket-2-line mr-1"></i>Producción
                </button>
                <button
                  onClick={() => cambiarEntorno('qa')}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    entornoActivo === 'qa' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <i className="ri-flask-line mr-1"></i>QA
                </button>
              </div>
            </div>
            {entornoActivo === 'production' && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <i className="ri-alert-line text-red-600 mt-0.5"></i>
                <p className="text-xs text-red-700">
                  Estás operando sobre <strong>Producción</strong>. Las aprobaciones modificarán fechas reales de las órdenes.
                </p>
              </div>
            )}
          </div>
        )}

        <h2 className="text-lg font-semibold text-gray-900 mb-1">Buscar orden de compra</h2>
        <p className="text-sm text-gray-500 mb-4">
          Consultá la PO en Raga. Vas a ver las fechas que se pueden actualizar: carga lista teórica y su variable, ETD inicial, ETD, ATD, ETA inicial, ETA variable y ATA. Si la orden todavía no tiene alguna de esas fechas, igual podés cargarla.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={poInput}
            onChange={(e) => setPoInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
            placeholder="Ej: PO-2025-0021"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
          />
          <button
            onClick={buscar}
            disabled={buscando}
            className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buscando ? (
              <><i className="ri-loader-4-line animate-spin mr-2"></i>Buscando...</>
            ) : (
              <><i className="ri-search-line mr-2"></i>Buscar PO</>
            )}
          </button>
        </div>
        {errorBusqueda && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
            <p className="text-sm text-red-700">{errorBusqueda}</p>
          </div>
        )}
        {exito && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
            <i className="ri-checkbox-circle-line text-emerald-600 mt-0.5"></i>
            <p className="text-sm text-emerald-700">{exito}</p>
          </div>
        )}
      </div>

      {po && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {listaPos.length > 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">
                Se encontraron {listaPos.length} órdenes con ese número. Selecciona la correcta:
              </p>
              <div className="flex flex-wrap gap-2">
                {listaPos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => seleccionarOrden(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      i === indice
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                    }`}
                  >
                    {String(p.trading_company || `Orden ${i + 1}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
              <i className="ri-calendar-schedule-line text-lg"></i>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Cambio de fechas de la PO {orderNumber}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Solo se modificarán las fechas seleccionadas, y recién cuando un aprobador lo confirme.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Número de PO</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 break-words">{orderNumber || '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Compañía</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 break-words">{tradingCompany || '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Fechas seleccionadas</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{seleccionadas.length}</p>
            </div>
          </div>

          <TablaFechasPo
            filas={filas}
            onToggle={toggleFila}
            onCambiarNuevo={cambiarNuevo}
            onSeleccionarTodas={seleccionarTodas}
            onLimpiar={limpiarSeleccion}
            mostrarTodas={mostrarTodas}
            onToggleMostrarTodas={alternarTodas}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Motivo del cambio <span className="text-red-500">*</span>
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
              >
                <option value="">Selecciona un motivo...</option>
                {MOTIVOS_CAMBIO_FECHAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {motivo === 'Otro' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Especifique el motivo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={otroDetalle}
                  onChange={(e) => setOtroDetalle(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Describe el motivo del cambio"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
            )}
          </div>

          {errorForm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
              <p className="text-sm text-red-700">{errorForm}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={abrirConfirmacion}
              className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-send-plane-line mr-2"></i>
              Enviar solicitud de cambio
            </button>
          </div>
        </div>
      )}

      {/* Confirmación */}
      {confirmando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirmar solicitud de fechas</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                PO <strong>{orderNumber}</strong> · {tradingCompany}
              </p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Actual</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Nueva</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cambiosSeleccionados().map((c) => (
                      <tr key={c.campo}>
                        <td className="px-4 py-2.5 text-sm text-gray-800">{c.etiqueta}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{mostrarValor(c.valorAnterior || '')}</td>
                        <td className="px-4 py-2.5 text-sm font-semibold text-teal-700">{mostrarValor(c.valorNuevo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-gray-500">Motivo</span>
                <span className="font-medium text-gray-900 text-right">
                  {motivo === 'Otro' ? otroDetalle.trim() : motivo}
                </span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-gray-500">Entorno</span>
                <span className={`font-semibold ${entornoActivo === 'production' ? 'text-red-700' : 'text-teal-700'}`}>
                  {RAGA_ENV_LABEL[entornoActivo]}
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <i className="ri-shield-check-line mr-1"></i>
                No se modificará ninguna fecha en Raga hasta que un aprobador lo confirme.
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmando(false)}
                disabled={enviando}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={enviando}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {enviando ? (
                  <><i className="ri-loader-4-line animate-spin mr-2"></i>Enviando...</>
                ) : (
                  <><i className="ri-check-line mr-2"></i>Confirmar y enviar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}