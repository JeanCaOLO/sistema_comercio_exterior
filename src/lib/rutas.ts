import { supabase } from './supabase';

// ============================================================
// RUTAS LOGÍSTICAS CONFIGURABLES
// Fuente única de verdad: se guardan en configuracion_sistema
// (clave 'rutas_logisticas') y se consumen en todo el sistema:
//   - FormularioExpediente (crear ticket)
//   - GestionExpedientes / ListaExpedientes (editar ticket)
//   - CargaDocumentosCAA (selección de ruta por módulo)
//   - notificaciones.ts (destinatarios por ruta)
//
// Además de la base de datos, mantenemos una caché en memoria.
// Al guardar desde Configuración, la caché se actualiza al instante,
// por lo que cualquier ruta nueva aparece de inmediato en TODOS los
// componentes sin depender de que cada uno vuelva a consultar la base.
// ============================================================

export type ModuloRuta = 'dropship' | 'zf';

export interface RutaLogistica {
  id: string;
  /** Nombre corto. Es el valor que se guarda en expedientes.tipo_po */
  key: string;
  /** Descripción larga que se muestra en el formulario */
  label: string;
  /** Módulo al que pertenece */
  modulo: ModuloRuta;
  /** Correos que se notifican al cargar documentos en esta ruta (Carga CAA) */
  emails: string[];
  /** Si está inactiva, no aparece en los selectores del sistema */
  activa: boolean;
}

const CLAVE_CONFIG = 'rutas_logisticas';

/** Caché en memoria. Se llena en la primera lectura y se actualiza al guardar. */
let rutasCache: RutaLogistica[] | null = null;

/** Devuelve una copia profunda para evitar mutaciones accidentales de la caché. */
function clonarRutas(rutas: RutaLogistica[]): RutaLogistica[] {
  return rutas.map((r) => ({ ...r, emails: [...r.emails] }));
}

// Rutas por defecto — replican el comportamiento original del sistema.
// Se usan como respaldo si todavía no hay rutas guardadas en la base.
export const RUTAS_POR_DEFECTO: RutaLogistica[] = [
  {
    id: 'ruta-zf-overseas',
    key: 'ZF - OVERSEAS',
    label: 'ZF - OVERSEAS LOGISTICS OPERATIONS',
    modulo: 'zf',
    emails: ['scambronero@ologistics.com'],
    activa: true,
  },
  {
    id: 'ruta-directo-cr-consorcio',
    key: 'Directo CR - CONSORCIO',
    label: 'Directo CR - CONSORCIO FERRETERO DE SAN JOSE, S.A.',
    modulo: 'dropship',
    emails: ['jchavarrias@ologistics.com'],
    activa: true,
  },
  {
    id: 'ruta-directo-cr-epa-cr',
    key: 'Directo CR - EPA CR',
    label: 'Directo CR - FERRETERIA EPA, S.A.',
    modulo: 'dropship',
    emails: ['jchavarrias@ologistics.com'],
    activa: true,
  },
  {
    id: 'ruta-directo-gt-epa-gt',
    key: 'Directo GT - EPA GT',
    label: 'Directo GT - FERRETERIA EPA, S.A.',
    modulo: 'dropship',
    emails: ['kcortesm@ologistics.com'],
    activa: true,
  },
  {
    id: 'ruta-directo-sv-epa-sv',
    key: 'Directo SV - EPA SV',
    label: 'Directo SV - FERRETERIA EPA, C.A.',
    modulo: 'dropship',
    emails: ['kcortesm@ologistics.com'],
    activa: true,
  },
  {
    id: 'ruta-directo-ve-febeca',
    key: 'Directo VE - FEBECA',
    label: 'Directo VE - FEBECA C.A.',
    modulo: 'dropship',
    emails: ['nherrera@ologistics.com'],
    activa: true,
  },
  {
    id: 'ruta-directo-ve-epa-ve',
    key: 'Directo VE - EPA VE',
    label: 'Directo VE - FERRETERIA EPA, C.A.',
    modulo: 'dropship',
    emails: ['nherrera@ologistics.com'],
    activa: true,
  },
  {
    id: 'ruta-gl-gt-epa-gt',
    key: 'GL GT - EPA GT',
    label: 'GL GT - FERRETERIA EPA, S.A. (Guatemala)',
    modulo: 'dropship',
    emails: ['kcortesm@ologistics.com'],
    activa: true,
  },
  {
    id: 'ruta-gl-sv-epa-sv',
    key: 'GL SV - EPA SV',
    label: 'GL SV - FERRETERIA EPA, S.A. DE C.V.',
    modulo: 'dropship',
    emails: ['kcortesm@ologistics.com'],
    activa: true,
  },
];

