import { useEffect, useRef, useState } from 'react';
import type { DocumentoLeido, MapeoColumnas, SeleccionPdf } from '@/lib/comparadorDocumentos';
import { muestrasColumnas, sugerirSeleccionPdf } from '@/lib/comparadorDocumentos';
import type { PerfilColumnas } from '@/lib/perfilesComparador';

export interface EstadoCarga {
  tipo: 'idle' | 'leyendo' | 'listo' | 'aviso' | 'error';
  mensaje?: string;
}

interface ZonaCargaDocumentoProps {
  titulo: string;
  descripcion: string;
  numero: number;
  documento: DocumentoLeido | null;
  estado: EstadoCarga;
  perfiles: PerfilColumnas[];
  perfilAplicado: PerfilColumnas | null;
  onArchivo: (archivo: File) => void;
  onQuitar: () => void;
  onMapeo: (mapeo: MapeoColumnas) => void;
  onHoja: (indice: number) => void;
  onSeleccionPdf: (seleccion: SeleccionPdf | null) => void;
  onAplicarPerfil: (perfil: PerfilColumnas) => void;
  onGuardarPerfil: (proveedor: string) => void;
  onEliminarPerfil: (id: string) => void;
}

const ACEPTADOS = '.xlsx,.xls,.csv,.pdf';

