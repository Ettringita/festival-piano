// ============================================================
//  FESTIVAL DE PIANO — App Logic
// ============================================================

// ── Identidad del alumno (persiste en localStorage) ──────────
const Identity = {
  KEY: "festival_piano_identity",

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || "null");
    } catch {
      return null;
    }
  },

  save(nombre, email) {
    localStorage.setItem(this.KEY, JSON.stringify({ nombre, email }));
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },
};

function initIdentity() {
  const identity = Identity.get();
  if (identity) {
    showIdentitySaved(identity);
    prefillForms(identity);
  }

  document.getElementById("id-save-btn").addEventListener("click", () => {
    const nombre = document.getElementById("id-nombre").value.trim();
    const email = document.getElementById("id-email").value.trim();
    if (!nombre || !email) {
      showToast("Introduce tu nombre y correo para continuar.", "error");
      return;
    }
    Identity.save(nombre, email);
    showIdentitySaved({ nombre, email });
    prefillForms({ nombre, email });
    showToast("✓ Datos guardados");
  });

  document.getElementById("id-change-btn").addEventListener("click", () => {
    Identity.clear();
    document.getElementById("identity-form-wrap").style.display = "";
    document.getElementById("identity-saved-wrap").style.display = "none";
    // Limpiar campos
    document.getElementById("id-nombre").value = "";
    document.getElementById("id-email").value = "";
    // Quitar readonly de formularios
    setFormsReadonly(false);
  });
}

function showIdentitySaved({ nombre, email }) {
  document.getElementById("identity-form-wrap").style.display = "none";
  document.getElementById("identity-saved-wrap").style.display = "flex";
  document.getElementById("id-display-nombre").textContent = nombre;
  document.getElementById("id-display-email").textContent = email;
}

function prefillForms({ nombre, email }) {
  // Tab 2: Mi Horario — pre-rellena el email de búsqueda
  const emailInput = document.getElementById("email-input");
  if (emailInput) emailInput.value = email;

  // Tab 3: Solicitar clase
  const solNombre = document.getElementById("sol-nombre");
  const solEmail  = document.getElementById("sol-email");
  if (solNombre) { solNombre.value = nombre; }
  if (solEmail)  { solEmail.value  = email;  }

  // Tab 4: Piano de cola
  const pianNombre = document.getElementById("pian-nombre");
  const pianEmail  = document.getElementById("pian-email");
  if (pianNombre) { pianNombre.value = nombre; }
  if (pianEmail)  { pianEmail.value  = email;  }

  setFormsReadonly(true);
}

function setFormsReadonly(readonly) {
  ["sol-nombre", "sol-email", "pian-nombre", "pian-email"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.readOnly = readonly;
  });
}

// ── Tab navigation ───────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(target).classList.add("active");

    if (target === "conciertos") loadConciertos();
    if (target === "horario")   { initHorario(); }
    if (target === "solicitar") initSolicitud();
    if (target === "reservar")  loadSalasParaPiano();
  });
});

// ── Helpers ──────────────────────────────────────────────────
function setLoading(containerId, msg = "Cargando...") {
  document.getElementById(containerId).innerHTML = `
    <div class="loading-state"><span class="loader"></span><p>${msg}</p></div>`;
}

function setError(containerId, msg) {
  document.getElementById(containerId).innerHTML = `
    <div class="error-state"><span class="icon-error">!</span><p>${msg}</p></div>`;
}

function formatDate(str) {
  if (!str) return "—";
  let d;
  if (str.includes("/")) {
    const [dd, mm, yyyy] = str.split("/");
    d = new Date(`${yyyy}-${mm}-${dd}`);
  } else {
    d = new Date(str);
  }
  if (isNaN(d)) return str;
  return d.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatTime(str) {
  if (!str) return "—";
  return str.slice(0, 5);
}

function showToast(msg, type = "success") {
  const t = document.createElement("div");
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("toast--visible"), 10);
  setTimeout(() => {
    t.classList.remove("toast--visible");
    setTimeout(() => t.remove(), 400);
  }, 3500);
}

