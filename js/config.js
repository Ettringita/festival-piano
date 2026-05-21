// ============================================================
//  FESTIVAL DE PIANO — Configuración
//  Rellena estos valores siguiendo el README.md
// ============================================================

const CONFIG = {
  // 1. ID de tu Google Sheet (está en la URL del spreadsheet)
  //    https://docs.google.com/spreadsheets/d/AQUÍ_VA_EL_ID/edit
  SHEET_ID: "1trHHCmlRkLBMZDMWP-ix5A4xXk_zF9fQtxjK1KQ56Zg",

  // 2. API Key de Google Cloud Console (solo lectura)
  API_KEY: "AIzaSyCDGzvv-gQOtKWAM0ZmXqQnG-R3P78M1l4",

  // 3. URL de tu Google Apps Script desplegado (para escritura)
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxynqetEsc3-ZDztgM8T38dFOOiqlxuqEOxkEsydDDS3hK-lCbrEn5m5lPray2u4TbA/exec",

  // 4. Nombre exacto de las pestañas en tu Google Sheet
  TABS: {
    conciertos: "Conciertos",
    horarios: "Horarios",
    profesores: "Profesores",
    salas: "Salas",
    solicitudes: "Solicitudes",
    reservas: "Reservas",
  },

  // 5. Nombre del festival (aparece en la web)
  NOMBRE_FESTIVAL: "Festival Internacional de Piano",
  EDICION: "2025",
};
