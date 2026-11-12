import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  analizarCarga,
  compararCargas,
  formatearEntero,
  PAISES_INFO,
  PAISES_ORDEN,
  SIN_PROVEEDOR,
  type FilaComparativo,
  type MetaCarga,
  type MetaComparativo,
  type PoCarga,
} from '@/lib/agenteCarga';
import {
  PERIODO_SIN_FECHA,
  cargarCargaPorPeriodo,
  cargarDetalleRango,
  cargarPeriodoAnterior,
  clavesEnRango,
  etiquetaPeriodoCarga,
  etiquetaRangoCarga,
  listarPeriodos,
  type PeriodoCarga,
} from '@/lib/agenteCargaPeriodos';
import TarjetasResumen from './TarjetasResumen';
import IndicadorSinProveedor from './IndicadorSinProveedor';
import FiltroAsignacion, { type ModoSeleccionPeriodo } from './FiltroAsignacion';
import TablaAsignacion from './TablaAsignacion';
import ComparacionCarga from './ComparacionCarga';
import DistribucionCarga from './DistribucionCarga';
import ModalCargarExcel from './ModalCargarExcel';
import ModalDetallePos from './ModalDetallePos';

interface AnalisisAgenteCargaProps {
  usuario: string;
}

interface SeleccionDetalle {
  proveedorServicio: string;
  pais: string | null;
}

const COLUMNAS_REQUERIDAS = [
  'N° Orden de Compra (PO)',
  'Proveedor de Servicio',
  'Fecha Asignación Agente de Carga',
  'Ruta Logística',
  'Puerto de Arribo',
];

