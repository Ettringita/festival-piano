// ============================================================
//  FESTIVAL DE PIANO — App Logic (alumnos)
// ============================================================

// ── Identidad del alumno (persiste en localStorage) ──────────
const Identity = {
  KEY: "festival_piano_identity",
  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || "null"); }
    catch { return null; }
  },
  save(nombre, email) {
    localStorage.setItem(this.KEY, JSON.stringify({ nombre, email }));
  },
  clear() { localStorage.removeItem(this.KEY); },
};

function initIdentity() {
  const identity = Identity.get();
  if (identity) {
    showIdentitySaved(identity);
    prefillForms(identity);
  }

  document.getElementById("id-save-btn").addEventListener("click", () => {
    const nombre = document.getElementById("id-nombre").value.trim();
    const email  = document.getElementById("id-email").value.trim();
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
    document.getElementById("id-nombre").value = "";
    document.getElementById("id-email").value  = "";
    setFormsReadonly(false);
  });
}

function showIdentitySaved({ nombre, email }) {
  document.getElementById("identity-form-wrap").style.display = "none";
  document.getElementById("identity-saved-wrap").style.display = "flex";
  document.getElementById("id-display-nombre").textContent = nombre;
  document.getElementById("id-display-email").textContent  = email;
}

function prefillForms({ nombre, email }) {
  [
    ["sol-nombre", nombre], ["sol-email", email],
    ["pian-nombre", nombre], ["pian-email", email],
  ].forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  const emailInput = document.getElementById("email-input");
  if (emailInput) emailInput.value = email;
  setFormsReadonly(true);
}

function setFormsReadonly(readonly) {
  ["sol-nombre", "sol-email", "pian-nombre", "pian-email"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.readOnly = readonly;
  });
}

// ── Helpers UI ───────────────────────────────────────────────
function setLoading(id, msg = "Cargando...") {
  document.getElementById(id).innerHTML =
    `<div class="loading-state"><span class="loader"></span><p>${msg}</p></div>`;
}

function setError(id, msg) {
  document.getElementById(id).innerHTML =
    `<div class="error-state"><span class="icon-error">!</span><p>${msg}</p></div>`;
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
  }, 3800);
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
    weekday: "long", day: "numeric", month: "long",
  });
}

function formatTime(str) {
  return str ? String(str).slice(0, 5) : "—";
}

function monthFromDate(str) {
  if (!str) return "";
  const months = ["ENE","FEB","MAR","ABR","MAY","JUN",
                  "JUL","AGO","SEP","OCT","NOV","DIC"];
  const parts = str.includes("/") ? str.split("/") : str.split("-");
  const m = parseInt(str.includes("/") ? parts[1] : parts[1]) - 1;
  return months[m] || "";
}

// ── Tab navigation ───────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach(b  => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(target).classList.add("active");

    if (target === "conciertos") loadConciertos();
    if (target === "horario")    initHorario();
    if (target === "solicitar")  initSolicitud();
    if (target === "reservar")   initPianoCola();
  });
});

