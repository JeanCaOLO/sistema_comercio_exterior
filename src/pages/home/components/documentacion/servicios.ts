import { supabase } from '@/lib/supabase';
import { parseDocEntries, combinarEntradas, esPackingList, type DocEntry } from '@/lib/documentos';
import { crearNotificacion } from '@/lib/notificaciones';
import { hoyLocal } from '@/lib/fechas';
import type { DocumentoCAA, ModuloDestino } from '@/pages/home/components/documentacion/types';

const TABLA = 'documentos_caa';

export const cargarDocumentosCaa = async (): Promise<DocumentoCAA[]> => {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as DocumentoCAA[];
};

/** Recarga sin spinner: mantiene la UI usable mientras sincroniza */
export const recargarDocumentosCaa = async (): Promise<DocumentoCAA[] | null> => {
  try {
    return await cargarDocumentosCaa();
  } catch (error) {
    console.error('Error en recarga silenciosa:', error);
    return null;
  }
};

export const obtenerNombreUsuario = async (): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Sistema';

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('email', user.email)
      .maybeSingle();

    return usuario?.nombre || 'Sistema';
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return 'Sistema';
  }
};

export interface ResultadoConsolidacion {
  nuevoExpId: string;
  totalPos: number;
  totalDocumentos: number;
}

/**
 * Consolida las filas seleccionadas en UN solo expediente destino.
 * Preserva auditoría (cargador original inmutable), historial de cambios y tiempos.
 */