export default function AnalisisAgenteCarga({ usuario }: AnalisisAgenteCargaProps) {
  const [periodos, setPeriodos] = useState<PeriodoCarga[]>([]);
  const [periodo, setPeriodo] = useState('');
  const [modo, setModo] = useState<ModoSeleccionPeriodo>('periodo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cargandoPeriodos, setCargandoPeriodos] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState('');
  const [pos, setPos] = useState<PoCarga[]>([]);
  const [meta, setMeta] = useState<MetaCarga | null>(null);
  const [modalCarga, setModalCarga] = useState(false);
  const [incluirSinAsignar, setIncluirSinAsignar] = useState(false);
  const [seleccion, setSeleccion] = useState<SeleccionDetalle | null>(null);
  const [comparativoFilas, setComparativoFilas] = useState<FilaComparativo[]>([]);
  const [metaComparativo, setMetaComparativo] = useState<MetaComparativo | null>(null);

  const cargarPeriodos = useCallback(async (preferido?: string) => {
    setCargandoPeriodos(true);
    setError('');
    try {
      const lista = await listarPeriodos();
      setPeriodos(lista);
      const conDetalle = lista.filter((p) => p.periodo !== PERIODO_SIN_FECHA);
      const objetivo = preferido && lista.some((p) => p.periodo === preferido)
        ? preferido
        : conDetalle[0]?.periodo || lista[0]?.periodo || '';
      setPeriodo(objetivo);
      setDesde((previo) => (lista.some((p) => p.periodo === previo) ? previo : objetivo));
      setHasta((previo) => (lista.some((p) => p.periodo === previo) ? previo : objetivo));
      return { lista, objetivo };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de periodos.');
      setPeriodos([]);
      setPeriodo('');
      return { lista: [] as PeriodoCarga[], objetivo: '' };
    } finally {
      setCargandoPeriodos(false);
    }
  }, []);

  useEffect(() => {
    cargarPeriodos();
  }, [cargarPeriodos]);

  const periodosReales = useMemo(
    () => periodos.filter((p) => p.periodo !== PERIODO_SIN_FECHA).map((p) => p.periodo),
    [periodos]
  );

  const clavesSeleccionadas = useMemo(() => {
    if (modo === 'periodo') return periodo ? [periodo] : [];
    if (!desde || !hasta) return [];
    return clavesEnRango(periodos, desde, hasta);
  }, [modo, periodo, desde, hasta, periodos]);

  const claveSeleccion = clavesSeleccionadas.join('|');

  const etiquetaSeleccion = useMemo(() => {
    if (clavesSeleccionadas.length === 0) return 'Sin periodo';
    if (clavesSeleccionadas.length === 1 && clavesSeleccionadas[0] === PERIODO_SIN_FECHA) {
      return etiquetaPeriodoCarga(PERIODO_SIN_FECHA);
    }
    return etiquetaRangoCarga(clavesSeleccionadas);
  }, [clavesSeleccionadas]);

  useEffect(() => {
    const claves = claveSeleccion ? claveSeleccion.split('|') : [];
    if (claves.length === 0) {
      setPos([]);
      setMeta(null);
      setComparativoFilas([]);
      setMetaComparativo(null);
      return undefined;
    }

    let cancelado = false;
    setCargandoDetalle(true);
    setError('');

    (async () => {
      try {
        const detalle = claves.length === 1
          ? await cargarCargaPorPeriodo(claves[0])
          : await cargarDetalleRango(claves);
        if (cancelado) return;
        setPos(detalle.pos);
        setMeta(detalle.meta);

        if (claves[0] === PERIODO_SIN_FECHA) {
          setComparativoFilas([]);
          setMetaComparativo(null);
          return;
        }

        const anterior = await cargarPeriodoAnterior(claves[0], periodos);
        if (cancelado) return;
        setComparativoFilas(anterior.filas);
        setMetaComparativo(anterior.meta);
      } catch (err) {
        if (cancelado) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle del periodo.');
        setPos([]);
        setMeta(null);
        setComparativoFilas([]);
        setMetaComparativo(null);
      } finally {
        if (!cancelado) setCargandoDetalle(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [claveSeleccion, periodos]);

  // Al cambiar de periodo se vuelve a excluir a las POs sin proveedor.
  useEffect(() => {
    setIncluirSinAsignar(false);
  }, [claveSeleccion]);

  const sinAsignar = useMemo(
    () => pos.filter((p) => p.proveedorServicio === SIN_PROVEEDOR).length,
    [pos]
  );

  const sinAsignarPorPais = useMemo(() => {
    const mapa = new Map<string, number>();
    pos.forEach((p) => {
      if (p.proveedorServicio !== SIN_PROVEEDOR) return;
      mapa.set(p.paisDestino, (mapa.get(p.paisDestino) || 0) + 1);
    });
    return PAISES_ORDEN
      .filter((pais) => mapa.has(pais))
      .map((pais) => ({ pais: pais as string, cantidad: mapa.get(pais) || 0 }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [pos]);

  const posBase = useMemo(
    () => (incluirSinAsignar ? pos : pos.filter((p) => p.proveedorServicio !== SIN_PROVEEDOR)),
    [pos, incluirSinAsignar]
  );

  const analisis = useMemo(
    () => (posBase.length > 0 ? analizarCarga(posBase, true) : null),
    [posBase]
  );

  const rangoFechas = useMemo(() => {
    const fechas = pos
      .map((p) => (p.fechaAsignacion ? p.fechaAsignacion.slice(0, 10) : ''))
      .filter(Boolean)
      .sort();
    return { min: fechas[0] || null, max: fechas[fechas.length - 1] || null };
  }, [pos]);

  const periodoLabel = etiquetaSeleccion;
  const totalHistorico = useMemo(
    () => periodos.reduce((acc, p) => acc + p.totalPos, 0),
    [periodos]
  );

  const comparativo = useMemo(
    () => compararCargas(posBase, comparativoFilas, metaComparativo),
    [posBase, comparativoFilas, metaComparativo]
  );

  const detalle = useMemo(() => {
    if (!seleccion) return null;
    const { proveedorServicio, pais } = seleccion;
    const universo = proveedorServicio === SIN_PROVEEDOR ? pos : posBase;
    const filtradas = universo.filter((p) => {
      const coincideProveedor = !proveedorServicio || p.proveedorServicio === proveedorServicio;
      const coincidePais = !pais || p.paisDestino === pais;
      return coincideProveedor && coincidePais;
    });
    const partes: string[] = [];
    if (proveedorServicio) partes.push(proveedorServicio);
    if (pais) partes.push(PAISES_INFO[pais]?.nombre || pais);
    return {
      titulo: partes.length > 0 ? partes.join(' · ') : `Todas las POs de ${periodoLabel}`,
      subtitulo: `${formatearEntero(filtradas.length)} POs · ${periodoLabel}`,
      pos: filtradas,
    };
  }, [seleccion, pos, posBase, periodoLabel]);

  const abrirDetalle = (proveedorServicio: string, pais: string | null) => {
    setSeleccion({ proveedorServicio, pais });
  };

  const cambiarModo = (nuevo: ModoSeleccionPeriodo) => {
    setModo(nuevo);
    if (nuevo !== 'rango') return;
    const base = periodo && periodo !== PERIODO_SIN_FECHA ? periodo : periodosReales[0] || '';
    const inicio = !desde || desde === PERIODO_SIN_FECHA ? base : desde;
    const fin = !hasta || hasta === PERIODO_SIN_FECHA ? base : hasta;
    if (inicio > fin) {
      setDesde(fin);
      setHasta(inicio);
    } else {
      setDesde(inicio);
      setHasta(fin);
    }
  };

  const cambiarDesde = (valor: string) => {
    setDesde(valor);
    if (hasta && valor > hasta) setHasta(valor);
  };

  const cambiarHasta = (valor: string) => {
    setHasta(valor);
    if (desde && valor < desde) setDesde(valor);
  };

  const recargarTodo = async (preferido?: string) => {
    await cargarPeriodos(preferido);
  };

  const cargando = cargandoPeriodos || cargandoDetalle;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 flex items-center justify-center bg-teal-600 rounded-lg flex-shrink-0">
            <i className="ri-ship-2-line text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Asignación Agentes de Carga</h1>
            <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
              Consulta un mes o el acumulado de varios meses, con el detalle por Proveedor de Servicio y País
              Destino. Cada PO queda guardada en el mes de su Fecha Asignación Agente de Carga.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            onClick={() => recargarTodo(periodo)}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-refresh-line mr-1.5"></i>Actualizar
          </button>
          <button
            onClick={() => setModalCarga(true)}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-upload-2-line mr-1.5"></i>Cargar Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => recargarTodo(periodo)}
              className="mt-2 text-sm font-medium text-red-700 underline cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {cargandoPeriodos ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-teal-600"></i>
          <p className="mt-3 text-sm text-gray-500">Cargando los periodos guardados...</p>
        </div>
      ) : periodos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
          <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-teal-50 text-teal-600">
            <i className="ri-file-excel-2-line text-3xl"></i>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mt-4">Todavía no hay una carga cargada</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-lg mx-auto">
            Sube el Excel de POs Activas y el sistema armará la asignación de carga por proveedor de servicio y
            país destino, guardando el detalle de cada periodo.
          </p>
          <button
            onClick={() => setModalCarga(true)}
            className="mt-5 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-upload-2-line mr-1.5"></i>Subir Excel
          </button>

          <div className="mt-8 max-w-xl mx-auto text-left bg-gray-50/70 border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Columnas que se usan del archivo
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COLUMNAS_REQUERIDAS.map((columna) => (
                <li key={columna} className="flex items-center gap-2 text-xs text-gray-600">
                  <i className="ri-check-line text-teal-600"></i>
                  {columna}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              El país destino se deduce de la Ruta Logística y del Puerto de Arribo. Las rutas de Zona Franca
              se agrupan como ZF.
            </p>
          </div>
        </div>
      ) : (
        <>
          <FiltroAsignacion
            periodos={periodos}
            modo={modo}
            periodo={periodo}
            desde={desde}
            hasta={hasta}
            etiquetaSeleccion={etiquetaSeleccion}
            mesesSeleccionados={clavesSeleccionadas.filter((c) => c !== PERIODO_SIN_FECHA).length}
            onCambiarModo={cambiarModo}
            onSeleccionarPeriodo={setPeriodo}
            onCambiarDesde={cambiarDesde}
            onCambiarHasta={cambiarHasta}
            totalPos={pos.length}
            totalHistorico={totalHistorico}
            minFecha={rangoFechas.min}
            maxFecha={rangoFechas.max}
            cargando={cargandoDetalle}
          />

          {cargandoDetalle ? (
            <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
              <i className="ri-loader-4-line animate-spin text-3xl text-teal-600"></i>
              <p className="mt-3 text-sm text-gray-500">Cargando el detalle de {periodoLabel}...</p>
            </div>
          ) : !analisis ? (
            <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <i className="ri-calendar-close-line text-3xl"></i>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mt-4">
                {clavesSeleccionadas.length === 0
                  ? 'Elegí el rango de meses a consultar'
                  : pos.length === 0
                    ? `No hay detalle guardado para ${periodoLabel}`
                    : 'Todas las POs del periodo están sin proveedor asignado'}
              </h2>
              <p className="text-sm text-gray-500 mt-1 max-w-lg mx-auto">
                {clavesSeleccionadas.length === 0
                  ? 'En el modo rango elegí un mes de inicio y un mes de fin para ver el acumulado de la asignación.'
                  : pos.length === 0
                    ? 'Elegí otro periodo en el selector o volvé a cargar el Excel para completar el detalle.'
                    : 'Las POs del periodo no tienen Proveedor de Servicio. Podés incluirlas para ver la distribución por país destino.'}
              </p>
              {pos.length > 0 && (
                <button
                  onClick={() => setIncluirSinAsignar(true)}
                  className="mt-5 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-eye-line mr-1.5"></i>Incluir POs sin proveedor
                </button>
              )}
            </div>
          ) : (
            <>
              <TarjetasResumen analisis={analisis} />

              <IndicadorSinProveedor
                sinAsignar={sinAsignar}
                total={pos.length}
                porPais={sinAsignarPorPais}
                incluirSinAsignar={incluirSinAsignar}
                onToggle={() => setIncluirSinAsignar((v) => !v)}
                onVerDetalle={() => setSeleccion({ proveedorServicio: SIN_PROVEEDOR, pais: null })}
              />

              <TablaAsignacion
                analisis={analisis}
                periodo={periodoLabel}
                meta={meta}
                sinAsignar={sinAsignar}
                incluirSinAsignar={incluirSinAsignar}
                onToggleSinAsignar={() => setIncluirSinAsignar((v) => !v)}
                onVerDetalle={abrirDetalle}
                onCargarExcel={() => setModalCarga(true)}
              />

              {clavesSeleccionadas[0] === PERIODO_SIN_FECHA ? (
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-start gap-2">
                  <i className="ri-information-line text-gray-400 mt-0.5"></i>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Estas POs no tienen Fecha Asignación Agente de Carga, así que no se pueden comparar contra un
                    periodo anterior.
                  </p>
                </div>
              ) : (
                <ComparacionCarga
                  comparativo={comparativo}
                  periodoActual={periodoLabel}
                  onVerDetalle={abrirDetalle}
                />
              )}

              <DistribucionCarga analisis={analisis} onVerDetalle={abrirDetalle} />

              <div className="bg-teal-50 border border-teal-100 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-600 text-white flex-shrink-0">
                    <i className="ri-information-line text-lg"></i>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-teal-900">¿Cambió la asignación de carga?</p>
                    <p className="text-xs text-teal-700 mt-0.5 max-w-xl">
                      Sube el Excel actualizado. Se actualizan las POs que vienen en el archivo y el detalle
                      histórico de los meses anteriores se conserva completo.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalCarga(true)}
                  className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer self-start sm:self-auto"
                >
                  <i className="ri-upload-2-line mr-1.5"></i>Cargar Excel
                </button>
              </div>
            </>
          )}
        </>
      )}

      {modalCarga && (
        <ModalCargarExcel
          usuario={usuario}
          totalActual={totalHistorico}
          metaActual={meta}
          onClose={() => setModalCarga(false)}
          onGuardado={async () => {
            setModalCarga(false);
            await recargarTodo(periodo);
          }}
        />
      )}

      {detalle && (
        <ModalDetallePos
          titulo={detalle.titulo}
          subtitulo={detalle.subtitulo}
          pos={detalle.pos}
          onClose={() => setSeleccion(null)}
        />
      )}
    </div>
  );
}