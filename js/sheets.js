// ============================================================
//  FESTIVAL DE PIANO — Sheets (capa de solo lectura)
//  Escribe siempre a través de api.js, nunca aquí.
// ============================================================

const Sheets = (() => {
  const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

  // ── Caché por sesión ─────────────────────────────────────────
  // Evita llamadas duplicadas a la API durante la misma visita.
  // Se invalida después de cualquier escritura (ver api.js).
  const _cache = {};

  async function read(tabName) {
    if (_cache[tabName]) return _cache[tabName];
    const url = `${BASE}/${CONFIG.SHEET_ID}/values/${encodeURIComponent(tabName)}?key=${CONFIG.API_KEY}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`Sheets API error ${res.status} — ${tabName}`);
    const data = await res.json();
    _cache[tabName] = data.values || [];
    return _cache[tabName];
  }

  function invalidateCache(...tabs) {
    if (!tabs.length) {
      Object.keys(_cache).forEach(k => delete _cache[k]);
    } else {
      tabs.forEach(t => delete _cache[t]);
    }
  }

  function toObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map(h =>
      String(h).trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
    );
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = String(row[i] ?? "").trim()));
      return obj;
    });
  }

  // Normaliza cualquier formato de fecha a DD/MM/YYYY
  function normalizeFecha(str) {
    if (!str) return "";
    str = String(str).trim();
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

  // ── Profesores ───────────────────────────────────────────────
  async function _getProfesoresData() {
    const rows = await read(CONFIG.TABS.profesores);
    return toObjects(rows);
    // Columnas: nombre | token | fecha | hora | exclusivo
  }

  // Lista de nombres únicos (para el select del alumno)
  async function getProfesores() {
    const data = await _getProfesoresData();
    return [...new Set(data.map(p => p.nombre).filter(Boolean))];
  }

  // Disponibilidad real de un profesor: slots ofertados − slots aceptados
  // Devuelve: [{ fecha, slotsLibres: ["10:00", "11:00"] }, ...]
  async function getDisponibilidadProfesor(profesor) {
    const [profData, solData] = await Promise.all([
      _getProfesoresData(),
      _getSolicitudesData(),
    ]);

    // Todos los slots que oferta este profesor, agrupados por fecha
    const ofertaPorFecha = {};
    profData
      .filter(p => p.nombre === profesor && p.fecha && p.hora)
      .forEach(p => {
        const f = normalizeFecha(p.fecha);
        if (!ofertaPorFecha[f]) ofertaPorFecha[f] = [];
        ofertaPorFecha[f].push(p.hora.trim().slice(0, 5));
      });

    // Slots ya bloqueados (solicitudes aceptadas de este profesor)
    const bloqueados = {}; // { "DD/MM/YYYY": Set<"HH:MM"> }
    solData
      .filter(s =>
        s.profesor === profesor &&
        s.estado   === "aceptada" &&
        s.fecha_asignada &&
        s.hora_asignada
      )
      .forEach(s => {
        const f = normalizeFecha(s.fecha_asignada);
        if (!bloqueados[f]) bloqueados[f] = new Set();
        bloqueados[f].add(s.hora_asignada.trim().slice(0, 5));
      });

    // Cruzar: solo fechas con al menos un slot libre
    return Object.entries(ofertaPorFecha)
      .map(([fecha, slots]) => ({
        fecha,
        slotsLibres: slots.filter(h => !bloqueados[fecha]?.has(h)),
      }))
      .filter(d => d.slotsLibres.length > 0)
      .sort((a, b) => {
        // Ordenar por fecha ascendente (DD/MM/YYYY → ISO para comparar)
        const toISO = f => f.split("/").reverse().join("-");
        return toISO(a.fecha) < toISO(b.fecha) ? -1 : 1;
      });
  }

  // ¿Este profesor está bloqueado para este alumno?
  // Bloqueado = exclusivo Y ya tiene solicitud pendiente/aceptada con él
  async function isProfesorBloqueadoParaAlumno(email, profesor) {
    const [profData, solData] = await Promise.all([
      _getProfesoresData(),
      _getSolicitudesData(),
    ]);

    const esExclusivo = profData.some(p =>
      p.nombre === profesor &&
      p.exclusivo.toLowerCase().startsWith("s")
    );
    if (!esExclusivo) return false;

    return solData.some(s =>
      s.email.toLowerCase() === email.toLowerCase() &&
      s.profesor            === profesor &&
      (s.estado === "pendiente" || s.estado === "aceptada")
    );
  }

  // ── Solicitudes ──────────────────────────────────────────────
  async function _getSolicitudesData() {
    const rows = await read(CONFIG.TABS.solicitudes);
    return toObjects(rows);
  }

  // Clases confirmadas del alumno (para Mi Horario)
  async function getHorarioAlumno(email) {
    const data = await _getSolicitudesData();
    return data.filter(s =>
      s.email.toLowerCase() === email.toLowerCase() &&
      s.estado === "aceptada"
    );
  }

  // Todas las solicitudes del alumno (para validaciones UX)
  async function getSolicitudesAlumno(email) {
    const data = await _getSolicitudesData();
    return data.filter(s =>
      s.email.toLowerCase() === email.toLowerCase()
    );
  }

  // ── Salas / Piano de cola ────────────────────────────────────
  async function getSalas() {
    try {
      const rows = await read(CONFIG.TABS.salas);
      return toObjects(rows)
        .map(s => s.sala || s.nombre || "")
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  // Horas libres para piano: CONFIG.HORAS_DISPONIBLES − horas de profesores ese día
  async function getSlotsLibresParaPiano(fecha) {
    const fechaNorm = normalizeFecha(fecha);
    const profData  = await _getProfesoresData();

    const horasOcupadas = new Set(
      profData
        .filter(p => normalizeFecha(p.fecha) === fechaNorm && p.hora)
        .map(p => p.hora.trim().slice(0, 5))
    );

    return CONFIG.HORAS_DISPONIBLES.filter(h => !horasOcupadas.has(h));
  }

  // ── API pública del módulo ────────────────────────────────────
  return {
    getConciertos,
    getProfesores,
    getDisponibilidadProfesor,
    isProfesorBloqueadoParaAlumno,
    getHorarioAlumno,
    getSolicitudesAlumno,
    getSalas,
    getSlotsLibresParaPiano,
    invalidateCache,
  };
})();
