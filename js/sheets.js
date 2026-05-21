// ============================================================
//  FESTIVAL DE PIANO — Google Sheets API Layer
// ============================================================

const Sheets = (() => {
  const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

  // Lectura genérica de un rango
  async function read(tabName, range = "") {
    const fullRange = range ? `${tabName}!${range}` : tabName;
    const url = `${BASE}/${CONFIG.SHEET_ID}/values/${encodeURIComponent(fullRange)}?key=${CONFIG.API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
    const data = await res.json();
    return data.values || [];
  }

  // Convierte array de arrays en array de objetos usando la primera fila como headers
  function toObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/ /g, "_"));
    return rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i] || ""));
      return obj;
    });
  }

  // Escritura via Apps Script
  async function write(action, payload) {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // evita preflight CORS
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) throw new Error(`Apps Script error: ${res.status}`);
    return await res.json();
  }

  // ── Métodos específicos ──────────────────────────────────

  async function getConciertos() {
    const rows = await read(CONFIG.TABS.conciertos);
    return toObjects(rows);
  }

  async function getHorarioAlumno(email) {
    const rows = await read(CONFIG.TABS.horarios);
    const todos = toObjects(rows);
    return todos.filter(
      (r) => r.email && r.email.toLowerCase().trim() === email.toLowerCase().trim()
    );
  }

  async function getProfesores() {
    try {
      const rows = await read(CONFIG.TABS.profesores);
      return toObjects(rows).map((p) => p.nombre || p.name || "");
    } catch {
      return [];
    }
  }

  async function getSalas() {
    try {
      const rows = await read(CONFIG.TABS.salas);
      return toObjects(rows).map((s) => s.sala || s.nombre || s.name || "");
    } catch {
      return [];
    }
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
    getSalas,
    postSolicitudClase,
    postReservaSala,
  };
})();
