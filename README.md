# 🎹 Festival de Piano — Guía de Configuración Completa

## Arquitectura (100% gratuita)

```
Google Sheets  ←──lectura──→  API v4 + API Key (pública)
               ←──escritura─  Apps Script Web App (POST)
index.html     ←──deploy───   GitHub + Vercel (gratis)
```

---

## PASO 1 — Preparar el Google Sheet

Crea un nuevo Google Spreadsheet y añade estas **6 pestañas** con exactamente estos nombres:

| Pestaña | Columnas mínimas |
|---|---|
| `Conciertos` | `titulo` · `fecha` · `dia` · `mes` · `hora` · `lugar` · `interprete` · `descripcion` · `entrada` |
| `Horarios` | `email` · `fecha` · `hora` · `sala` · `profesor` · `observaciones` |
| `Profesores` | `nombre` |
| `Salas` | `sala` |
| `Solicitudes` | *(se crea sola al primer envío)* |
| `Reservas` | *(se crea sola al primer envío)* |

> **Importante:** La primera fila de cada pestaña debe ser la cabecera (los nombres en minúscula).

### Hacer la hoja pública (solo lectura)
1. Botón **Compartir** → **Cambiar a cualquiera con el enlace** → Rol: **Lector**
2. Copia el **ID** de la URL: `https://docs.google.com/spreadsheets/d/**ESTE_ES_EL_ID**/edit`

---

## PASO 2 — Obtener API Key de Google (lectura)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo (o usa uno existente)
3. **APIs y servicios** → **Habilitar APIs** → busca **Google Sheets API** → Habilitar
4. **APIs y servicios** → **Credenciales** → **Crear credenciales** → **Clave de API**
5. (Recomendado) Restringe la clave: **Restricciones de API** → Google Sheets API

---

## PASO 3 — Desplegar el Apps Script (escritura)

1. En tu Google Sheet: menú **Extensiones** → **Apps Script**
2. Borra el contenido de `Code.gs` y **pega el contenido** del archivo `apps-script/Code.gs`
3. Guarda (Ctrl+S)
4. Clic en **Implementar** → **Nueva implementación**
5. Tipo: **Aplicación web**
   - Ejecutar como: **Yo (tu cuenta)**
   - Quién tiene acceso: **Cualquier persona** ⬅ imprescindible para que el formulario funcione
6. Clic en **Implementar** → copia la **URL de la aplicación web**

> La URL tiene esta forma: `https://script.google.com/macros/s/XXXXXX/exec`

---

## PASO 4 — Configurar `js/config.js`

Abre el archivo y rellena los tres valores:

```js
const CONFIG = {
  SHEET_ID: "PEGA_TU_SHEET_ID_AQUÍ",
  API_KEY:  "PEGA_TU_API_KEY_AQUÍ",
  APPS_SCRIPT_URL: "PEGA_TU_URL_APPS_SCRIPT_AQUÍ",
  // ...resto sin cambios
};
```

---

## PASO 5 — Subir a GitHub y desplegar en Vercel

### GitHub
```bash
git init
git add .
git commit -m "Festival Piano App"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/festival-piano.git
git push -u origin main
```

### Vercel (gratis, sin tarjeta)
1. Ve a [vercel.com](https://vercel.com) → Sign up con GitHub
2. **Add New Project** → importa tu repositorio
3. Framework: **Other** (es HTML estático)
4. Clic en **Deploy**
5. ✅ Tu web estará en `https://festival-piano.vercel.app`

---

## Estructura de archivos

```
festival-piano/
├── index.html          ← Toda la UI (4 pestañas)
├── css/
│   └── style.css       ← Diseño negro y dorado
├── js/
│   ├── config.js       ← ⚙️ TU CONFIGURACIÓN (edita esto)
│   ├── sheets.js       ← Capa de datos (Google Sheets API)
│   └── app.js          ← Lógica de tabs y formularios
└── apps-script/
    └── Code.gs         ← Pega esto en Apps Script
```

---

## Preguntas frecuentes

**¿Por qué no puedo usar `fetch` directamente para escribir en Sheets?**
La Sheets API v4 requiere OAuth para escritura. Apps Script es la forma gratuita de evitarlo: actúa como intermediario autenticado.

**¿Es seguro que la API Key esté en el código?**
Para lectura de una hoja pública, sí. Restringe la clave a Google Sheets API y a tu dominio de Vercel en Google Cloud Console.

**¿Cómo actualizo los datos?**
Edita directamente el Google Sheet. La web lo lee en tiempo real en cada carga.

**¿Qué pasa si un alumno introduce un correo equivocado?**
No verá resultados. Puedes añadir un campo "alias" o normalizar los correos en el sheet.
