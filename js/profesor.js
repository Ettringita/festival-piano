// ============================================================
//  FESTIVAL DE PIANO — Panel del Profesor
// ============================================================

// ── Leer parámetros de la URL ────────────────────────────────
const params   = new URLSearchParams(window.location.search);
const PROFESOR = (params.get("profesor") || "").trim();
const TOKEN    = (params.get("token") || "").trim();

// Estado global de disponibilidad del profesor (cargado una sola vez)
let disponibilidad = []; // [{ fecha, slotsLibres: ["10:00", ...] }]

// ── Helpers ──────────────────────────────────────────────────
function showToast(msg, type = "success") {
  let t = document.getElementById("prof-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "prof-toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  setTimeout(() => t.classList.add("toast--visible"), 10);
  setTimeout(() => {
    t.classList.remove("toast--visible");
  }, 3800);
}

function formatDate(str) {
  if (!str) return "—";
  let d;
  if (str.includes("/")) {
    const [dd, mm, yyyy] = str.split("/");
    d = new Date(`${yyyy}-${mm}-${dd}`);
  } else { d = new Date(str); }
  if (isNaN(d)) return str;
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(str) { return str ? String(str).slice(0, 5) : "—"; }

function timeAgo(isoStr) {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h > 48) return `hace ${Math.floor(h/24)} días`;
  if (h >= 1)  return `hace ${h}h`;
  if (m >= 1)  return `hace ${m} min`;
  return "ahora mismo";
}

function tipoLabel(tipo) {
  return {
    GENERAL:           "Abierta — cualquier fecha y hora",
    FECHA:             "Fecha concreta — hora abierta",
    DIA_HORA_FLEXIBLE: "Hora preferida — flexible",
    HORA_EXACTA:       "Hora exacta",
  }[tipo] || tipo;
}

function preferenciaTexto(sol) {
  const { tipo, fecha_preferida, hora_preferida } = sol;
  if (tipo === "GENERAL")          return "Se adapta al profesor";
  if (tipo === "FECHA")            return `El ${formatDate(fecha_preferida)}, hora abierta`;
  if (tipo === "DIA_HORA_FLEXIBLE")
    return `El ${formatDate(fecha_preferida)} — prefiere las ${formatTime(hora_preferida)}`;
  if (tipo === "HORA_EXACTA")
    return `El ${formatDate(fecha_preferida)} a las ${formatTime(hora_preferida)} exactamente`;
  return "";
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!PROFESOR || !TOKEN) {
    document.getElementById("sol-list").innerHTML =
      `<div class="error-state"><p>Enlace inválido. Contacta con la organización.</p></div>`;
    return;
  }

  document.getElementById("prof-nombre").textContent = PROFESOR;

  try {
    // Cargar solicitudes y disponibilidad en paralelo
    const [solicitudes, disp] = await Promise.all([
      API.getSolicitudesProfesor(PROFESOR, TOKEN),
      Sheets.getDisponibilidadProfesor(PROFESOR),
    ]);

    disponibilidad = disp;
    renderSolicitudes(solicitudes);

  } catch (err) {
    document.getElementById("prof-nombre").textContent = "Error";
    document.getElementById("sol-list").innerHTML =
      `<div class="error-state"><p>${err.message || "No se pudo cargar. Comprueba el enlace."}</p></div>`;
  }
});

// ── Render lista ─────────────────────────────────────────────
function renderSolicitudes(solicitudes) {
  const pendientes  = solicitudes.filter(s => s.estado === "pendiente").length;
  const aceptadas   = solicitudes.filter(s => s.estado === "aceptada").length;

  document.getElementById("prof-stats").textContent =
    `${pendientes} pendiente${pendientes !== 1 ? "s" : ""} · ${aceptadas} aceptada${aceptadas !== 1 ? "s" : ""}`;

  if (!solicitudes.length) {
    document.getElementById("sol-list").innerHTML =
      `<div class="empty-state"><p>No tienes solicitudes todavía.</p></div>`;
    return;
  }

  document.getElementById("sol-list").innerHTML = solicitudes
    .map((s, i) => renderCard(s, i))
    .join("");

  // Añadir listeners
  document.querySelectorAll(".btn-aceptar").forEach(btn => {
    btn.addEventListener("click", () => onAceptarClick(btn.dataset.id));
  });
  document.querySelectorAll(".btn-rechazar").forEach(btn => {
    btn.addEventListener("click", () => onRechazarClick(btn.dataset.id, btn));
  });
}

