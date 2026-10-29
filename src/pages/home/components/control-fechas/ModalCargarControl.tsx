import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  analizarControl,
  formatearEntero,
  hoyIso,
  leerArchivoControl,
  type ResultadoLectura,
} from '@/lib/controlFechas';
import { guardarControlFechas, type MetaControl } from '@/lib/controlFechasDb';

interface ModalCargarControlProps {
  usuario: string;
  metaActual: MetaControl | null;
  onClose: () => void;
  onGuardado: (meta: MetaControl) => void;
}

const PROVEEDOR_EXCLUIDO_DEFAULT = 'HENAN LORY SANITARY WARE CO.,LTD.';

export default function ModalCargarControl({
  usuario,
  metaActual,
  onClose,
  onGuardado,
}: ModalCargarControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [lectura, setLectura] = useState<ResultadoLectura | null>(null);
  const [fechaCorte, setFechaCorte] = useState(metaActual?.fechaCorte || hoyIso());
  const [excluirReales, setExcluirReales] = useState(metaActual?.excluirReales ?? true);
  const [etapasExcluidas, setEtapasExcluidas] = useState<string[]>(metaActual?.etapasExcluidas || []);
  const [proveedoresTexto, setProveedoresTexto] = useState(
    (metaActual?.proveedoresExcluidos?.length ? metaActual.proveedoresExcluidos.join('\n') : PROVEEDOR_EXCLUIDO_DEFAULT)
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, guardando]);

  const proveedoresExcluidos = useMemo(
    () => proveedoresTexto.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean),
    [proveedoresTexto]
  );

  const previsualizacion = useMemo(() => {
    if (!lectura) return null;
    return analizarControl(lectura.filas, {
      fechaCorte: fechaCorte || hoyIso(),
      excluirReales,
      etapasExcluidas,
      proveedoresExcluidos,
    });
  }, [lectura, fechaCorte, excluirReales, etapasExcluidas, proveedoresExcluidos]);

  const procesarArchivo = async (file: File) => {
    setError('');
    setLectura(null);
    setArchivo(file);
    setLeyendo(true);
    try {
      const resultado = await leerArchivoControl(file);
      setLectura(resultado);
    } catch (err) {
      setArchivo(null);
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.');
    } finally {
      setLeyendo(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) procesarArchivo(file);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setArrastrando(false);
    const file = event.dataTransfer.files?.[0];
    if (file) procesarArchivo(file);
  };

  const confirmar = async () => {
    if (!archivo || !lectura) return;
    setGuardando(true);
    setProgreso(0);
    setError('');
    try {
      const meta = await guardarControlFechas(
        lectura.filas,
        archivo.name,
        usuario,
        {
          fechaCorte: fechaCorte || hoyIso(),
          etapasExcluidas,
          proveedoresExcluidos,
          excluirReales,
        },
        (avance) => setProgreso(avance)
      );
      onGuardado(meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el reporte.');
      setGuardando(false);
    }
  };

  const alternarEtapa = (etapa: string) => {
    setEtapasExcluidas((actual) =>
      actual.includes(etapa) ? actual.filter((e) => e !== etapa) : [...actual, etapa]
    );
  };

  const tarjetas = previsualizacion
    ? [
        { label: 'Sin fechas', valor: previsualizacion.faltantes.length },
        { label: 'ETD vencido', valor: previsualizacion.etdVencido.length },
        { label: 'ETA vencida', valor: previsualizacion.etaVencido.length },
        { label: 'Fuera de regla', valor: previsualizacion.controlEtapa.filter((i) => !i.ok).length },
        { label: 'ATA < ATD', valor: previsualizacion.ataMenorAtd.length },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-xl border border-gray-200 my-8">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
              <i className="ri-file-excel-2-line text-lg"></i>
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Cargar Excel de POs Activas</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Se genera el reporte de control de fechas y reemplaza la carga anterior.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={guardando}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer disabled:opacity-40"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {metaActual && (
            <div className="rounded-lg border border-gray-200 px-4 py-3 flex items-start gap-2.5">
              <i className="ri-history-line text-gray-400 mt-0.5"></i>
              <p className="text-xs text-gray-600 leading-relaxed">
                Carga vigente: <span className="font-medium text-gray-800">{metaActual.archivo}</span> ·{' '}
                {formatearEntero(metaActual.totalPos)} POs ·{' '}
                {new Date(metaActual.cargadoAt).toLocaleString('es-CR')}
              </p>
            </div>
          )}

          {!lectura && (
            <div
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                arrastrando ? 'border-teal-500 bg-teal-50/60' : 'border-gray-200 bg-gray-50/60'
              }`}
            >
              <i className="ri-upload-cloud-2-line text-4xl text-teal-600"></i>
              <p className="mt-3 text-sm font-medium text-gray-800">Arrastra el Excel acá o selecciónalo</p>
              <p className="text-xs text-gray-500 mt-1">
                Formato .xlsx o .xls · exportación de POs Activas de NEXT
              </p>
              <button
                onClick={() => inputRef.current?.click()}
                disabled={leyendo}
                className="mt-4 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <i className="ri-folder-open-line mr-1.5"></i>
                {leyendo ? 'Leyendo archivo...' : 'Seleccionar archivo'}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          )}

          {lectura && archivo && previsualizacion && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <i className="ri-file-excel-2-line text-emerald-600 text-lg flex-shrink-0"></i>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{archivo.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatearEntero(lectura.filas.length)} filas leídas · {formatearEntero(previsualizacion.analizadas)} POs
                      analizadas
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setLectura(null); setArchivo(null); setError(''); }}
                  disabled={guardando}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap cursor-pointer disabled:opacity-40"
                >
                  Cambiar archivo
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {tarjetas.map((t) => (
                  <div key={t.label} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 truncate">{t.label}</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{formatearEntero(t.valor)}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Fecha de corte</span>
                  <input
                    type="date"
                    value={fechaCorte}
                    onChange={(e) => setFechaCorte(e.target.value)}
                    disabled={guardando}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 cursor-pointer disabled:opacity-50"
                  />
                </label>
                <button
                  onClick={() => setExcluirReales((v) => !v)}
                  disabled={guardando}
                  className={`self-end inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                    excluirReales
                      ? 'border-teal-300 bg-teal-50 text-teal-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className={`${excluirReales ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'}`}></i>
                  Excluir POs con ATD/ATA
                </button>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-2">
                  Etapas a incluir en el control
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {lectura.etapas.map((fila) => {
                    const excluida = etapasExcluidas.includes(fila.etapa);
                    return (
                      <button
                        key={fila.etapa}
                        onClick={() => alternarEtapa(fila.etapa)}
                        disabled={guardando}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                          excluida
                            ? 'border-gray-200 bg-gray-50 text-gray-400 line-through'
                            : 'border-teal-200 bg-teal-50 text-teal-800'
                        }`}
                      >
                        <i className={`${excluida ? 'ri-close-line' : 'ri-check-line'} text-[11px]`}></i>
                        {fila.etapa} <span className="text-gray-400">{formatearEntero(fila.total)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Proveedores a excluir (uno por línea o separados por coma)
                </span>
                <textarea
                  value={proveedoresTexto}
                  onChange={(e) => setProveedoresTexto(e.target.value)}
                  rows={2}
                  disabled={guardando}
                  spellCheck={false}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-y disabled:opacity-50"
                />
              </label>

              {lectura.advertencias.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <i className="ri-alert-line"></i>Ten en cuenta
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {lectura.advertencias.map((a) => (
                      <li key={a} className="text-xs text-amber-800">· {a}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg bg-teal-50 border border-teal-100 px-4 py-3 flex items-start gap-2.5">
                <i className="ri-information-line text-teal-600 mt-0.5"></i>
                <p className="text-xs text-teal-800 leading-relaxed">
                  Se guardarán <strong>{formatearEntero(lectura.filas.length)} filas</strong> y se reemplazará por
                  completo la carga anterior del módulo. Los parámetros (corte, etapas y proveedores excluidos)
                  quedan guardados junto con la carga.
                </p>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2">
              <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {guardando && (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                <span>Guardando y generando el reporte...</span>
                <span className="font-semibold text-teal-700">{progreso}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-600 rounded-full transition-all duration-300" style={{ width: `${progreso}%` }}></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!lectura || guardando}
            className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-save-3-line mr-1.5"></i>
            {guardando ? 'Guardando...' : 'Generar reporte y guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}