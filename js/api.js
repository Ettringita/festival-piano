// ============================================================
//  FESTIVAL DE PIANO — API (capa de escritura)
//  Todas las llamadas POST van a Apps Script desde aquí.
//  Lee siempre desde sheets.js, nunca desde este archivo.
// ============================================================

const API = (() => {

  // ── Core POST ────────────────────────────────────────────────
  async function post(action, payload) {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain" },
      body:    JSON.stringify({ action, ...payload }),
    });

    if (!res.ok) throw new Error(`Error de red: ${res.status}`);

    const data = await res.json();

    // Apps Script devuelve { ok: false, error: "..." } en errores de lógica
    if (!data.ok) throw new Error(data.error || "Error desconocido");

    return data;
  }

  // ════════════════════════════════════════════════════════════
  //  ALUMNO — Solicitud de clase
  // ════════════════════════════════════════════════════════════

  // datos = { nombre, email, profesor, tipo, fecha_preferida?,
  //           hora_preferida?, mensaje? }
  //
  // tipos:
  //   GENERAL          → sin fecha ni hora
  //   FECHA            → fecha_preferida, sin hora
  //   DIA_HORA_FLEXIBLE → fecha_preferida + hora_preferida (flexible)
  //   HORA_EXACTA      → fecha_preferida + hora_preferida (exacta)
  async function solicitudClase(datos) {
    const result = await post("solicitud_clase", {
      ...datos,
      timestamp: new Date().toISOString(),
    });
    // Invalidar caché de solicitudes para que Mi Horario se refresque
    Sheets.invalidateCache(CONFIG.TABS.solicitudes);
    return result;
  }

  // ════════════════════════════════════════════════════════════
  //  ALUMNO — Reserva de piano de cola
  // ════════════════════════════════════════════════════════════
  async function reservaPiano(datos) {
    const result = await post("reserva_piano", {
      ...datos,
      timestamp: new Date().toISOString(),
    });
    return result;
  }

  // ════════════════════════════════════════════════════════════
  //  PROFESOR — Leer sus solicitudes (requiere token)
  // ════════════════════════════════════════════════════════════
  async function getSolicitudesProfesor(profesor, token) {
    const result = await post("get_solicitudes_profesor", { profesor, token });
    return result.solicitudes || [];
  }

  // ════════════════════════════════════════════════════════════
  //  PROFESOR — Aceptar solicitud (requiere token)
  // ════════════════════════════════════════════════════════════
  // id             → id de la solicitud
  // profesor       → nombre del profesor (debe coincidir con el token)
  // token          → token del profesor
  // fecha_asignada → fecha confirmada (puede ser distinta a la preferida)
  // hora_asignada  → hora confirmada
  async function aceptarSolicitud({ id, profesor, token, fecha_asignada, hora_asignada }) {
    return await post("aceptar_solicitud", {
      id, profesor, token, fecha_asignada, hora_asignada,
    });
  }

  // ════════════════════════════════════════════════════════════
  //  PROFESOR — Rechazar solicitud (requiere token)
  // ════════════════════════════════════════════════════════════
  async function rechazarSolicitud({ id, profesor, token }) {
    return await post("rechazar_solicitud", { id, profesor, token });
  }

  // ── API pública del módulo ────────────────────────────────────
  return {
    solicitudClase,
    reservaPiano,
    getSolicitudesProfesor,
    aceptarSolicitud,
    rechazarSolicitud,
  };
})();
