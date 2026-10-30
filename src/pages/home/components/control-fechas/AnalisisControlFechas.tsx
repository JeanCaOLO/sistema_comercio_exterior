import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analizarControl,
  construirResumen,
  exportarReporteControl,
  formatearEntero,
  formatearFecha,
  hoyIso,
  type PoControl,
  type ResultadoControl,
} from '@/lib/controlFechas';
import {
  actualizarParametrosControl,
  cargarControlFechas,
  type MetaControl,
} from '@/lib/controlFechasDb';
import TarjetasHallazgos from './TarjetasHallazgos';
import PanelHallazgos from './PanelHallazgos';
import ParametrosControl from './ParametrosControl';
import ResumenReporte from './ResumenReporte';
import ReglasEtapa from './ReglasEtapa';
import ModalCargarControl from './ModalCargarControl';
import PanelEnvioReporte from './PanelEnvioReporte';

interface AnalisisControlFechasProps {
  usuario: string;
}

const COLUMNAS_REQUERIDAS = [
  'Etapa',
  'N° Orden de Compra (PO)',
  'Proveedor',
  'Número de Contenedor',
  'Línea Naviera',
  'ETD Inicial · ETD Variable · ATD',
  'ETA Inicial · ETA Variable · ATA',
];

export default function AnalisisControlFechas({ usuario }: AnalisisControlFechasProps) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filas, setFilas] = useState<PoControl[]>([]);
  const [meta, setMeta] = useState<MetaControl | null>(null);
  const [modal, setModal] = useState(false);
  const [tab, setTab] = useState('a');

  const [fechaCorte, setFechaCorte] = useState(hoyIso());
  const [excluirReales, setExcluirReales] = useState(true);
  const [etapasExcluidas, setEtapasExcluidas] = useState<string[]>([]);
  const [proveedoresTexto, setProveedoresTexto] = useState('');

  const firmaGuardada = useRef('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const { filas: guardadas, meta: metaGuardada } = await cargarControlFechas();
      setFilas(guardadas);
      setMeta(metaGuardada);
      if (metaGuardada) {
        setFechaCorte(metaGuardada.fechaCorte);
        setExcluirReales(metaGuardada.excluirReales);
        setEtapasExcluidas(metaGuardada.etapasExcluidas);
        setProveedoresTexto(metaGuardada.proveedoresExcluidos.join('\n'));
        firmaGuardada.current = JSON.stringify([
          metaGuardada.fechaCorte,
          metaGuardada.excluirReales,
          metaGuardada.etapasExcluidas,
          metaGuardada.proveedoresExcluidos,
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte guardado.');
      setFilas([]);
      setMeta(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const proveedoresExcluidos = useMemo(
    () => proveedoresTexto.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean),
    [proveedoresTexto]
  );

  const etapas = useMemo(() => {
    const mapa = new Map<string, number>();
    filas.forEach((fila) => {
      const etiqueta = fila.etapa || '(vacía)';
      mapa.set(etiqueta, (mapa.get(etiqueta) || 0) + 1);
    });
    return Array.from(mapa.entries())
      .map(([etapa, total]) => ({ etapa, total }))
      .sort((a, b) => b.total - a.total);
  }, [filas]);

  const resultado: ResultadoControl | null = useMemo(() => {
    if (filas.length === 0) return null;
    return analizarControl(filas, {
      fechaCorte: fechaCorte || hoyIso(),
      excluirReales,
      etapasExcluidas,
      proveedoresExcluidos,
    });
  }, [filas, fechaCorte, excluirReales, etapasExcluidas, proveedoresExcluidos]);

  const resumen = useMemo(() => (resultado ? construirResumen(resultado) : ''), [resultado]);

  // Guarda los parámetros del análisis para que el reporte quede reproducible.
  useEffect(() => {
    if (!meta) return;
    const firma = JSON.stringify([fechaCorte, excluirReales, etapasExcluidas, proveedoresExcluidos]);
    if (firmaGuardada.current === firma) return;
    const temporizador = setTimeout(() => {
      firmaGuardada.current = firma;
      actualizarParametrosControl(meta.cargaId, {
        fechaCorte: fechaCorte || hoyIso(),
        etapasExcluidas,
        proveedoresExcluidos,
        excluirReales,
      }).catch(() => {
        firmaGuardada.current = '';
      });
    }, 900);
    return () => clearTimeout(temporizador);
  }, [fechaCorte, excluirReales, etapasExcluidas, proveedoresExcluidos, meta]);

  const alternarEtapa = (etapa: string) => {
    setEtapasExcluidas((actual) =>
      actual.includes(etapa) ? actual.filter((e) => e !== etapa) : [...actual, etapa]
    );
  };

  const descargar = () => {
    if (!resultado) return;
    exportarReporteControl(resultado, filas, meta?.archivo || 'pos_activas.xlsx');
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 flex items-center justify-center bg-teal-600 rounded-lg flex-shrink-0">
            <i className="ri-calendar-check-line text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Control de Fechas NEXT</h1>
            <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
              Carga la exportación de POs Activas y obtén los hallazgos de fechas ETD/ETA, el control por etapa y
              las POs con arribo real anterior al zarpe real.
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
            onClick={descargar}
            disabled={!resultado}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line mr-1.5"></i>Descargar Excel
          </button>
          <button
            onClick={() => setModal(true)}
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
            <button onClick={cargar} className="mt-2 text-sm font-medium text-red-700 underline cursor-pointer">
              Reintentar
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-teal-600"></i>
          <p className="mt-3 text-sm text-gray-500">Cargando el reporte guardado...</p>
        </div>
      ) : !resultado || !meta ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
          <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-teal-50 text-teal-600">
            <i className="ri-file-excel-2-line text-3xl"></i>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mt-4">Todavía no hay un reporte cargado</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-lg mx-auto">
            Sube la exportación de POs Activas de NEXT. El sistema arma automáticamente el control de fechas y
            guarda el resultado del módulo.
          </p>
          <button
            onClick={() => setModal(true)}
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
                <li key={columna} className="flex items-start gap-2 text-xs text-gray-600">
                  <i className="ri-check-line text-teal-600 mt-0.5"></i>
                  {columna}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              No se consideran las POs sin contenedor ni con contenedor inválido (debe tener 4 letras + 7 números y
              no empezar con AAAA).
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1 text-gray-600">
                <i className="ri-file-excel-2-line"></i>{meta.archivo}
              </span>
              <span className="text-gray-300">·</span>
              <span>Cargado el {new Date(meta.cargadoAt).toLocaleString('es-CR')}</span>
              {meta.cargadoPor && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>{meta.cargadoPor}</span>
                </>
              )}
            </p>
            <p className="text-[11px] text-gray-500 whitespace-nowrap">
              Corte {formatearFecha(resultado.fechaCorte)} · vencido ≤ {formatearFecha(resultado.limite)}
            </p>
          </div>

          <ParametrosControl
            fechaCorte={fechaCorte}
            onFechaCorte={setFechaCorte}
            excluirReales={excluirReales}
            onToggleReales={() => setExcluirReales((v) => !v)}
            etapas={etapas}
            etapasExcluidas={etapasExcluidas}
            onToggleEtapa={alternarEtapa}
            proveedoresTexto={proveedoresTexto}
            onProveedores={setProveedoresTexto}
          />

          <TarjetasHallazgos resultado={resultado} tabActiva={tab} onSeleccionar={setTab} />

          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {[
              { label: 'POs analizadas', valor: `${formatearEntero(resultado.analizadas)} de ${formatearEntero(resultado.totalLeidas)}` },
              { label: 'Sin contenedor', valor: formatearEntero(resultado.sinContenedor) },
              { label: 'Contenedor inválido', valor: formatearEntero(resultado.contenedorInvalido) },
              { label: 'En etapas excluidas', valor: formatearEntero(resultado.omitidasEtapa) },
              { label: 'De proveedores excluidos', valor: formatearEntero(resultado.omitidasProveedor) },
            ].map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{item.label}</p>
                <p className="text-sm font-semibold text-gray-800">{item.valor}</p>
              </div>
            ))}
          </div>

          <PanelHallazgos resultado={resultado} tabActiva={tab} onTab={setTab} />

          <PanelEnvioReporte resultado={resultado} meta={meta} usuario={usuario} />

          <ResumenReporte resumen={resumen} />

          <ReglasEtapa />

          <div className="bg-teal-50 border border-teal-100 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-600 text-white flex-shrink-0">
                <i className="ri-information-line text-lg"></i>
              </span>
              <div>
                <p className="text-sm font-semibold text-teal-900">¿Nuevo corte de fechas?</p>
                <p className="text-xs text-teal-700 mt-0.5 max-w-xl">
                  Sube la exportación más reciente. El reporte guardado se reemplaza por completo con la nueva data
                  y los parámetros que elijas.
                </p>
              </div>
            </div>
            <button
              onClick={() => setModal(true)}
              className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer self-start sm:self-auto"
            >
              <i className="ri-upload-2-line mr-1.5"></i>Cargar Excel
            </button>
          </div>
        </>
      )}

      {modal && (
        <ModalCargarControl
          usuario={usuario}
          metaActual={meta}
          onClose={() => setModal(false)}
          onGuardado={async () => {
            setModal(false);
            await cargar();
          }}
        />
      )}
    </div>
  );
}