export const consolidarDocumentos = async (
  ids: string[],
  targetModulo: ModuloDestino,
  marcarMCG: boolean
): Promise<ResultadoConsolidacion> => {
  const ahora = new Date().toISOString();
  const hoy = hoyLocal();
  const nombreUsuario = await obtenerNombreUsuario();

  const { data: docsCAA, error: fetchError } = await supabase
    .from(TABLA)
    .select('*')
    .in('id', ids);

  if (fetchError) throw new Error(`Error al leer documentos: ${fetchError.message}`);
  if (!docsCAA || docsCAA.length === 0) throw new Error('No se encontraron los documentos seleccionados.');

  const todasLasPOs: string[] = [];
  const todasLasEntradas: DocEntry[] = [];
  const grupos: any[] = [];
  let algunBL = false;
  let algunPL = false;
  let algunTC = false;
  let algunTLC = false;
  let numeroBlConsolidado = '';
  let numeroContenedorConsolidado = '';

  for (const doc of docsCAA as any[]) {
    // Cada fila puede tener múltiples POs separadas por " / "
    if (doc.po_tiquetera) {
      const pos = doc.po_tiquetera.split('/').map((p: string) => p.trim()).filter(Boolean);
      todasLasPOs.push(...pos);
    }

    const entradasFila = parseDocEntries(doc.doc);
    todasLasEntradas.push(...entradasFila);

    if (doc.bl_cargado) algunBL = true;
    if (doc.packing_list_cargado || entradasFila.some(esPackingList)) algunPL = true;
    if (!numeroBlConsolidado && doc.numero_bl) numeroBlConsolidado = doc.numero_bl;
    if (!numeroContenedorConsolidado && doc.numero_contenedor) numeroContenedorConsolidado = doc.numero_contenedor;
    if (doc.tc_cargado) algunTC = true;
    if (doc.aplica_tlc) algunTLC = true;

    // Se preserva la fila original (PO + documentos) para poder separarla
    // tal cual vino si el ticket se devuelve a Documentación
    grupos.push({
      po_tiquetera: doc.po_tiquetera,
      tipo_po: doc.tipo_po,
      solicitante: doc.solicitante,
      tipo_modulo: doc.tipo_modulo,
      bl_cargado: doc.bl_cargado,
      packing_list_cargado: doc.packing_list_cargado || entradasFila.some(esPackingList),
      numero_bl: doc.numero_bl || null,
      numero_contenedor: doc.numero_contenedor || null,
      tc_cargado: doc.tc_cargado,
      aplica_tlc: doc.aplica_tlc,
      doc: entradasFila,
      responsable_creacion: doc.responsable_creacion,
      instrucciones_adicionales: doc.instrucciones_adicionales,
      fecha_solicitud: doc.fecha_solicitud,
      prioridad: doc.prioridad,
      prioridad_urgente: doc.prioridad_urgente,
      motivo_urgencia: doc.motivo_urgencia,
      dificultad: doc.dificultad,
      tiempo_minutos: doc.tiempo_minutos,
      dias_entrega: doc.dias_entrega,
      fecha_requerimiento: doc.fecha_requerimiento,
      exp_id: doc.exp_id,
      lineas_oc: doc.lineas_oc,
      fecha_creacion_expediente: doc.fecha_creacion_expediente,
      created_at: doc.created_at,
    });
  }

  const poUnicas = [...new Set(todasLasPOs)];
  const entradasConsolidadas = combinarEntradas(todasLasEntradas);

  const primerDoc = (docsCAA as any[])[0];
  const {
    id: _id,
    tc_cargado: _tc,
    created_at: _createdAt,
    responsable_creacion: _respCreacion,
    ...basePayload
  } = primerDoc;

  // ─── Auditoría original ───
  const cargadoresUnicos = [...new Set((docsCAA as any[]).map((d) => d.responsable_creacion).filter(Boolean))];
  const cargadorOriginal = cargadoresUnicos.join(', ') || 'Sistema';

  const fechasCreacion = (docsCAA as any[])
    .map((d) => new Date(d.created_at || ahora).getTime())
    .filter((t) => !isNaN(t));
  const fechaMasAntigua = fechasCreacion.length > 0
    ? new Date(Math.min(...fechasCreacion)).toISOString()
    : ahora;

  const { data: nuevoExp, error: insertExpError } = await supabase
    .from('expedientes')
    .insert([{
      ...basePayload,
      po_tiquetera: poUnicas.join(' / '),
      doc: entradasConsolidadas,
      bl_cargado: algunBL,
      packing_list_cargado: algunPL,
      numero_bl: numeroBlConsolidado || null,
      numero_contenedor: numeroContenedorConsolidado || null,
      transito_corto: algunTC,
      aplica_tlc: algunTLC,
      mcg: marcarMCG,
      estado_expediente: 'No Asignado',
      tipo_modulo: targetModulo,
      fecha_creacion_expediente: hoy,
      cargador_documentos: cargadorOriginal,
      solicitante: nombreUsuario,
      responsable_creacion: '',
      created_at: fechaMasAntigua,
    }])
    .select('id, exp_id')
    .single();

  if (insertExpError) throw new Error(`Error al crear el ticket consolidado: ${insertExpError.message}`);

  const nuevoExpId = nuevoExp?.id;
  if (!nuevoExpId) throw new Error('No se pudo obtener el ID del ticket creado.');

  await supabase.from('expedientes_historial').insert([{
    expediente_id: nuevoExpId,
    campo_modificado: 'Estado',
    valor_anterior: 'Documentación',
    valor_nuevo: 'No Asignado',
    usuario: nombreUsuario,
    fecha_cambio: ahora,
    detalle: {
      tipo: 'consolidacion',
      consolidado_por: nombreUsuario,
      cargador_original: cargadorOriginal,
      total_pos: poUnicas.length,
      total_docs: entradasConsolidadas.length,
      pos: poUnicas,
      grupos,
    },
  }]);

  await supabase.from('expedientes_tiempos_estados').insert([{
    expediente_id: nuevoExpId,
    estado_anterior: 'Documentación',
    estado_nuevo: 'No Asignado',
    fecha_inicio: ahora,
    fecha_fin: null,
    minutos_transcurridos: null,
  }]);

  // Re-apuntar el historial de las filas originales al ticket nuevo
  try {
    await supabase
      .from('documento_modificaciones')
      .update({
        registro_id: nuevoExpId,
        tabla_origen: 'expedientes',
        exp_id: (nuevoExp as any)?.exp_id || null,
      })
      .in('registro_id', ids);
  } catch (histErr: any) {
    console.error('[Historial] No se pudo re-apuntar el historial al ticket consolidado:', histErr?.message || histErr);
  }

  // Limpiar la bandeja de staging
  await supabase.from(TABLA).delete().in('id', ids);

  crearNotificacion({
    poTiquetera: poUnicas.join(' / '),
    solicitante: primerDoc.solicitante || '',
    responsable: primerDoc.responsable_creacion || '',
    usuarioGenero: nombreUsuario,
    tipo: 'ticket_creado',
    mensaje: `${nombreUsuario} consolidó ${entradasConsolidadas.length} documento(s) en 1 ticket para las POs: ${poUnicas.slice(0, 3).join(', ')}${poUnicas.length > 3 ? ' y más' : ''} — enviado a ${targetModulo === 'dropship' ? 'Dropship' : 'ZF'}`,
    icono: 'ri-send-plane-line',
    expedienteId: nuevoExpId,
  });

  return {
    nuevoExpId,
    totalPos: poUnicas.length,
    totalDocumentos: entradasConsolidadas.length,
  };
};

export const eliminarDocumentosCaa = async (ids: string[]): Promise<void> => {
  const { error } = await supabase.from(TABLA).delete().in('id', ids);
  if (error) throw error;
};

export const descargarArchivo = async (url: string, fileName: string): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error al descargar');
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
};