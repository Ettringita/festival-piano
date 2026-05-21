// ============================================================
//  FESTIVAL DE PIANO — Google Apps Script
//  Pega este código en: Extensions > Apps Script > Code.gs
//  Luego haz Deploy > New deployment > Web App
// ============================================================

const SHEET_NAMES = {
  solicitudes: "Solicitudes",
  reservas: "Reservas",
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === "solicitud_clase") {
      const sheet = ss.getSheetByName(SHEET_NAMES.solicitudes);
      // Si la hoja no tiene cabeceras, las añade
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Timestamp", "Nombre", "Email", "Profesor", "Fecha", "Hora", "Mensaje"]);
      }
      sheet.appendRow([
        data.timestamp,
        data.nombre,
        data.email,
        data.profesor,
        data.fecha,
        data.hora,
        data.mensaje || "",
      ]);
    }

    if (data.action === "reserva_sala") {
      const sheet = ss.getSheetByName(SHEET_NAMES.reservas);
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Timestamp", "Nombre", "Email", "Sala", "Fecha", "Hora inicio", "Hora fin"]);
      }
      sheet.appendRow([
        data.timestamp,
        data.nombre,
        data.email,
        data.sala,
        data.fecha,
        data.hora_inicio,
        data.hora_fin,
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Permite testear el endpoint con GET
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "Festival Piano API activa" }))
    .setMimeType(ContentService.MimeType.JSON);
}
