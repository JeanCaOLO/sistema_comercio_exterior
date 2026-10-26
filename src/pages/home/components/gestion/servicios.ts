// Servicios del tablero de Gestión: todo el acceso a Supabase, storage,
// correos y notificaciones vive aquí para que los componentes queden
// enfocados únicamente en la interfaz.

import { supabase } from '@/lib/supabase';
import { crearNotificacion } from '@/lib/notificaciones';
import { consultarPorIds } from '@/lib/consultas';
import { parseDocEntries, combinarEntradas, nombresFacturas, type DocEntry } from '@/lib/documentos';
import {
  COLUMNAS_EXPEDIENTE,
  DIEZ_DIAS_MS,
  type Expediente,
  type TipoModulo,
} from './types';

const BUCKET_DOCUMENTOS = 'expedientes-documentos';

/** Trae los expedientes del módulo con las columnas livianas del kanban. */
export const consultarExpedientes = async (tipoModulo: TipoModulo): Promise<Expediente[]> => {
  const { data, error } = await supabase
    .from('expedientes')
    .select(COLUMNAS_EXPEDIENTE)
    .eq('tipo_modulo', tipoModulo)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as Expediente[];
};

/** Mapa liviano de "nombres de factura por expediente" para habilitar la búsqueda. */
export const consultarFacturasBusqueda = async (
  tipoModulo: TipoModulo
): Promise<Record<string, string[]>> => {
  const { data, error } = await supabase
    .from('expedientes')
    .select('id, doc')
    .eq('tipo_modulo', tipoModulo);

  if (error) throw error;

  const mapa: Record<string, string[]> = {};
  (data || []).forEach((d: any) => {
    mapa[d.id] = nombresFacturas(d.doc);
  });
  return mapa;
};

/** Carga el campo `doc` de un expediente bajo demanda. */
export const cargarDocExpediente = async (
  expedienteId: string
): Promise<string | string[] | null> => {
  const { data, error } = await supabase
    .from('expedientes')
    .select('doc')
    .eq('id', expedienteId)
    .maybeSingle();

  if (error || !data) return null;
  return data.doc ?? null;
};

/**
 * Carga en una sola consulta la fecha de asignación de los tickets visibles.
 * Es clave para que el reloj de duración no arranque desde created_at (que en
 * tickets consolidados es la fecha en que se subieron los documentos).
 */
export const cargarFechasAsignado = async (
  lista: Expediente[]
): Promise<Record<string, string>> => {
  if (lista.length === 0) return {};

  try {
    const ids = lista.map((exp) => exp.id);
    // Se consulta en lotes: con cientos de IDs la URL supera el máximo
    // permitido por Supabase y la petición falla con "Bad Request".
    const data = await consultarPorIds<{ expediente_id: string; fecha_inicio: string }>(
      'expedientes_tiempos_estados',
      'expediente_id, fecha_inicio',
      'expediente_id',
      ids,
      (consulta) => consulta.eq('estado_nuevo', 'Asignado')
    );

    const mapa: Record<string, string> = {};
    data.forEach((t) => {
      if (!t.fecha_inicio) return;
      if (!mapa[t.expediente_id] || t.fecha_inicio < mapa[t.expediente_id]) {
        mapa[t.expediente_id] = t.fecha_inicio;
      }
    });
    return mapa;
  } catch (err) {
    console.error('Error al cargar fechas de asignación:', err);
    return {};
  }
};

// Regla automática: marcar OK País a los 10 días naturales desde "Notificado"
// si aún no se ha marcado manualmente. Solo aplica a Dropship en estados
// "Notificado" o "Visto Listo".
export const aplicarOKPaisAutomatico = async (lista: Expediente[]): Promise<Expediente[]> => {
  const ahora = new Date();
  const pendientes = lista.filter(
    (exp) =>
      exp.tipo_modulo === 'dropship' &&
      (exp.estado_expediente === 'Notificado' || exp.estado_expediente === 'Visto Listo') &&
      exp.ok_pais !== true
  );

  for (const exp of pendientes) {
    const refStr = exp.fecha_notificado || exp.fecha_liberacion || exp.updated_at || exp.created_at;
    if (!refStr) continue;
    const refDate = new Date(refStr);
    if (Number.isNaN(refDate.getTime())) continue;
    if (ahora.getTime() - refDate.getTime() < DIEZ_DIAS_MS) continue;

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('expedientes')
      .update({ ok_pais: true, fecha_ok_pais: nowIso })
      .eq('id', exp.id);

    if (error) {
      console.error('Error al marcar OK País automático:', error);
      continue;
    }

    exp.ok_pais = true;
    exp.fecha_ok_pais = nowIso;

    await supabase.from('expedientes_historial').insert([
      {
        expediente_id: exp.id,
        campo_modificado: 'OK País',
        valor_anterior: 'Pendiente',
        valor_nuevo: 'OK (automático - 10 días naturales)',
        usuario: 'Sistema',
        fecha_cambio: nowIso,
      },
    ]);

    crearNotificacion({
      poTiquetera: exp.po_tiquetera,
      solicitante: exp.solicitante || '',
      responsable: exp.responsable_creacion || '',
      usuarioGenero: 'Sistema',
      tipo: 'documento_modificado',
      mensaje: `OK País marcado automáticamente para ${exp.po_tiquetera} (10 días naturales transcurridos)`,
      icono: 'ri-check-double-line',
      expedienteId: exp.id,
    });
  }

  return lista;
};

