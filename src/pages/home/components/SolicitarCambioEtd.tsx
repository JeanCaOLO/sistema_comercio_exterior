import { useState } from 'react';
import { buscarPurchaseOrder, normalizarListaPos, normalizarFecha, RAGA_ENV_LABEL, type RagaEnv } from '@/lib/ragaApi';
import { crearSolicitudEtd, obtenerSolicitudPendienteEtd } from '@/lib/etdCambios';
import { MOTIVOS_CAMBIO_ETD, humanizarClave } from '@/lib/etdMotivos';
import { formatearFechaCorta } from '@/lib/fechas';

interface SolicitarCambioEtdProps {
  usuarioId: string;
  usuarioNombre: string;
  puedeElegirEntorno?: boolean;
}

// Extrae el primer valor no vacío entre varias posibles claves.
function campo(po: Record<string, any> | null, ...claves: string[]): any {
  if (!po) return null;
  for (const k of claves) {
    const v = po[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

// Claves puramente técnicas que no aportan nada al usuario final (ids, auditoría, etc.).
const CLAVES_TECNICAS = new Set([
  'id', 'uuid', 'index', 'action_type', 'old_values', 'new_values',
  'created_at', 'updated_at', 'deleted_at', 'order_id', 'status_id', 'kanban_status_id',
]);

function esClaveTecnica(clave: string): boolean {
  const k = String(clave).trim().toLowerCase();
  return CLAVES_TECNICAS.has(k) || k.endsWith('_id') || k.endsWith('_at');
}

// Convierte un texto tipo ISO (2026-10-07T12:02:49.000000Z) en algo legible.
function formatearTextoFecha(texto: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(texto);
  if (!iso) return null;
  const [, anio, mes, dia, hora, minuto] = iso;
  // Si la hora es 00:00 se trata como fecha pura (evita el corrimiento por zona horaria).
  if (hora === '00' && minuto === '00') return `${dia}/${mes}/${anio}`;
  return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
}

// Convierte cualquier valor de la PO en un texto legible: nunca muestra JSON crudo.
function renderValor(v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    if (v.every((x) => x === null || typeof x !== 'object')) {
      return v.map((x) => String(x)).join(', ');
    }
    const partes = v
      .map((x) => renderValor(x))
      .filter((t) => t && t !== '—');
    if (partes.length === 0) return '—';
    return partes.length === 1 ? partes[0] : partes.map((t, i) => `${i + 1}. ${t}`).join(' · ');
  }
  if (typeof v === 'object') {
    const partes = Object.entries(v)
      .filter(([k, val]) => !esClaveTecnica(k) && val !== null && val !== undefined && val !== '')
      .map(([k, val]) => {
        const contenido = renderValor(val);
        return contenido === '—' ? '' : `${humanizarClave(k)}: ${contenido}`;
      })
      .filter(Boolean);
    return partes.length > 0 ? partes.join(' · ') : '—';
  }
  const texto = String(v).trim();
  const fecha = formatearTextoFecha(texto);
  if (fecha) return fecha;
  // Si el valor llegó como texto con forma de JSON, lo parseamos y lo mostramos legible.
  if (/^[[{]/.test(texto)) {
    try {
      const parseado = JSON.parse(texto);
      if (parseado && typeof parseado === 'object') return renderValor(parseado);
    } catch {
      // No era JSON válido: lo mostramos como texto plano.
    }
  }
  return texto;
}

// Muestra un valor y, si es muy largo, permite expandirlo sin romper la tarjeta.
function ValorCampo({ valor }: { valor: any }) {
  const [abierto, setAbierto] = useState(false);
  const texto = renderValor(valor);
  const esLargo = texto.length > 120;
  return (
    <div>
      <p
        className={`mt-1 text-sm text-gray-800 break-words leading-relaxed ${
          esLargo && !abierto ? 'line-clamp-3' : ''
        }`}
      >
        {texto}
      </p>
      {esLargo && (
        <button
          onClick={() => setAbierto(!abierto)}
          className="mt-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer whitespace-nowrap"
        >
          {abierto ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
}

// Extrae un mensaje de error legible de cualquier forma de error (PostgREST, Error nativo, etc.).
function mensajeDeError(err: unknown): string {
  if (!err) return 'No se pudo registrar la solicitud.';
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string };
    const codigo = e.code || '';
    const mensaje = e.message || '';
    if (codigo === '42501' || /row-level security|violates row-level/i.test(mensaje)) {
      return 'No tienes permisos para registrar solicitudes de cambio ETD, o tu usuario no está vinculado correctamente. Contactá al administrador.';
    }
    if (codigo === '23505' || /duplicate key|unique/i.test(mensaje)) {
      return 'Ya existe una solicitud pendiente de aprobación para esta PO.';
    }
    if (codigo === '23502' || /null value|not-null/i.test(mensaje)) {
      return 'Faltan datos obligatorios para registrar la solicitud.';
    }
    if (mensaje) return e.details ? `${mensaje} (${e.details})` : mensaje;
  }
  return 'No se pudo registrar la solicitud.';
}

const CLAVES_RESALTADAS = new Set([
  'order_number', 'po_number', 'trading_company',
  'date_etd_initial', 'etd_initial', 'date_etd', 'etd',
]);

export default function SolicitarCambioEtd({ usuarioId, usuarioNombre, puedeElegirEntorno = false }: SolicitarCambioEtdProps) {
  // Producción es el entorno por defecto. QA queda como opción manual para pruebas
  // (solo visible para usuarios autorizados) y no se recuerda entre sesiones.
  const [entorno, setEntorno] = useState<RagaEnv>('production');
  const entornoActivo: RagaEnv = puedeElegirEntorno ? entorno : 'production';
  const [poInput, setPoInput] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [listaPos, setListaPos] = useState<Record<string, any>[]>([]);
  const [indice, setIndice] = useState(0);

  const [nuevoEtd, setNuevoEtd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [otroDetalle, setOtroDetalle] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState('');
  const [infoAbierta, setInfoAbierta] = useState(true);

  const po = listaPos[indice] || null;
  const orderNumber = String(campo(po, 'order_number', 'po_number') || poInput || '');
  const tradingCompany = String(campo(po, 'trading_company') || '');
  const etdInicial = normalizarFecha(campo(po, 'date_etd_initial', 'etd_initial'));
  const etdVariable = normalizarFecha(campo(po, 'date_etd', 'etd'));

  const otrosCampos = po
    ? Object.entries(po).filter(([k, v]) => {
        if (CLAVES_RESALTADAS.has(k)) return false;
        // Ocultamos ids, sellos de auditoría y campos sin contenido útil.
        if (esClaveTecnica(k)) return false;
        return renderValor(v) !== '—';
      })
    : [];

  const limpiarResultado = () => {
    setListaPos([]);
    setIndice(0);
    setNuevoEtd('');
    setMotivo('');
    setOtroDetalle('');
    setErrorForm('');
  };

  const cambiarEntorno = (nuevo: RagaEnv) => {
    if (!puedeElegirEntorno || nuevo === entornoActivo) return;
    setEntorno(nuevo);
    limpiarResultado();
    setListaPos([]);
    setIndice(0);
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
  };

  const validar = async (): Promise<string> => {
    if (!orderNumber) return 'No hay una PO válida seleccionada.';
    if (!nuevoEtd) return 'Selecciona el nuevo ETD Inicial propuesto.';
    if (etdInicial && nuevoEtd === etdInicial) return 'La nueva fecha debe ser diferente a la actual.';
    if (!motivo) return 'Selecciona el motivo del cambio.';
    if (motivo === 'Otro' && !otroDetalle.trim()) return 'Debes especificar el motivo del cambio.';

    const pendiente = await obtenerSolicitudPendienteEtd(orderNumber, tradingCompany, entornoActivo);
    if (pendiente) return 'Ya existe una solicitud pendiente de aprobación para esta PO.';
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
      await crearSolicitudEtd({
        order_number: orderNumber,
        trading_company: tradingCompany,
        previous_etd_initial: etdInicial || null,
        proposed_etd_initial: nuevoEtd,
        change_reason: motivo,
        other_reason_detail: motivo === 'Otro' ? otroDetalle.trim() : null,
        requested_by: usuarioId || null,
        requested_by_name: usuarioNombre || null,
        api_env: entornoActivo,
      });
      setConfirmando(false);
      setExito('Solicitud registrada. Queda pendiente de aprobación. El ETD Inicial vigente NO se modificó.');
      limpiarResultado();
      setPoInput('');
    } catch (err) {
      setConfirmando(false);
      setErrorForm(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* A. Búsqueda de PO */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {puedeElegirEntorno && (
          <div className="mb-5 pb-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <i className="ri-server-line text-gray-500"></i>
                <span className="text-sm font-medium text-gray-700">Entorno de Raga</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    entornoActivo === 'production'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-teal-100 text-teal-700'
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
                  Estás operando sobre <strong>Producción</strong> (next.ologistics.com). Las aprobaciones modificarán datos reales.
                </p>
              </div>
            )}
          </div>
        )}

        <h2 className="text-lg font-semibold text-gray-900 mb-1">Buscar orden de compra</h2>
        <p className="text-sm text-gray-500 mb-4">Consulta la PO en Raga por su número para cargar su información.</p>
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
        <>
          {/* Selector cuando hay varias POs con el mismo número */}
          {listaPos.length > 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">
                Se encontraron {listaPos.length} órdenes con ese número. Selecciona la correcta:
              </p>
              <div className="flex flex-wrap gap-2">
                {listaPos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setIndice(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      i === indice
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                    }`}
                  >
                    {String(campo(p, 'trading_company') || `Orden ${i + 1}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Solicitud de cambio (formulario) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Solicitud de Cambio ETD Inicial</h2>
            <p className="text-sm text-gray-500 mb-4">
              El ETD Inicial vigente no se modifica hasta que un aprobador autorizado confirme el cambio.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Número de PO</label>
                  <input value={orderNumber} readOnly className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Compañía</label>
                  <input value={tradingCompany} readOnly className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-600 mb-1.5">ETD Inicial actual</label>
                  <input value={etdInicial ? formatearFechaCorta(etdInicial) : 'Sin fecha'} readOnly className="w-full px-4 py-2.5 border-2 border-red-300 bg-red-50 rounded-lg text-sm font-bold text-red-700" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nuevo ETD Inicial propuesto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={nuevoEtd}
                    onChange={(e) => setNuevoEtd(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  />
                  {etdInicial && nuevoEtd && nuevoEtd !== etdInicial && (
                    <p className="text-xs text-teal-700 mt-1">
                      <i className="ri-information-line mr-1"></i>
                      Diferencia: {Math.round((new Date(nuevoEtd).getTime() - new Date(etdInicial).getTime()) / 86400000)} día(s). Queda como propuesta pendiente.
                    </p>
                  )}
                </div>
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
                    {MOTIVOS_CAMBIO_ETD.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                {motivo === 'Otro' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Especifique el motivo del cambio <span className="text-red-500">*</span>
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
            </div>

            {errorForm && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
                <p className="text-sm text-red-700">{errorForm}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={abrirConfirmacion}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-send-plane-line mr-2"></i>
                Enviar solicitud de cambio
              </button>
            </div>
          </div>

          {/* Información de la PO (panel desplegable) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setInfoAbierta(!infoAbierta)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <i className="ri-information-line text-teal-600 text-lg"></i>
                <h2 className="text-lg font-semibold text-gray-900">Información de la PO</h2>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    entornoActivo === 'production'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-teal-100 text-teal-700'
                  }`}
                >
                  {RAGA_ENV_LABEL[entornoActivo]}
                </span>
              </div>
              <i className={`${infoAbierta ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-xl text-gray-400`}></i>
            </button>

            {infoAbierta && (
              <div className="px-6 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium text-gray-500 uppercase">Número de PO</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{orderNumber || '—'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium text-gray-500 uppercase">Compañía</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{tradingCompany || '—'}</p>
                  </div>
                  <div className="rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3">
                    <p className="text-xs font-medium text-red-600 uppercase">ETD Inicial actual</p>
                    <p className="mt-1 text-base font-bold text-red-700">{etdInicial ? formatearFechaCorta(etdInicial) : 'Sin fecha'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500 uppercase">ETD Variable (no editable)</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{etdVariable ? formatearFechaCorta(etdVariable) : 'Sin fecha'}</p>
                  </div>
                </div>

                {otrosCampos.length > 0 && (
                  <>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Otros datos de la orden</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {otrosCampos.map(([k, v]) => (
                        <div key={k} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{humanizarClave(k)}</p>
                          <ValorCampo valor={v} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmación */}
      {confirmando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmar solicitud</h3>
            <p className="text-sm text-gray-600 mb-4">
              Se registrará una solicitud de cambio para la PO <strong>{orderNumber}</strong>:
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">ETD Inicial actual</span>
                <span className="font-medium text-gray-900">{etdInicial ? formatearFechaCorta(etdInicial) : 'Sin fecha'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Nuevo ETD solicitado</span>
                <span className="font-medium text-teal-700">{formatearFechaCorta(nuevoEtd)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Motivo</span>
                <span className="font-medium text-gray-900">{motivo === 'Otro' ? otroDetalle.trim() : motivo}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Entorno</span>
                <span className={`font-semibold ${entornoActivo === 'production' ? 'text-red-700' : 'text-teal-700'}`}>
                  {RAGA_ENV_LABEL[entornoActivo]}
                </span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4">
              <i className="ri-shield-check-line mr-1"></i>
              No se modificará el ETD Inicial en Raga hasta que un aprobador lo confirme.
            </div>
            <div className="flex items-center justify-end gap-3">
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