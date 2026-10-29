import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  analizarCarga,
  formatearEntero,
  guardarCargaVigente,
  parsearArchivoExcel,
  SIN_PROVEEDOR,
  type MetaCarga,
  type ResultadoParseo,
} from '@/lib/agenteCarga';

interface ModalCargarExcelProps {
  usuario: string;
  totalActual: number;
  metaActual: MetaCarga | null;
  onClose: () => void;
  onGuardado: () => void;
}

export default function ModalCargarExcel({
  usuario,
  totalActual,
  metaActual,
  onClose,
  onGuardado,
}: ModalCargarExcelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [lectura, setLectura] = useState<ResultadoParseo | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, guardando]);

  const procesarArchivo = async (file: File) => {
    setError('');
    setLectura(null);
    setArchivo(file);
    setLeyendo(true);
    try {
      const resultado = await parsearArchivoExcel(file);
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
      await guardarCargaVigente(lectura.pos, archivo.name, usuario, (avance) => setProgreso(avance));
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la carga.');
      setGuardando(false);
    }
  };

  const resumen = lectura ? analizarCarga(lectura.pos, true) : null;
  const sinAsignar = lectura ? lectura.pos.filter((p) => p.proveedorServicio === SIN_PROVEEDOR).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-xl border border-gray-200 my-8">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
              <i className="ri-file-excel-2-line text-lg"></i>
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Cargar Excel de POs</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Al guardar se reemplaza la carga vigente; la anterior queda como referencia de comparación.
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
          {metaActual && totalActual > 0 && (
            <div className="rounded-lg border border-gray-200 px-4 py-3 flex items-start gap-2.5">
              <i className="ri-history-line text-gray-400 mt-0.5"></i>
              <p className="text-xs text-gray-600 leading-relaxed">
                Carga vigente: <span className="font-medium text-gray-800">{metaActual.archivo}</span> ·{' '}
                {formatearEntero(totalActual)} POs ·{' '}
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
              <p className="mt-3 text-sm font-medium text-gray-800">
                Arrastra el archivo acá o selecciónalo
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Formato .xlsx, .xls o .csv · se usa la hoja con las columnas de PO y Proveedor de Servicio
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
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          )}

          {lectura && resumen && archivo && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <i className="ri-file-excel-2-line text-emerald-600 text-lg flex-shrink-0"></i>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{archivo.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatearEntero(lectura.filasLeidas)} filas leídas
                      {lectura.duplicadas > 0 ? ` · ${formatearEntero(lectura.duplicadas)} PO duplicadas omitidas` : ''}
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'POs', valor: formatearEntero(lectura.pos.length), icono: 'ri-file-list-3-line' },
                  { label: 'Proveedores', valor: formatearEntero(resumen.proveedores), icono: 'ri-truck-line' },
                  { label: 'Países', valor: formatearEntero(resumen.paisesActivos), icono: 'ri-earth-line' },
                  { label: 'ZF', valor: formatearEntero(resumen.posZf), icono: 'ri-building-4-line' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      <i className={`${item.icono} text-gray-400`}></i>
                      {item.label}
                    </div>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{item.valor}</p>
                  </div>
                ))}
              </div>

              {lectura.advertencias.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <i className="ri-alert-line"></i>Revisa esto antes de guardar
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
                  Se guardarán <strong>{formatearEntero(lectura.pos.length)} POs</strong> y se
                  reemplazará la carga vigente por completo
                  {metaActual ? ` (${formatearEntero(totalActual)} POs del archivo ${metaActual.archivo})` : ''}.
                  La carga anterior se conserva solo como referencia para el bloque de comparación.
                  {sinAsignar > 0 && (
                    <> {formatearEntero(sinAsignar)} de esas POs no tienen Proveedor de Servicio asignado, así que
                      quedan fuera del análisis por defecto (puedes incluirlas con el interruptor de la tabla).</>
                  )}
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
                <span>Guardando en el módulo...</span>
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
            {guardando ? 'Guardando...' : 'Reemplazar carga'}
          </button>
        </div>
      </div>
    </div>
  );
}