/**
 * ============================================================
 * Control de Fechas NEXT — envío de la cola de correos
 * Google Apps Script (cuenta dueña del remitente)
 * ============================================================
 *
 * QUÉ CAMBIÓ (versión con reclamo):
 *  1. Antes de enviar, el script RECLAMA cada correo en la cola.
 *     Mientras está reclamado, ninguna otra corrida lo recibe.
 *  2. Después de enviarlo, lo MARCA como enviado. Si el marcado
 *     falla por red, se reintenta: no queda "pendiente" por error.
 *  3. Si la corrida se cae a mitad de camino, el reclamo vence solo
 *     (120 minutos por defecto) y el correo vuelve a estar
 *     disponible. Nunca se reenvía un correo ya marcado como enviado.
 *  4. Si Gmail rechaza un correo (dirección inválida, adjunto roto),
 *     se marca como error y NO se reintenta al día siguiente.
 *     Si el problema es de cupo de Gmail, se libera el reclamo y se
 *     corta la corrida para reintentar en la siguiente.
 *  5. Si se acaba el tiempo de ejecución de Apps Script, los correos
 *     que quedaron sin enviar se liberan solos.
 *
 * INSTALACIÓN (una sola vez):
 *  1. Abrir el proyecto de Apps Script y reemplazar todo el código
 *     por este archivo.
 *  2. Revisar el bloque CONFIG (URL, TOKEN y clave pública).
 *  3. Ejecutar una vez "crearDisparadorDiario" para dejar el
 *     disparador de lunes a viernes a las 8:00 a. m.
 *  4. Probar con "enviarColaControlFechas" desde el editor.
 * ============================================================
 */

var CONFIG = {
  // Función de Supabase que administra la cola.
  URL_COLA: 'https://hcmwiqxvuopbdlefsain.supabase.co/functions/v1/cola-reporte-control-fechas',
  // Clave pública (la misma que usa la web). No es una llave privada.
  CLAVE_PUBLICA: 'sb_publishable_uWQHqOHommJy4RLVVDNHaw_nMF6AMH-',
  // Token compartido: debe ser igual al "Token compartido" de la web.
  TOKEN: 'ologistics-control-fechas-2026',
  // Nombre de esta corrida (queda guardado como quién reclamó el correo).
  WORKER: 'apps-script-control-fechas',
  // Cuántos correos pide por corrida.
  LIMITE: 250,
  // Minutos que un correo queda reclamado antes de liberarse solo.
  MINUTOS_RECLAMO: 120,
  // Reintentos de red (no de Gmail) antes de darse por vencido.
  MAX_INTENTOS_RED: 3,
  // Segundos de margen antes del límite de 6 minutos de Apps Script.
  SEGUNDOS_SEGURIDAD: 60,
  // Solo enviar de lunes a viernes.
  SOLO_DIAS_HABILES: true,
  // Copia del resumen de la corrida (dejar vacío para no enviar nada).
  AVISAR_A: ''
};

