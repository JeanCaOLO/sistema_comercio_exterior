import { useMemo, useState } from 'react';
import {
  buscarPurchaseOrder,
  normalizarListaPos,
  normalizarFecha,
  clavesDePoCompletas,
  detectarClaveCampo,
  detectarCamposCargaLista,
  RAGA_ENV_LABEL,
  type RagaEnv,
} from '@/lib/ragaApi';
import {
  crearSolicitudCampo,
  obtenerPendienteCambio,
  TIPOS_CAMBIO,
  MOTIVOS_CAMBIO_CARGA_LISTA,
  MOTIVOS_CAMBIO_INCOTERM,
  INCOTERMS,
  INCOTERM_DESCRIPCIONES,
  type CambioCampo,
  type TipoCambioOrden,
} from '@/lib/cambiosOrden';
import { formatearFechaCorta } from '@/lib/fechas';
import {
  EditorPropuestasCargaLista,
  ListaValoresCargaLista,
  claveCargaLista,
  type PropuestasCargaLista,
} from './CamposCargaLista';

interface SolicitarCambioCampoProps {
  tipo: Extract<TipoCambioOrden, 'carga_lista' | 'incoterm'>;
  usuarioId: string;
  usuarioNombre: string;
  puedeElegirEntorno?: boolean;
}

const ETIQUETA_INCOTERM = 'Incoterm de compra';

function humanizarClave(clave: string): string {
  return clave
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function valorTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

// Si el valor es una fecha ISO, la mostramos corta; si no, tal cual.
function mostrarValor(valor: string | null): string {
  if (!valor) return 'Sin valor';
  const texto = valor.trim();
  if (/^true$/i.test(texto)) return 'Sí';
  if (/^false$/i.test(texto)) return 'No';
  const fecha = normalizarFecha(texto);
  if (fecha) return formatearFechaCorta(fecha);
  return texto;
}

function mensajeDeError(err: unknown): string {
  if (!err) return 'No se pudo registrar la solicitud.';
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string };
    const codigo = e.code || '';
    const mensaje = e.message || '';
    if (codigo === '42501' || /row-level security|violates row-level/i.test(mensaje)) {
      return 'No tienes permisos para registrar solicitudes de cambio. Contactá al administrador.';
    }
    if (codigo === '23505' || /duplicate key|unique/i.test(mensaje)) {
      return 'Ya existe una solicitud pendiente para esta PO y este tipo de cambio.';
    }
    if (codigo === '23502' || /null value|not-null/i.test(mensaje)) {
      return 'Faltan datos obligatorios para registrar la solicitud.';
    }
    if (mensaje) return e.details ? `${mensaje} (${e.details})` : mensaje;
  }
  return 'No se pudo registrar la solicitud.';
}

