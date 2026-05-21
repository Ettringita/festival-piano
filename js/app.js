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
    if (target === "solicitar") loadProfesores();
    if (target === "reservar") loadSalas();
  });
});

// ── Helpers ──────────────────────────────────────────────────
function setLoading(containerId, msg = "Cargando...") {
  document.getElementById(containerId).innerHTML = `
    <div class="loading-state">
      <span class="loader"></span>
      <p>${msg}</p>
    </div>`;
}

function setError(containerId, msg) {
  document.getElementById(containerId).innerHTML = `
    <div class="error-state">
      <span class="icon-error">!</span>
      <p>${msg}</p>
    </div>`;
}

function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(str) {
  if (!str) return "—";
  return str.length === 5 ? str : str.slice(0, 5);
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
    setError("conciertos-list", "No se pudo cargar el calendario. Verifica la configuración de Google Sheets.");
  }
}

function monthFromDate(str) {
  if (!str) return "";
  const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  const parts = str.includes("/") ? str.split("/") : str.split("-");
  const m = parseInt(parts[1] || parts[0]) - 1;
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
        `<p class="empty-state">No se encontraron clases para <strong>${email}</strong>.<br>Verifica que el correo coincida con el registro.</p>`;
      return;
    }
    document.getElementById("horario-result").innerHTML = `
      <p class="horario-found">Se encontraron <strong>${clases.length}</strong> clase${clases.length > 1 ? "s" : ""}</p>
      <div class="schedule-table-wrap">
        <table class="schedule-table">
          <thead>
            <tr>
              <th>Fecha</th><th>Hora</th><th>Sala / Aula</th><th>Profesor</th><th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            ${clases.map((c) => `
              <tr>
                <td>${formatDate(c.fecha)}</td>
                <td>${formatTime(c.hora)}</td>
                <td>${c.sala || c.aula || "—"}</td>
                <td>${c.profesor || "—"}</td>
                <td>${c.observaciones || c.notas || "—"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    console.error(e);
    setError("horario-result", "Error al consultar el horario. Inténtalo de nuevo.");
  }
});

// ── TAB 3: Solicitar Clase ───────────────────────────────────
async function loadProfesores() {
  const sel = document.getElementById("sel-profesor");
  if (sel.options.length > 1) return; // ya cargado
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

document.getElementById("form-solicitud").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Enviando...";
  const datos = {
    nombre: document.getElementById("sol-nombre").value.trim(),
    email: document.getElementById("sol-email").value.trim(),
    profesor: document.getElementById("sel-profesor").value,
    fecha: document.getElementById("sol-fecha").value,
    hora: document.getElementById("sol-hora").value,
    mensaje: document.getElementById("sol-mensaje").value.trim(),
    timestamp: new Date().toISOString(),
  };
  try {
    await Sheets.postSolicitudClase(datos);
    showToast("✓ Solicitud enviada correctamente");
    e.target.reset();
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
      if (!s) return;
      const opt = document.createElement("option");
      opt.value = opt.textContent = s;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("No se pudieron cargar las salas", e);
  }
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
