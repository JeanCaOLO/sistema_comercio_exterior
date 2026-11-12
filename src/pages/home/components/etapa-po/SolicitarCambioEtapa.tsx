import { useState } from 'react';
import {
  buscarPurchaseOrder,
  diagnosticarEtapaRaga,
  normalizarListaPos,
  RAGA_ENV_LABEL,
  type RagaEnv,
} from '@/lib/ragaApi';
import {
  detectarEtapa,
  obtenerPendienteEtapa,
  crearSolicitudEtapa,
  MOTIVOS_CAMBIO_ETAPA,
  type DeteccionEtapa,
} from '@/lib/etapaPo';

interface SolicitarCambioEtapaProps {
  usuarioId: string;
  usuarioNombre: string;
  puedeElegirEntorno: boolean;
}

function campo(po: Record<string, any> | null, ...claves: string[]): any {
  if (!po) return null;
  for (const k of claves) {
    const v = po[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function mensajeDeError(err: unknown): string {
  if (!err) return 'No se pudo registrar la solicitud.';
  if (err instanceof Error && err.message) {
    if (/duplicate key|unique/i.test(err.message)) {
      return 'Ya existe una solicitud pendiente de aprobación para esta PO.';
    }
    return err.message;
  }
  return 'No se pudo registrar la solicitud.';
}

export default function SolicitarCambioEtapa({
  usuarioId,
  usuarioNombre,
  puedeElegirEntorno,
}: SolicitarCambioEtapaProps) {
  const [entorno, setEntorno] = useState<RagaEnv>('production');
  const entornoActivo: RagaEnv = puedeElegirEntorno ? entorno : 'production';

  const [poInput, setPoInput] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [listaPos, setListaPos] = useState<Record<string, any>[]>([]);
  const [indice, setIndice] = useState(0);

  const [etapaNuevaId, setEtapaNuevaId] = useState('');
  const [etapaNuevaNombre, setEtapaNuevaNombre] = useState('');
  const [motivo, setMotivo] = useState('');
  const [otroDetalle, setOtroDetalle] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [exito, setExito] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [mostrarDiagnostico, setMostrarDiagnostico] = useState(false);
  const [cargandoDiagnostico, setCargandoDiagnostico] = useState(false);
  const [camposEtapaRaga, setCamposEtapaRaga] = useState<Record<string, string> | null>(null);
  const [errorDiagnostico, setErrorDiagnostico] = useState('');

  const po = listaPos[indice] || null;
  const orderNumber = String(campo(po, 'order_number', 'po_number') || poInput || '');
  const tradingCompany = String(campo(po, 'trading_company') || '');
  const deteccion: DeteccionEtapa = detectarEtapa(po);
  const hayCatalogo = deteccion.opciones.length > 0;

  const etapaSeleccionada = hayCatalogo
    ? deteccion.opciones.find((o) => o.id === etapaNuevaId) || null
    : null;
  const nombreDestino = hayCatalogo
    ? (etapaSeleccionada?.nombre || '')
    : etapaNuevaNombre.trim();

  const limpiarFormulario = () => {
    setEtapaNuevaId('');
    setEtapaNuevaNombre('');
    setMotivo('');
    setOtroDetalle('');
    setErrorForm('');
  };

  const cambiarEntorno = (nuevo: RagaEnv) => {
    if (!puedeElegirEntorno || nuevo === entornoActivo) return;
    setEntorno(nuevo);
    setListaPos([]);
    setIndice(0);
    setErrorBusqueda('');
    setExito('');
    limpiarFormulario();
  };

  const buscar = async () => {
    const numero = poInput.trim();
    if (!numero) {
      setErrorBusqueda('Ingresá un número de PO para buscar.');
      return;
    }
    setBuscando(true);
    setErrorBusqueda('');
    setExito('');
    limpiarFormulario();
    setListaPos([]);
    setCamposEtapaRaga(null);
    setErrorDiagnostico('');
    setMostrarDiagnostico(false);

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

  const cargarDiagnostico = async () => {
    if (mostrarDiagnostico) {
      setMostrarDiagnostico(false);
      return;
    }
    setMostrarDiagnostico(true);
    if (camposEtapaRaga || !orderNumber) return;
    setCargandoDiagnostico(true);
    setErrorDiagnostico('');
    const res = await diagnosticarEtapaRaga(orderNumber, entornoActivo);
    setCargandoDiagnostico(false);
    if (!res.ok || !res.data) {
      setErrorDiagnostico(res.error || 'No se pudieron leer los campos de etapa.');
      return;
    }
    setCamposEtapaRaga(res.data.campos_etapa || {});
  };

  const validar = async (): Promise<string> => {
    if (!orderNumber) return 'No hay una PO válida seleccionada.';
    if (!deteccion.campoEtapa) {
      return 'No se pudo identificar el campo de etapa en la PO. Revisá la información de la orden o consultá con el administrador.';
    }
    if (!etapaNuevaId.trim()) return 'Seleccioná la etapa destino.';
    if (!nombreDestino) return 'Indicá el nombre de la etapa destino.';
    const mismoId = deteccion.valorActualId && deteccion.valorActualId === etapaNuevaId.trim();
    const mismoNombre = deteccion.nombreActual
      && deteccion.nombreActual.trim().toLowerCase() === nombreDestino.toLowerCase();
    if (mismoId || mismoNombre) return 'La etapa destino debe ser diferente a la etapa actual.';
    if (!motivo) return 'Seleccioná el motivo del cambio.';
    if (motivo === 'Otro' && !otroDetalle.trim()) return 'Especificá el motivo del cambio.';

    const pendiente = await obtenerPendienteEtapa(orderNumber, tradingCompany, entornoActivo);
    if (pendiente) return 'Ya existe una solicitud pendiente para esta PO en este entorno.';
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
      await crearSolicitudEtapa({
        order_number: orderNumber,
        trading_company: tradingCompany,
        campo_etapa: deteccion.campoEtapa || 'kanban_status_id',
        etapa_actual_id: deteccion.valorActualId,
        etapa_actual_nombre: deteccion.nombreActual,
        etapa_nueva_id: etapaNuevaId.trim(),
        etapa_nueva_nombre: nombreDestino,
        change_reason: motivo,
        other_reason_detail: motivo === 'Otro' ? otroDetalle.trim() : null,
        requested_by: usuarioId || null,
        requested_by_name: usuarioNombre || null,
        api_env: entornoActivo,
      });
      setConfirmando(false);
      setExito('Solicitud registrada. Queda pendiente de aprobación. La etapa en Raga NO se modificó.');
      setPoInput('');
      setListaPos([]);
      limpiarFormulario();
    } catch (err) {
      setConfirmando(false);
      setErrorForm(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Búsqueda */}
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
            {entornoActivo === 'production' ? (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <i className="ri-alert-line text-red-600 mt-0.5"></i>
                <p className="text-xs text-red-700">
                  Estás consultando <strong>Producción</strong>. Las aprobaciones mueven POs reales de etapa.
                </p>
              </div>
            ) : (
              <div className="mt-3 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <i className="ri-flask-line text-teal-600 mt-0.5"></i>
                <p className="text-xs text-teal-700">
                  Modo <strong>QA</strong>: los cambios se prueban en el ambiente de pruebas de Raga y no afectan Producción.
                </p>
              </div>
            )}
          </div>
        )}

        <h2 className="text-lg font-semibold text-gray-900 mb-1">Buscar orden de compra</h2>
        <p className="text-sm text-gray-500 mb-4">
          Consultá la PO en Raga para ver su etapa actual y elegir la etapa destino.
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
        <>
          {listaPos.length > 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">
                Se encontraron {listaPos.length} órdenes con ese número. Seleccioná la correcta:
              </p>
              <div className="flex flex-wrap gap-2">
                {listaPos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => { setIndice(i); limpiarFormulario(); }}
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

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Mover de etapa</h2>
                <p className="text-sm text-gray-500">
                  El cambio se aplica en Raga solo cuando un Administrador lo aprueba.
                </p>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                  entornoActivo === 'production' ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'
                }`}
              >
                {RAGA_ENV_LABEL[entornoActivo]}
              </span>
            </div>

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
                  <label className="block text-sm font-medium text-red-600 mb-1.5">Etapa actual</label>
                  <div className="w-full px-4 py-2.5 border-2 border-red-300 bg-red-50 rounded-lg">
                    <p className="text-sm font-bold text-red-700">
                      {deteccion.nombreActual || deteccion.valorActualId || 'Sin etapa registrada'}
                    </p>
                    {deteccion.valorActualId && (
                      <p className="text-xs text-red-600 mt-0.5">Valor en Raga: {deteccion.valorActualId}</p>
                    )}
                  </div>
                </div>

                <div>
                  <button
                    onClick={cargarDiagnostico}
                    className="text-xs font-medium text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <i className={mostrarDiagnostico ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                    {mostrarDiagnostico ? 'Ocultar campos de etapa de Raga' : 'Ver campos de etapa que devuelve Raga'}
                  </button>

                  {mostrarDiagnostico && (
                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      {cargandoDiagnostico ? (
                        <p className="text-xs text-gray-500">
                          <i className="ri-loader-4-line animate-spin mr-1"></i>Consultando Raga...
                        </p>
                      ) : errorDiagnostico ? (
                        <p className="text-xs text-red-600">{errorDiagnostico}</p>
                      ) : (
                        <>
                          <p className="text-xs font-semibold text-gray-700 mb-1.5">Campos relacionados con la etapa</p>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {Object.entries(camposEtapaRaga || {}).map(([clave, valor]) => (
                              <div key={clave} className="flex items-start justify-between gap-2 text-xs">
                                <span className="font-mono text-gray-500 break-all">{clave}</span>
                                <span className="font-mono text-gray-900 text-right break-all">{valor}</span>
                              </div>
                            ))}
                            {Object.keys(camposEtapaRaga || {}).length === 0 && (
                              <p className="text-xs text-gray-500">Raga no devolvió campos de etapa reconocibles en esta PO.</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Etapa destino <span className="text-red-500">*</span>
                  </label>
                  {hayCatalogo ? (
                    <select
                      value={etapaNuevaId}
                      onChange={(e) => setEtapaNuevaId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                    >
                      <option value="">Seleccioná una etapa...</option>
                      {deteccion.opciones.map((o) => (
                        <option key={`${o.id}-${o.nombre}`} value={o.id}>{o.nombre}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={etapaNuevaId}
                        onChange={(e) => setEtapaNuevaId(e.target.value)}
                        placeholder="ID de la etapa en Raga"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      />
                      <input
                        value={etapaNuevaNombre}
                        onChange={(e) => setEtapaNuevaNombre(e.target.value)}
                        placeholder="Nombre de la etapa"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      />
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <i className="ri-information-line mr-1"></i>
                        Raga no devolvió el catálogo de etapas en esta PO. Ingresá el ID y el nombre de la etapa destino.
                      </p>
                    </div>
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
                    <option value="">Seleccioná un motivo...</option>
                    {MOTIVOS_CAMBIO_ETAPA.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {motivo === 'Otro' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Especificá el motivo <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={otroDetalle}
                      onChange={(e) => setOtroDetalle(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Describí el motivo del cambio de etapa"
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

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-gray-500">
                <i className="ri-route-line mr-1"></i>
                La etapa se lee de la PO: campo <span className="font-mono">{deteccion.campoEtapa || 'no detectado'}</span>
                {deteccion.campoLista && (
                  <> · catálogo <span className="font-mono">{deteccion.campoLista}</span></>
                )}
              </p>
              <button
                onClick={abrirConfirmacion}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-send-plane-line mr-2"></i>Enviar solicitud
              </button>
            </div>
          </div>
        </>
      )}

      {confirmando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmar solicitud</h3>
            <p className="text-sm text-gray-600 mb-4">
              Se registrará un cambio de etapa para la PO <strong>{orderNumber}</strong>:
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">Etapa actual</span>
                <span className="font-medium text-gray-900 text-right">
                  {deteccion.nombreActual || deteccion.valorActualId || 'Sin etapa'}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">Etapa solicitada</span>
                <span className="font-medium text-teal-700 text-right">{nombreDestino}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">Motivo</span>
                <span className="font-medium text-gray-900 text-right">
                  {motivo === 'Otro' ? otroDetalle.trim() : motivo}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">Entorno</span>
                <span className={`font-semibold ${entornoActivo === 'production' ? 'text-red-700' : 'text-teal-700'}`}>
                  {RAGA_ENV_LABEL[entornoActivo]}
                </span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4">
              <i className="ri-shield-check-line mr-1"></i>
              La etapa no se moverá en Raga hasta que un Administrador apruebe la solicitud.
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
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