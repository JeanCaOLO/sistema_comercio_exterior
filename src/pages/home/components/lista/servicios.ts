// Capa de servicios de la Lista de Expedientes (Supabase, historial y guardado).

import { supabase } from '@/lib/supabase';
import { notificarComentario } from '@/lib/notificaciones';
import { parseDocEntries, combinarEntradas, type DocEntry } from '@/lib/documentos';
import type { Expediente } from './types';
import { calcularDiasHabilesReales, calcularTiempoReal } from './utils';

// Trae todos los expedientes que ya no están en Documentación.
export const cargarExpedientes = async (): Promise<Expediente[]> => {
  const { data, error } = await supabase
    .from('expedientes')
    .select('*')
    .neq('estado_expediente', 'Documentación')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Expediente[];
};

// Nombres de usuarios activos (case-insensitive: activo/Activo/vacío cuentan).
export const cargarUsuariosActivos = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('nombre, rol, email, estado')
    .order('nombre');

  if (error) throw error;

  const usuarios = (data || []).filter((u: any) => {
    const estado = (u.estado || '').toLowerCase().trim();
    return estado === '' || estado === 'activo';
  });

  return usuarios.map((u: any) => u.nombre);
};

export const obtenerNombreUsuarioActual = async (): Promise<string> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'Sistema';

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('email', user.email)
      .single();

    return usuario?.nombre || 'Sistema';
  } catch (error) {
    console.error('Error al obtener usuario actual:', error);
    return 'Sistema';
  }
};

// Historial de cambios + validación de si el cargador original está autorizado.
export const cargarHistorialExpediente = async (
  expediente: Expediente
): Promise<{ historial: any[]; cargadorNoAutorizado: boolean }> => {
  const { data, error } = await supabase
    .from('expedientes_historial')
    .select('*')
    .eq('expediente_id', expediente.id)
    .order('fecha_cambio', { ascending: false });

  if (error) throw error;

  const historial = data || [];

  const cargador = expediente.cargador_documentos || expediente.solicitante || '';
  if (!cargador) {
    return { historial, cargadorNoAutorizado: true };
  }

  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('id, email')
    .eq('nombre', cargador)
    .maybeSingle();

  if (!usuarioData?.email) {
    return { historial, cargadorNoAutorizado: true };
  }

  const email = usuarioData.email.toLowerCase();
  const esListaBlanca = ['lchavala', 'smcdonald', 'mpaniagua'].some(
    (u) => email.startsWith(u.toLowerCase() + '@') || email === u.toLowerCase()
  );

  let esAdministrador = false;
  if (usuarioData?.id) {
    const { data: rolesData } = await supabase
      .from('usuario_roles')
      .select('roles!inner(nombre)')
      .eq('usuario_id', usuarioData.id);
    esAdministrador = (rolesData || []).some((r: any) => r.roles?.nombre === 'Administrador');
  }

  return { historial, cargadorNoAutorizado: !(esListaBlanca || esAdministrador) };
};

// Cierra el registro abierto del estado anterior y abre el nuevo.
export const registrarTiempoEstado = async (
  expedienteId: string,
  estadoAnterior: string,
  estadoNuevo: string
): Promise<void> => {
  try {
    const ahora = new Date().toISOString();

    const { data: registroAbierto } = await supabase
      .from('expedientes_tiempos_estados')
      .select('*')
      .eq('expediente_id', expedienteId)
      .eq('estado_nuevo', estadoAnterior)
      .is('fecha_fin', null)
      .order('fecha_inicio', { ascending: false })
      .limit(1);

    if (registroAbierto && registroAbierto.length > 0) {
      const registro = registroAbierto[0];
      const fechaInicio = new Date(registro.fecha_inicio);
      const fechaFin = new Date(ahora);
      const minutosTranscurridos = Math.round(
        (fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60)
      );

      await supabase
        .from('expedientes_tiempos_estados')
        .update({ fecha_fin: ahora, minutos_transcurridos: minutosTranscurridos })
        .eq('id', registro.id);
    }

    await supabase.from('expedientes_tiempos_estados').insert([
      {
        expediente_id: expedienteId,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        fecha_inicio: ahora,
        fecha_fin: null,
        minutos_transcurridos: null,
      },
    ]);
  } catch (error) {
    console.error('Error al registrar tiempo de estado:', error);
  }
};