// ── TAB 1: Conciertos ────────────────────────────────────────
async function loadConciertos() {
  setLoading("conciertos-list", "Cargando programa de conciertos...");
  try {
    const conciertos = await Sheets.getConciertos();
    if (!conciertos.length) {
      document.getElementById("conciertos-list").innerHTML =
        `<p class="empty-state">No hay conciertos programados aún.</p>`;
      return;
    }
    document.getElementById("conciertos-list").innerHTML = conciertos
      .map(
        (c, i) => `
      <article class="concert-card" style="animation-delay:${i * 0.07}s">
        <div class="concert-card__date">
          <span class="concert-card__day">${c.dia || c.fecha?.split("/")[0] || "—"}</span>
          <span class="concert-card__month">${c.mes || monthFromDate(c.fecha) || ""}</span>
        </div>
        <div class="concert-card__info">
          <h3 class="concert-card__title">${c.titulo || c.concierto || "Concierto"}</h3>
          <p class="concert-card__meta">
            ${c.hora   ? `<span>🕐 ${formatTime(c.hora)}</span>` : ""}
            ${c.lugar || c.sala ? `<span>📍 ${c.lugar || c.sala}</span>` : ""}
            ${c.interprete || c.artista ? `<span>🎹 ${c.interprete || c.artista}</span>` : ""}
          </p>
          ${c.descripcion ? `<p class="concert-card__desc">${c.descripcion}</p>` : ""}
        </div>
        ${c.entrada ? `<div class="concert-card__badge">${c.entrada}</div>` : ""}
      </article>`
      )
      .join("");
  } catch (e) {
    console.error(e);
    setError("conciertos-list", "No se pudo cargar el calendario.");
  }
}

function monthFromDate(str) {
  if (!str) return "";
  const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  const parts = str.includes("/") ? str.split("/") : str.split("-");
  const m = parseInt(str.includes("/") ? parts[1] : parts[1]) - 1;
  return months[m] || "";
}

// ── TAB 2: Mi Horario ────────────────────────────────────────
function initHorario() {
  // Si ya sabemos quién es, consultamos directamente
  const identity = Identity.get();
  if (identity && identity.email) {
    const emailInput = document.getElementById("email-input");
    emailInput.value = identity.email;
    buscarHorario(identity.email);
  }
}

async function buscarHorario(email) {
  setLoading("horario-result", "Buscando tu horario...");
  try {
    const clases = await Sheets.getHorarioAlumno(email);
    if (!clases.length) {
      document.getElementById("horario-result").innerHTML =
        `<p class="empty-state">No hay clases aceptadas para <strong>${email}</strong> aún.</p>`;
      return;
    }
    document.getElementById("horario-result").innerHTML = `
      <p class="horario-found">Se encontraron <strong>${clases.length}</strong> clase${clases.length > 1 ? "s" : ""} confirmada${clases.length > 1 ? "s" : ""}</p>
      <div class="schedule-table-wrap">
        <table class="schedule-table">
          <thead>
            <tr><th>Fecha</th><th>Hora</th><th>Profesor</th><th>Sala</th></tr>
          </thead>
          <tbody>
            ${clases
              .map(
                (c) => `
              <tr>
                <td>${formatDate(c.fecha)}</td>
                <td>${formatTime(c.hora_1 || c.hora || "—")}</td>
                <td>${c.profesor || "—"}</td>
                <td>${c.sala || c.aula || "—"}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    console.error(e);
    setError("horario-result", "Error al consultar. Inténtalo de nuevo.");
  }
}

document.getElementById("horario-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email-input").value.trim();
  if (!email) return;
  buscarHorario(email);
});