// Registra el tiempo que estuvo en el estado anterior y abre el nuevo estado.
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

const construirCorreoDropship = (
  expediente: Expediente,
  estadoAnterior: string,
  estadoNuevo: string
): string => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #0d9488; padding: 20px; border-radius: 8px 8px 0 0;">
      <h2 style="color: white; margin: 0;">Cambio de Estado - Expediente Dropship</h2>
    </div>
    <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
      <p style="color: #374151; font-size: 16px;">El expediente a su cargo ha cambiado de estado:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">PO / Tiquetera</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.po_tiquetera}</td></tr>
        <tr style="background-color: #f3f4f6;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">EXP ID</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.exp_id}</td></tr>
        <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Estado Anterior</td><td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626;">${estadoAnterior}</td></tr>
        <tr style="background-color: #f3f4f6;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Estado Nuevo</td><td style="padding: 10px; border: 1px solid #e5e7eb; color: #16a34a; font-weight: bold;">${estadoNuevo}</td></tr>
        <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Solicitante</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.solicitante}</td></tr>
        <tr style="background-color: #f3f4f6;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Responsable</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.responsable_creacion}</td></tr>
        <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Fecha y Hora</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}</td></tr>
      </table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Este es un mensaje automático del Sistema de Gestión de Expedientes.</p>
    </div>
  </div>
`;

const construirCorreoZf = (expediente: Expediente): string => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #0891b2; padding: 20px; border-radius: 8px 8px 0 0;">
      <h2 style="color: white; margin: 0;">Arribo de Carga - Expediente ZF</h2>
    </div>
    <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
      <p style="color: #374151; font-size: 16px;">Un expediente ZF ha llegado al estado <strong style="color: #0891b2;">Arribo de Carga</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">PO / Tiquetera</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.po_tiquetera}</td></tr>
        <tr style="background-color: #f3f4f6;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">EXP ID</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.exp_id}</td></tr>
        <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Solicitante</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.solicitante}</td></tr>
        <tr style="background-color: #f3f4f6;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Responsable</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${expediente.responsable_creacion}</td></tr>
        <tr style="background-color: #fff;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Fecha y Hora</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}</td></tr>
      </table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Este es un mensaje automático del Sistema de Gestión de Expedientes.</p>
    </div>
  </div>
`;

/** Envía el correo de cambio de estado según el módulo. Nunca lanza error. */
export const enviarCorreoCambioEstado = async (
  expediente: Expediente,
  estadoAnterior: string,
  estadoNuevo: string,
  tipoModulo: TipoModulo
): Promise<void> => {
  try {
    // ── DROPSHIP: notificar al responsable asignado en CUALQUIER cambio de estado ──
    if (tipoModulo === 'dropship') {
      const { data: usuarioResp } = await supabase
        .from('usuarios')
        .select('email')
        .eq('nombre', expediente.responsable_creacion)
        .maybeSingle();

      if (usuarioResp?.email) {
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: [usuarioResp.email],
            subject: `Cambio de Estado - Expediente Dropship: ${expediente.po_tiquetera}`,
            html: construirCorreoDropship(expediente, estadoAnterior, estadoNuevo),
          },
        });
        if (emailError) {
          console.error('Error al enviar correo Dropship:', emailError);
        }
      } else {
        console.warn(
          `⚠️ No se encontró email para el responsable: ${expediente.responsable_creacion}`
        );
      }
      return;
    }

    // ── ZF: notificar a correos configurados cuando pasa a "Arribo de Carga" ──
    if (tipoModulo === 'zf' && estadoNuevo === 'Arribo de Carga') {
      const { data: config, error } = await supabase
        .from('configuracion_sistema')
        .select('valor')
        .eq('clave', 'correos_notificacion_arribo_carga')
        .maybeSingle();

      if (error) {
        console.error('Error al obtener correos de notificación:', error);
        return;
      }

      if (config && config.valor && Array.isArray(config.valor) && config.valor.length > 0) {
        const correos = config.valor as string[];
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: correos,
            subject: `Expediente ZF en Arribo de Carga: ${expediente.po_tiquetera}`,
            html: construirCorreoZf(expediente),
          },
        });
        if (emailError) {
          console.error('Error al enviar correo ZF Arribo de Carga:', emailError);
        }
      } else {
        console.log('⚠️ No hay correos configurados para notificaciones de Arribo de Carga');
      }
    }
  } catch (error) {
    console.error('Error en enviarCorreoCambioEstado:', error);
  }
};

