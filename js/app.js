// ============================================================
//  FESTIVAL DE PIANO — App Logic
// ============================================================

// ── Tab navigation ───────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(target).classList.add("active");
    if (target === "conciertos") loadConciertos();
    if (target === "solicitar") initSolicitud();
    if (target === "reservar") loadSalas();
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
  // soporta dd/mm/yyyy y yyyy-mm-dd
  let d;
  if (str.includes("/")) {
    const [dd, mm, yyyy] = str.split("/");
    d = new Date(`${yyyy}-${mm}-${dd}`);
  } else {
    d = new Date(str);
  }
  if (isNaN(d)) return str;
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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
  setTimeout(() => { t.classList.remove("toast--visible"); setTimeout(() => t.remove(), 400); }, 3500);
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
    document.getElementById("conciertos-list").innerHTML = conciertos.map((c, i) => `
      <article class="concert-card" style="animation-delay:${i * 0.07}s">
        <div class="concert-card__date">
          <span class="concert-card__day">${c.dia || c.fecha?.split("/")[0] || "—"}</span>
          <span class="concert-card__month">${c.mes || monthFromDate(c.fecha) || ""}</span>
        </div>
        <div class="concert-card__info">
          <h3 class="concert-card__title">${c.titulo || c.concierto || "Concierto"}</h3>
          <p class="concert-card__meta">
            ${c.hora ? `<span>🕐 ${formatTime(c.hora)}</span>` : ""}
            ${c.lugar || c.sala ? `<span>📍 ${c.lugar || c.sala}</span>` : ""}
            ${c.interprete || c.artista ? `<span>🎹 ${c.interprete || c.artista}</span>` : ""}
          </p>
          ${c.descripcion ? `<p class="concert-card__desc">${c.descripcion}</p>` : ""}
        </div>
        ${c.entrada ? `<div class="concert-card__badge">${c.entrada}</div>` : ""}
      </article>`
    ).join("");
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
document.getElementById("horario-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email-input").value.trim();
  if (!email) return;
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
            ${clases.map((c) => `
              <tr>
                <td>${formatDate(c.fecha)}</td>
                <td>${formatTime(c.hora_1 || c.hora || "—")}</td>
                <td>${c.profesor || "—"}</td>
                <td>${c.sala || c.aula || "—"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    console.error(e);
    setError("horario-result", "Error al consultar. Inténtalo de nuevo.");
  }
});

// ── TAB 3: Solicitar Clase ───────────────────────────────────
let profesoresCache = [];

async function initSolicitud() {
  const sel = document.getElementById("sel-profesor");
  if (sel.options.length > 1) return;
  try {
    profesoresCache = await Sheets.getProfesores();
    profesoresCache.forEach((p) => {
      if (!p) return;
      const opt = document.createElement("option");
      opt.value = opt.textContent = p;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("No se pudieron cargar los profesores", e);
  }
}

// Cuando cambia profesor o fecha, carga los slots disponibles
async function actualizarSlots() {
  const profesor = document.getElementById("sel-profesor").value;
  const fecha = document.getElementById("sol-fecha").value;
  if (!profesor || !fecha) return;

  const slotsWrap = document.getElementById("slots-wrap");
  slotsWrap.innerHTML = `<div class="loading-state" style="padding:1rem 0"><span class="loader"></span></div>`;

  try {
    const slots = await Sheets.getSlotsDisponibles(profesor, fecha);
    renderSlots(slots);
  } catch (e) {
    slotsWrap.innerHTML = `<p class="form-note" style="color:var(--error)">Error al cargar disponibilidad.</p>`;
  }
}

function renderSlots(slots) {
  const slotsWrap = document.getElementById("slots-wrap");
  if (!slots.length) {
    slotsWrap.innerHTML = `<p class="form-note">No hay horas disponibles para esa fecha.</p>`;
    return;
  }

  const todasOpciones = [...slots, "me_adapto"];

  slotsWrap.innerHTML = `
    <p class="slots-label">Selecciona hasta 3 preferencias de horario (por orden de prioridad):</p>
    <div class="slots-grid">
      ${todasOpciones.map((s) => `
        <label class="slot-option">
          <input type="checkbox" name="slot" value="${s}" />
          <span>${s === "me_adapto" ? "Me adapto al profesor" : s}</span>
        </label>`).join("")}
    </div>
    <p id="slots-error" class="form-note" style="color:var(--error);display:none">Máximo 3 preferencias.</p>
  `;

  // Máximo 3 checkboxes
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

document.getElementById("sel-profesor").addEventListener("change", actualizarSlots);
document.getElementById("sol-fecha").addEventListener("change", actualizarSlots);

document.getElementById("form-solicitud").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");

  const nombre   = document.getElementById("sol-nombre").value.trim();
  const email    = document.getElementById("sol-email").value.trim();
  const profesor = document.getElementById("sel-profesor").value;
  const fecha    = document.getElementById("sol-fecha").value;
  const mensaje  = document.getElementById("sol-mensaje").value.trim();

  // Recoger preferencias seleccionadas
  const checked = [...document.querySelectorAll('input[name="slot"]:checked')];
  if (!checked.length) {
    showToast("Selecciona al menos una preferencia de horario.", "error");
    return;
  }

  const horas = checked.map((c) => c.value === "me_adapto" ? "Me adapto" : c.value);
  const [hora_1 = "", hora_2 = "", hora_3 = ""] = horas;

  btn.disabled = true;
  btn.textContent = "Enviando...";

  try {
    // Validar en cliente
    const validacion = await Sheets.validarSolicitud(email, profesor, fecha, horas);
    if (!validacion.ok) {
      showToast(validacion.msg, "error");
      return;
    }

    await Sheets.postSolicitudClase({
      nombre, email, profesor, fecha, hora_1, hora_2, hora_3,
      mensaje, estado: "pendiente", timestamp: new Date().toISOString(),
    });

    showToast("✓ Solicitud enviada correctamente");
    e.target.reset();
    document.getElementById("slots-wrap").innerHTML = "";
  } catch (err) {
    console.error(err);
    showToast("Error al enviar. Inténtalo de nuevo.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar solicitud";
  }
});

// ── TAB 4: Reservar Sala ─────────────────────────────────────
async function loadSalas() {
  const sel = document.getElementById("sel-sala");
  if (sel.options.length > 1) return;
  try {
    const salas = await Sheets.getSalas();
    salas.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = s;
      sel.appendChild(opt);
    });
  } catch (e) { console.error(e); }
}

document.getElementById("form-reserva").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Reservando...";
  const datos = {
    nombre: document.getElementById("res-nombre").value.trim(),
    email: document.getElementById("res-email").value.trim(),
    sala: document.getElementById("sel-sala").value,
    fecha: document.getElementById("res-fecha").value,
    hora_inicio: document.getElementById("res-hora-inicio").value,
    hora_fin: document.getElementById("res-hora-fin").value,
    timestamp: new Date().toISOString(),
  };
  try {
    await Sheets.postReservaSala(datos);
    showToast("✓ Sala reservada correctamente");
    e.target.reset();
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
  document.querySelector(".tab-btn[data-tab='conciertos']").click();
});
  document.querySelector(".tab-btn[data-tab='conciertos']").click();
});
