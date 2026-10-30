import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  analizarCarga,
  cargarCargaVigente,
  cargarComparativoVigente,
  compararCargas,
  etiquetaPeriodo,
  filtrarPorAsignacion,
  formatearEntero,
  PAISES_INFO,
  PAISES_ORDEN,
  SIN_PROVEEDOR,
  type FilaComparativo,
  type MetaCarga,
  type MetaComparativo,
  type PoCarga,
} from '@/lib/agenteCarga';
import TarjetasResumen from './TarjetasResumen';
import IndicadorSinProveedor from './IndicadorSinProveedor';
import FiltroAsignacion from './FiltroAsignacion';
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
  'Ruta Logística',
  'Puerto de Arribo',
];

export default function AnalisisAgenteCarga({ usuario }: AnalisisAgenteCargaProps) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [pos, setPos] = useState<PoCarga[]>([]);
  const [meta, setMeta] = useState<MetaCarga | null>(null);
  const [modalCarga, setModalCarga] = useState(false);
  const [incluirSinAsignar, setIncluirSinAsignar] = useState(false);
  const [seleccion, setSeleccion] = useState<SeleccionDetalle | null>(null);
  const [comparativoFilas, setComparativoFilas] = useState<FilaComparativo[]>([]);
  const [metaComparativo, setMetaComparativo] = useState<MetaComparativo | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [carga, comparativo] = await Promise.all([
        cargarCargaVigente(),
        cargarComparativoVigente(),
      ]);
      setPos(carga.pos);
      setMeta(carga.meta);
      setComparativoFilas(comparativo.filas);
      setMetaComparativo(comparativo.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la información guardada.');
      setPos([]);
      setMeta(null);
      setComparativoFilas([]);
      setMetaComparativo(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrado = useMemo(() => filtrarPorAsignacion(pos, { desde, hasta }), [pos, desde, hasta]);
  const posFiltradas = filtrado.pos;

  const sinAsignar = useMemo(
    () => posFiltradas.filter((p) => p.proveedorServicio === SIN_PROVEEDOR).length,
    [posFiltradas]
  );

  const sinAsignarPorPais = useMemo(() => {
    const mapa = new Map<string, number>();
    posFiltradas.forEach((p) => {
      if (p.proveedorServicio !== SIN_PROVEEDOR) return;
      mapa.set(p.paisDestino, (mapa.get(p.paisDestino) || 0) + 1);
    });
    return PAISES_ORDEN
      .filter((pais) => mapa.has(pais))
      .map((pais) => ({ pais: pais as string, cantidad: mapa.get(pais) || 0 }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [posFiltradas]);

  const posBase = useMemo(
    () => (incluirSinAsignar
      ? posFiltradas
      : posFiltradas.filter((p) => p.proveedorServicio !== SIN_PROVEEDOR)),
    [posFiltradas, incluirSinAsignar]
  );

  const analisis = useMemo(
    () => (posBase.length > 0 ? analizarCarga(posBase, true) : null),
    [posBase]
  );

  const periodoLabel = useMemo(() => {
    if (desde || hasta) {
      const formato = (valor: string) => {
        if (!valor) return '—';
        const [anio, mes, dia] = valor.split('-');
        return `${dia}/${mes}/${anio}`;
      };
      return `${formato(desde)} a ${formato(hasta)}`;
    }
    return etiquetaPeriodo(meta?.cargadoAt || new Date().toISOString());
  }, [desde, hasta, meta]);

  const comparativo = useMemo(
    () => compararCargas(posBase, comparativoFilas, metaComparativo),
    [posBase, comparativoFilas, metaComparativo]
  );

  const detalle = useMemo(() => {
    if (!seleccion) return null;
    const { proveedorServicio, pais } = seleccion;
    // Las POs sin proveedor no están en la base filtrada, se toman del universo completo.
    const universo = proveedorServicio === SIN_PROVEEDOR ? posFiltradas : posBase;
    const filtradas = universo.filter((p) => {
      const coincideProveedor = !proveedorServicio || p.proveedorServicio === proveedorServicio;
      const coincidePais = !pais || p.paisDestino === pais;
      return coincideProveedor && coincidePais;
    });
    const partes: string[] = [];
    if (proveedorServicio) partes.push(proveedorServicio);
    if (pais) partes.push(PAISES_INFO[pais]?.nombre || pais);
    return {
      titulo: partes.length > 0 ? partes.join(' · ') : 'Todas las POs cargadas',
      subtitulo: `${formatearEntero(filtradas.length)} POs · ${periodoLabel}`,
      pos: filtradas,
    };
  }, [seleccion, posFiltradas, posBase, periodoLabel]);

  const abrirDetalle = (proveedorServicio: string, pais: string | null) => {
    setSeleccion({ proveedorServicio, pais });
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 flex items-center justify-center bg-teal-600 rounded-lg flex-shrink-0">
            <i className="ri-ship-2-line text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Análisis Asignación Agente de Carga</h1>
            <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
              Carga el Excel de POs y obtén la asignación por Proveedor de Servicio y País Destino.
              El archivo trae el histórico completo, así que cada carga reemplaza la anterior.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            onClick={cargar}
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
              onClick={cargar}
              className="mt-2 text-sm font-medium text-red-700 underline cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-teal-600"></i>
          <p className="mt-3 text-sm text-gray-500">Cargando el análisis guardado...</p>
        </div>
      ) : pos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
          <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-teal-50 text-teal-600">
            <i className="ri-file-excel-2-line text-3xl"></i>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mt-4">
            {pos.length === 0 ? 'Todavía no hay una carga cargada' : 'Todas las POs están sin proveedor asignado'}
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-lg mx-auto">
            {pos.length === 0
              ? 'Sube el Excel de POs Activas y el sistema armará automáticamente la tabla de asignación de carga por proveedor de servicio y país destino.'
              : 'La carga se guardó, pero ninguna PO tiene un Proveedor de Servicio. Puedes incluir esas POs para ver la distribución por país destino.'}
          </p>
          <button
            onClick={() => (pos.length === 0 ? setModalCarga(true) : setIncluirSinAsignar(true))}
            className="mt-5 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className={`${pos.length === 0 ? 'ri-upload-2-line' : 'ri-eye-line'} mr-1.5`}></i>
            {pos.length === 0 ? 'Subir Excel' : 'Incluir POs sin proveedor'}
          </button>

          {pos.length === 0 && (
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
          )}
        </div>
      ) : (
        <>
          <FiltroAsignacion
            desde={desde}
            hasta={hasta}
            onDesde={setDesde}
            onHasta={setHasta}
            onLimpiar={() => {
              setDesde('');
              setHasta('');
            }}
            totalPos={pos.length}
            enRango={posFiltradas.length}
            sinFecha={filtrado.sinFecha}
            fueraRango={filtrado.fueraRango}
            activo={filtrado.activo}
          />

          {!analisis ? (
            <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <i className="ri-calendar-close-line text-3xl"></i>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mt-4">
                {posFiltradas.length === 0
                  ? 'No hay POs en el periodo seleccionado'
                  : 'Todas las POs del periodo están sin proveedor asignado'}
              </h2>
              <p className="text-sm text-gray-500 mt-1 max-w-lg mx-auto">
                {posFiltradas.length === 0
                  ? 'Ajustá las fechas Desde y Hasta, o volvé a Todo el histórico para ver la carga completa.'
                  : 'Las POs del periodo no tienen Proveedor de Servicio. Podés incluirlas para ver la distribución por país destino.'}
              </p>
              <button
                onClick={() => {
                  if (posFiltradas.length === 0) {
                    setDesde('');
                    setHasta('');
                    return;
                  }
                  setIncluirSinAsignar(true);
                }}
                className="mt-5 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className={`${posFiltradas.length === 0 ? 'ri-history-line' : 'ri-eye-line'} mr-1.5`}></i>
                {posFiltradas.length === 0 ? 'Ver todo el histórico' : 'Incluir POs sin proveedor'}
              </button>
            </div>
          ) : (
            <>
          <TarjetasResumen analisis={analisis} />

          <IndicadorSinProveedor
            sinAsignar={sinAsignar}
            total={posFiltradas.length}
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

          {filtrado.activo ? (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-start gap-2">
              <i className="ri-information-line text-gray-400 mt-0.5"></i>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                La comparación con la carga anterior se calcula sobre el histórico completo, así que se oculta
                mientras hay un periodo seleccionado. Tocá “Todo el histórico” para verla.
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
                  Sube el Excel actualizado. Como el archivo trae el histórico completo, la carga anterior se
                  reemplaza por completo y se guarda como referencia para la comparación.
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
          totalActual={pos.length}
          metaActual={meta}
          onClose={() => setModalCarga(false)}
          onGuardado={async () => {
            setModalCarga(false);
            await cargar();
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