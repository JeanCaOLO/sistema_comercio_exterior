import { useCallback, useEffect, useMemo, useState } from 'react';
import { buscarPurchaseOrder, normalizarListaPos, RAGA_ENV_LABEL, type RagaEnv } from '@/lib/ragaApi';
import {
  buscarTicketsPorPo,
  enviarCambioBlContenedor,
  MOTIVOS_CAMBIO_BL,
  valorBl,
  valorCampoPo,
  valorContenedor,
  type ResultadoEnvioBl,
  type TicketVinculado,
} from '@/lib/blContenedor';
import { formatearFechaCorta } from '@/lib/fechas';
import EstadoBlBadge from './EstadoBlBadge';

interface ActualizarBlContenedorProps {
  poInicial?: string | null;
  onObjetivoConsumido?: () => void;
}

function campo(po: Record<string, any> | null, ...claves: string[]): string {
  if (!po) return '';
  for (const clave of claves) {
    const valor = po[clave];
    if (valor !== undefined && valor !== null && String(valor).trim() !== '') return String(valor).trim();
  }
  return '';
}

const FORMATO_BL = /^[A-Za-z0-9._\-/]{3,40}$/;
const FORMATO_CONTENEDOR = /^[A-Za-z0-9\-]{3,20}$/;

export default function ActualizarBlContenedor({
  poInicial = null,
  onObjetivoConsumido,
}: ActualizarBlContenedorProps) {
  const [entorno, setEntorno] = useState<RagaEnv>('production');
  const [poInput, setPoInput] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [listaPos, setListaPos] = useState<Record<string, any>[]>([]);
  const [indice, setIndice] = useState(0);

  const [blEnRaga, setBlEnRaga] = useState('');
  const [contenedorEnRaga, setContenedorEnRaga] = useState('');
  const [bl, setBl] = useState('');
  const [contenedor, setContenedor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');

  const [tickets, setTickets] = useState<TicketVinculado[]>([]);
  const [errorForm, setErrorForm] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEnvioBl | null>(null);

  const po = listaPos[indice] || null;
  const orderNumber = campo(po, 'order_number', 'po_number') || poInput.trim().toUpperCase();
  const tradingCompany = campo(po, 'trading_company');
  const etdInicial = valorCampoPo(po, 'date_etd_initial', 'etd_initial');
  const atd = valorCampoPo(po, 'date_atd');
  const ata = valorCampoPo(po, 'date_ata');

  const limpiarFormulario = useCallback(() => {
    setBl('');
    setContenedor('');
    setMotivo('');
    setDetalle('');
    setErrorForm('');
    setResultado(null);
    setTickets([]);
    setBlEnRaga('');
    setContenedorEnRaga('');
  }, []);

  const buscar = useCallback(async (numeroParam?: string, envParam?: RagaEnv) => {
    const numero = (numeroParam ?? poInput).trim().toUpperCase();
    const ambiente = envParam || entorno;
    if (!numero) {
      setErrorBusqueda('Ingresá un número de PO para buscar.');
      return;
    }
    setBuscando(true);
    setErrorBusqueda('');
    setErrorForm('');
    setResultado(null);
    setListaPos([]);
    setIndice(0);
    setTickets([]);

    const [res, vinculados] = await Promise.all([
      buscarPurchaseOrder(numero, ambiente),
      buscarTicketsPorPo(numero),
    ]);

    setBuscando(false);
    setTickets(vinculados);

    if (!res.ok) {
      setErrorBusqueda(res.error || `No se pudo consultar la PO en Raga (${RAGA_ENV_LABEL[ambiente]}).`);
      return;
    }
    const lista = normalizarListaPos(res.data);
    if (lista.length === 0) {
      setErrorBusqueda(`No se encontró la PO "${numero}" en Raga (${RAGA_ENV_LABEL[ambiente]}).`);
      return;
    }

    const primero = lista[0];
    setListaPos(lista);
    setBlEnRaga(valorBl(primero));
    setContenedorEnRaga(valorContenedor(primero));
    setBl(valorBl(primero));
    setContenedor(valorContenedor(primero));
  }, [poInput, entorno]);

  const cambiarEntorno = (nuevo: RagaEnv) => {
    if (nuevo === entorno) return;
    setEntorno(nuevo);
    setListaPos([]);
    setIndice(0);
    setTickets([]);
    setResultado(null);
    setErrorBusqueda('');
    setErrorForm('');
    limpiarFormulario();
    if (poInput.trim()) void buscar(poInput, nuevo);
  };

  useEffect(() => {
    if (!poInicial) return;
    setPoInput(poInicial);
    void buscar(poInicial);
    onObjetivoConsumido?.();
    // Solo debe reaccionar al ticket que llega desde el dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poInicial]);

  const seleccionarOrden = (i: number) => {
    const elegida = listaPos[i];
    if (!elegida) return;
    setIndice(i);
    setBlEnRaga(valorBl(elegida));
    setContenedorEnRaga(valorContenedor(elegida));
    setBl(valorBl(elegida));
    setContenedor(valorContenedor(elegida));
    setMotivo('');
    setDetalle('');
    setErrorForm('');
    setResultado(null);
  };

  const blLimpio = bl.trim().toUpperCase();
  const contenedorLimpio = contenedor.trim().toUpperCase();
  const cambiaBl = blLimpio !== blEnRaga;
  const cambiaContenedor = contenedorLimpio !== contenedorEnRaga;
  const hayCambios = Boolean(blLimpio && cambiaBl) || Boolean(contenedorLimpio && cambiaContenedor);

  const avisoContenedor = useMemo(
    () => contenedorLimpio.length > 0 && !/^[A-Z]{4}\d{7}$/.test(contenedorLimpio),
    [contenedorLimpio]
  );

  const validar = (): string => {
    if (!orderNumber) return 'No hay una PO seleccionada.';
    if (!blLimpio && !contenedorLimpio) return 'Ingresá el N° de BL o el N° de Contenedor.';
    if (blLimpio && !FORMATO_BL.test(blLimpio)) return 'El N° de BL no tiene un formato válido.';
    if (contenedorLimpio && !FORMATO_CONTENEDOR.test(contenedorLimpio)) {
      return 'El N° de Contenedor no tiene un formato válido (solo letras, números y guiones).';
    }
    if (!hayCambios) return 'Los datos ingresados ya son los que tiene Raga. Modificá al menos un valor.';
    if (!motivo) return 'Seleccioná el motivo del cambio.';
    if (motivo === 'Otro' && !detalle.trim()) return 'Especificá el motivo del cambio.';
    return '';
  };

  const abrirConfirmacion = () => {
    const error = validar();
    if (error) {
      setErrorForm(error);
      return;
    }
    setErrorForm('');
    setConfirmando(true);
  };

  const enviar = async () => {
    setEnviando(true);
    setErrorForm('');
    const res = await enviarCambioBlContenedor({
      orderNumber,
      tradingCompany,
      bl: blLimpio && cambiaBl ? blLimpio : '',
      contenedor: contenedorLimpio && cambiaContenedor ? contenedorLimpio : '',
      motivo,
      detalleMotivo: motivo === 'Otro' ? detalle.trim() : detalle.trim() || '',
      apiEnv: entorno,
    });
    setEnviando(false);
    setConfirmando(false);
    setResultado(res);

    if (res.ok) {
      if (res.nuevo_bl) setBlEnRaga(res.nuevo_bl);
      if (res.nuevo_contenedor) setContenedorEnRaga(res.nuevo_contenedor);
      setBl(res.nuevo_bl || blEnRaga);
      setContenedor(res.nuevo_contenedor || contenedorEnRaga);
      setMotivo('');
      setDetalle('');
      if (tickets.length > 0) {
        const vinculados = await buscarTicketsPorPo(orderNumber);
        setTickets(vinculados);
      }
    }
  };

  const cargarOtra = () => {
    setPoInput('');
    setListaPos([]);
    setIndice(0);
    setErrorBusqueda('');
    limpiarFormulario();
  };

  return (
    <div className="space-y-6">
      {/* Búsqueda */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Buscar orden de compra</h2>
            <p className="text-sm text-gray-500 mt-1">
              Consultá la PO en Raga para ver el BL y el contenedor que tiene hoy antes de cargar los nuevos datos.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['production', 'qa'] as const).map((env) => (
              <button
                key={env}
                onClick={() => cambiarEntorno(env)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  entorno === env
                    ? env === 'qa'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-teal-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <i className={env === 'qa' ? 'ri-flask-line' : 'ri-rocket-2-line'}></i>
                {RAGA_ENV_LABEL[env]}
              </button>
            ))}
          </div>
        </div>

        {entorno === 'qa' && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <i className="ri-flask-line text-amber-600 mt-0.5"></i>
            <p className="text-xs text-amber-800 leading-relaxed">
              Estás trabajando en <strong>QA</strong>. Los cambios se envían solo al entorno de pruebas de Raga y
              <strong> no</strong> modifican los tickets reales del sistema.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={poInput}
              onChange={(e) => setPoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') void buscar(); }}
              placeholder="Ej: 6703309"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => void buscar()}
            disabled={buscando}
            className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buscando ? (
              <><i className="ri-loader-4-line animate-spin mr-1.5"></i>Buscando...</>
            ) : (
              <><i className="ri-search-line mr-1.5"></i>Buscar PO</>
            )}
          </button>
        </div>

        {errorBusqueda && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
            <p className="text-sm text-red-700">{errorBusqueda}</p>
          </div>
        )}
      </div>

      {listaPos.length > 1 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-900 mb-2">
            Se encontraron {listaPos.length} órdenes con ese número. Seleccioná la correcta:
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
                {String(campo(p, 'trading_company') || `Orden ${i + 1}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {po && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Datos de embarque</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Al confirmar, el dato se envía a Raga y se actualiza el ticket del sistema.
                </p>
              </div>
              <button
                onClick={cargarOtra}
                className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-refresh-line mr-1"></i>Otra PO
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  N° de BL
                </label>
                <input
                  type="text"
                  value={bl}
                  onChange={(e) => setBl(e.target.value.toUpperCase())}
                  maxLength={40}
                  placeholder="Ej: ASNGBA10442"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <p className="mt-1.5 text-[11px] text-gray-500">
                  {blEnRaga ? (
                    <>En Raga hoy: <span className="font-mono text-gray-700">{blEnRaga}</span></>
                  ) : (
                    'Raga no tiene BL cargado para esta PO.'
                  )}
                </p>
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  N° de Contenedor
                </label>
                <input
                  type="text"
                  value={contenedor}
                  onChange={(e) => setContenedor(e.target.value.toUpperCase())}
                  maxLength={20}
                  placeholder="Ej: MSDU4583360"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <p className={`mt-1.5 text-[11px] ${avisoContenedor ? 'text-amber-700' : 'text-gray-500'}`}>
                  {avisoContenedor
                    ? 'El formato habitual es 4 letras + 7 números. Verificá el dato antes de enviarlo.'
                    : contenedorEnRaga
                      ? <>En Raga hoy: <span className="font-mono text-gray-700">{contenedorEnRaga}</span></>
                      : 'Raga no tiene contenedor cargado para esta PO.'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Motivo del cambio <span className="text-red-500">*</span>
                </label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Seleccioná un motivo...</option>
                  {MOTIVOS_CAMBIO_BL.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Detalle {motivo === 'Otro' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                  maxLength={300}
                  placeholder={motivo === 'Otro' ? 'Describí el motivo' : 'Opcional'}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            {resultado?.ok && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-emerald-600 mt-0.5 text-lg"></i>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-emerald-900">
                        Datos enviados a Raga
                      </p>
                      <EstadoBlBadge estado={resultado.status || 'APLICADO'} size="xs" />
                    </div>
                    <p className="text-xs text-emerald-700 mt-1">
                      {(resultado.aplicados || []).join(' · ') || 'Sin campos'} ·{' '}
                      {entorno === 'qa'
                        ? 'Entorno de pruebas: los tickets del sistema no se modifican.'
                        : `${resultado.expedientes_actualizados || 0} ticket(s) actualizados en el sistema.`}
                    </p>
                    {resultado.errores && resultado.errores.length > 0 && (
                      <p className="text-xs text-amber-800 mt-1.5">
                        No se pudo aplicar: {resultado.errores.join(' ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {resultado && !resultado.ok && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
                <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-800">No se pudo actualizar Raga</p>
                  <p className="text-xs text-red-700 mt-1 break-words leading-relaxed">
                    {resultado.error || 'Raga rechazó la actualización.'}
                  </p>
                </div>
              </div>
            )}

            {errorForm && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <i className="ri-alert-line text-amber-600 mt-0.5"></i>
                <p className="text-sm text-amber-800">{errorForm}</p>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                <i className="ri-information-line"></i>
                Solo se envían los campos que cambian.
              </p>
              <button
                onClick={abrirConfirmacion}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-send-plane-line mr-1.5"></i>
                Enviar
              </button>
            </div>
          </div>

          {/* Referencia */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900">Datos de la PO</h3>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Número de PO</p>
                  <p className="text-sm font-semibold text-gray-900 break-all">{orderNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Compañía</p>
                  <p className="text-sm text-gray-800 break-words">{tradingCompany || '—'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">ETD Inicial</p>
                    <p className="text-xs font-semibold text-gray-900 mt-0.5">
                      {etdInicial ? formatearFechaCorta(etdInicial) : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">ATD</p>
                    <p className="text-xs font-semibold text-gray-900 mt-0.5">
                      {atd ? formatearFechaCorta(atd) : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">ATA</p>
                    <p className="text-xs font-semibold text-gray-900 mt-0.5">
                      {ata ? formatearFechaCorta(ata) : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Tickets</p>
                    <p className="text-xs font-semibold text-gray-900 mt-0.5">{tickets.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <i className="ri-links-line text-teal-600"></i>
                <h3 className="text-sm font-semibold text-gray-900">Tickets vinculados</h3>
              </div>
              {tickets.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <i className="ri-inbox-line text-2xl text-gray-300"></i>
                  <p className="text-xs text-gray-500 mt-1.5">
                    No hay un expediente del sistema con esta PO. El dato igual queda registrado en Raga.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {tickets.map((t) => (
                    <div key={t.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{t.exp_id || t.po_tiquetera}</p>
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {t.estado_expediente || '—'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 break-words">PO: {t.po_tiquetera}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.numero_bl ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          BL: {t.numero_bl || 'sin dato'}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.numero_contenedor ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          Cont.: {t.numero_contenedor || 'sin dato'}
                        </span>
                      </div>
                    </div>
                  ))}
                  <p className="px-5 py-2.5 text-[11px] text-teal-700 bg-teal-50/60 flex items-center gap-1.5">
                    <i className="ri-refresh-line"></i>
                    Se actualizarán al enviar los datos a Raga.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!po && !buscando && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
          <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-teal-50 text-teal-600">
            <i className="ri-ship-2-line text-3xl"></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mt-4">Cargá el BL y el contenedor</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Buscá la orden de compra en Raga y completá el N° de BL y el N° de Contenedor.
            El dato se envía a Raga y queda en el historial del sistema.
          </p>
        </div>
      )}

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900">Confirmar envío a Raga</h3>
            <p className="text-sm text-gray-600 mt-1">
              Se actualizará la PO <strong>{orderNumber}</strong> en{' '}
              <strong className={entorno === 'qa' ? 'text-amber-700' : 'text-teal-700'}>
                {RAGA_ENV_LABEL[entorno]}
              </strong>.
            </p>

            <div className="mt-4 space-y-2.5">
              {cambiaBl && blLimpio && (
                <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">N° de BL</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-mono text-gray-500 line-through">{blEnRaga || 'sin dato'}</span>
                    <i className="ri-arrow-right-line text-teal-600 text-xs"></i>
                    <span className="text-sm font-mono font-bold text-teal-900">{blLimpio}</span>
                  </div>
                </div>
              )}
              {cambiaContenedor && contenedorLimpio && (
                <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">N° de Contenedor</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-mono text-gray-500 line-through">{contenedorEnRaga || 'sin dato'}</span>
                    <i className="ri-arrow-right-line text-teal-600 text-xs"></i>
                    <span className="text-sm font-mono font-bold text-teal-900">{contenedorLimpio}</span>
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-gray-500">Motivo</span>
                <span className="font-medium text-gray-900 text-right">{motivo}</span>
              </div>
            </div>

            <div className={`mt-4 border rounded-lg p-3 text-xs flex items-start gap-2 ${entorno === 'qa' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <i className="ri-alert-line mt-0.5"></i>
              <span>
                {entorno === 'qa'
                  ? 'Esta acción modifica datos del entorno de pruebas de Raga. Los tickets reales del sistema no se actualizan.'
                  : 'Esta acción modifica datos reales en Raga y en el ticket del sistema. No se puede deshacer automáticamente.'}
              </span>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmando(false)}
                disabled={enviando}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void enviar()}
                disabled={enviando}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {enviando ? (
                  <><i className="ri-loader-4-line animate-spin mr-1.5"></i>Enviando...</>
                ) : (
                  <><i className="ri-check-line mr-1.5"></i>Confirmar y enviar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}