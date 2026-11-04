import { useCallback, useEffect, useMemo, useState } from 'react';
import ZonaCargaDocumento, { type EstadoCarga } from './ZonaCargaDocumento';
import ResultadoComparador from './ResultadoComparador';
import {
  aplicarMapeoPorEtiquetas,
  aplicarSeleccionPdf,
  cambiarHoja,
  combinarDocumentos,
  comparar,
  leerDocumento,
  lineasParaFirma,
  volverAAutomaticoPdf,
  type DocumentoLeido,
  type MapeoColumnas,
  type ResultadoComparacion,
  type SeleccionPdf,
} from '@/lib/comparadorDocumentos';
import {
  buscarPerfilComparador,
  buscarPerfilExcel,
  eliminarPerfilComparador,
  firmarLayoutExcel,
  firmarLayoutPdf,
  guardarPerfilComparador,
  leerPerfilesComparador,
  type PerfilColumnas,
} from '@/lib/perfilesComparador';
import { leerFacturaConIa } from '@/lib/ocrFactura';

type LadoDocumento = 'a' | 'b';

const ESTADO_INICIAL: EstadoCarga = { tipo: 'idle' };

export default function ComparadorDocumentos() {
  const [docsA, setDocsA] = useState<DocumentoLeido[]>([]);
  const [docsB, setDocsB] = useState<DocumentoLeido[]>([]);
  const [perfilesA, setPerfilesA] = useState<(PerfilColumnas | null)[]>([]);
  const [perfilesB, setPerfilesB] = useState<(PerfilColumnas | null)[]>([]);
  const [estadoA, setEstadoA] = useState<EstadoCarga>(ESTADO_INICIAL);
  const [estadoB, setEstadoB] = useState<EstadoCarga>(ESTADO_INICIAL);
  const [perfiles, setPerfiles] = useState<PerfilColumnas[]>([]);
  const [tolerancia, setTolerancia] = useState(0.01);
  const [resultado, setResultado] = useState<ResultadoComparacion | null>(null);

  useEffect(() => {
    setPerfiles(leerPerfilesComparador());
  }, []);

  const listaDocs = useCallback((lado: LadoDocumento) => (lado === 'a' ? docsA : docsB), [docsA, docsB]);

  const fijarDocs = (lado: LadoDocumento, actualizar: (prev: DocumentoLeido[]) => DocumentoLeido[]) => {
    if (lado === 'a') setDocsA(actualizar);
    else setDocsB(actualizar);
  };

  const fijarPerfiles = (
    lado: LadoDocumento,
    actualizar: (prev: (PerfilColumnas | null)[]) => (PerfilColumnas | null)[],
  ) => {
    if (lado === 'a') setPerfilesA(actualizar);
    else setPerfilesB(actualizar);
  };

  const fijarPerfil = (lado: LadoDocumento, indice: number, perfil: PerfilColumnas | null) => {
    fijarPerfiles(lado, (prev) => prev.map((item, i) => (i === indice ? perfil : item)));
  };

  const fijarEstado = (lado: LadoDocumento, estado: EstadoCarga) => {
    if (lado === 'a') setEstadoA(estado);
    else setEstadoB(estado);
  };

  /** Lee un archivo y le aplica el perfil guardado del proveedor si existe. */
  const leerArchivo = async (
    archivo: File,
    catalogo: PerfilColumnas[],
  ): Promise<{ doc: DocumentoLeido; perfil: PerfilColumnas | null; aviso?: string }> => {
    const esPdf = /\.pdf$/i.test(archivo.name);

    let leido: DocumentoLeido | null = null;
    let errorTexto: any = null;
    try {
      leido = await leerDocumento(archivo);
    } catch (error) {
      errorTexto = error;
    }

    // PDF sin texto útil (escaneo o foto) o sin líneas reconocidas: se intenta con IA.
    if (esPdf && (!leido || !leido.filas.length)) {
      try {
        const conIa = await leerFacturaConIa(archivo);
        return {
          doc: conIa,
          perfil: null,
          aviso: `${conIa.nombre} leído con IA (revisá la vista previa)`,
        };
      } catch (errorIa: any) {
        if (leido && leido.lineas?.length) {
          return {
            doc: leido,
            perfil: null,
            aviso: `No pude leerlo con IA (${errorIa?.message ?? 'sin detalle'}). Usá “Elegir columnas” para marcarlas a mano.`,
          };
        }
        throw new Error(errorIa?.message || errorTexto?.message || 'No se pudo leer el PDF.');
      }
    }

    if (!leido) throw new Error(errorTexto?.message || 'No se pudo leer el archivo.');

    if (!leido.filas.length) {
      throw new Error('Leí el archivo pero no encontré líneas con referencia, bultos y precio. Revisá el mapeo de columnas.');
    }

    let doc = leido;
    let perfil: PerfilColumnas | null = null;
    if (doc.tipo === 'pdf' && doc.lineas?.length) {
      const lineasFirma = lineasParaFirma(doc);
      perfil = lineasFirma.length ? buscarPerfilComparador(lineasFirma, doc.nombre, catalogo) : null;
      if (perfil && perfil.seleccion) doc = aplicarSeleccionPdf(doc, perfil.seleccion);
    } else if (doc.tipo === 'excel') {
      const encontrado = buscarPerfilExcel(doc.etiquetas, doc.nombre, catalogo);
      if (encontrado && encontrado.perfil.mapeo) {
        perfil = encontrado.perfil;
        doc = aplicarMapeoPorEtiquetas(doc, encontrado.perfil.mapeo, encontrado.perfil.etiquetas ?? []);
      }
    }

    return { doc, perfil };
  };

  const cargar = async (lado: LadoDocumento, archivos: File[]) => {
    if (!archivos.length) return;

    const nuevos: DocumentoLeido[] = [];
    const nuevosPerfiles: (PerfilColumnas | null)[] = [];
    const fallos: string[] = [];
    const avisos: string[] = [];

    for (let i = 0; i < archivos.length; i += 1) {
      const archivo = archivos[i];
      fijarEstado(lado, {
        tipo: 'leyendo',
        mensaje: archivos.length > 1
          ? `Leyendo ${archivo.name} (${i + 1}/${archivos.length})…`
          : `Leyendo ${archivo.name}…`,
      });
      try {
        const { doc, perfil, aviso } = await leerArchivo(archivo, perfiles);
        nuevos.push(doc);
        nuevosPerfiles.push(perfil);
        if (aviso) avisos.push(aviso);
      } catch (error: any) {
        fallos.push(`${archivo.name}: ${error?.message || 'no se pudo leer'}`);
      }
    }

    if (nuevos.length) {
      fijarDocs(lado, (prev) => [...prev, ...nuevos]);
      fijarPerfiles(lado, (prev) => [...prev, ...nuevosPerfiles]);
    }

    const totalLineas = nuevos.reduce((suma, doc) => suma + doc.filas.length, 0);
    const resumen = `${nuevos.length} archivo(s) · ${totalLineas} línea(s) leídas`;
    const conPerfil = nuevosPerfiles.filter(Boolean).length;
    const detallePerfil = conPerfil ? ` · ${conPerfil} con perfil de proveedor aplicado` : '';

    if (fallos.length) {
      fijarEstado(lado, {
        tipo: 'aviso',
        mensaje: `${nuevos.length ? `${resumen}${detallePerfil}. ` : ''}No pude leer: ${fallos.join(' | ')}`,
      });
    } else if (avisos.length) {
      fijarEstado(lado, { tipo: 'aviso', mensaje: `${resumen}${detallePerfil}. ${avisos.join(' | ')}` });
    } else if (nuevos.length) {
      fijarEstado(lado, { tipo: 'listo', mensaje: `${resumen}${detallePerfil}` });
    }
  };

  const quitar = (lado: LadoDocumento, indice: number) => {
    const restantes = listaDocs(lado).filter((_, i) => i !== indice);
    fijarDocs(lado, (prev) => prev.filter((_, i) => i !== indice));
    fijarPerfiles(lado, (prev) => prev.filter((_, i) => i !== indice));
    if (!restantes.length) fijarEstado(lado, ESTADO_INICIAL);
  };

  const quitarTodos = (lado: LadoDocumento) => {
    fijarDocs(lado, () => []);
    fijarPerfiles(lado, () => []);
    fijarEstado(lado, ESTADO_INICIAL);
  };

  const actualizarDoc = (
    lado: LadoDocumento,
    indice: number,
    transformar: (doc: DocumentoLeido) => DocumentoLeido,
  ) => {
    fijarDocs(lado, (prev) => prev.map((doc, i) => (i === indice ? transformar(doc) : doc)));
  };

  const actualizarMapeo = (lado: LadoDocumento, indice: number, mapeo: MapeoColumnas) => {
    actualizarDoc(lado, indice, (doc) => ({ ...doc, mapeo }));
  };

  const actualizarHoja = (lado: LadoDocumento, indice: number, hoja: number) => {
    actualizarDoc(lado, indice, (doc) => cambiarHoja(doc, hoja));
  };

  const actualizarSeleccionPdf = (lado: LadoDocumento, indice: number, seleccion: SeleccionPdf | null) => {
    actualizarDoc(lado, indice, (doc) =>
      (seleccion ? aplicarSeleccionPdf(doc, seleccion) : volverAAutomaticoPdf(doc)),
    );
  };

  const aplicarPerfil = (lado: LadoDocumento, indice: number, perfil: PerfilColumnas) => {
    const actual = listaDocs(lado)[indice];
    if (!actual) return;

    let actualizado: DocumentoLeido = actual;
    if (perfil.tipo === 'pdf' && perfil.seleccion) {
      if (!actual.lineas || !perfil.rejilla) return;
      actualizado = aplicarSeleccionPdf(actual, perfil.seleccion);
    } else if (perfil.tipo === 'excel' && perfil.mapeo) {
      if (actual.tipo !== 'excel') return;
      actualizado = aplicarMapeoPorEtiquetas(actual, perfil.mapeo, perfil.etiquetas ?? []);
    } else {
      return;
    }

    actualizarDoc(lado, indice, () => actualizado);
    fijarPerfil(lado, indice, perfil);
    fijarEstado(lado, {
      tipo: 'listo',
      mensaje: `${actual.nombre} · perfil «${perfil.proveedor}» aplicado`,
    });
  };

  const guardarPerfil = (lado: LadoDocumento, indice: number, proveedor: string) => {
    const actual = listaDocs(lado)[indice];
    if (!actual) return;
    const nombre = proveedor.trim();
    if (!nombre) return;

    let lista: PerfilColumnas[];
    if (actual.tipo === 'excel') {
      lista = guardarPerfilComparador(nombre, firmarLayoutExcel(actual.etiquetas), {
        tipo: 'excel',
        mapeo: actual.mapeo,
        etiquetas: actual.etiquetas,
      });
    } else {
      const lineasFirma = lineasParaFirma(actual);
      if (!lineasFirma.length || !actual.seleccion) return;
      lista = guardarPerfilComparador(nombre, firmarLayoutPdf(lineasFirma), {
        tipo: 'pdf',
        seleccion: actual.seleccion,
        rejilla: true,
      });
    }

    setPerfiles(lista);
    const guardado = lista.find(
      (item) => item.tipo === actual.tipo && item.proveedor.toLowerCase() === nombre.toLowerCase(),
    );
    if (guardado) fijarPerfil(lado, indice, guardado);
  };

  const eliminarPerfil = (id: string) => {
    const lista = eliminarPerfilComparador(id);
    setPerfiles(lista);
    setPerfilesA((prev) => prev.map((perfil) => (perfil?.id === id ? null : perfil)));
    setPerfilesB((prev) => prev.map((perfil) => (perfil?.id === id ? null : perfil)));
  };

  const reiniciar = () => {
    setDocsA([]);
    setDocsB([]);
    setPerfilesA([]);
    setPerfilesB([]);
    setEstadoA(ESTADO_INICIAL);
    setEstadoB(ESTADO_INICIAL);
    setResultado(null);
  };

  // Todas las facturas cargadas se unen en un solo documento para comparar.
  const docA = useMemo(
    () => combinarDocumentos(
      docsA,
      docsA.length > 1 ? `${docsA.length} facturas de proveedor` : docsA[0]?.nombre ?? 'Factura de proveedor',
    ),
    [docsA],
  );
  const docB = useMemo(
    () => combinarDocumentos(docsB, docsB[0]?.nombre ?? 'PO de Siglo'),
    [docsB],
  );

  useEffect(() => {
    if (!docA || !docB) {
      setResultado(null);
      return;
    }
    setResultado(comparar(docA, docB, tolerancia));
  }, [docA, docB, tolerancia]);

  const alTolerancia = useCallback((valor: number) => setTolerancia(valor), []);

  const hayArchivos = docsA.length > 0 || docsB.length > 0;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Comparador de Documentos</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Sube una o varias facturas del proveedor y el PO de Siglo (Excel o PDF) y te digo qué referencias faltan y dónde cambian
            bultos, unidad o precio unitario.
          </p>
        </div>
        {hayArchivos && (
          <button
            type="button"
            onClick={reiniciar}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-delete-bin-6-line"></i>
            Limpiar todo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ZonaCargaDocumento
          numero={1}
          titulo="Factura de proveedor"
          descripcion="Podés sumar varias facturas: se comparan juntas contra el PO."
          multiple
          documentos={docsA}
          estado={estadoA}
          perfiles={perfiles}
          perfilesAplicados={perfilesA}
          onArchivos={(archivos) => cargar('a', archivos)}
          onQuitar={(indice) => quitar('a', indice)}
          onQuitarTodos={() => quitarTodos('a')}
          onMapeo={(indice, mapeo) => actualizarMapeo('a', indice, mapeo)}
          onHoja={(indice, hoja) => actualizarHoja('a', indice, hoja)}
          onSeleccionPdf={(indice, seleccion) => actualizarSeleccionPdf('a', indice, seleccion)}
          onAplicarPerfil={(indice, perfil) => aplicarPerfil('a', indice, perfil)}
          onGuardarPerfil={(indice, proveedor) => guardarPerfil('a', indice, proveedor)}
          onEliminarPerfil={eliminarPerfil}
        />
        <ZonaCargaDocumento
          numero={2}
          titulo="PO de Siglo"
          descripcion="El PO con el formato fijo del sistema."
          documentos={docsB}
          estado={estadoB}
          perfiles={perfiles}
          perfilesAplicados={perfilesB}
          onArchivos={(archivos) => cargar('b', archivos)}
          onQuitar={(indice) => quitar('b', indice)}
          onQuitarTodos={() => quitarTodos('b')}
          onMapeo={(indice, mapeo) => actualizarMapeo('b', indice, mapeo)}
          onHoja={(indice, hoja) => actualizarHoja('b', indice, hoja)}
          onSeleccionPdf={(indice, seleccion) => actualizarSeleccionPdf('b', indice, seleccion)}
          onAplicarPerfil={(indice, perfil) => aplicarPerfil('b', indice, perfil)}
          onGuardarPerfil={(indice, proveedor) => guardarPerfil('b', indice, proveedor)}
          onEliminarPerfil={eliminarPerfil}
        />
      </div>

      {!docA || !docB ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
              <i className="ri-lightbulb-line text-lg"></i>
            </span>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">Cómo funciona</p>
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-teal-600 mt-0.5"></i>
                  <span>Podés cargar <b className="font-semibold">varias facturas PDF a la vez</b>: se unen y se comparan como un solo documento contra el PO.</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-teal-600 mt-0.5"></i>
                  <span>En Excel la lectura es automática: detecta referencia, bultos, unidad y precio aunque el formato cambie.</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-teal-600 mt-0.5"></i>
                  <span>En PDF, si la detección automática no acierta, elige <b className="font-semibold">“Elegir columnas”</b> y
                    indica cuál columna es la referencia, los bultos y el precio unitario.</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-teal-600 mt-0.5"></i>
                  <span>Guarda ese mapeo con el nombre del proveedor, tanto en PDF como en Excel: la próxima factura suya se va a leer sola.</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-teal-600 mt-0.5"></i>
                  <span>Cuando ambos lados están cargados podés copiar el reporte, descargarlo en Excel o sacar un PDF listo para enviarle al proveedor.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : resultado ? (
        <ResultadoComparador
          resultado={resultado}
          tolerancia={tolerancia}
          nombreArchivo={docA.nombre}
          factura={docA.nombre}
          po={docB.nombre}
          onTolerancia={alTolerancia}
          onNueva={reiniciar}
        />
      ) : null}
    </div>
  );
}