import { supabase } from '@/lib/supabase';
import type { PaginaRepositorio, RegistroRepositorio } from '@/pages/home/components/repositorio/types';

const COLUMNAS_CAA = 'id, po_tiquetera, tipo_po, solicitante, tipo_modulo, estado_expediente, bl_cargado, packing_list_cargado, numero_bl, numero_contenedor, tc_cargado, aplica_tlc, doc, exp_id, created_at, responsable_creacion, prioridad, prioridad_urgente, instrucciones_adicionales';

const COLUMNAS_EXP = 'id, po_tiquetera, tipo_po, solicitante, tipo_modulo, estado_expediente, bl_cargado, packing_list_cargado, numero_bl, numero_contenedor, transito_corto, aplica_tlc, doc, exp_id, created_at, responsable_creacion, cargador_documentos, prioridad, prioridad_urgente, instrucciones_adicionales';

/** Columnas donde se busca el texto libre, por tabla */
const CAMPOS_BUSQUEDA_CAA = ['po_tiquetera', 'exp_id', 'solicitante', 'responsable_creacion', 'tipo_po', 'doc'];
const CAMPOS_BUSQUEDA_EXP = [...CAMPOS_BUSQUEDA_CAA, 'cargador_documentos'];

/**
 * Limpia el término para no romper la sintaxis de `.or()` de PostgREST
 * (las comas y paréntesis separan condiciones).
 */
const limpiarTermino = (termino: string): string =>
  termino.replace(/[,()%*:"'\\]/g, ' ').replace(/\s+/g, ' ').trim();

const construirOr = (termino: string, campos: string[]): string =>
  campos.map((campo) => `${campo}.ilike.%${termino}%`).join(',');

const normalizarCaa = (fila: any): RegistroRepositorio => ({
  ...fila,
  estado_expediente: 'Documentación',
  origen: 'cca',
});

const normalizarExpediente = (fila: any): RegistroRepositorio => ({
  ...fila,
  origen: 'expediente',
  // En expedientes el campo se llama transito_corto; se normaliza a tc_cargado
  tc_cargado: fila.transito_corto,
});

const ordenarPorFecha = (a: RegistroRepositorio, b: RegistroRepositorio) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

interface ParametrosPagina {
  pagina: number;
  porPagina: number;
  busqueda: string;
  filtroEstado: string;
  filtroModulo: string;
}

/**
 * Trae SOLO lo necesario para pintar la página visible.
 *
 * documentos_caa y expedientes viven en tablas distintas y se muestran
 * mezclados por fecha, así que para reconstruir la ventana exacta se piden
 * como máximo (página × tamaño) filas de cada tabla: el prefijo de una mezcla
 * de longitud k nunca necesita más de k elementos de cada lista. Antes se
 * descargaban todas las filas de ambas tablas en cada visita.
 */
export const cargarPaginaRepositorio = async ({
  pagina,
  porPagina,
  busqueda,
  filtroEstado,
  filtroModulo,
}: ParametrosPagina): Promise<PaginaRepositorio> => {
  const limite = Math.max(1, pagina * porPagina);
  const termino = limpiarTermino(busqueda);
  const incluirCaa = filtroEstado === 'Todos' || filtroEstado === 'Documentación';

  let caaQuery: any = null;
  if (incluirCaa) {
    caaQuery = supabase
      .from('documentos_caa')
      .select(COLUMNAS_CAA, { count: 'exact' });
    if (termino) caaQuery = caaQuery.or(construirOr(termino, CAMPOS_BUSQUEDA_CAA));
    if (filtroModulo !== 'Todos') caaQuery = caaQuery.eq('tipo_modulo', filtroModulo);
    caaQuery = caaQuery.order('created_at', { ascending: false }).range(0, limite - 1);
  }

  let expQuery: any = supabase
    .from('expedientes')
    .select(COLUMNAS_EXP, { count: 'exact' });
  if (termino) expQuery = expQuery.or(construirOr(termino, CAMPOS_BUSQUEDA_EXP));
  if (filtroEstado !== 'Todos') expQuery = expQuery.eq('estado_expediente', filtroEstado);
  if (filtroModulo !== 'Todos') expQuery = expQuery.eq('tipo_modulo', filtroModulo);
  expQuery = expQuery.order('created_at', { ascending: false }).range(0, limite - 1);

  const [resCaa, resExp] = await Promise.all([
    caaQuery ?? Promise.resolve({ data: [], count: 0, error: null }),
    expQuery,
  ]);

  if (resCaa?.error) console.error('Error al cargar documentos_caa:', resCaa.error);
  if (resExp?.error) console.error('Error al cargar expedientes:', resExp.error);

  const filasCaa: RegistroRepositorio[] = (resCaa?.data || []).map(normalizarCaa);
  const filasExp: RegistroRepositorio[] = (resExp?.data || []).map(normalizarExpediente);

  const total = (resCaa?.count || 0) + (resExp?.count || 0);

  const offset = Math.max(0, (pagina - 1) * porPagina);
  const registros = [...filasCaa, ...filasExp]
    .sort(ordenarPorFecha)
    .slice(offset, offset + porPagina);

  return { registros, total };
};