export default function SolicitarCambioCampo({
  tipo,
  usuarioId,
  usuarioNombre,
  puedeElegirEntorno = false,
}: SolicitarCambioCampoProps) {
  const config = TIPOS_CAMBIO[tipo];
  const motivos = tipo === 'incoterm' ? MOTIVOS_CAMBIO_INCOTERM : MOTIVOS_CAMBIO_CARGA_LISTA;

  const [entorno, setEntorno] = useState<RagaEnv>('production');
  const entornoActivo: RagaEnv = puedeElegirEntorno ? entorno : 'production';

  const [poInput, setPoInput] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [listaPos, setListaPos] = useState<Record<string, any>[]>([]);
  const [indice, setIndice] = useState(0);

  const [propuestas, setPropuestas] = useState<PropuestasCargaLista>({});
  const [claveManual, setClaveManual] = useState('');
  const [nuevoValor, setNuevoValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [otroDetalle, setOtroDetalle] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState('');

  const po = listaPos[indice] || null;
  const orderNumber = String(po?.order_number || po?.po_number || poInput || '');
  const tradingCompany = String(po?.trading_company || '');

  // Solo se editan las dos fechas del bloque de carga lista.
  const camposCargaLista = useMemo(
    () => (tipo === 'carga_lista' ? detectarCamposCargaLista(po) : []),
    [po, tipo]
  );

  // Cambios propuestos: únicamente los datos que el usuario completó.
  const cambiosCargaLista = useMemo<CambioCampo[]>(() => {
    if (tipo !== 'carga_lista') return [];
    return camposCargaLista.reduce<CambioCampo[]>((acc, c) => {
      const nuevo = (propuestas[c.id] || '').trim();
      if (!nuevo) return acc;
      acc.push({
        campo: claveCargaLista(c),
        etiqueta: c.etiqueta,
        valorAnterior: c.valor || null,
        valorNuevo: c.tipo === 'booleano' ? nuevo.toLowerCase() : nuevo,
      });
      return acc;
    }, []);
  }, [camposCargaLista, propuestas, tipo]);

  const claveIncoterm = claveManual || detectarClaveCampo(po, 'incoterm') || '';
  const valorActualIncoterm = po && claveIncoterm ? valorTexto(po[claveIncoterm]) : '';
  const clavesDisponibles = useMemo(() => clavesDePoCompletas(po), [po]);

  const resumen = tipo === 'carga_lista'
    ? cambiosCargaLista.map((c) => ({
      etiqueta: c.etiqueta,
      anterior: mostrarValor(c.valorAnterior),
      nuevo: mostrarValor(c.valorNuevo),
    }))
    : [{
      etiqueta: ETIQUETA_INCOTERM,
      anterior: mostrarValor(valorActualIncoterm || null),
      nuevo: mostrarValor(nuevoValor ? nuevoValor.trim().toUpperCase() : ''),
    }];

  const limpiarResultado = () => {
    setListaPos([]);
    setIndice(0);
    setPropuestas({});
    setClaveManual('');
    setNuevoValor('');
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

  const cambiarPropuesta = (id: string, valor: string) => {
    setPropuestas((prev) => ({ ...prev, [id]: valor }));
    setErrorForm('');
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

  const iguales = (a: string, b: string, esBooleano: boolean): boolean => {
    const normalizar = (valor: string) => {
      const texto = valor.trim();
      if (esBooleano || /^(true|false)$/i.test(texto)) return texto.toLowerCase();
      return normalizarFecha(texto) || texto.toUpperCase();
    };
    return normalizar(a) === normalizar(b);
  };

  const validar = async (): Promise<string> => {
    if (!orderNumber) return 'No hay una PO válida seleccionada.';

    if (tipo === 'carga_lista') {
      if (cambiosCargaLista.length === 0) {
        return 'Completá el nuevo valor de al menos un dato de carga lista.';
      }
      for (const cambio of cambiosCargaLista) {
        if (!cambio.campo) {
          return `No pudimos identificar el dato "${cambio.etiqueta}" en la PO.`;
        }
        const esBooleano = /^(true|false)$/i.test(cambio.valorNuevo);
        if (cambio.valorAnterior && iguales(cambio.valorNuevo, cambio.valorAnterior, esBooleano)) {
          return `El nuevo valor de "${cambio.etiqueta}" debe ser diferente al actual.`;
        }
      }
    } else {
      if (!claveIncoterm) return 'Indicá cuál campo de la orden corresponde al incoterm.';
      if (!nuevoValor.trim()) return 'Selecciona el nuevo incoterm.';
      if (valorActualIncoterm && iguales(nuevoValor, valorActualIncoterm, false)) {
        return 'El nuevo valor debe ser diferente al actual.';
      }
    }

    if (!motivo) return 'Selecciona el motivo del cambio.';
    if (motivo === 'Otro' && !otroDetalle.trim()) return 'Debes especificar el motivo del cambio.';

    const pendiente = await obtenerPendienteCambio(orderNumber, tradingCompany, tipo, entornoActivo);
    if (pendiente) return 'Ya existe una solicitud pendiente de este tipo para la misma PO.';
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
    const campos: CambioCampo[] = tipo === 'carga_lista'
      ? cambiosCargaLista
      : [{
        campo: claveIncoterm,
        etiqueta: ETIQUETA_INCOTERM,
        valorAnterior: valorActualIncoterm || null,
        valorNuevo: nuevoValor.trim().toUpperCase(),
      }];
    try {
      await crearSolicitudCampo({
        tipo,
        order_number: orderNumber,
        trading_company: tradingCompany,
        campos,
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
                  Estás operando sobre <strong>Producción</strong>. Las aprobaciones modificarán datos reales.
                </p>
              </div>
            )}
          </div>
        )}

        <h2 className="text-lg font-semibold text-gray-900 mb-1">Buscar orden de compra</h2>
        <p className="text-sm text-gray-500 mb-4">
          Consultá la PO en Raga. Al cargarla vas a ver los valores actuales
          {tipo === 'carga_lista'
            ? ' de la fecha de carga lista teórica y la fecha variable, y vas a poder proponer uno o ambos cambios a la vez.'
            : ' del incoterm de compra.'}
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
                Se encontraron {listaPos.length} órdenes con ese número. Selecciona la correcta:
              </p>
              <div className="flex flex-wrap gap-2">
                {listaPos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => { setIndice(i); setClaveManual(''); setPropuestas({}); }}
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

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
                <i className={`${config.icono} text-lg`}></i>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{config.label}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  La orden no se modifica hasta que un aprobador autorizado confirme el cambio.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Datos actuales */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500 uppercase">Número de PO</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{orderNumber || '—'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500 uppercase">Compañía</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{tradingCompany || '—'}</p>
                  </div>
                </div>

                {tipo === 'carga_lista' ? (
                  <ListaValoresCargaLista campos={camposCargaLista} />
                ) : (
                  <>
                    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                      <p className="text-xs font-medium text-gray-500 uppercase">{ETIQUETA_INCOTERM}</p>
                      <p className="mt-1 text-base font-bold text-gray-900 break-words">
                        {mostrarValor(valorActualIncoterm || null)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Campo de la orden que contiene este dato <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={claveIncoterm}
                        onChange={(e) => setClaveManual(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                      >
                        <option value="">Selecciona una columna...</option>
                        {clavesDisponibles.map((k) => (
                          <option key={k} value={k}>{humanizarClave(k)}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Valores propuestos */}
              <div className="space-y-4">
                {tipo === 'carga_lista' ? (
                  <EditorPropuestasCargaLista
                    campos={camposCargaLista}
                    propuestas={propuestas}
                    onCambiar={cambiarPropuesta}
                  />
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Nuevo incoterm propuesto <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={nuevoValor}
                      onChange={(e) => setNuevoValor(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                    >
                      <option value="">Selecciona un incoterm...</option>
                      {INCOTERMS.map((i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {nuevoValor && INCOTERM_DESCRIPCIONES[nuevoValor]
                        ? <><strong className="text-gray-700">{nuevoValor}:</strong> {INCOTERM_DESCRIPCIONES[nuevoValor]}</>
                        : 'Lista de incoterms disponible en la orden de compra.'}
                    </p>
                    {valorActualIncoterm && nuevoValor && (
                      <p className="text-xs text-teal-700 mt-1.5">
                        <i className="ri-information-line mr-1"></i>
                        Cambio: {mostrarValor(valorActualIncoterm)} → {mostrarValor(nuevoValor)}
                      </p>
                    )}
                  </div>
                )}

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
                    {motivos.map((m) => <option key={m} value={m}>{m}</option>)}
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
            </div>

            {errorForm && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
                <p className="text-sm text-red-700">{errorForm}</p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {tipo === 'carga_lista'
                  ? `${cambiosCargaLista.length} cambio(s) propuesto(s)`
                  : nuevoValor ? '1 cambio propuesto' : 'Sin cambios propuestos'}
              </p>
              <button
                onClick={abrirConfirmacion}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-send-plane-line mr-2"></i>
                Enviar solicitud de cambio
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirmación */}
      {confirmando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmar solicitud</h3>
            <p className="text-sm text-gray-600 mb-4">
              Se registrará un cambio de <strong>{config.labelCorto}</strong> para la PO <strong>{orderNumber}</strong>:
            </p>
            <div className="space-y-2 mb-4">
              {resumen.map((r, i) => (
                <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs font-medium text-gray-500 uppercase">{r.etiqueta}</p>
                  <p className="text-sm font-semibold text-gray-900 break-words">
                    {r.anterior}
                    <i className="ri-arrow-right-line mx-2 text-teal-600"></i>
                    <span className="text-teal-700">{r.nuevo}</span>
                  </p>
                </div>
              ))}
              <div className="flex justify-between text-sm gap-3">
                <span className="text-gray-500">Motivo</span>
                <span className="font-medium text-gray-900 text-right">{motivo === 'Otro' ? otroDetalle.trim() : motivo}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-gray-500">Entorno</span>
                <span className={`font-semibold ${entornoActivo === 'production' ? 'text-red-700' : 'text-teal-700'}`}>
                  {RAGA_ENV_LABEL[entornoActivo]}
                </span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4">
              <i className="ri-shield-check-line mr-1"></i>
              No se modificará la orden en Raga hasta que un aprobador lo confirme.
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