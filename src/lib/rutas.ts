import { supabase } from './supabase';

// ============================================================
// RUTAS LOGÍSTICAS CONFIGURABLES
// Fuente única de verdad: se guardan en configuracion_sistema
// (clave 'rutas_logisticas') y se consumen en todo el sistema:
//   - FormularioExpediente (crear ticket)
//   - GestionExpedientes / ListaExpedientes (editar ticket)
//   - CargaDocumentosCAA (selección de ruta por módulo)
//   - notificaciones.ts (destinatarios por ruta)
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

// Carga todas las rutas (activas e inactivas). Si no hay nada guardado o falla
// la consulta, devuelve las rutas por defecto para no romper el sistema.
export async function cargarRutas(): Promise<RutaLogistica[]> {
  try {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('valor')
      .eq('clave', CLAVE_CONFIG)
      .maybeSingle();

    if (error) throw error;

    if (data?.valor && Array.isArray(data.valor) && data.valor.length > 0) {
      return data.valor.map((r: any, i: number) => normalizarRuta(r, i));
    }
    return RUTAS_POR_DEFECTO;
  } catch (error) {
    console.error('[Rutas] Error al cargar rutas, usando valores por defecto:', error);
    return RUTAS_POR_DEFECTO;
  }
}

// Carga solo las rutas activas (para selectores del sistema).
export async function cargarRutasActivas(): Promise<RutaLogistica[]> {
  const rutas = await cargarRutas();
  return rutas.filter((r) => r.activa !== false && r.key);
}

// Guarda el arreglo completo de rutas en configuracion_sistema.
export async function guardarRutas(rutas: RutaLogistica[]): Promise<void> {
  const { data: existente } = await supabase
    .from('configuracion_sistema')
    .select('id')
    .eq('clave', CLAVE_CONFIG)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from('configuracion_sistema')
      .update({ valor: rutas, updated_at: new Date().toISOString() })
      .eq('clave', CLAVE_CONFIG);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('configuracion_sistema')
      .insert([{
        clave: CLAVE_CONFIG,
        valor: rutas,
        descripcion: 'Rutas logísticas configurables del sistema',
      }]);
    if (error) throw error;
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