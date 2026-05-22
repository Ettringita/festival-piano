// ============================================================
//  FESTIVAL DE PIANO — Google Sheets API Layer
// ============================================================

const Sheets = (() => {
  const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

  // ── Core ────────────────────────────────────────────────────
  async function read(tabName) {
    const url = `${BASE}/${CONFIG.SHEET_ID}/values/${encodeURIComponent(tabName)}?key=${CONFIG.API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
    const data = await res.json();
    return data.values || [];
  }

  function toObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map((h) =>
      h.trim().toLowerCase()
       .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
       .replace(/ /g, "_")
    );
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

  // ── Normalización de fechas ──────────────────────────────────
  // Convierte cualquier formato (DD/MM/YYYY o YYYY-MM-DD) a DD/MM/YYYY
  function normalizeFecha(str) {
    if (!str) return "";
    str = str.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split("-");
      return `${d}/${m}/${y}`;
    }
    return str;
  }

  // ── Conciertos ───────────────────────────────────────────────
  async function getConciertos() {
    const rows = await read(CONFIG.TABS.conciertos);
    return toObjects(rows);
  }

  // ── Horario alumno ───────────────────────────────────────────
  // Lee de Solicitudes las filas con estado "aceptada" para ese email
  async function getHorarioAlumno(email) {
    const rows = await read(CONFIG.TABS.solicitudes);
    const todas = toObjects(rows);
    return todas.filter(
      (r) =>
        r.email.toLowerCase() === email.toLowerCase() &&
        r.estado && r.estado.toLowerCase() === "aceptada"
    );
  }

  // ── Profesores ───────────────────────────────────────────────
  async function getProfesoresData() {
    const rows = await read(CONFIG.TABS.profesores);
    return toObjects(rows);
    // Columnas esperadas en el Sheet:
    //   nombre | fecha | hora | exclusivo
    // "exclusivo" = "sí" (o "si") si el profesor solo puede dar 1 clase por alumno en todo el festival
  }

  async function getProfesores() {
    const data = await getProfesoresData();
    return [...new Set(data.map((p) => p.nombre).filter(Boolean))];
  }

  // Fechas disponibles de un profesor (deduplica y ordena)
  async function getFechasDisponibles(profesor) {
    const data = await getProfesoresData();
    const fechas = [
      ...new Set(
        data
          .filter((p) => p.nombre === profesor && p.fecha)
          .map((p) => p.fecha)
      ),
    ].sort();
    return fechas;
  }

  // Slots de un profesor en una fecha, descontando los ya solicitados/aceptados
  async function getSlotsDisponibles(profesor, fecha) {
    const fechaNorm = normalizeFecha(fecha);
    const [profData, solRows] = await Promise.all([
      getProfesoresData(),
      read(CONFIG.TABS.solicitudes),
    ]);

    const ofertadas = profData
      .filter(
        (p) => p.nombre === profesor && normalizeFecha(p.fecha) === fechaNorm
      )
      .map((p) => p.hora.trim().slice(0, 5));

    const solicitudes = toObjects(solRows);
    const ocupadas = new Set();
    solicitudes.forEach((s) => {
      if (
        s.profesor === profesor &&
        normalizeFecha(s.fecha) === fechaNorm &&
        (s.estado === "pendiente" || s.estado === "aceptada")
      ) {
        [s.hora_1, s.hora_2, s.hora_3].forEach((h) => {
          if (h && h !== "Me adapto") ocupadas.add(h.trim().slice(0, 5));
        });
      }
    });

    return ofertadas.filter((h) => !ocupadas.has(h));
  }

  // ── Validaciones para solicitud de clase ─────────────────────
  async function validarSolicitud(email, profesor, fecha) {
    const fechaNorm = normalizeFecha(fecha);
    const [solRows, profData] = await Promise.all([
      read(CONFIG.TABS.solicitudes),
      getProfesoresData(),
    ]);
    const solicitudes = toObjects(solRows);
    const emailLow = email.toLowerCase();

    // 1. ¿Ya tiene clase aceptada ese día?
    const claseAceptadaEseDia = solicitudes.some(
      (s) =>
        s.email.toLowerCase() === emailLow &&
        normalizeFecha(s.fecha) === fechaNorm &&
        s.estado === "aceptada"
    );
    if (claseAceptadaEseDia) {
      return { ok: false, msg: "Ya tienes una clase aceptada ese día." };
    }

    // 2. ¿Ya tiene solicitud pendiente/aceptada con ese profesor ese día?
    const yaHaySolicitud = solicitudes.some(
      (s) =>
        s.email.toLowerCase() === emailLow &&
        normalizeFecha(s.fecha) === fechaNorm &&
        s.profesor === profesor &&
        (s.estado === "pendiente" || s.estado === "aceptada")
    );
    if (yaHaySolicitud) {
      return {
        ok: false,
        msg: "Ya tienes una solicitud con ese profesor ese día.",
      };
    }

    // 3. Profesor exclusivo: solo 1 clase por alumno en todo el festival
    const profInfo = profData.find((p) => p.nombre === profesor);
    const esExclusivo =
      profInfo &&
      (profInfo.exclusivo || "").toLowerCase().startsWith("s");

    if (esExclusivo) {
      const yaClaseConProfesor = solicitudes.some(
        (s) =>
          s.email.toLowerCase() === emailLow &&
          s.profesor === profesor &&
          (s.estado === "pendiente" || s.estado === "aceptada")
      );
      if (yaClaseConProfesor) {
        return {
          ok: false,
          msg: `${profesor} solo puede darte una clase en el festival y ya tienes una solicitud con este profesor.`,
        };
      }
    }

    return { ok: true };
  }

  // ── Salas / Pianos de cola ───────────────────────────────────
  async function getSalas() {
    try {
      const rows = await read(CONFIG.TABS.salas);
      return toObjects(rows)
        .map((s) => s.sala || s.nombre || s.name || "")
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  // Horas libres para piano de cola en una fecha:
  // CONFIG.HORAS_DISPONIBLES − horas que tienen los profesores ese día
  async function getSlotsLibresParaPiano(fecha) {
    const fechaNorm = normalizeFecha(fecha);
    const profData = await getProfesoresData();
    const horasOcupadas = new Set(
      profData
        .filter((p) => normalizeFecha(p.fecha) === fechaNorm && p.hora)
        .map((p) => p.hora.trim().slice(0, 5))
    );
    return CONFIG.HORAS_DISPONIBLES.filter((h) => !horasOcupadas.has(h));
  }

  // ── Escritura ────────────────────────────────────────────────
  async function postSolicitudClase(datos) {
    return write("solicitud_clase", datos);
  }

  async function postReservaPiano(datos) {
    return write("reserva_piano", datos);
  }

  return {
    getConciertos,
    getHorarioAlumno,
    getProfesores,
    getFechasDisponibles,
    getSlotsDisponibles,
    validarSolicitud,
    getSalas,
    getSlotsLibresParaPiano,
    postSolicitudClase,
    postReservaPiano,
  };
})();
