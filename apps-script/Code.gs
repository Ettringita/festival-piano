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
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "timestamp","nombre","email","profesor",
          "fecha","hora_1","hora_2","hora_3","mensaje","estado"
        ]);
      }
      sheet.appendRow([
        data.timestamp,
        data.nombre,
        data.email,
        data.profesor,
        data.fecha,
        data.hora_1 || "",
        data.hora_2 || "",
        data.hora_3 || "",
        data.mensaje || "",
        "pendiente",  // estado inicial
      ]);
    }

    if (data.action === "reserva_sala") {
      const sheet = ss.getSheetByName(SHEET_NAMES.reservas);
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["timestamp","nombre","email","sala","fecha","hora_inicio","hora_fin"]);
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

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "Festival Piano API activa" }))
    .setMimeType(ContentService.MimeType.JSON);
}