/** Sube los archivos seleccionados al bucket y devuelve sus URLs públicas. */
export const subirArchivosExpediente = async (
  expedienteId: string,
  files: File[]
): Promise<string[]> => {
  const uploadedUrls: string[] = [];

  for (const file of files) {
    const fileName = `${expedienteId}/${Date.now()}_${file.name}`;

    const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        throw new Error(
          'El almacenamiento de documentos no está configurado. Por favor, cree un bucket llamado "expedientes-documentos" en Supabase Storage con acceso público.'
        );
      }
      throw new Error(`Error al subir ${file.name}: ${error.message}`);
    }

    const { data: urlData } = supabase.storage.from(BUCKET_DOCUMENTOS).getPublicUrl(fileName);
    if (urlData?.publicUrl) {
      uploadedUrls.push(urlData.publicUrl);
    }
  }

  return uploadedUrls;
};

/**
 * Combina los documentos existentes con las URLs recién subidas, preservando
 * la estructura { url, tipo } y devolviendo el arreglo listo para guardar.
 */
export const combinarDocumentosConNuevas = (
  docActual: string | string[] | null,
  nuevasUrls: string[]
): DocEntry[] => {
  const entradasExistentes = parseDocEntries(docActual);
  const nuevasEntradas: DocEntry[] = nuevasUrls.map((url) => ({ url, tipo: null }));
  return combinarEntradas([...entradasExistentes, ...nuevasEntradas]);
};

/**
 * Lee la estructura original de consolidación guardada en el historial.
 * Devuelve el arreglo de grupos (cada uno con su PO y documentos) o [] si no hay.
 */
export const obtenerGruposOriginales = async (expediente: Expediente): Promise<any[]> => {
  try {
    const { data: historialConsolidacion } = await supabase
      .from('expedientes_historial')
      .select('detalle')
      .eq('expediente_id', expediente.id)
      .eq('campo_modificado', 'Estado')
      .eq('valor_nuevo', 'No Asignado')
      .order('fecha_cambio', { ascending: true })
      .limit(1);

    const detalle = historialConsolidacion?.[0]?.detalle;
    if (detalle && Array.isArray(detalle.grupos) && detalle.grupos.length > 0) {
      return detalle.grupos;
    }
    return [];
  } catch (e) {
    console.warn('No se pudo leer la información de consolidación:', e);
    return [];
  }
};

/**
 * Devuelve el ticket a la bandeja de Documentación: reinserta las filas en
 * documentos_caa (separando las POs originales si aplica), elimina el ticket
 * del kanban, registra el historial y crea la notificación.
 */