// ── TAB 3: Solicitar Clase ───────────────────────────────────
async function initSolicitud() {
  const sel = document.getElementById("sel-profesor");
  if (sel.options.length > 1) return;
  try {
    const profesores = await Sheets.getProfesores();
    profesores.forEach((p) => {
      if (!p) return;
      const opt = document.createElement("option");
      opt.value = opt.textContent = p;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("No se pudieron cargar los profesores", e);
  }
}

document.getElementById("sel-profesor").addEventListener("change", async () => {
  const profesor = document.getElementById("sel-profesor").value;
  const fechasWrap = document.getElementById("fechas-wrap");
  const slotsWrap  = document.getElementById("slots-wrap");
  slotsWrap.innerHTML = "";

  if (!profesor) { fechasWrap.innerHTML = ""; return; }

  fechasWrap.innerHTML = `<div class="loading-state" style="padding:0.75rem 0"><span class="loader"></span></div>`;

  try {
    const fechas = await Sheets.getFechasDisponibles(profesor);
    if (!fechas.length) {
      fechasWrap.innerHTML = `<p class="form-note">Este profesor no tiene fechas disponibles.</p>`;
      return;
    }
    fechasWrap.innerHTML = `
      <p class="slots-label">Fechas disponibles — elige una:</p>
      <div class="slots-grid">
        ${fechas
          .map(
            (f) => `
          <button type="button" class="fecha-btn" data-fecha="${f}">
            ${formatDate(f)}
          </button>`
          )
          .join("")}
      </div>`;

    fechasWrap.querySelectorAll(".fecha-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        fechasWrap.querySelectorAll(".fecha-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        cargarSlots(profesor, btn.dataset.fecha);
      });
    });
  } catch (e) {
    fechasWrap.innerHTML = `<p class="form-note" style="color:var(--error)">Error al cargar fechas.</p>`;
  }
});

async function cargarSlots(profesor, fecha) {
  const slotsWrap = document.getElementById("slots-wrap");
  slotsWrap.innerHTML = `<div class="loading-state" style="padding:0.75rem 0"><span class="loader"></span></div>`;
  try {
    const slots = await Sheets.getSlotsDisponibles(profesor, fecha);
    renderSlots(slots, fecha);
  } catch (e) {
    slotsWrap.innerHTML = `<p class="form-note" style="color:var(--error)">Error al cargar disponibilidad.</p>`;
  }
}

function renderSlots(slots, fecha) {
  const slotsWrap = document.getElementById("slots-wrap");
  document.getElementById("sol-fecha-hidden").value = fecha;

  const todasOpciones = [...slots, "me_adapto"];

  if (!slots.length) {
    slotsWrap.innerHTML = `
      <p class="slots-label">Preferencias de horario:</p>
      <div class="slots-grid">
        <label class="slot-option">
          <input type="checkbox" name="slot" value="me_adapto" />
          <span>Me adapto al profesor</span>
        </label>
      </div>`;
    return;
  }

  slotsWrap.innerHTML = `
    <p class="slots-label">Selecciona hasta 3 preferencias (por orden de prioridad):</p>
    <div class="slots-grid">
      ${todasOpciones
        .map(
          (s) => `
        <label class="slot-option">
          <input type="checkbox" name="slot" value="${s}" />
          <span>${s === "me_adapto" ? "Me adapto al profesor" : s}</span>
        </label>`
        )
        .join("")}
    </div>
    <p id="slots-error" class="form-note" style="color:var(--error);display:none">Máximo 3 preferencias.</p>`;

  slotsWrap.querySelectorAll('input[name="slot"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const checked = [...slotsWrap.querySelectorAll('input[name="slot"]:checked')];
      const err = document.getElementById("slots-error");
      if (checked.length > 3) {
        cb.checked = false;
        err.style.display = "block";
      } else {
        err.style.display = "none";
      }
    });
  });
}