export default function ZonaCargaDocumento({
  titulo,
  descripcion,
  numero,
  documento,
  estado,
  perfiles,
  perfilAplicado,
  onArchivo,
  onQuitar,
  onMapeo,
  onHoja,
  onSeleccionPdf,
  onAplicarPerfil,
  onGuardarPerfil,
  onEliminarPerfil,
}: ZonaCargaDocumentoProps) {
  const [arrastrando, setArrastrando] = useState(false);
  const [verDetalle, setVerDetalle] = useState(false);
  const [proveedor, setProveedor] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVerDetalle(false);
    setProveedor(perfilAplicado?.proveedor ?? '');
  }, [documento?.nombre, perfilAplicado]);

  const tomarArchivo = (archivo?: File | null) => {
    if (!archivo) return;
    onArchivo(archivo);
    if (inputRef.current) inputRef.current.value = '';
  };

  const cambiarCampo = (campo: keyof MapeoColumnas, valor: number) => {
    if (!documento) return;
    onMapeo({ ...documento.mapeo, [campo]: valor });
  };

  const borde = estado.tipo === 'error'
    ? 'border-red-300 bg-red-50/40'
    : estado.tipo === 'leyendo'
      ? 'border-teal-400 bg-teal-50/40'
      : estado.tipo === 'aviso'
        ? 'border-amber-300 bg-amber-50/40'
        : documento
          ? 'border-emerald-300 bg-emerald-50/30'
          : arrastrando
            ? 'border-teal-400 bg-teal-50/50'
            : 'border-gray-300 bg-gray-50 hover:border-teal-400 hover:bg-teal-50/30';

  const columnas = documento?.tipo === 'pdf' && documento.lineas ? muestrasColumnas(documento.lineas) : [];

  const opcionesMapeo = documento && documento.tipo === 'excel'
    ? documento.etiquetas.map((etiqueta, indice) => ({ valor: indice, etiqueta }))
    : columnas.map((columna) => ({
      valor: columna.indice,
      etiqueta: `Columna ${columna.indice + 1}${columna.muestras.length ? ` · ${columna.muestras.join(' / ')}` : ''}`,
    }));

  const campos: { campo: keyof MapeoColumnas; nombre: string; opcional?: boolean }[] = [
    { campo: 'ref', nombre: 'Referencia' },
    { campo: 'qty', nombre: 'Bultos / Cantidad' },
    { campo: 'um', nombre: 'Unidad', opcional: true },
    { campo: 'price', nombre: 'Precio unitario' },
  ];

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <header className="flex items-start gap-3 px-4 py-3 border-b border-gray-100">
        <span className="w-7 h-7 flex items-center justify-center rounded-full bg-teal-600 text-white text-xs font-bold flex-shrink-0">
          {numero}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{titulo}</p>
          <p className="text-xs text-gray-500 mt-0.5">{descripcion}</p>
        </div>
        {documento && (
          <button
            type="button"
            onClick={onQuitar}
            title="Quitar archivo"
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0"
          >
            <i className="ri-close-line"></i>
          </button>
        )}
      </header>

      <div className="p-4 space-y-3 flex-1">
        <label
          onDragOver={(event) => { event.preventDefault(); setArrastrando(true); }}
          onDragLeave={(event) => { event.preventDefault(); setArrastrando(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setArrastrando(false);
            tomarArchivo(event.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center justify-center gap-1 text-center border-2 border-dashed rounded-lg px-3 py-6 transition-colors cursor-pointer ${borde}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACEPTADOS}
            className="hidden"
            onChange={(event) => tomarArchivo(event.target.files?.[0])}
          />
          <i className={`text-2xl ${estado.tipo === 'error' ? 'ri-error-warning-line text-red-500' : estado.tipo === 'aviso' ? 'ri-error-warning-line text-amber-500' : documento ? 'ri-file-check-line text-emerald-600' : 'ri-upload-cloud-2-line text-teal-600'}`}></i>
          <span className="text-sm font-medium text-gray-800 break-all">
            {documento ? documento.nombre : 'Arrastra el archivo o haz clic aquí'}
          </span>
          <span className="text-xs text-gray-500">Excel (.xlsx, .xls, .csv) o PDF (con texto o escaneado)</span>
        </label>

        {estado.tipo !== 'idle' && estado.mensaje && (
          <p className={`text-xs ${estado.tipo === 'error' ? 'text-red-600' : estado.tipo === 'leyendo' ? 'text-teal-700' : estado.tipo === 'aviso' ? 'text-amber-700' : 'text-emerald-700'}`}>
            {estado.tipo === 'leyendo' && <i className="ri-loader-4-line animate-spin mr-1"></i>}
            {estado.mensaje}
          </p>
        )}

        {documento && (
          <div className="space-y-3 pt-1">
            {documento.tipo === 'excel' && documento.hojas && documento.hojas.length > 1 && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Hoja</label>
                <select
                  value={documento.hojaActiva ?? 0}
                  onChange={(event) => onHoja(Number(event.target.value))}
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-800 cursor-pointer"
                >
                  {documento.hojas.map((hoja, indice) => (
                    <option key={hoja.nombre} value={indice}>{hoja.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {documento.tipo === 'pdf' && documento.lineas && documento.lineas.length > 0 && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                <button
                  type="button"
                  onClick={() => onSeleccionPdf(null)}
                  className={`flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${!documento.manual ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Detección automática
                </button>
                <button
                  type="button"
                  onClick={() => onSeleccionPdf(documento.seleccion ?? sugerirSeleccionPdf(documento.lineas ?? []))}
                  className={`flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${documento.manual ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Elegir columnas
                </button>
              </div>
            )}

            {(documento.tipo === 'excel' || documento.manual) && (
              <div className="grid grid-cols-2 gap-2">
                {campos.map(({ campo, nombre, opcional }) => (
                  <div key={campo} className="min-w-0">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1 truncate">
                      {nombre}
                    </label>
                    <select
                      value={documento.mapeo[campo]}
                      onChange={(event) => cambiarCampo(campo, Number(event.target.value))}
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-800 cursor-pointer"
                    >
                      {opcional && <option value={-1}>— ninguna —</option>}
                      {!opcional && documento.mapeo[campo] < 0 && <option value={-1}>— sin dato —</option>}
                      {opcionesMapeo.map((opcion) => (
                        <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {documento.tipo === 'pdf' && !documento.manual && documento.lineas && documento.lineas.length > 0 && (
              <p className="text-[11px] text-gray-500 leading-snug flex items-start gap-1.5">
                <i className="ri-bookmark-3-line mt-0.5 text-teal-600"></i>
                <span>
                  ¿Es una factura que recibís siempre igual? Elegí columnas y guardá el perfil del proveedor para que la
                  próxima se lea sola.
                </span>
              </p>
            )}

            {documento.tipo === 'pdf' && !documento.lineas && documento.filas.length > 0 && (
              <p className="text-[11px] text-emerald-700 leading-snug flex items-start gap-1.5">
                <i className="ri-sparkling-2-line mt-0.5"></i>
                <span>
                  Este documento se leyó con IA porque no trae texto seleccionable. Revisá la vista previa antes de comparar.
                </span>
              </p>
            )}

            {(documento.tipo === 'excel' || (documento.tipo === 'pdf' && documento.manual)) && (
              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-2.5 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 flex items-center justify-center text-teal-700">
                    <i className="ri-bookmark-3-line text-sm"></i>
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
                    Guardar columnas por proveedor
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={proveedor}
                    onChange={(event) => setProveedor(event.target.value)}
                    placeholder="Proveedor (ej. ACME)"
                    className="flex-1 min-w-0 text-sm border border-teal-200 rounded-md px-2 py-1.5 bg-white text-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => onGuardarPerfil(proveedor)}
                    disabled={!proveedor.trim()}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      proveedor.trim()
                        ? 'bg-teal-600 text-white hover:bg-teal-700 cursor-pointer'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <i className="ri-save-3-line"></i>
                    Guardar
                  </button>
                </div>
                <p className="text-[11px] leading-snug text-teal-800/80">
                  {documento.tipo === 'excel'
                    ? 'Este Excel de proveedor tiene un formato propio. Guardá su perfil y la próxima vez se detecta solo, aunque las columnas vengan en otro orden o con otros títulos.'
                    : 'La próxima factura de este proveedor se va a leer sola con estas columnas.'}
                </p>
                {perfiles.length > 0 && (
                  <select
                    value=""
                    onChange={(event) => {
                      const perfil = perfiles.find((item) => item.id === event.target.value);
                      if (perfil) onAplicarPerfil(perfil);
                    }}
                    className="w-full text-sm border border-teal-200 rounded-md px-2 py-1.5 bg-white text-gray-800 cursor-pointer"
                  >
                    <option value="">Usar un perfil guardado…</option>
                    {perfiles
                      .filter((perfil) => perfil.tipo === documento.tipo)
                      .map((perfil) => (
                        <option key={perfil.id} value={perfil.id}>{perfil.proveedor}</option>
                      ))}
                  </select>
                )}
                {perfilAplicado && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] text-teal-800 truncate">
                      Aplicado: <b className="font-semibold">{perfilAplicado.proveedor}</b>
                    </span>
                    <button
                      type="button"
                      onClick={() => onEliminarPerfil(perfilAplicado.id)}
                      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600 cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-delete-bin-6-line"></i>
                      Olvidar
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-gray-500">
                {documento.filas.length} línea(s) leídas
                {documento.tipo === 'pdf' && documento.paginas ? ` · ${documento.paginas} pág.` : ''}
              </span>
              <button
                type="button"
                onClick={() => setVerDetalle((prev) => !prev)}
                className="text-xs text-teal-700 hover:text-teal-800 font-medium cursor-pointer whitespace-nowrap"
              >
                {verDetalle ? 'Ocultar vista previa' : 'Ver vista previa'}
              </button>
            </div>

            {verDetalle && (
              <div className="border border-gray-200 rounded-lg overflow-auto max-h-56 bg-white">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {documento.etiquetas.map((etiqueta) => (
                        <th key={etiqueta} className="text-left font-semibold text-gray-600 px-2 py-1 whitespace-nowrap border-b border-gray-200">
                          {etiqueta}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {documento.filas.slice(0, 25).map((fila, indice) => (
                      <tr key={`${documento.nombre}-${indice}`} className="odd:bg-white even:bg-gray-50/60">
                        {documento.etiquetas.map((etiqueta, columna) => (
                          <td key={etiqueta} className="px-2 py-1 text-gray-700 whitespace-nowrap max-w-[180px] truncate">
                            {String(fila.celdas[columna] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}