// ============================================================
// Punto de entrada
// ============================================================
function enviarColaControlFechas() {
  var inicio = new Date().getTime();

  if (CONFIG.SOLO_DIAS_HABILES) {
    var dia = Number(Utilities.formatDate(new Date(), 'America/Costa_Rica', 'u'));
    if (dia > 5) {
      Logger.log('Fin de semana: no se envían correos.');
      return;
    }
  }

  var bloqueo = LockService.getScriptLock();
  if (!bloqueo.tryLock(30000)) {
    Logger.log('Otra corrida ya está enviando la cola. No hago nada para no duplicar.');
    return;
  }

  var resumen = { reclamados: 0, enviados: 0, fallidos: 0, liberados: 0, sobrantes: 0, errores: [] };

  try {
    // 1) Reclamar: el servidor entrega solo lo que nadie más tiene tomado.
    var pedido = llamarApi_({
      accion: 'reclamar',
      token: CONFIG.TOKEN,
      worker: CONFIG.WORKER,
      limite: CONFIG.LIMITE,
      minutos: CONFIG.MINUTOS_RECLAMO
    });

    if (!pedido.ok) {
      Logger.log('No se pudo reclamar la cola: ' + pedido.error);
      return;
    }

    var correos = pedido.pendientes || [];
    resumen.reclamados = correos.length;
    Logger.log('Correos reclamados para esta corrida: ' + correos.length);

    for (var i = 0; i < correos.length; i++) {
      var correo = correos[i];

      // Si se está acabando el tiempo, se liberan los que quedan sin enviar.
      if (quedaPocoTiempo_(inicio)) {
        for (var k = i; k < correos.length; k++) {
          liberar_(correos[k].id);
          resumen.liberados++;
        }
        resumen.sobrantes = correos.length - i;
        Logger.log('Se acabó el tiempo de ejecución: ' + resumen.sobrantes + ' correos liberados para la próxima corrida.');
        break;
      }

      try {
        enviarCorreo_(correo);

        // Nunca se deja sin marcar: si el aviso falla, se reintenta.
        var marcado = marcar_(correo.id, true, 'Enviado desde Apps Script a ' + correo.para);
        if (!marcado.ok) {
          resumen.errores.push('Enviado pero no se pudo marcar: ' + correo.asunto + ' → ' + marcado.error);
        }
        resumen.enviados++;
        Logger.log('Enviado: ' + correo.seccion + ' · ' + correo.asunto);

      } catch (error) {
        var mensaje = error && error.message ? error.message : String(error);

        // Cupo de Gmail / servicio no disponible: se libera y se corta la corrida.
        if (esProblemaDeServicio_(mensaje)) {
          liberar_(correo.id);
          resumen.liberados++;
          resumen.errores.push('Corrida detenida: ' + mensaje);
          Logger.log('Se corta la corrida para no perder correos: ' + mensaje);
          break;
        }

        // Error real del correo (dirección inválida, adjunto, etc.): se marca y no se reintenta.
        marcar_(correo.id, false, mensaje);
        resumen.fallidos++;
        resumen.errores.push(correo.asunto + ': ' + mensaje);
        Logger.log('Falló: ' + correo.asunto + ' → ' + mensaje);
      }
    }
  } catch (error) {
    Logger.log('Error inesperado en la corrida: ' + (error && error.message ? error.message : error));
  } finally {
    try { bloqueo.releaseLock(); } catch (ignorado) {}
  }

  resumir_(resumen);
}

// ============================================================
// Envío con Gmail
// ============================================================
function enviarCorreo_(correo) {
  var opciones = { name: 'Control de Fechas NEXT' };

  if (correo.cuerpo_html) opciones.htmlBody = correo.cuerpo_html;
  if (correo.cc) opciones.cc = correo.cc;

  if (correo.adjunto_base64 && correo.adjunto_nombre) {
    var bytes = Utilities.base64Decode(correo.adjunto_base64);
    opciones.attachments = [
      Utilities.newBlob(bytes, correo.adjunto_mime || 'application/octet-stream', correo.adjunto_nombre)
    ];
  }

  // Solo se pone el remitente si es un alias válido de esta cuenta.
  var remitente = String(correo.remitente || '').trim();
  if (remitente && aliasPermitidos_().indexOf(remitente.toLowerCase()) !== -1) {
    opciones.from = remitente;
  }

  GmailApp.sendEmail(correo.para, correo.asunto, correo.cuerpo_texto || '', opciones);
}

var ALIAS_CACHE = null;
function aliasPermitidos_() {
  if (ALIAS_CACHE) return ALIAS_CACHE;
  var lista = [];
  try {
    lista = GmailApp.getAliases().map(function (a) { return String(a).toLowerCase(); });
  } catch (error) {
    lista = [];
  }
  lista.push(String(Session.getActiveUser().getEmail() || '').toLowerCase());
  ALIAS_CACHE = lista;
  return lista;
}