document.getElementById("form-solicitud").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");

  const nombre   = document.getElementById("sol-nombre").value.trim();
  const email    = document.getElementById("sol-email").value.trim();
  const profesor = document.getElementById("sel-profesor").value;
  const fecha    = document.getElementById("sol-fecha-hidden").value;
  const mensaje  = document.getElementById("sol-mensaje").value.trim();

  if (!nombre || !email) { showToast("Introduce tu nombre y correo.", "error"); return; }
  if (!profesor) { showToast("Selecciona un profesor.", "error"); return; }
  if (!fecha)    { showToast("Selecciona una fecha.", "error"); return; }

  const checked = [...document.querySelectorAll('input[name="slot"]:checked')];
  if (!checked.length) {
    showToast("Selecciona al menos una preferencia de horario.", "error");
    return;
  }

  const horas = checked.map((c) => (c.value === "me_adapto" ? "Me adapto" : c.value));
  const [hora_1 = "", hora_2 = "", hora_3 = ""] = horas;

  btn.disabled = true;
  btn.textContent = "Enviando...";

  try {
    const validacion = await Sheets.validarSolicitud(email, profesor, fecha);
    if (!validacion.ok) {
      showToast(validacion.msg, "error");
      return;
    }

    await Sheets.postSolicitudClase({
      nombre, email, profesor, fecha,
      hora_1, hora_2, hora_3,
      mensaje, estado: "pendiente",
      timestamp: new Date().toISOString(),
    });

    showToast("✓ Solicitud enviada correctamente");
    e.target.reset();
    document.getElementById("fechas-wrap").innerHTML = "";
    document.getElementById("slots-wrap").innerHTML = "";
    document.getElementById("sol-fecha-hidden").value = "";

    // Reponer datos de identidad si estaban bloqueados
    const identity = Identity.get();
    if (identity) prefillForms(identity);

  } catch (err) {
    console.error(err);
    showToast("Error al enviar. Inténtalo de nuevo.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar solicitud";
  }
});

// ── TAB 4: Piano de Cola ─────────────────────────────────────
async function loadSalasParaPiano() {
  const sel = document.getElementById("sel-sala");
  if (sel.options.length > 1) return;
  try {
    const salas = await Sheets.getSalas();
    salas.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = s;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }
}

document.getElementById("pian-fecha").addEventListener("change", async () => {
  const fechaISO = document.getElementById("pian-fecha").value;
  if (!fechaISO) return;

  const slotsWrap = document.getElementById("piano-slots-wrap");
  slotsWrap.innerHTML = `<div class="loading-state" style="padding:0.75rem 0"><span class="loader"></span></div>`;

  try {
    const slots = await Sheets.getSlotsLibresParaPiano(fechaISO);
    if (!slots.length) {
      slotsWrap.innerHTML = `<p class="form-note">No hay horas libres ese día — los profesores ocupan toda la jornada.</p>`;
      return;
    }
    slotsWrap.innerHTML = `
      <p class="slots-label">Horas disponibles — elige una:</p>
      <div class="slots-grid">
        ${slots
          .map(
            (h) => `
          <label class="slot-option">
            <input type="radio" name="piano-slot" value="${h}" />
            <span>${h}</span>
          </label>`
          )
          .join("")}
      </div>`;
  } catch (e) {
    slotsWrap.innerHTML = `<p class="form-note" style="color:var(--error)">Error al cargar disponibilidad.</p>`;
  }
});

document.getElementById("form-reserva").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");

  const nombre   = document.getElementById("pian-nombre").value.trim();
  const email    = document.getElementById("pian-email").value.trim();
  const piano    = document.getElementById("sel-sala").value;
  const fechaISO = document.getElementById("pian-fecha").value;
  const horaEl   = document.querySelector('input[name="piano-slot"]:checked');

  if (!nombre || !email) { showToast("Faltan tu nombre o correo.", "error"); return; }
  if (!piano)    { showToast("Selecciona un piano de cola.", "error"); return; }
  if (!fechaISO) { showToast("Selecciona una fecha.", "error"); return; }
  if (!horaEl)   { showToast("Selecciona una hora.", "error"); return; }

  // Convertir YYYY-MM-DD → DD/MM/YYYY para el Sheet
  const [y, m, d] = fechaISO.split("-");
  const fecha = `${d}/${m}/${y}`;

  btn.disabled = true;
  btn.textContent = "Reservando...";

  try {
    await Sheets.postReservaPiano({
      nombre, email,
      piano,
      fecha,
      hora: horaEl.value,
      timestamp: new Date().toISOString(),
    });
    showToast("✓ Piano reservado correctamente");
    e.target.reset();
    document.getElementById("piano-slots-wrap").innerHTML = "";

    // Reponer identidad
    const identity = Identity.get();
    if (identity) prefillForms(identity);

  } catch (err) {
    console.error(err);
    showToast("Error al reservar. Inténtalo de nuevo.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar reserva";
  }
});

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initIdentity();
  document.querySelector(".tab-btn[data-tab='conciertos']").click();
});
