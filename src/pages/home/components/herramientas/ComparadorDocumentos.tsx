import { useCallback, useEffect, useState } from 'react';
import ZonaCargaDocumento, { type EstadoCarga } from './ZonaCargaDocumento';
import ResultadoComparador from './ResultadoComparador';
import {
  aplicarMapeoPorEtiquetas,
  aplicarSeleccionPdf,
  cambiarHoja,
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
  const [docA, setDocA] = useState<DocumentoLeido | null>(null);
  const [docB, setDocB] = useState<DocumentoLeido | null>(null);
  const [estadoA, setEstadoA] = useState<EstadoCarga>(ESTADO_INICIAL);
  const [estadoB, setEstadoB] = useState<EstadoCarga>(ESTADO_INICIAL);
  const [perfilA, setPerfilA] = useState<PerfilColumnas | null>(null);
  const [perfilB, setPerfilB] = useState<PerfilColumnas | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilColumnas[]>([]);
  const [tolerancia, setTolerancia] = useState(0.01);
  const [resultado, setResultado] = useState<ResultadoComparacion | null>(null);

  useEffect(() => {
    setPerfiles(leerPerfilesComparador());
  }, []);

  const fijarDoc = (lado: LadoDocumento, doc: DocumentoLeido | null) => {
    if (lado === 'a') setDocA(doc);
    else setDocB(doc);
  };

  const fijarEstado = (lado: LadoDocumento, estado: EstadoCarga) => {
    if (lado === 'a') setEstadoA(estado);
    else setEstadoB(estado);
  };

  const fijarPerfil = (lado: LadoDocumento, perfil: PerfilColumnas | null) => {
    if (lado === 'a') setPerfilA(perfil);
    else setPerfilB(perfil);
  };

  const cargar = async (lado: LadoDocumento, archivo: File) => {
    fijarEstado(lado, { tipo: 'leyendo', mensaje: `Leyendo ${archivo.name}…` });
    fijarPerfil(lado, null);
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
      fijarEstado(lado, { tipo: 'leyendo', mensaje: 'El PDF no trae texto legible. Leyendo la imagen con IA…' });
      try {
        const conIa = await leerFacturaConIa(archivo);
        fijarDoc(lado, conIa);
        fijarEstado(lado, {
          tipo: 'listo',
          mensaje: `${conIa.nombre} · ${conIa.filas.length} línea(s) leídas con IA (revisá la vista previa)`,
        });
        return;
      } catch (errorIa: any) {
        if (leido && leido.lineas?.length) {
          fijarDoc(lado, leido);
          fijarEstado(lado, {
            tipo: 'aviso',
            mensaje: `No pude leerlo con IA (${errorIa?.message ?? 'sin detalle'}). Usá “Elegir columnas” para marcarlas a mano.`,
          });
          return;
        }
        throw new Error(errorIa?.message || errorTexto?.message || 'No se pudo leer el PDF.');
      }
    }

    if (!leido) throw new Error(errorTexto?.message || 'No se pudo leer el archivo.');

    if (!leido.filas.length) {
      throw new Error('Leí el archivo pero no encontré líneas con referencia, bultos y precio. Revisa el mapeo de columnas.');
    }

    try {
      // Si hay un perfil guardado para este proveedor o este formato, se aplica solo.
      let doc = leido;
      let perfil: PerfilColumnas | null = null;
      if (doc.tipo === 'pdf' && doc.lineas?.length) {
        const lineasFirma = lineasParaFirma(doc);
        perfil = lineasFirma.length ? buscarPerfilComparador(lineasFirma, doc.nombre, perfiles) : null;
        if (perfil && perfil.seleccion) doc = aplicarSeleccionPdf(doc, perfil.seleccion);
      } else if (doc.tipo === 'excel') {
        const encontrado = buscarPerfilExcel(doc.etiquetas, doc.nombre, perfiles);
        if (encontrado && encontrado.perfil.mapeo) {
          perfil = encontrado.perfil;
          doc = aplicarMapeoPorEtiquetas(doc, encontrado.perfil.mapeo, encontrado.perfil.etiquetas ?? []);
        }
      }

      fijarDoc(lado, doc);
      fijarPerfil(lado, perfil);
      fijarEstado(lado, {
        tipo: 'listo',
        mensaje: `${doc.nombre} · ${doc.filas.length} línea(s) leídas${doc.tipo === 'pdf' ? ' del PDF' : ''}${
          perfil ? ` · perfil «${perfil.proveedor}» aplicado` : ''
        }`,
      });
    } catch (error: any) {
      fijarDoc(lado, null);
      fijarPerfil(lado, null);
      fijarEstado(lado, { tipo: 'error', mensaje: error?.message || 'No se pudo leer el archivo.' });
    }
  };

  const quitar = (lado: LadoDocumento) => {
    fijarDoc(lado, null);
    fijarPerfil(lado, null);
    fijarEstado(lado, ESTADO_INICIAL);
  };

  const actualizarMapeo = (lado: LadoDocumento, mapeo: MapeoColumnas) => {
    const actual = lado === 'a' ? docA : docB;
    if (!actual) return;
    fijarDoc(lado, { ...actual, mapeo });
  };

  const actualizarHoja = (lado: LadoDocumento, indice: number) => {
    const actual = lado === 'a' ? docA : docB;
    if (!actual) return;
    fijarDoc(lado, cambiarHoja(actual, indice));
  };

  const actualizarSeleccionPdf = (lado: LadoDocumento, seleccion: SeleccionPdf | null) => {
    const actual = lado === 'a' ? docA : docB;
    if (!actual) return;
    fijarDoc(lado, seleccion ? aplicarSeleccionPdf(actual, seleccion) : volverAAutomaticoPdf(actual));
  };

  const aplicarPerfil = (lado: LadoDocumento, perfil: PerfilColumnas) => {
    const actual = lado === 'a' ? docA : docB;
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
    fijarDoc(lado, actualizado);
    fijarPerfil(lado, perfil);
    fijarEstado(lado, {
      tipo: 'listo',
      mensaje: `${actual.nombre} · perfil «${perfil.proveedor}» aplicado`,
    });
  };

  const guardarPerfil = (lado: LadoDocumento, proveedor: string) => {
    const actual = lado === 'a' ? docA : docB;
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
    if (guardado) fijarPerfil(lado, guardado);
  };

  const eliminarPerfil = (id: string) => {
    const lista = eliminarPerfilComparador(id);
    setPerfiles(lista);
    if (perfilA?.id === id) setPerfilA(null);
    if (perfilB?.id === id) setPerfilB(null);
  };

  const reiniciar = () => {
    setDocA(null);
    setDocB(null);
    setEstadoA(ESTADO_INICIAL);
    setEstadoB(ESTADO_INICIAL);
    setPerfilA(null);
    setPerfilB(null);
    setResultado(null);
  };

  useEffect(() => {
    if (!docA || !docB) {
      setResultado(null);
      return;
    }
    setResultado(comparar(docA, docB, tolerancia));
  }, [docA, docB, tolerancia]);

  const alTolerancia = useCallback((valor: number) => setTolerancia(valor), []);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Comparador de Documentos</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Sube la factura del proveedor y el PO de Siglo (Excel o PDF) y te digo qué referencias faltan y dónde cambian
            bultos, unidad o precio unitario.
          </p>
        </div>
        {(docA || docB) && (
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
          descripcion="Documento que envía el proveedor (el formato puede variar)."
          documento={docA}
          estado={estadoA}
          perfiles={perfiles}
          perfilAplicado={perfilA}
          onArchivo={(archivo) => cargar('a', archivo)}
          onQuitar={() => quitar('a')}
          onMapeo={(mapeo) => actualizarMapeo('a', mapeo)}
          onHoja={(indice) => actualizarHoja('a', indice)}
          onSeleccionPdf={(seleccion) => actualizarSeleccionPdf('a', seleccion)}
          onAplicarPerfil={(perfil) => aplicarPerfil('a', perfil)}
          onGuardarPerfil={(proveedor) => guardarPerfil('a', proveedor)}
          onEliminarPerfil={eliminarPerfil}
        />
        <ZonaCargaDocumento
          numero={2}
          titulo="PO de Siglo"
          descripcion="El PO con el formato fijo del sistema."
          documento={docB}
          estado={estadoB}
          perfiles={perfiles}
          perfilAplicado={perfilB}
          onArchivo={(archivo) => cargar('b', archivo)}
          onQuitar={() => quitar('b')}
          onMapeo={(mapeo) => actualizarMapeo('b', mapeo)}
          onHoja={(indice) => actualizarHoja('b', indice)}
          onSeleccionPdf={(seleccion) => actualizarSeleccionPdf('b', seleccion)}
          onAplicarPerfil={(perfil) => aplicarPerfil('b', perfil)}
          onGuardarPerfil={(proveedor) => guardarPerfil('b', proveedor)}
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
                  <span>Cuando ambos archivos están cargados podés copiar el reporte, descargarlo en Excel o sacar un PDF listo para enviarle al proveedor.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : resultado ? (
        <ResultadoComparador
          resultado={resultado}
          tolerancia={tolerancia}
          nombreArchivo={docA?.nombre ?? 'comparacion'}
          factura={docA?.nombre ?? ''}
          po={docB?.nombre ?? ''}
          onTolerancia={alTolerancia}
          onNueva={reiniciar}
        />
      ) : null}
    </div>
  );
}