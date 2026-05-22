// ============================================================
//  FESTIVAL DE PIANO — Google Apps Script
//  Endpoints: solicitud_clase · get_solicitudes_profesor ·
//             aceptar_solicitud · rechazar_solicitud · reserva_piano
// ============================================================

// ── Nombres de pestañas ──────────────────────────────────────
const TABS = {
  profesores:  "Profesores",
  solicitudes: "Solicitudes",
  reservas:    "Reservas",
};

// ── Índices de columnas (0-based) ────────────────────────────
const SOL = {
  id:                   0,
  timestamp:            1,
  nombre:               2,
  email:                3,
  profesor:             4,
  tipo:                 5,
  fecha_preferida:      6,
  hora_preferida:       7,
  mensaje:              8,
  estado:               9,
  fecha_asignada:       10,
  hora_asignada:        11,
  timestamp_resolucion: 12,
};

const PROF = {
  nombre:    0,
  token:     1,
  fecha:     2,
  hora:      3,
  exclusivo: 4,
};

// ── Helpers ──────────────────────────────────────────────────
function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function generateId() {
  return "sol_" + new Date().getTime() + "_" +
    Math.random().toString(36).substr(2, 6);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeFecha(str) {
  if (!str) return "";
  str = String(str).trim();
  // YYYY-MM-DD → DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split("-");
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }
  return str;
}

// ── Validación de token ──────────────────────────────────────
function validarToken(nombreProfesor, token) {
  if (!nombreProfesor || !token) return false;
  const filas = getSheet(TABS.profesores).getDataRange().getValues();
  for (let i = 1; i < filas.length; i++) {
    if (String(filas[i][PROF.nombre]).trim() === String(nombreProfesor).trim() &&
        String(filas[i][PROF.token]).trim()  === String(token).trim()) {
      return true;
    }
  }
  return false;
}

// ── Router ───────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.action) {
      case "solicitud_clase":           return accionSolicitudClase(data);
      case "get_solicitudes_profesor":  return accionGetSolicitudesProfesor(data);
      case "aceptar_solicitud":         return accionAceptarSolicitud(data);
      case "rechazar_solicitud":        return accionRechazarSolicitud(data);
      case "reserva_piano":             return accionReservaPiano(data);
      default:
        return jsonResponse({ ok: false, error: "Acción desconocida: " + data.action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function doGet() {
  return jsonResponse({ status: "Festival Piano API activa" });
}

// ════════════════════════════════════════════════════════════
//  1. SOLICITUD DE CLASE — alumno crea solicitud pendiente
// ════════════════════════════════════════════════════════════
function accionSolicitudClase(data) {
  const sheet = getSheet(TABS.solicitudes);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "id","timestamp","nombre","email","profesor","tipo",
      "fecha_preferida","hora_preferida","mensaje","estado",
      "fecha_asignada","hora_asignada","timestamp_resolucion",
    ]);
  }

  const id = generateId();
  sheet.appendRow([
    id,
    data.timestamp || new Date().toISOString(),
    data.nombre           || "",
    data.email            || "",
    data.profesor         || "",
    data.tipo             || "GENERAL",
    normalizeFecha(data.fecha_preferida) || "",
    data.hora_preferida   || "",
    data.mensaje          || "",
    "pendiente",
    "", // fecha_asignada  — la rellena el profesor al aceptar
    "", // hora_asignada
    "", // timestamp_resolucion
  ]);

  return jsonResponse({ ok: true, id });
}

// ════════════════════════════════════════════════════════════
//  2. GET SOLICITUDES PROFESOR — requiere token
// ════════════════════════════════════════════════════════════
function accionGetSolicitudesProfesor(data) {
  if (!validarToken(data.profesor, data.token)) {
    return jsonResponse({ ok: false, error: "Token inválido" });
  }

  const sheet  = getSheet(TABS.solicitudes);
  const filas  = sheet.getDataRange().getValues();
  const cabecera = filas[0];

  const solicitudes = filas.slice(1)
    .filter(f => String(f[SOL.profesor]).trim() === String(data.profesor).trim())
    .map(f => {
      const obj = {};
      cabecera.forEach((h, i) => { obj[h] = f[i] != null ? String(f[i]) : ""; });
      return obj;
    })
    .sort((a, b) => {
      // Pendientes primero; dentro de cada grupo, más recientes primero
      if (a.estado === "pendiente" && b.estado !== "pendiente") return -1;
      if (a.estado !== "pendiente" && b.estado === "pendiente") return  1;
      return a.timestamp < b.timestamp ? 1 : -1;
    });

  return jsonResponse({ ok: true, solicitudes });
}