function renderCard(sol, idx) {
  const isPendiente = sol.estado === "pendiente";
  const resolucion  = sol.timestamp_resolucion
    ? `<p class="sol-resolucion">${sol.estado === "aceptada" ? "✓" : "✗"} 
       ${sol.fecha_asignada ? formatDate(sol.fecha_asignada) + " · " + formatTime(sol.hora_asignada) : ""}
       ${timeAgo(sol.timestamp_resolucion)}</p>` : "";

  return `
    <div class="sol-card sol-card--${sol.estado}" id="card-${sol.id}"
         style="animation-delay:${idx * 0.05}s">

      <div class="sol-card__top">
        <span class="sol-estado">${
          sol.estado === "pendiente"  ? "Pendiente" :
          sol.estado === "aceptada"   ? "Aceptada"  : "Rechazada"
        }</span>
        <span class="sol-timestamp">${timeAgo(sol.timestamp)}</span>
      </div>

      <div class="sol-card__body">
        <h3 class="sol-alumno">${sol.nombre || "—"}</h3>
        <p class="sol-email">${sol.email || ""}</p>

        <div class="sol-preferencia">
          <span class="sol-tipo-badge">${tipoLabel(sol.tipo)}</span>
          <p class="sol-pref-detalle">${preferenciaTexto(sol)}</p>
        </div>

        ${sol.mensaje ? `<p class="sol-mensaje">${sol.mensaje}</p>` : ""}
      </div>

      ${resolucion}

      ${isPendiente ? `
        <div class="sol-card__actions">
          <button class="btn-accion btn-aceptar" data-id="${sol.id}">✓ Aceptar</button>
          <button class="btn-accion btn-rechazar" data-id="${sol.id}">✗ Rechazar</button>
        </div>
        <div class="accept-form" id="accept-form-${sol.id}" style="display:none">
          ${renderAcceptForm(sol)}
        </div>
      ` : ""}
    </div>`;
}

// ── Inline Accept Form ────────────────────────────────────────
function renderAcceptForm(sol) {
  if (!disponibilidad.length) {
    return `<p style="color:var(--muted);font-size:.9rem">No tienes horas disponibles en el Sheet.</p>`;
  }

  // Fecha sugerida (si el alumno tiene preferencia y coincide con disponibilidad)
  const fechaSugerida = disponibilidad.find(d =>
    sol.fecha_preferida && d.fecha === sol.fecha_preferida
  );

  const fechasBtns = disponibilidad.map(d => `
    <button type="button" class="accept-fecha-btn ${d.fecha === sol.fecha_preferida ? "active" : ""}"
      data-fecha="${d.fecha}"
      data-slots='${JSON.stringify(d.slotsLibres)}'>
      <span>${formatDate(d.fecha)}</span>
      <span class="accept-fecha-slots">${d.slotsLibres.length} hueco${d.slotsLibres.length !== 1 ? "s" : ""}</span>
    </button>`).join("");

  // Mostrar slots de la fecha sugerida por defecto, o la primera disponible
  const fechaInicial = fechaSugerida || disponibilidad[0];
  const horasBtns = renderHorasBtns(fechaInicial.slotsLibres, sol.hora_preferida);

  return `
    <span class="accept-form__title">Confirmar fecha y hora</span>

    <div class="accept-fechas" id="accept-fechas-${sol.id}">
      ${fechasBtns}
    </div>

    <div class="accept-horas" id="accept-horas-${sol.id}">
      ${horasBtns}
    </div>

    <div class="accept-form__footer">
      <button class="btn-confirmar" id="btn-confirmar-${sol.id}" disabled
        data-id="${sol.id}">
        Confirmar clase
      </button>
      <button class="btn-cancelar" data-id="${sol.id}">Cancelar</button>
    </div>`;
}

function renderHorasBtns(slots, horaSugerida) {
  return slots.map(h => `
    <button type="button"
      class="accept-hora-btn ${h === horaSugerida ? "sugerida" : ""}"
      data-hora="${h}">
      ${h}${h === horaSugerida ? " ★" : ""}
    </button>`).join("");
}