export const devolverTicketADocumentacion = async (
  expediente: Expediente
): Promise<{ nombreUsuario: string; totalFilas: number }> => {
  // Cargar `doc` bajo demanda si no vino en la carga inicial
  let docActual = expediente.doc;
  if (docActual === undefined) {
    docActual = await cargarDocExpediente(expediente.id);
  }

  const ahora = new Date().toISOString();

  // Obtener usuario actual
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
      .maybeSingle();
    if (usuario) nombreUsuario = usuario.nombre;
  }

  const gruposOriginales = await obtenerGruposOriginales(expediente);

  if (gruposOriginales.length > 0) {
    // Separar en filas individuales, una por cada PO/agrupación original
    const filas = gruposOriginales.map((g: any) => ({
      po_tiquetera: g.po_tiquetera ?? expediente.po_tiquetera,
      tipo_po: g.tipo_po ?? expediente.tipo_po,
      solicitante: g.solicitante ?? expediente.solicitante,
      fecha_solicitud: g.fecha_solicitud ?? expediente.fecha_solicitud,
      prioridad: g.prioridad ?? expediente.prioridad,
      prioridad_urgente: g.prioridad_urgente ?? expediente.prioridad_urgente,
      motivo_urgencia: g.motivo_urgencia ?? expediente.motivo_urgencia,
      dificultad: g.dificultad ?? expediente.dificultad,
      tiempo_minutos: g.tiempo_minutos ?? expediente.tiempo_minutos,
      dias_entrega: g.dias_entrega ?? expediente.dias_entrega,
      fecha_requerimiento: g.fecha_requerimiento ?? expediente.fecha_requerimiento,
      exp_id: g.exp_id ?? 'Por Asignar',
      doc: g.doc ?? docActual,
      lineas_oc: g.lineas_oc ?? expediente.lineas_oc,
      bl_cargado: g.bl_cargado ?? false,
      numero_bl: g.numero_bl ?? expediente.numero_bl ?? null,
      numero_contenedor: g.numero_contenedor ?? expediente.numero_contenedor ?? null,
      packing_list_cargado: g.packing_list_cargado ?? expediente.packing_list_cargado ?? false,
      tc_cargado: g.tc_cargado ?? expediente.transito_corto,
      aplica_tlc: g.aplica_tlc ?? expediente.aplica_tlc,
      fecha_creacion_expediente: g.fecha_creacion_expediente ?? expediente.fecha_creacion_expediente,
      estado_expediente: 'Documentación',
      responsable_creacion: g.responsable_creacion ?? expediente.responsable_creacion,
      instrucciones_adicionales:
        g.instrucciones_adicionales ?? expediente.instrucciones_adicionales,
      tipo_modulo: expediente.tipo_modulo,
      created_at: g.created_at ?? expediente.created_at ?? ahora,
    }));

    const { error: insertError } = await supabase.from('documentos_caa').insert(filas);
    if (insertError) {
      throw new Error(`Error al devolver a Documentación: ${insertError.message}`);
    }
  } else {
    // Comportamiento original: una sola fila (datos antiguos sin estructura de grupos)
    const { error: insertError } = await supabase.from('documentos_caa').insert([
      {
        po_tiquetera: expediente.po_tiquetera,
        tipo_po: expediente.tipo_po,
        solicitante: expediente.solicitante,
        fecha_solicitud: expediente.fecha_solicitud,
        prioridad: expediente.prioridad,
        prioridad_urgente: expediente.prioridad_urgente,
        motivo_urgencia: expediente.motivo_urgencia,
        dificultad: expediente.dificultad,
        tiempo_minutos: expediente.tiempo_minutos,
        dias_entrega: expediente.dias_entrega,
        fecha_requerimiento: expediente.fecha_requerimiento,
        exp_id: expediente.exp_id,
        doc: docActual,
        lineas_oc: expediente.lineas_oc,
        bl_cargado: expediente.bl_cargado,
        numero_bl: expediente.numero_bl ?? null,
        numero_contenedor: expediente.numero_contenedor ?? null,
        packing_list_cargado: expediente.packing_list_cargado ?? false,
        tc_cargado: expediente.transito_corto,
        aplica_tlc: expediente.aplica_tlc,
        fecha_creacion_expediente: expediente.fecha_creacion_expediente,
        estado_expediente: 'Documentación',
        responsable_creacion: expediente.responsable_creacion,
        instrucciones_adicionales: expediente.instrucciones_adicionales,
        tipo_modulo: expediente.tipo_modulo,
        created_at: expediente.created_at || ahora,
      },
    ]);

    if (insertError) {
      throw new Error(`Error al devolver a Documentación: ${insertError.message}`);
    }
  }

  // Quitar el ticket del kanban (expedientes)
  const { error: deleteError } = await supabase
    .from('expedientes')
    .delete()
    .eq('id', expediente.id);

  if (deleteError) {
    throw new Error(`Error al quitar el ticket del kanban: ${deleteError.message}`);
  }

  // Registrar historial
  await supabase.from('expedientes_historial').insert([
    {
      expediente_id: expediente.id,
      campo_modificado: 'Estado',
      valor_anterior: 'No Asignado',
      valor_nuevo: 'Documentación',
      usuario: nombreUsuario,
      usuario_email: emailUsuario,
      fecha_cambio: ahora,
    },
  ]);

  const totalFilas = gruposOriginales.length > 0 ? gruposOriginales.length : 1;

  crearNotificacion({
    poTiquetera: expediente.po_tiquetera,
    solicitante: expediente.solicitante || '',
    responsable: expediente.responsable_creacion || '',
    usuarioGenero: nombreUsuario,
    tipo: 'documento_modificado',
    mensaje:
      gruposOriginales.length > 1
        ? `${nombreUsuario} devolvió el ticket ${expediente.po_tiquetera} a Documentación, separado en ${totalFilas} POs con sus documentos`
        : `${nombreUsuario} devolvió el ticket ${expediente.po_tiquetera} a Documentación`,
    icono: 'ri-arrow-go-back-line',
    expedienteId: expediente.id,
  });

  return { nombreUsuario, totalFilas };
};