// Subida de documentos al bucket de Storage, optimizada para el comportamiento
// real de este proyecto.
//
// Diagnóstico medido en producción:
//   - El archivo SÍ se escribe en el bucket en menos de 1 segundo.
//   - Pero la respuesta HTTP de la subida nunca regresa: el gateway la corta a
//     los 60 s con una página HTML de 504. Antes se leía como JSON y reventaba
//     con "Unexpected token '<'".
//   - La lectura pública del archivo responde en ~0.5 s.
//
// Conclusión: no hay que esperar la respuesta de la subida. Se lanza la subida y
// en paralelo se consulta la URL pública del archivo; en cuanto aparece, la
// carga se da por buena (normalmente en 1-3 s) y se cancela la petición que
// quedó colgada para liberar la conexión del navegador.

import { supabase } from '@/lib/supabase';

export const BUCKET_DOCUMENTOS = 'expedientes-documentos';

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

/** Cada cuánto se consulta si el archivo ya apareció. */
const MS_ENTRE_CONSULTAS = 500;
/** Tiempo máximo total esperando a que el archivo aparezca. */
const MS_ESPERA_MAXIMA = 45000;
/** Margen extra cuando la subida devolvió un error explícito. */
const CONSULTAS_TRAS_ERROR = 8;

/** Limpia el nombre del archivo para que sea seguro en Storage. */
export const sanitizarNombreArchivo = (name: string): string => {
  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex > 0 ? name.substring(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.substring(dotIndex).toLowerCase() : '';
  const limpio = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `${limpio || 'documento'}${ext}`;
};

const nuevoId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* navegadores sin randomUUID */
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const esperar = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const archivoExiste = async (url: string): Promise<boolean> => {
  try {
    const respuesta = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return respuesta.ok;
  } catch {
    return false;
  }
};

/** Segunda comprobación por listado, por si el HEAD público no responde bien. */
const estaEnListado = async (ruta: string): Promise<boolean> => {
  const corte = ruta.lastIndexOf('/');
  if (corte < 0) return false;
  const carpeta = ruta.substring(0, corte);
  const nombre = ruta.substring(corte + 1);

  try {
    const { data } = await supabase.storage.from(BUCKET_DOCUMENTOS).list(carpeta, {
      limit: 100,
      search: nombre,
    });
    return (data || []).some((item) => item.name === nombre);
  } catch {
    return false;
  }
};

const leerToken = async (): Promise<string> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || SUPABASE_ANON_KEY;
  } catch {
    return SUPABASE_ANON_KEY;
  }
};

interface ResultadoPeticion {
  ok: boolean;
  mensaje: string;
}

/** Dispara la subida real. Puede quedarse colgada: se cancela con el signal. */
const enviarArchivo = async (
  ruta: string,
  file: File,
  signal: AbortSignal
): Promise<ResultadoPeticion> => {
  const token = await leerToken();
  const rutaCodificada = ruta
    .split('/')
    .map((parte) => encodeURIComponent(parte))
    .join('/');

  const respuesta = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET_DOCUMENTOS}/${rutaCodificada}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
        'cache-control': 'max-age=3600',
        'x-upsert': 'false',
      },
      body: file,
      signal,
    }
  );

  if (respuesta.ok) return { ok: true, mensaje: '' };

  let mensaje = '';
  try {
    mensaje = (await respuesta.text()).substring(0, 300);
  } catch {
    mensaje = `HTTP ${respuesta.status}`;
  }
  return { ok: false, mensaje };
};


export interface OpcionesSubida {
  /** Carpeta destino dentro del bucket (por defecto "caa"). */
  carpeta?: string;
}

/**
 * Sube un archivo y devuelve su URL pública.
 * Resuelve en cuanto el archivo aparece en el bucket (normalmente 1-3 s).
 */
export async function subirDocumento(
  file: File,
  opciones: OpcionesSubida = {}
): Promise<string> {
  const carpeta = (opciones.carpeta || 'caa').replace(/^\/+|\/+$/g, '');
  const ruta = `${carpeta}/${nuevoId()}/${Date.now()}_${sanitizarNombreArchivo(file.name)}`;

  const { data: urlData } = supabase.storage.from(BUCKET_DOCUMENTOS).getPublicUrl(ruta);
  const urlPublica = urlData?.publicUrl || '';

  if (!urlPublica) {
    throw new Error(`No se pudo preparar la subida de "${file.name}".`);
  }

  const control = new AbortController();
  let peticionTerminada = false;
  let mensajeError = '';
  let peticionExitosa = false;

  enviarArchivo(ruta, file, control.signal)
    .then((resultado) => {
      peticionExitosa = resultado.ok;
      mensajeError = resultado.ok ? '' : resultado.mensaje;
    })
    .catch((error: unknown) => {
      const texto = error instanceof Error ? error.message : String(error);
      if (!texto.toLowerCase().includes('abort')) mensajeError = texto;
    })
    .finally(() => {
      peticionTerminada = true;
    });

  const inicio = Date.now();
  let consultasTrasError = 0;

  while (Date.now() - inicio < MS_ESPERA_MAXIMA) {
    if (await archivoExiste(urlPublica)) {
      control.abort();
      return urlPublica;
    }

    if (peticionExitosa) {
      // La subida respondió bien: damos un instante a que se propague.
      control.abort();
      return urlPublica;
    }

    if (peticionTerminada && mensajeError) {
      consultasTrasError += 1;
      if (consultasTrasError >= CONSULTAS_TRAS_ERROR) break;
    }

    await esperar(MS_ENTRE_CONSULTAS);
  }

  control.abort();

  // Últimas comprobaciones antes de rendirse.
  if (await archivoExiste(urlPublica)) return urlPublica;
  if (await estaEnListado(ruta)) return urlPublica;

  if (mensajeError.toLowerCase().includes('bucket')) {
    throw new Error(
      'El almacenamiento de documentos no está configurado (bucket "expedientes-documentos").'
    );
  }

  const detalle = limpiarMensaje(mensajeError);

  if (detalle) {
    throw new Error(`Error subiendo "${file.name}": ${detalle}`);
  }

  throw new Error(
    `No se pudo confirmar la subida de "${file.name}". El servicio de archivos está respondiendo lento; espera unos segundos y vuelve a intentar.`
  );
}

/** Sube varios archivos en paralelo y devuelve las URLs en el mismo orden. */
export async function subirDocumentos(
  files: File[],
  opciones: OpcionesSubida = {}
): Promise<string[]> {
  return Promise.all(files.map((file) => subirDocumento(file, opciones)));
}

const esErrorDeServicio = (mensaje: string): boolean => {
  const m = (mensaje || '').toLowerCase();
  return (
    m.includes('unexpected token') ||
    m.includes('<html') ||
    m.includes('gateway') ||
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('failed to fetch') ||
    m.includes('network') ||
    m.includes('504') ||
    m.includes('503') ||
    m.includes('502')
  );
};

const limpiarMensaje = (mensaje: string): string => {
  const texto = (mensaje || '').trim();
  if (!texto || esErrorDeServicio(texto)) return '';
  return texto.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
};