const subirDocumentos = async (expedienteId: string, archivos: File[]): Promise<string[]> => {
  const urls: string[] = [];

  for (const file of archivos) {
    const fileName = `${expedienteId}/${Date.now()}_${file.name}`;

    const { error } = await supabase.storage
      .from('expedientes-documentos')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) {
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        throw new Error(
          'El almacenamiento de documentos no está configurado. Por favor, cree un bucket llamado "expedientes-documentos" en Supabase Storage con acceso público.'
        );
      }
      throw new Error(`Error al subir ${file.name}: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('expedientes-documentos')
      .getPublicUrl(fileName);

    if (urlData?.publicUrl) urls.push(urlData.publicUrl);
  }

  return urls;
};

const CAMPOS_A_COMPARAR = [
  { key: 'po_tiquetera', label: 'PO/Tiquetera' },
  { key: 'tipo_po', label: 'Ruta Logística' },
  { key: 'prioridad', label: 'Prioridad' },
  { key: 'prioridad_urgente', label: 'Prioridad Urgente' },
  { key: 'motivo_urgencia', label: 'Motivo de Urgencia' },
  { key: 'dificultad', label: 'Dificultad' },
  { key: 'tiempo_minutos', label: 'Tiempo Minutos' },
  { key: 'dias_entrega', label: 'Días de Entrega' },
  { key: 'exp_id', label: 'EXP ID' },
  { key: 'lineas_oc', label: 'Líneas OC' },
  { key: 'estado_expediente', label: 'Estado' },
  { key: 'motivo_revision', label: 'Motivo de Revisión' },
  { key: 'responsable_creacion', label: 'Responsable Creación' },
  { key: 'instrucciones_adicionales', label: 'Observaciones' },
  { key: 'transito_corto', label: 'Tránsito Corto' },
  { key: 'ok_pais', label: 'OK País' },
  { key: 'bl_cargado', label: 'BL Cargado' },
  { key: 'packing_list_cargado', label: 'Packing List Cargado' },
  { key: 'aplica_tlc', label: 'Aplica TLC' },
  { key: 'incidente', label: 'Incidente' },
  { key: 'comentario_incidente', label: 'Comentario Incidente' },
  { key: 'finiquito', label: 'Finiquito' },
  { key: 'mcg', label: 'MCG' },
  { key: 'etd', label: 'ETD' },
  { key: 'eta_real', label: 'ETA Real' },
  { key: 'recibo_delzof_fecha', label: 'Fecha Recibo Delzof' },
  { key: 'recibo_delzof_numero', label: 'N° Recibo Delzof' },
];

interface GuardarArgs {
  seleccionado: Expediente;
  original: Expediente;
  archivos: File[];
}

// Guarda los cambios del expediente y devuelve el payload para actualizar el estado local.
export const guardarCambiosExpediente = async ({
  seleccionado,
  original,
  archivos,
}: GuardarArgs): Promise<Partial<Expediente>> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let nombreUsuario = 'Sistema';
  let emailUsuario = '';

  if (user) {
    emailUsuario = user.email || '';
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('email', user.email)
      .single();
    if (usuario) nombreUsuario = usuario.nombre;
  }

  const updates: any = {
    po_tiquetera: seleccionado.po_tiquetera,
    tipo_po: seleccionado.tipo_po,
    prioridad: seleccionado.prioridad,
    prioridad_urgente: seleccionado.prioridad_urgente,
    motivo_urgencia: seleccionado.prioridad_urgente ? seleccionado.motivo_urgencia : null,
    dificultad: seleccionado.dificultad,
    tiempo_minutos: seleccionado.tiempo_minutos,
    dias_entrega: seleccionado.dias_entrega,
    exp_id: seleccionado.exp_id,
    lineas_oc: seleccionado.lineas_oc,
    estado_expediente: seleccionado.estado_expediente,
    motivo_revision:
      seleccionado.estado_expediente === 'En Revisión' ? seleccionado.motivo_revision : null,
    responsable_creacion: seleccionado.responsable_creacion,
    instrucciones_adicionales: seleccionado.instrucciones_adicionales,
    usuario_modificador: emailUsuario,
    bl_cargado: seleccionado.bl_cargado ?? false,
    packing_list_cargado: seleccionado.packing_list_cargado ?? false,
    transito_corto: seleccionado.transito_corto ?? false,
    ok_pais: seleccionado.ok_pais ?? false,
    aplica_tlc: seleccionado.aplica_tlc ?? false,
    etd: seleccionado.etd || null,
    eta_real: seleccionado.eta_real || null,
    recibo_delzof_fecha:
      seleccionado.tipo_modulo === 'zf' ? seleccionado.recibo_delzof_fecha || null : null,
    recibo_delzof_numero:
      seleccionado.tipo_modulo === 'zf'
        ? seleccionado.recibo_delzof_numero?.trim() || null
        : null,
    incidente: seleccionado.tipo_modulo === 'dropship' ? seleccionado.incidente ?? false : false,
    comentario_incidente:
      seleccionado.tipo_modulo === 'dropship' && seleccionado.incidente
        ? seleccionado.comentario_incidente || null
        : null,
    finiquito: seleccionado.tipo_modulo === 'dropship' ? seleccionado.finiquito ?? false : false,
    mcg: seleccionado.tipo_modulo === 'dropship' ? seleccionado.mcg ?? false : false,
  };

  // Documentos: detectar si se agregaron archivos nuevos
  let docsAgregados = false;
  let countDocsNuevos = 0;

  if (archivos.length > 0) {
    const nuevasUrls = await subirDocumentos(seleccionado.id, archivos);
    const entradasExistentes = parseDocEntries(seleccionado.doc);
    const nuevasEntradas: DocEntry[] = nuevasUrls.map((url) => ({ url, tipo: null }));
    updates.doc = combinarEntradas([...entradasExistentes, ...nuevasEntradas]);
    docsAgregados = true;
    countDocsNuevos = nuevasUrls.length;
  }

  for (const campo of CAMPOS_A_COMPARAR) {
    const valorAnterior = original[campo.key as keyof Expediente];
    const valorNuevo = seleccionado[campo.key as keyof Expediente];

    if (valorAnterior !== valorNuevo) {
      await supabase.from('expedientes_historial').insert([
        {
          expediente_id: seleccionado.id,
          campo_modificado: campo.label,
          valor_anterior: String(valorAnterior || ''),
          valor_nuevo: String(valorNuevo || ''),
          usuario: nombreUsuario,
          usuario_email: emailUsuario,
          fecha_cambio: new Date().toISOString(),
        },
      ]);
    }
  }

  if (docsAgregados && countDocsNuevos > 0) {
    await supabase.from('expedientes_historial').insert([
      {
        expediente_id: seleccionado.id,
        campo_modificado: 'Documentos',
        valor_anterior: '',
        valor_nuevo: `Se agregaron ${countDocsNuevos} documento(s)`,
        usuario: nombreUsuario,
        usuario_email: emailUsuario,
        fecha_cambio: new Date().toISOString(),
      },
    ]);
  }

  // Cierre: congelar tiempos al llegar al estado final
  const estadoFinal = seleccionado.tipo_modulo === 'dropship' ? 'Notificado' : 'Completado';
  const estadoNuevo = seleccionado.estado_expediente;
  const estadoAnterior = original.estado_expediente;

  if (estadoNuevo === estadoFinal && estadoAnterior !== estadoFinal) {
    const fechaInicio =
      seleccionado.fecha_apertura ||
      seleccionado.fecha_creacion_expediente ||
      seleccionado.created_at;
    const fechaLiberacion = new Date().toISOString();

    updates.fecha_liberacion = fechaLiberacion;
    updates.tiempo_real_minutos = calcularTiempoReal(fechaInicio, fechaLiberacion);
    updates.dias_entrega_real = calcularDiasHabilesReales(fechaInicio, fechaLiberacion);
  }

  const { error } = await supabase
    .from('expedientes')
    .update(updates)
    .eq('id', seleccionado.id);

  if (error) throw error;

  if (estadoAnterior && estadoNuevo && estadoAnterior !== estadoNuevo) {
    await registrarTiempoEstado(seleccionado.id, estadoAnterior, estadoNuevo);
  }

  const comentarioAnterior = (original.instrucciones_adicionales || '').trim();
  const comentarioNuevo = (seleccionado.instrucciones_adicionales || '').trim();

  if (comentarioNuevo && comentarioNuevo !== comentarioAnterior) {
    notificarComentario({
      poTiquetera: seleccionado.po_tiquetera,
      solicitante: seleccionado.solicitante || '',
      responsable: seleccionado.responsable_creacion || '',
      usuarioGenero: nombreUsuario,
      expedienteId: seleccionado.id,
      textoComentario: comentarioNuevo,
    });
  }

  return updates;
};

export const eliminarExpediente = async (expedienteId: string): Promise<void> => {
  const { error } = await supabase.from('expedientes').delete().eq('id', expedienteId);
  if (error) throw error;
};

// Descarga forzada del archivo; si falla, abre en pestaña nueva.
export const descargarArchivo = async (url: string, fileName: string): Promise<void> => {
  try {
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
  } catch (error) {
    console.error('Error al descargar documento:', error);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};