// ════════════════════════════════════════════════════════════
//  3. ACEPTAR SOLICITUD — requiere token + LockService
// ════════════════════════════════════════════════════════════
function accionAceptarSolicitud(data) {
  if (!validarToken(data.profesor, data.token)) {
    return jsonResponse({ ok: false, error: "Token inválido" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = getSheet(TABS.solicitudes);
    const filas = sheet.getDataRange().getValues();

    // Localizar la solicitud por id
    let filaIdx = -1;
    for (let i = 1; i < filas.length; i++) {
      if (String(filas[i][SOL.id]).trim() === String(data.id).trim()) {
        filaIdx = i; break;
      }
    }
    if (filaIdx === -1) {
      return jsonResponse({ ok: false, error: "Solicitud no encontrada" });
    }

    const sol = filas[filaIdx];

    // ¿Sigue pendiente? (re-validar dentro del lock)
    if (String(sol[SOL.estado]).trim() !== "pendiente") {
      return jsonResponse({ ok: false, error: "Esta solicitud ya no está pendiente" });
    }

    const fechaAsignada = normalizeFecha(data.fecha_asignada);
    const horaAsignada  = String(data.hora_asignada || "").trim();
    const emailAlumno   = String(sol[SOL.email]).trim().toLowerCase();

    if (!fechaAsignada || !horaAsignada) {
      return jsonResponse({ ok: false, error: "Debes indicar fecha y hora al aceptar" });
    }

    // ¿El slot ya está ocupado? (concurrencia)
    const slotOcupado = filas.slice(1).some(f =>
      String(f[SOL.profesor]).trim()       === String(data.profesor).trim() &&
      String(f[SOL.estado]).trim()         === "aceptada" &&
      String(f[SOL.fecha_asignada]).trim() === fechaAsignada &&
      String(f[SOL.hora_asignada]).trim()  === horaAsignada
    );
    if (slotOcupado) {
      return jsonResponse({
        ok: false,
        error: "El slot " + horaAsignada + " del " + fechaAsignada + " ya está ocupado"
      });
    }

    // ¿El alumno ya tiene clase aceptada ese día?
    const alumnoOcupado = filas.slice(1).some(f =>
      String(f[SOL.email]).trim().toLowerCase() === emailAlumno &&
      String(f[SOL.estado]).trim()              === "aceptada" &&
      String(f[SOL.fecha_asignada]).trim()      === fechaAsignada
    );
    if (alumnoOcupado) {
      return jsonResponse({
        ok: false,
        error: emailAlumno + " ya tiene una clase aceptada el " + fechaAsignada
      });
    }

    // ✅ Marcar como aceptada
    const ahora  = new Date().toISOString();
    const numFila = filaIdx + 1; // Sheets es 1-based
    sheet.getRange(numFila, SOL.estado               + 1).setValue("aceptada");
    sheet.getRange(numFila, SOL.fecha_asignada       + 1).setValue(fechaAsignada);
    sheet.getRange(numFila, SOL.hora_asignada        + 1).setValue(horaAsignada);
    sheet.getRange(numFila, SOL.timestamp_resolucion + 1).setValue(ahora);

    // 🔁 Auto-rechazar conflictos
    for (let i = 1; i < filas.length; i++) {
      if (i === filaIdx) continue;
      const f = filas[i];
      if (String(f[SOL.estado]).trim() !== "pendiente") continue;

      let rechazar = false;

      // Otras solicitudes pendientes del mismo alumno ese mismo día
      if (String(f[SOL.email]).trim().toLowerCase() === emailAlumno &&
          String(f[SOL.fecha_preferida]).trim()      === fechaAsignada) {
        rechazar = true;
      }

      // HORA_EXACTA de otro alumno para el mismo slot con el mismo profesor
      if (!rechazar &&
          String(f[SOL.profesor]).trim()        === String(data.profesor).trim() &&
          String(f[SOL.tipo]).trim()            === "HORA_EXACTA" &&
          String(f[SOL.fecha_preferida]).trim() === fechaAsignada &&
          String(f[SOL.hora_preferida]).trim()  === horaAsignada) {
        rechazar = true;
      }

      if (rechazar) {
        sheet.getRange(i + 1, SOL.estado               + 1).setValue("rechazada");
        sheet.getRange(i + 1, SOL.timestamp_resolucion + 1).setValue(ahora);
      }
    }

    return jsonResponse({ ok: true });

  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════
//  4. RECHAZAR SOLICITUD — requiere token
// ════════════════════════════════════════════════════════════
function accionRechazarSolicitud(data) {
  if (!validarToken(data.profesor, data.token)) {
    return jsonResponse({ ok: false, error: "Token inválido" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet(TABS.solicitudes);
    const filas = sheet.getDataRange().getValues();

    let filaIdx = -1;
    for (let i = 1; i < filas.length; i++) {
      if (String(filas[i][SOL.id]).trim()      === String(data.id).trim() &&
          String(filas[i][SOL.profesor]).trim() === String(data.profesor).trim()) {
        filaIdx = i; break;
      }
    }

    if (filaIdx === -1) {
      return jsonResponse({ ok: false, error: "Solicitud no encontrada" });
    }
    if (String(filas[filaIdx][SOL.estado]).trim() !== "pendiente") {
      return jsonResponse({ ok: false, error: "La solicitud ya no está pendiente" });
    }

    const numFila = filaIdx + 1;
    sheet.getRange(numFila, SOL.estado               + 1).setValue("rechazada");
    sheet.getRange(numFila, SOL.timestamp_resolucion + 1).setValue(new Date().toISOString());

    return jsonResponse({ ok: true });

  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════
//  5. RESERVA PIANO DE COLA — alumno
// ════════════════════════════════════════════════════════════
function accionReservaPiano(data) {
  const sheet = getSheet(TABS.reservas);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["timestamp","nombre","email","piano","fecha","hora"]);
  }

  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.nombre    || "",
    data.email     || "",
    data.piano     || "",
    normalizeFecha(data.fecha) || "",
    data.hora      || "",
  ]);

  return jsonResponse({ ok: true });
}