// ════════════════════════════════════════════════════════════
//  TAB 1 — Conciertos
// ════════════════════════════════════════════════════════════
async function loadConciertos() {
  setLoading("conciertos-list", "Cargando programa...");
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
          <h3 class="concert-card__title">${c.titulo || "Concierto"}</h3>
          <p class="concert-card__meta">
            ${c.hora       ? `<span>🕐 ${formatTime(c.hora)}</span>` : ""}
            ${c.lugar      ? `<span>📍 ${c.lugar}</span>` : ""}
            ${c.interprete ? `<span>🎹 ${c.interprete}</span>` : ""}
          </p>
          ${c.descripcion ? `<p class="concert-card__desc">${c.descripcion}</p>` : ""}
        </div>
        ${c.entrada ? `<div class="concert-card__badge">${c.entrada}</div>` : ""}
      </article>`).join("");
  } catch (e) {
    console.error(e);
    setError("conciertos-list", "No se pudo cargar el calendario.");
  }
}

// ════════════════════════════════════════════════════════════
//  TAB 2 — Mi Horario
// ════════════════════════════════════════════════════════════
function initHorario() {
  const identity = Identity.get();
  if (identity?.email) {
    document.getElementById("email-input").value = identity.email;
    buscarHorario(identity.email);
  }
}

async function buscarHorario(email) {
  setLoading("horario-result", "Buscando tu horario...");
  try {
    const clases = await Sheets.getHorarioAlumno(email);
    if (!clases.length) {
      document.getElementById("horario-result").innerHTML =
        `<p class="empty-state">No hay clases confirmadas para <strong>${email}</strong> aún.</p>`;
      return;
    }
    document.getElementById("horario-result").innerHTML = `
      <p class="horario-found">
        <strong>${clases.length}</strong> clase${clases.length > 1 ? "s" : ""} confirmada${clases.length > 1 ? "s" : ""}
      </p>
      <div class="schedule-table-wrap">
        <table class="schedule-table">
          <thead><tr><th>Fecha</th><th>Hora</th><th>Profesor</th></tr></thead>
          <tbody>
            ${clases.map(c => `
              <tr>
                <td>${formatDate(c.fecha_asignada || c.fecha_preferida)}</td>
                <td>${formatTime(c.hora_asignada  || c.hora_preferida)}</td>
                <td>${c.profesor || "—"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    console.error(e);
    setError("horario-result", "Error al consultar. Inténtalo de nuevo.");
  }
}

document.getElementById("horario-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = document.getElementById("email-input").value.trim();
  if (email) buscarHorario(email);
});

// ════════════════════════════════════════════════════════════
//  TAB 3 — Solicitar Clase
// ════════════════════════════════════════════════════════════

// Estado interno de la solicitud en curso
const solicitudState = {
  tipo:            null,
  fecha_preferida: "",
  hora_preferida:  "",
  reset() {
    this.tipo = null;
    this.fecha_preferida = "";
    this.hora_preferida  = "";
  },
};

async function initSolicitud() {
  const sel = document.getElementById("sel-profesor");
  if (sel.options.length > 1) return; // ya cargado

  try {
    const profesores = await Sheets.getProfesores();
    profesores.forEach(p => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = p;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("Error cargando profesores", e);
  }
}

// Al elegir profesor
document.getElementById("sel-profesor").addEventListener("change", async () => {
  const profesor = document.getElementById("sel-profesor").value;
  solicitudState.reset();
  document.getElementById("disponibilidad-wrap").innerHTML = "";
  document.getElementById("tipo-wrap").innerHTML = "";

  if (!profesor) return;

  document.getElementById("disponibilidad-wrap").innerHTML =
    `<div class="loading-state" style="padding:0.75rem 0"><span class="loader"></span></div>`;

  try {
    const email = Identity.get()?.email;

    // Comprobar si el profesor está bloqueado para este alumno (exclusivo + ya tiene solicitud)
    if (email) {
      const bloqueado = await Sheets.isProfesorBloqueadoParaAlumno(email, profesor);
      if (bloqueado) {
        document.getElementById("disponibilidad-wrap").innerHTML = `
          <p class="form-note" style="color:var(--error)">
            Este profesor solo puede darte una clase en el festival y ya tienes una solicitud con él.
          </p>`;
        return;
      }
    }

    const disponibilidad = await Sheets.getDisponibilidadProfesor(profesor);
    renderDisponibilidad(disponibilidad);

  } catch (e) {
    console.error(e);
    document.getElementById("disponibilidad-wrap").innerHTML =
      `<p class="form-note" style="color:var(--error)">Error al cargar disponibilidad.</p>`;
  }
});

function renderDisponibilidad(disponibilidad) {
  const wrap = document.getElementById("disponibilidad-wrap");

  if (!disponibilidad.length) {
    wrap.innerHTML = `<p class="form-note">Este profesor no tiene horas disponibles.</p>`;
    return;
  }

  // Opción GENERAL siempre disponible
  wrap.innerHTML = `
    <div class="disponibilidad-header">
      <p class="slots-label">Disponibilidad del profesor — elige cómo quieres solicitar:</p>
      <button type="button" class="btn btn--ghost btn--adapto" id="btn-general">
        Me adapto al profesor (cualquier fecha y hora)
      </button>
    </div>
    <p class="slots-label" style="margin-top:1.25rem">O elige una fecha concreta:</p>
    <div class="fechas-grid">
      ${disponibilidad.map(d => `
        <button type="button" class="fecha-btn" data-fecha="${d.fecha}"
          data-slots='${JSON.stringify(d.slotsLibres)}'>
          <span class="fecha-btn__date">${formatDate(d.fecha)}</span>
          <span class="fecha-btn__slots">${d.slotsLibres.length} hueco${d.slotsLibres.length > 1 ? "s" : ""}</span>
        </button>`).join("")}
    </div>`;

  // GENERAL
  document.getElementById("btn-general").addEventListener("click", () => {
    solicitudState.tipo = "GENERAL";
    solicitudState.fecha_preferida = "";
    solicitudState.hora_preferida  = "";
    markBtnActive(document.getElementById("btn-general"), ".btn--adapto");
    document.querySelectorAll(".fecha-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("tipo-wrap").innerHTML = "";
    showTipoConfirmado("GENERAL", "", "");
  });

  // Al elegir fecha
  wrap.querySelectorAll(".fecha-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".fecha-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("btn-general")?.classList.remove("active");
      const fecha = btn.dataset.fecha;
      const slots = JSON.parse(btn.dataset.slots);
      solicitudState.fecha_preferida = fecha;
      solicitudState.hora_preferida  = "";
      solicitudState.tipo = "FECHA"; // default al elegir fecha sin hora
      renderSlotsDeFecha(fecha, slots);
    });
  });
}

function renderSlotsDeFecha(fecha, slots) {
  const tipoWrap = document.getElementById("tipo-wrap");

  if (!slots.length) {
    tipoWrap.innerHTML = `<p class="form-note">No hay horas disponibles en esta fecha.</p>`;
    return;
  }

  tipoWrap.innerHTML = `
    <div class="slots-bloque">
      <button type="button" class="btn btn--ghost btn--adapto" id="btn-fecha">
        Me adapto en ${formatDate(fecha)} (cualquier hora)
      </button>
      <p class="slots-label" style="margin-top:1rem">O elige una hora concreta:</p>
      <div class="slots-grid">
        ${slots.map(h => `
          <button type="button" class="slot-hora-btn" data-hora="${h}">${h}</button>`
        ).join("")}
      </div>
    </div>`;

  // FECHA
  document.getElementById("btn-fecha").addEventListener("click", () => {
    solicitudState.tipo = "FECHA";
    solicitudState.hora_preferida = "";
    markBtnActive(document.getElementById("btn-fecha"), ".btn--adapto");
    document.querySelectorAll(".slot-hora-btn").forEach(b => b.classList.remove("active"));
    showTipoConfirmado("FECHA", fecha, "");
  });

  // Al elegir hora concreta
  tipoWrap.querySelectorAll(".slot-hora-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".slot-hora-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("btn-fecha")?.classList.remove("active");
      solicitudState.hora_preferida = btn.dataset.hora;
      renderSelectorTipoHora(fecha, btn.dataset.hora);
    });
  });
}

function renderSelectorTipoHora(fecha, hora) {
  // Añadir selector flexible/exacta debajo de los slots
  const existente = document.getElementById("selector-tipo-hora");
  if (existente) existente.remove();

  const div = document.createElement("div");
  div.id = "selector-tipo-hora";
  div.className = "slots-bloque";
  div.innerHTML = `
    <p class="slots-label" style="margin-top:1rem">¿Cómo quieres esta hora?</p>
    <div class="tipo-hora-opciones">
      <label class="tipo-hora-opcion">
        <input type="radio" name="tipo-hora" value="DIA_HORA_FLEXIBLE" />
        <span>
          <strong>Prefiero las ${hora}</strong>
          <em>pero me adapto si el profesor necesita cambiarla</em>
        </span>
      </label>
      <label class="tipo-hora-opcion">
        <input type="radio" name="tipo-hora" value="HORA_EXACTA" />
        <span>
          <strong>Quiero exactamente las ${hora}</strong>
          <em>si no está disponible, prefiero que me rechacen</em>
        </span>
      </label>
    </div>`;

  document.getElementById("tipo-wrap").appendChild(div);

  div.querySelectorAll('input[name="tipo-hora"]').forEach(radio => {
    radio.addEventListener("change", () => {
      solicitudState.tipo = radio.value;
      showTipoConfirmado(radio.value, fecha, hora);
    });
  });
}

function showTipoConfirmado(tipo, fecha, hora) {
  const msgs = {
    GENERAL:          "📋 Solicitud abierta — el profesor elegirá fecha y hora",
    FECHA:            `📅 Prefieres el ${formatDate(fecha)} — el profesor elegirá la hora`,
    DIA_HORA_FLEXIBLE:`🕐 Prefieres el ${formatDate(fecha)} a las ${hora} (flexible)`,
    HORA_EXACTA:      `⏰ Solicitas el ${formatDate(fecha)} a las ${hora} exactamente`,
  };
  const existente = document.getElementById("tipo-confirmado");
  if (existente) existente.remove();

  const p = document.createElement("p");
  p.id = "tipo-confirmado";
  p.className = "tipo-confirmado";
  p.textContent = msgs[tipo] || "";
  document.getElementById("tipo-wrap").appendChild(p);
}

function markBtnActive(btn, selector) {
  document.querySelectorAll(selector).forEach(b => b.classList.remove("active"));
  btn?.classList.add("active");
}

// Envío del formulario de solicitud
document.getElementById("form-solicitud").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");

  const nombre   = document.getElementById("sol-nombre").value.trim();
  const email    = document.getElementById("sol-email").value.trim();
  const profesor = document.getElementById("sel-profesor").value;
  const mensaje  = document.getElementById("sol-mensaje").value.trim();

  if (!nombre || !email) {
    showToast("Introduce tu nombre y correo.", "error"); return;
  }
  if (!profesor) {
    showToast("Selecciona un profesor.", "error"); return;
  }
  if (!solicitudState.tipo) {
    showToast("Elige cómo quieres hacer la solicitud.", "error"); return;
  }

  btn.disabled = true;
  btn.textContent = "Enviando...";

  try {
    await API.solicitudClase({
      nombre, email, profesor,
      tipo:            solicitudState.tipo,
      fecha_preferida: solicitudState.fecha_preferida,
      hora_preferida:  solicitudState.hora_preferida,
      mensaje,
    });

    showToast("✓ Solicitud enviada correctamente");
    resetFormSolicitud();

  } catch (err) {
    console.error(err);
    showToast(err.message || "Error al enviar. Inténtalo de nuevo.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar solicitud";
  }
});

function resetFormSolicitud() {
  document.getElementById("form-solicitud").reset();
  document.getElementById("disponibilidad-wrap").innerHTML = "";
  document.getElementById("tipo-wrap").innerHTML = "";
  solicitudState.reset();
  const identity = Identity.get();
  if (identity) prefillForms(identity);
}

// ════════════════════════════════════════════════════════════
//  TAB 4 — Piano de Cola
// ════════════════════════════════════════════════════════════
async function initPianoCola() {
  const sel = document.getElementById("sel-sala");
  if (sel.options.length > 1) return;
  try {
    const salas = await Sheets.getSalas();
    salas.forEach(s => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = s;
      sel.appendChild(opt);
    });
  } catch (e) { console.error(e); }
}

document.getElementById("pian-fecha").addEventListener("change", async () => {
  const fechaISO = document.getElementById("pian-fecha").value;
  if (!fechaISO) return;

  const slotsWrap = document.getElementById("piano-slots-wrap");
  slotsWrap.innerHTML =
    `<div class="loading-state" style="padding:0.75rem 0"><span class="loader"></span></div>`;

  try {
    const slots = await Sheets.getSlotsLibresParaPiano(fechaISO);
    if (!slots.length) {
      slotsWrap.innerHTML =
        `<p class="form-note">No hay horas libres ese día — los profesores ocupan toda la jornada.</p>`;
      return;
    }
    slotsWrap.innerHTML = `
      <p class="slots-label">Horas disponibles — elige una:</p>
      <div class="slots-grid">
        ${slots.map(h => `
          <label class="slot-option">
            <input type="radio" name="piano-slot" value="${h}" />
            <span>${h}</span>
          </label>`).join("")}
      </div>`;
  } catch (e) {
    slotsWrap.innerHTML =
      `<p class="form-note" style="color:var(--error)">Error al cargar disponibilidad.</p>`;
  }
});

document.getElementById("form-reserva").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");

  const nombre   = document.getElementById("pian-nombre").value.trim();
  const email    = document.getElementById("pian-email").value.trim();
  const piano    = document.getElementById("sel-sala").value;
  const fechaISO = document.getElementById("pian-fecha").value;
  const horaEl   = document.querySelector('input[name="piano-slot"]:checked');

  if (!nombre || !email) { showToast("Faltan tu nombre o correo.", "error"); return; }
  if (!piano)            { showToast("Selecciona un piano.", "error"); return; }
  if (!fechaISO)         { showToast("Selecciona una fecha.", "error"); return; }
  if (!horaEl)           { showToast("Selecciona una hora.", "error"); return; }

  const [y, m, d] = fechaISO.split("-");
  const fecha = `${d}/${m}/${y}`;

  btn.disabled = true;
  btn.textContent = "Reservando...";

  try {
    await API.reservaPiano({ nombre, email, piano, fecha, hora: horaEl.value });
    showToast("✓ Piano reservado correctamente");
    e.target.reset();
    document.getElementById("piano-slots-wrap").innerHTML = "";
    const identity = Identity.get();
    if (identity) prefillForms(identity);
  } catch (err) {
    showToast(err.message || "Error al reservar.", "error");
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
