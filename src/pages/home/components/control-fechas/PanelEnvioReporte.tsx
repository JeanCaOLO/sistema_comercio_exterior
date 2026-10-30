import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CONFIG_CORREO_DEFECTO,
  cargarConfigCorreo,
  cargarEnvios,
  cargarPosEnviadas,
  enviarReporteControl,
  guardarConfigCorreo,
  previsualizarEnvio,
  cargarCola,
  descartarCorreoCola,
  type AgrupacionEnvio,
  type ConfigCorreoControl,
  type CorreoEnCola,
  type EnvioRegistro,
  type MapaEnviadas,
  type ModoEnvio,
  type ResultadoSeccionEnvio,
} from '@/lib/controlFechasCorreo';
import { formatearEntero, type ResultadoControl } from '@/lib/controlFechas';
import type { MetaControl } from '@/lib/controlFechasDb';

interface PanelEnvioReporteProps {
  resultado: ResultadoControl;
  meta: MetaControl | null;
  usuario: string;
}

interface Aviso {
  tipo: 'ok' | 'error' | 'info';
  texto: string;
}

export default function PanelEnvioReporte({ resultado, meta, usuario }: PanelEnvioReporteProps) {
  const [config, setConfig] = useState<ConfigCorreoControl>(CONFIG_CORREO_DEFECTO);
  const [configLista, setConfigLista] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [cola, setCola] = useState<CorreoEnCola[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [envios, setEnvios] = useState<EnvioRegistro[]>([]);
  const [enviadas, setEnviadas] = useState<MapaEnviadas | null>(null);
  const [detalle, setDetalle] = useState<ResultadoSeccionEnvio[] | null>(null);
  const [abierto, setAbierto] = useState(false);

  const configRef = useRef<ConfigCorreoControl>(CONFIG_CORREO_DEFECTO);
  const intentada = useRef('');

  const recargarHistorial = useCallback(async () => {
    try {
      const [historial, mapa, pendientes] = await Promise.all([
        cargarEnvios(8),
        cargarPosEnviadas(),
        cargarCola(12),
      ]);
      setEnvios(historial);
      setEnviadas(mapa);
      setCola(pendientes);
    } catch {
      setEnvios([]);
      setEnviadas(null);
      setCola([]);
    }
  }, []);

  useEffect(() => {
    let activo = true;
    cargarConfigCorreo()
      .then((valor) => {
        if (!activo) return;
        configRef.current = valor;
        setConfig(valor);
      })
      .catch(() => {
        if (!activo) return;
        setConfig(CONFIG_CORREO_DEFECTO);
      })
      .finally(() => {
        if (activo) setConfigLista(true);
      });
    recargarHistorial();
    return () => {
      activo = false;
    };
  }, [recargarHistorial]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const previsualizacion = useMemo(() => previsualizarEnvio(resultado, enviadas), [resultado, enviadas]);

  const totalNuevas = previsualizacion.reduce((suma, fila) => suma + fila.nuevas, 0);
  const correosPrevistos =
    config.agrupacion === 'po'
      ? totalNuevas
      : previsualizacion.filter((fila) => fila.nuevas > 0).length;

  const cambiarAgrupacion = (opcion: AgrupacionEnvio) => {
    actualizar('agrupacion', opcion);
  };

  const actualizar = <K extends keyof ConfigCorreoControl>(campo: K, valor: ConfigCorreoControl[K]) => {
    setConfig((actual) => ({ ...actual, [campo]: valor }));
  };

  const persistir = useCallback(async (siguiente: ConfigCorreoControl) => {
    await guardarConfigCorreo(siguiente);
    configRef.current = siguiente;
    setConfig(siguiente);
  }, []);

  const ejecutarEnvio = useCallback(
    async (automatico: boolean) => {
      const actual = configRef.current;
      if (enviando) return;
      setEnviando(true);
      setAviso(null);
      try {
        const respuesta = await enviarReporteControl({
          config: actual,
          resultado,
          archivo: meta?.archivo || 'pos_activas.xlsx',
          cargaId: meta?.cargaId || '',
          usuario,
        });

        setDetalle(respuesta.secciones);

        const fallidas = respuesta.secciones.filter((s) => s.enviado && !s.ok).length;

        setAviso({
          tipo: respuesta.ok ? 'ok' : 'error',
          texto: `${automatico ? 'Envío automático. ' : ''}${respuesta.mensaje}${
            respuesta.correos > 0
              ? ` Destino: ${respuesta.destinatarios}${respuesta.copia ? ` · copia a ${respuesta.copia}` : ''}.`
              : ''
          }${fallidas > 0 ? ` Fallaron ${fallidas} secciones.` : ''}`,
        });

        if (respuesta.ok && respuesta.correos > 0 && meta?.cargaId) {
          const siguiente = { ...actual, ultimaCargaEnviada: meta.cargaId };
          configRef.current = siguiente;
          setConfig(siguiente);
          await guardarConfigCorreo(siguiente).catch(() => undefined);
        }
        await recargarHistorial();
      } finally {
        setEnviando(false);
      }
    },
    [enviando, meta, recargarHistorial, resultado, usuario]
  );

  // Envío automático al detectar una carga nueva (solo si está activado).
  useEffect(() => {
    if (!configLista || !config.activo) return;
    if (!meta?.cargaId) return;
    if (config.ultimaCargaEnviada === meta.cargaId) return;
    if (intentada.current === meta.cargaId) return;
    intentada.current = meta.cargaId;
    void ejecutarEnvio(true);
  }, [configLista, config.activo, config.ultimaCargaEnviada, meta, ejecutarEnvio]);

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    try {
      await persistir(config);
      setAviso({ tipo: 'info', texto: 'Configuración guardada.' });
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo guardar la configuración.',
      });
    } finally {
      setGuardando(false);
    }
  };

  const cambiarModo = (modo: ModoEnvio) => {
    actualizar('modo', modo);
  };

  const endpointCola = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL || ''}/functions/v1/cola-reporte-control-fechas`;
  const pendientesCount = cola.filter((item) => item.estado === 'pendiente').length;

  const descartar = async (id: string) => {
    try {
      await descartarCorreoCola(id);
      await recargarHistorial();
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo quitar el correo de la cola.',
      });
    }
  };

  const destinoPrueba = config.de.trim();
  const destinoReal = config.para.trim();

  return (
    <section className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-900 text-white flex-shrink-0">
            <i className="ri-mail-send-line text-lg"></i>
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Enviar reporte a soporte RAGA</h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
              Elegí un correo por sección (2a, 2b, 2c, 3 y 4) o un correo por cada PO explicando su caso. Solo se
              reportan las POs que todavía no se enviaron. Quedan en cola y el script de Google los envía de lunes a
              viernes a las 8:00 a. m.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
              config.modo === 'real' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {config.modo === 'real' ? 'Modo real' : 'Modo prueba'}
          </span>
          <button
            onClick={() => setAbierto((v) => !v)}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className={abierto ? 'ri-arrow-up-s-line mr-1' : 'ri-settings-3-line mr-1'}></i>
            {abierto ? 'Ocultar ajustes' : 'Configurar envío'}
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Qué se enviaría, sección por sección */}
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Sección
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Hallazgos
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Ya reportadas
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  POs nuevas
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Correo
                </th>
              </tr>
            </thead>
            <tbody>
              {previsualizacion.map((fila) => (
                <tr key={fila.clave} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <span className="text-xs font-semibold text-gray-900">{fila.clave}</span>
                    <span className="text-xs text-gray-500 ml-1.5">{fila.titulo}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-700">{formatearEntero(fila.total)}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-500">{formatearEntero(fila.yaEnviadas)}</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`text-xs font-semibold ${fila.nuevas > 0 ? 'text-teal-700' : 'text-gray-400'}`}
                    >
                      {formatearEntero(fila.nuevas)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {fila.nuevas === 0 ? (
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">No se envía</span>
                    ) : config.agrupacion === 'po' ? (
                      <span className="text-[11px] text-teal-700 whitespace-nowrap">
                        <i className="ri-mail-line mr-1"></i>
                        {formatearEntero(fila.nuevas)} correos · 1 por PO
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-700 whitespace-nowrap">
                        <i className="ri-attachment-2 mr-1"></i>Excel propio
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-gray-50/80 border border-gray-100 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-600">
            Se pondrán en cola <span className="font-semibold text-gray-900">{formatearEntero(correosPrevistos)}</span>{' '}
            correos · <span className="font-semibold text-gray-900">{formatearEntero(totalNuevas)}</span> POs nuevas
          </p>
          <p className="text-xs text-gray-400 ml-auto">
            {config.modo === 'prueba'
              ? `Se envía solo a ${destinoPrueba || '(sin remitente)'}`
              : `Se envía a ${destinoReal || '(sin destinatario)'}${config.cc ? ` · copia a ${config.cc}` : ''}`}
          </p>
        </div>

        <div className="border border-gray-100 rounded-lg px-4 py-3 space-y-2.5 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-xs font-semibold text-gray-700 whitespace-nowrap">Formato del envío</p>
            <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-full">
              {(['seccion', 'po'] as AgrupacionEnvio[]).map((opcion) => (
                <button
                  key={opcion}
                  onClick={() => cambiarAgrupacion(opcion)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    config.agrupacion === opcion
                      ? 'bg-white text-gray-900 border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opcion === 'seccion' ? 'Un correo por sección' : 'Un correo por PO'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            {config.agrupacion === 'po'
              ? `Cada PO sale en su propio correo, explicando el caso de esa PO y con un Excel de una sola línea. Con la data actual se generan ${formatearEntero(totalNuevas)} correos.`
              : 'Cada sección (2a, 2b, 2c, 3 y 4) sale en un solo correo, con todas sus POs nuevas en un Excel.'}
          </p>
          {config.agrupacion === 'po' && totalNuevas > 40 && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-amber-50 border border-amber-200">
              <i className="ri-alert-line text-amber-600 mt-0.5"></i>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Ojo: son {formatearEntero(totalNuevas)} correos. Salen todos en la misma corrida de las 8:00 a. m., pero
                pueden tardar varios minutos. Si lo querés más liviano, cambiá a "Un correo por sección".
              </p>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg px-4 py-3 bg-teal-50 border border-teal-100">
          <i className="ri-shield-check-line text-teal-600 mt-0.5"></i>
          <p className="text-[11px] text-teal-800 leading-relaxed">
            Cada PO enviada en modo real queda marcada, así que si volvés a cargar la data solo se reportan las POs
            nuevas de cada sección. Los envíos de prueba no marcan nada y podés quitarlos de la cola cuando quieras.
          </p>
        </div>

        {aviso && (
          <div
            className={`flex items-start gap-2 rounded-lg px-4 py-3 border ${
              aviso.tipo === 'ok'
                ? 'bg-emerald-50 border-emerald-200'
                : aviso.tipo === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
            }`}
          >
            <i
              className={`mt-0.5 ${
                aviso.tipo === 'ok'
                  ? 'ri-checkbox-circle-line text-emerald-600'
                  : aviso.tipo === 'error'
                    ? 'ri-error-warning-line text-red-600'
                    : 'ri-information-line text-gray-500'
              }`}
            ></i>
            <p
              className={`text-xs leading-relaxed ${
                aviso.tipo === 'ok' ? 'text-emerald-800' : aviso.tipo === 'error' ? 'text-red-700' : 'text-gray-600'
              }`}
            >
              {aviso.texto}
            </p>
          </div>
        )}

        {detalle && detalle.length > 0 && (
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
            {detalle.map((seccion) => (
              <div key={seccion.clave} className="px-3 py-2 flex items-start gap-2">
                <i
                  className={`mt-0.5 ${
                    !seccion.enviado
                      ? 'ri-subtract-line text-gray-400'
                      : seccion.ok
                        ? 'ri-checkbox-circle-line text-emerald-600'
                        : 'ri-close-circle-line text-red-500'
                  }`}
                ></i>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">{seccion.clave}</span> {seccion.titulo} ·{' '}
                    {formatearEntero(seccion.nuevas)} POs nuevas
                  </p>
                  {seccion.adjunto && (
                    <p className="text-[10px] text-gray-400 truncate">{seccion.adjunto}</p>
                  )}
                  {(!seccion.ok || !seccion.enviado) && seccion.mensaje && (
                    <p className={`text-[10px] mt-0.5 ${seccion.ok ? 'text-gray-500' : 'text-red-600'}`}>
                      {seccion.mensaje}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-full">
            {(['prueba', 'real'] as ModoEnvio[]).map((opcion) => (
              <button
                key={opcion}
                onClick={() => cambiarModo(opcion)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  config.modo === opcion ? 'bg-white text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opcion === 'prueba' ? 'Prueba (solo yo)' : 'Real (soporte)'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span
              onClick={() => actualizar('activo', !config.activo)}
              className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${
                config.activo ? 'bg-teal-600 justify-end' : 'bg-gray-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white flex-shrink-0"></span>
            </span>
            <span className="text-xs text-gray-600">Enviar automáticamente al cargar nueva data</span>
          </label>

          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={guardar}
              disabled={guardando}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
            >
              {guardando ? 'Guardando...' : 'Guardar ajustes'}
            </button>
            <button
              onClick={() => ejecutarEnvio(false)}
              disabled={enviando || !meta}
              className="px-4 py-2 bg-teal-600 text-white rounded-md text-xs font-semibold hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {enviando ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-1.5"></i>Preparando...
                </>
              ) : (
                <>
                  <i className="ri-send-plane-line mr-1.5"></i>
                  {config.modo === 'prueba' ? 'Poner en cola (prueba)' : 'Poner en cola (soporte)'}
                </>
              )}
            </button>
          </div>
        </div>

        {abierto && (
          <div className="border border-gray-100 rounded-lg p-4 space-y-4 bg-gray-50/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Remitente
                </label>
                <input
                  type="email"
                  value={config.de}
                  onChange={(e) => actualizar('de', e.target.value)}
                  className="w-full min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="jalvarez@ologistics.com"
                />
                <p className="text-[10px] text-gray-400 mt-1">Debe ser la cuenta dueña del script de Google.</p>
              </div>
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Destinatario (modo real)
                </label>
                <input
                  type="email"
                  value={config.para}
                  onChange={(e) => actualizar('para', e.target.value)}
                  className="w-full min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="soporte@raga-x.ai"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Copia (CC)
                </label>
                <input
                  type="text"
                  value={config.cc}
                  onChange={(e) => actualizar('cc', e.target.value)}
                  className="w-full min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="correo1@ologistics.com, correo2@ologistics.com"
                />
                <p className="text-[10px] text-gray-400 mt-1">Separados por coma. No aplica en modo prueba.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="min-w-0 lg:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  URL que usa el script de Google
                </label>
                <input
                  type="text"
                  readOnly
                  value={endpointCola}
                  className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 font-mono text-xs focus:outline-none"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Token compartido
                </label>
                <input
                  type="text"
                  value={config.token}
                  onChange={(e) => actualizar('token', e.target.value)}
                  className="w-full min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="ologistics-control-fechas-2026"
                />
                <p className="text-[10px] text-gray-400 mt-1">Debe ser igual al TOKEN del script.</p>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed">
              Los correos no salen al instante: quedan en esta cola y el script de Google los manda solo, de lunes a
              viernes a las 8:00 a. m. (hora Costa Rica). El remitente siempre es la cuenta dueña del script.
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              En modo prueba el destinatario y las copias se ignoran: el correo va solo al remitente y ninguna PO se
              marca como reportada.
            </p>
          </div>
        )}

        {cola.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Cola de envío · lunes a viernes 8:00 a. m.
              </p>
              <span className="text-[11px] text-gray-500">
                {formatearEntero(pendientesCount)} pendiente{pendientesCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
              {cola.map((item) => (
                <div key={item.id} className="px-3 py-2 flex items-start gap-2">
                  <i
                    className={`mt-0.5 ${
                      item.estado === 'pendiente'
                        ? 'ri-time-line text-amber-500'
                        : item.estado === 'enviado'
                          ? 'ri-checkbox-circle-line text-emerald-600'
                          : 'ri-close-circle-line text-red-500'
                    }`}
                  ></i>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 truncate">
                      <span className="font-semibold">{item.seccion}</span> · {item.asunto}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {formatearEntero(item.totalPos)} POs · {item.modo === 'real' ? 'real' : 'prueba'} ·{' '}
                      {item.destinatarios}
                      {item.estado === 'pendiente' ? ' · esperando la corrida de las 8:00 a. m.' : ''}
                    </p>
                    {item.mensaje && <p className="text-[10px] text-red-600 mt-0.5 truncate">{item.mensaje}</p>}
                  </div>
                  {item.estado === 'pendiente' && (
                    <button
                      onClick={() => descartar(item.id)}
                      className="px-2 py-1 text-[10px] text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 whitespace-nowrap cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {envios.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Últimos envíos</p>
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
              {envios.map((envio) => (
                <div key={envio.id} className="px-3 py-2 flex items-start gap-2">
                  <i
                    className={`mt-0.5 ${
                      envio.ok ? 'ri-checkbox-circle-line text-emerald-600' : 'ri-close-circle-line text-red-500'
                    }`}
                  ></i>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 truncate">
                      <span className="font-semibold">{envio.seccion}</span> · {envio.asunto || 'Reporte Control de Fechas NEXT'}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {new Date(envio.enviadoAt).toLocaleString('es-CR')} ·{' '}
                      {envio.modo === 'real' ? 'real' : 'prueba'} · {envio.destinatarios || 'sin destinatario'}
                      {envio.enviadoPor ? ` · ${envio.enviadoPor}` : ''}
                    </p>
                    {!envio.ok && envio.mensaje && (
                      <p className="text-[10px] text-red-600 mt-0.5 truncate">{envio.mensaje}</p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                      envio.modo === 'real' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {envio.totalHallazgos}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}