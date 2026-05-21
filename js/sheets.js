// ============================================================
//  FESTIVAL DE PIANO — Google Sheets API Layer
// ============================================================

const Sheets = (() => {
  const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

  async function read(tabName) {
    const url = `${BASE}/${CONFIG.SHEET_ID}/values/${encodeURIComponent(tabName)}?key=${CONFIG.API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
    const data = await res.json();
    return data.values || [];
  }

  function toObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map((h) => h.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita tildes
      .replace(/ /g, "_"));
    return rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = (row[i] || "").trim()));
      return obj;
    });
  }

  async function write(action, payload) {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) throw new Error(`Apps Script error: ${res.status}`);
    return await res.json();
  }

  // ── Conciertos ───────────────────────────────────────────
  async function getConciertos() {
    const rows = await read(CONFIG.TABS.conciertos);
    return toObjects(rows);
  }

  // ── Horario alumno: lee Solicitudes con estado=aceptada ──
  async function getHorarioAlumno(email) {
    const rows = await read(CONFIG.TABS.solicitudes);
    const todas = toObjects(rows);
    return todas.filter(
      (r) => r.email.toLowerCase() === email.toLowerCase() &&
             r.estado && r.estado.toLowerCase() === "aceptada"
    );
  }

  // ── Profesores con sus slots disponibles ─────────────────
  async function getProfesoresData() {
    const rows = await read(CONFIG.TABS.profesores);
    return toObjects(rows); // [{nombre, fecha, hora}, ...]
  }

  // Nombres únicos de profesores
  async function getProfesores() {
    const data = await getProfesoresData();
    const nombres = [...new Set(data.map((p) => p.nombre).filter(Boolean))];
    return nombres;
  }

  // Slots disponibles de un profesor en una fecha
  // Descuenta los ya solicitados (pendiente o aceptada)
  async function getSlotsDisponibles(profesor, fecha) {
    const [profData, solRows] = await Promise.all([
      getProfesoresData(),
      read(CONFIG.TABS.solicitudes),
    ]);

    // Horas que ofrece el profesor ese día
    const ofertadas = profData
      .filter((p) => p.nombre === profesor && p.fecha === fecha)
      .map((p) => p.hora);

    // Horas ya ocupadas (pendiente o aceptada) para ese profesor y fecha
    const solicitudes = toObjects(solRows);
    const ocupadas = new Set();
    solicitudes.forEach((s) => {
      if (s.profesor === profesor && s.fecha === fecha &&
          (s.estado === "pendiente" || s.estado === "aceptada")) {
        [s.hora_1, s.hora_2, s.hora_3].forEach((h) => { if (h && h !== "me adapto") ocupadas.add(h); });
      }
    });

    return ofertadas.filter((h) => !ocupadas.has(h));
  }

  // Validaciones del lado cliente
  async function validarSolicitud(email, profesor, fecha, horas) {
    const rows = await read(CONFIG.TABS.solicitudes);
    const solicitudes = toObjects(rows);
    const emailLow = email.toLowerCase();

    // 1. ¿Ya tiene clase aceptada ese día?
    const claseAceptadaEseDia = solicitudes.some(
      (s) => s.email.toLowerCase() === emailLow &&
              s.fecha === fecha &&
              s.estado === "aceptada"
    );
    if (claseAceptadaEseDia) {
      return { ok: false, msg: "Ya tienes una clase aceptada ese día." };
    }

    // 2. ¿Ya tiene solicitud pendiente ese día con ese profesor?
    const yaHaySolicitud = solicitudes.some(
      (s) => s.email.toLowerCase() === emailLow &&
              s.fecha === fecha &&
              s.profesor === profesor &&
              s.estado === "pendiente"
    );
    if (yaHaySolicitud) {
      return { ok: false, msg: "Ya tienes una solicitud pendiente con ese profesor ese día." };
    }

    return { ok: true };
  }

  // ── Salas ─────────────────────────────────────────────────
  async function getSalas() {
    try {
      const rows = await read(CONFIG.TABS.salas);
      return toObjects(rows).map((s) => s.sala || s.nombre || s.name || "").filter(Boolean);
    } catch { return []; }
  }

  async function postSolicitudClase(datos) {
    return write("solicitud_clase", datos);
  }

  async function postReservaSala(datos) {
    return write("reserva_sala", datos);
  }

  return {
    getConciertos,
    getHorarioAlumno,
    getProfesores,
    getSlotsDisponibles,
    validarSolicitud,
    getSalas,
    postSolicitudClase,
    postReservaSala,
  };
})();