// ============================================================
// Llamadas a la cola
// ============================================================
function llamarApi_(carga) {
  var cuerpo = JSON.stringify(carga);
  var ultimoError = '';

  for (var intento = 1; intento <= CONFIG.MAX_INTENTOS_RED; intento++) {
    try {
      var respuesta = UrlFetchApp.fetch(CONFIG.URL_COLA, {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        headers: {
          apikey: CONFIG.CLAVE_PUBLICA,
          Authorization: 'Bearer ' + CONFIG.CLAVE_PUBLICA
        },
        payload: cuerpo
      });

      var codigo = respuesta.getResponseCode();
      var texto = respuesta.getContentText();
      var datos = {};
      try { datos = JSON.parse(texto); } catch (error) { datos = {}; }

      if (codigo === 200 && datos && datos.ok) return datos;

      ultimoError = (datos && datos.error) ? datos.error : ('HTTP ' + codigo);

      // 4xx son errores de token o de datos: reintentar no sirve.
      if (codigo >= 400 && codigo < 500) return { ok: false, error: ultimoError };

    } catch (error) {
      ultimoError = error && error.message ? error.message : String(error);
    }

    Utilities.sleep(2000 * intento);
  }

  return { ok: false, error: ultimoError || 'Sin respuesta de la cola.' };
}

function marcar_(id, ok, mensaje) {
  return llamarApi_({
    accion: 'marcar',
    token: CONFIG.TOKEN,
    id: id,
    ok: ok === true,
    mensaje: mensaje || ''
  });
}

function liberar_(id) {
  return llamarApi_({ accion: 'liberar', token: CONFIG.TOKEN, id: id });
}

// ============================================================
// Utilidades
// ============================================================
function quedaPocoTiempo_(inicio) {
  var limite = (6 * 60 - CONFIG.SEGUNDOS_SEGURIDAD) * 1000;
  return (new Date().getTime() - inicio) > limite;
}

function esProblemaDeServicio_(mensaje) {
  var texto = String(mensaje || '').toLowerCase();
  return texto.indexOf('quota') !== -1 ||
    texto.indexOf('cupo') !== -1 ||
    texto.indexOf('service invoked too many times') !== -1 ||
    texto.indexOf('too many times') !== -1 ||
    texto.indexOf('limit exceeded') !== -1 ||
    texto.indexOf('try again') !== -1 ||
    texto.indexOf('temporarily') !== -1 ||
    texto.indexOf('no se pudo marcar') !== -1 ||
    texto.indexOf('sin respuesta de la cola') !== -1;
}

function resumir_(resumen) {
  var texto = 'Corrida de la cola: ' +
    resumen.enviados + ' enviados, ' +
    resumen.fallidos + ' con error, ' +
    resumen.reclamados + ' reclamados' +
    (resumen.liberados ? ', ' + resumen.liberados + ' liberados' : '') + '.';

  Logger.log(texto);
  if (resumen.errores.length > 0) {
    Logger.log('Detalle: ' + resumen.errores.join(' | '));
  }

  if (CONFIG.AVISAR_A && (resumen.fallidos > 0 || resumen.errores.length > 0)) {
    try {
      GmailApp.sendEmail(CONFIG.AVISAR_A, 'Control de Fechas NEXT · resumen de la corrida', texto + '\n\n' + resumen.errores.join('\n'));
    } catch (error) {
      Logger.log('No se pudo enviar el resumen: ' + error);
    }
  }
}

// ============================================================
// Ayudas para el editor
// ============================================================

/** Crea (o reemplaza) el disparador diario a las 8:00 a. m. hora Costa Rica. */
function crearDisparadorDiario() {
  var existentes = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existentes.length; i++) {
    if (existentes[i].getHandlerFunction() === 'enviarColaControlFechas') {
      ScriptApp.deleteTrigger(existentes[i]);
    }
  }

  ScriptApp.newTrigger('enviarColaControlFechas')
    .timeBased()
    .atHour(8)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('America/Costa_Rica')
    .create();

  Logger.log('Disparador creado: todos los días a las 8:00 a. m. (los fines de semana el script no envía).');
}

/** Ver cuántos correos hay pendientes y cuántos están reclamados ahora. */
function verEstadoCola() {
  var estado = llamarApi_({ accion: 'estado', token: CONFIG.TOKEN });
  Logger.log(JSON.stringify(estado));
  return estado;
}