// ============================================================
//  FESTIVAL DE PIANO — Google Apps Script
//  Pega este código en: Extensions > Apps Script > Code.gs
//  Luego: Deploy > New deployment > Web App
//  · Ejecutar como: Yo
//  · Quién tiene acceso: Cualquier persona
// ============================================================

const SHEET_NAMES = {
  solicitudes: "Solicitudes",
  reservas:    "Reservas",
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();

    // ── Solicitud de clase magistral ────────────────────────
    if (data.action === "solicitud_clase") {
      const sheet = ss.getSheetByName(SHEET_NAMES.solicitudes);
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "Timestamp","Nombre","Email","Profesor",
          "Fecha","Hora_1","Hora_2","Hora_3",
          "Mensaje","Estado"
        ]);
      }
      sheet.appendRow([
        data.timestamp   || new Date().toISOString(),
        data.nombre      || "",
        data.email       || "",
        data.profesor    || "",
        data.fecha       || "",
        data.hora_1      || "",
        data.hora_2      || "",
        data.hora_3      || "",
        data.mensaje     || "",
        data.estado      || "pendiente",
      ]);
    }

    // ── Reserva de piano de cola ────────────────────────────
    if (data.action === "reserva_piano") {
      const sheet = ss.getSheetByName(SHEET_NAMES.reservas);
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "Timestamp","Nombre","Email","Piano","Fecha","Hora"
        ]);
      }
      sheet.appendRow([
        data.timestamp || new Date().toISOString(),
        data.nombre    || "",
        data.email     || "",
        data.piano     || data.sala || "",
        data.fecha     || "",
        data.hora      || "",
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