// Normaliza una ruta guardada (puede venir parcial o de una versión anterior).
function normalizarRuta(ruta: any, index: number): RutaLogistica {
  const modulo: ModuloRuta = ruta?.modulo === 'zf' ? 'zf' : 'dropship';
  return {
    id: ruta?.id || `ruta-${index}-${Date.now()}`,
    key: (ruta?.key || '').toString(),
    label: (ruta?.label || ruta?.key || '').toString(),
    modulo,
    emails: Array.isArray(ruta?.emails)
      ? ruta.emails.filter((e: any) => typeof e === 'string' && e.trim() !== '')
      : [],
    activa: ruta?.activa !== false,
  };
}

// Carga todas las rutas (activas e inactivas).
// - Si `force` es false y hay caché, devuelve la caché (rápido y consistente).
// - Si no, consulta la base. Tolerante a filas duplicadas: toma la más reciente.
// - Si no hay nada guardado o falla la consulta, usa las rutas por defecto
//   (Pero NUNCA pisa una caché válida con los valores por defecto ante un error).
export async function cargarRutas(force = false): Promise<RutaLogistica[]> {
  if (!force && rutasCache) {
    return clonarRutas(rutasCache);
  }

  try {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('valor, updated_at')
      .eq('clave', CLAVE_CONFIG)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    const fila = data && data.length > 0 ? data[0] : null;
    // La columna `valor` es jsonb, pero por si en alguna base quedó como texto
    // (o vino serializada), toleramos que llegue como string y la parseamos.
    let valor: any = fila?.valor ?? null;
    if (typeof valor === 'string') {
      try {
        valor = JSON.parse(valor);
      } catch {
        valor = null;
      }
    }
    if (Array.isArray(valor) && valor.length > 0) {
      rutasCache = valor.map((r: any, i: number) => normalizarRuta(r, i));
      return clonarRutas(rutasCache);
    }

    // Sin configuración guardada todavía → valores por defecto
    rutasCache = clonarRutas(RUTAS_POR_DEFECTO);
    return clonarRutas(rutasCache);
  } catch (error) {
    console.error('[Rutas] Error al cargar rutas desde la base:', error);
    // Ante un error, conservamos la caché si existía; si no, usamos las por defecto.
    return clonarRutas(rutasCache ?? RUTAS_POR_DEFECTO);
  }
}

// Carga solo las rutas activas (para selectores del sistema).
export async function cargarRutasActivas(force = false): Promise<RutaLogistica[]> {
  const rutas = await cargarRutas(force);
  return rutas.filter((r) => r.activa !== false && r.key);
}

// Guarda el arreglo completo de rutas en configuracion_sistema.
// Usa el id de la fila existente (tolerante a duplicados: actualiza la primera)
// y actualiza la caché en memoria al terminar para que todo el sistema lo refleje.
export async function guardarRutas(rutas: RutaLogistica[]): Promise<void> {
  const copia = clonarRutas(rutas);

  const { data: filas, error: errorSelect } = await supabase
    .from('configuracion_sistema')
    .select('id')
    .eq('clave', CLAVE_CONFIG)
    .order('updated_at', { ascending: false });

  if (errorSelect) throw errorSelect;

  if (filas && filas.length > 0) {
    // `.select()` nos devuelve la fila escrita: si viene vacío significa que la
    // base no persistió el cambio (por ejemplo permisos/RLS), y lo avisamos en
    // vez de dar por guardado algo que nunca se escribió.
    const { data: escritas, error } = await supabase
      .from('configuracion_sistema')
      .update({ valor: copia, updated_at: new Date().toISOString() })
      .eq('id', filas[0].id)
      .select('id');
    if (error) throw error;
    if (!escritas || escritas.length === 0) {
      throw new Error('La base de datos no permitió guardar las rutas. Revisá los permisos (RLS) de configuracion_sistema.');
    }
  } else {
    const { data: escritas, error } = await supabase
      .from('configuracion_sistema')
      .insert([{
        clave: CLAVE_CONFIG,
        valor: copia,
        descripcion: 'Rutas logísticas configurables del sistema',
      }])
      .select('id');
    if (error) throw error;
    if (!escritas || escritas.length === 0) {
      throw new Error('La base de datos no permitió guardar las rutas. Revisá los permisos (RLS) de configuracion_sistema.');
    }
  }

  // Actualiza la caché para que todos los componentes vean el cambio al instante.
  rutasCache = copia;

  // Avisa a cualquier componente montado para que refresque sus selectores
  // sin necesidad de recargar la página.
  try {
    window.dispatchEvent(new CustomEvent('rutasActualizadas'));
  } catch {
    // En entornos sin window (SSR/pruebas) simplemente se ignora.
  }
}

// Busca los correos de notificación de una ruta por su key.
// Se usa desde notificaciones.ts para respetar la configuración actual.
export async function getEmailsRuta(rutaKey: string): Promise<string[]> {
  try {
    const rutas = await cargarRutas();
    const ruta = rutas.find((r) => r.key === rutaKey);
    if (ruta && Array.isArray(ruta.emails) && ruta.emails.length > 0) {
      return ruta.emails;
    }
    return [];
  } catch (error) {
    console.error('[Rutas] Error al obtener correos de la ruta:', error);
    return [];
  }
}