// ── Event handlers ────────────────────────────────────────────
function onAceptarClick(id) {
  const form = document.getElementById(`accept-form-${id}`);
  const card = document.getElementById(`card-${id}`);

  // Ocultar botones, mostrar formulario
  card.querySelector(".sol-card__actions").style.display = "none";
  form.style.display = "block";

  // Selección de fecha
  form.querySelectorAll(".accept-fecha-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      form.querySelectorAll(".accept-fecha-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Actualizar horas según la fecha elegida
      const slots    = JSON.parse(btn.dataset.slots);
      const solCard  = btn.closest(".sol-card");
      const solId    = solCard.id.replace("card-", "");
      const solEl    = document.querySelector(`#card-${solId}`);

      // Recuperar hora sugerida del alumno
      const horaSugerida = disponibilidad.find(d => d.fecha === btn.dataset.fecha)?.slotsLibres ?? [];
      const horaPref = btn.dataset.fecha ===
        solEl?.querySelector(".sol-pref-detalle")?.dataset?.horaPref || "";

      document.getElementById(`accept-horas-${id}`).innerHTML =
        renderHorasBtns(slots, "");

      addHoraListeners(id, form);
      document.getElementById(`btn-confirmar-${id}`).disabled = true;
    });
  });

  addHoraListeners(id, form);

  // Pre-activar fecha sugerida y su hora si corresponde
  const fechaActiva = form.querySelector(".accept-fecha-btn.active");
  if (fechaActiva) {
    const horasWrap = document.getElementById(`accept-horas-${id}`);
    const horaSugerida = horasWrap.querySelector(".sugerida");
    if (horaSugerida) {
      horaSugerida.classList.add("active");
      document.getElementById(`btn-confirmar-${id}`).disabled = false;
    }
  }

  // Cancelar
  form.querySelector(".btn-cancelar").addEventListener("click", () => {
    form.style.display = "none";
    card.querySelector(".sol-card__actions").style.display = "grid";
  });

  // Confirmar
  document.getElementById(`btn-confirmar-${id}`).addEventListener("click", () => {
    onConfirmarAceptar(id, form);
  });
}

function addHoraListeners(id, form) {
  form.querySelectorAll(".accept-hora-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      form.querySelectorAll(".accept-hora-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`btn-confirmar-${id}`).disabled = false;
    });
  });
}

async function onConfirmarAceptar(id, form) {
  const fechaBtn = form.querySelector(".accept-fecha-btn.active");
  const horaBtn  = form.querySelector(".accept-hora-btn.active");

  if (!fechaBtn || !horaBtn) {
    showToast("Elige fecha y hora antes de confirmar.", "error"); return;
  }

  const btnConfirmar = document.getElementById(`btn-confirmar-${id}`);
  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "Enviando...";

  try {
    await API.aceptarSolicitud({
      id,
      profesor:      PROFESOR,
      token:         TOKEN,
      fecha_asignada: fechaBtn.dataset.fecha,
      hora_asignada:  horaBtn.dataset.hora,
    });

    // Actualizar disponibilidad local (quitar el slot aceptado)
    const fecha = fechaBtn.dataset.fecha;
    const hora  = horaBtn.dataset.hora;
    disponibilidad = disponibilidad.map(d => {
      if (d.fecha !== fecha) return d;
      return { ...d, slotsLibres: d.slotsLibres.filter(h => h !== hora) };
    }).filter(d => d.slotsLibres.length > 0);

    // Invalidar caché de Sheets
    Sheets.invalidateCache(CONFIG.TABS.solicitudes, CONFIG.TABS.profesores);

    showToast("✓ Clase aceptada correctamente");

    // Recargar la lista
    recargar();

  } catch (err) {
    showToast(err.message || "Error al aceptar.", "error");
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Confirmar clase";
  }
}

async function onRechazarClick(id, btn) {
  // Confirmación simple: segundo tap confirma
  if (btn.dataset.confirm !== "1") {
    btn.textContent = "¿Seguro? Toca de nuevo";
    btn.dataset.confirm = "1";
    setTimeout(() => {
      btn.textContent = "✗ Rechazar";
      btn.dataset.confirm = "0";
    }, 3000);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Rechazando...";

  try {
    await API.rechazarSolicitud({ id, profesor: PROFESOR, token: TOKEN });
    Sheets.invalidateCache(CONFIG.TABS.solicitudes);
    showToast("Solicitud rechazada");
    recargar();
  } catch (err) {
    showToast(err.message || "Error al rechazar.", "error");
    btn.disabled = false;
    btn.textContent = "✗ Rechazar";
  }
}

async function recargar() {
  try {
    const solicitudes = await API.getSolicitudesProfesor(PROFESOR, TOKEN);
    renderSolicitudes(solicitudes);
  } catch (err) {
    showToast("Error al recargar la lista.", "error");
  }
}
