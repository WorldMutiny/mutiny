# Mutiny — PRD

> *"Computers aren't the thing. They're the thing that gets us to the thing."*
> — Joe MacMillan, *Halt and Catch Fire*

**Estado:** v0.8 — fases 0 a 5a completas (en main) · 2026-09-27
**Base:** fork de [NEO](https://github.com/hughhowey/neo) v0.7.9 (Hugh Howey, MIT)
**Autor:** Maxx

---

## 1. Qué es

Mutiny es un procesador de textos local y sin distracciones para escribir **ensayos de opinión y divulgación**. Un asistente de IA configurable **investiga, critica y ayuda a pulir la redacción**, pero nunca cambia el texto sin tu permiso.

Toma el núcleo de NEO (página en blanco, archivos planos, sin cuentas ni nube) y le aplica el método de escritura estructurada de essay.app: outline → producir → reescribir → reordenar.

### Por qué un fork y no un PR

NEO es deliberadamente solo para novelas, y su autor rechaza funciones que lo agranden. Mutiny cambia el propósito (ensayos en vez de libros) y añade IA con herramientas, que es justo lo que NEO evita. Por eso es un fork divergente desde el día uno (ver §9).

## 2. Usuario y alcance

- **Usuario primario:** yo. Escribo ensayos de opinión y divulgación en español.
- **Usuario secundario (si el proyecto madura):** la comunidad. Por eso la IA es configurable desde el inicio y no está atada a mi setup.
- **Fuera de alcance:** escritura académica formal (APA/MLA, Zotero, notas al pie numeradas estilo Chicago), colaboración en tiempo real, sincronización en la nube, app móvil.

## 3. Principios

1. **La página es tuya.** La IA propone y tú decides. Ningún cambio de la IA entra al texto sin que lo aceptes explícitamente, y siempre se puede deshacer.
2. **Sin fuentes inventadas.** Cada afirmación de la IA sobre el mundo viene con URL y la cita textual que la respalda, o se marca como "sin fuente".
3. **Archivos planos.** Todo sigue siendo HTML/JSON legible en disco, sin bases de datos ni formatos propietarios.
4. **Lo de NEO que funciona se queda.** Página limpia, controles que se desvanecen, autoguardado y backups diarios.
5. **Sin inflar la app.** Si una función no sirve para escribir un ensayo, no entra.

## 4. De NEO a Mutiny

| NEO | Mutiny | Acción |
|---|---|---|
| Libro | **Ensayo** | Renombrar en la UI. El modelo de datos se conserva |
| Capítulo (Enter ×3) | **Sección** | Renombrar. Sin numeración automática ni capitulares |
| Estantería de libros | **Estantería de ensayos** | Se conserva (estantes por tema o estado) |
| Pestaña Outline + párrafos fantasma | **Outline estilo Peterson** | Se conserva. Plantilla inicial: tesis + 10–15 frases-esqueleto |
| Darlings | **Guardar para después** | Renombrar. Ya restaura el texto a su posición original |
| Placeholders `⌘⇧X` + notas adhesivas | **Marcas y comentarios** | Se amplía: autor humano o IA, tipos, fuentes (§6.2) |
| Pestaña Notes | **Notas / investigación** | Se conserva y se liga a las fuentes |
| Portadas (arte seed + OpenAI) | Portadas seed simples | Quitar la pintura con OpenAI; quedan las portadas seed como identidad visual |
| Export EPUB (KDP) | — | Quitar |
| Export DOCX / PDF / HTML / MD / TXT | Se conserva + **sección de Fuentes** | Añadir bibliografía al exportar |
| Estadísticas: palabras del día, meta diaria, meta por libro, sprints, gráfica de progreso, "mi día termina a las…" | **Se conserva completo** | Solo cambia "meta del libro" por "meta del ensayo" (placeholder 1 500 en vez de 80 000) |
| Onboarding (nombre, seudónimo, pantser/plotter, tipografía + capitulares) | **Onboarding para ensayistas** | Adaptar (§6.8) |
| UI solo en inglés | **UI en español e inglés** | i18n mínimo (§6.9) |
| Corrector `en-US` | **`es` + `en`** | Añadir `dictionary-es` y elegir idioma por ensayo |
| Autotipografía (comillas curvas, —, …) | Se conserva, **comillas inglesas “ ”** | Sin cambios de comillas. Solo verificar que ¿¡ no rompan el autoformato |

## 5. Arquitectura actual (referencia)

- Electron 43 con JS sin framework: `main.js` (disco, IPC, export, secretos), `preload.js` (puente `window.neo`), `app.js` (~4.6k líneas, toda la UI, editor `contentEditable` nativo).
- Biblioteca en `~/Documents/NEO Library/<book-id>/`:
  - `book.json`: metadatos y `chapterOrder`
  - `chapters/<id>.html`
  - `notes.html`, `outline.html`
  - `darlings.json`, `stickies.json` (`{id, chapterId, text, resolved}`, anclados a un `<span class="ph-mark" data-sid>` en el HTML)
- Secretos (API keys) cifrados con `safeStorage` de Electron, fuera de la carpeta de la biblioteca.

## 6. Funcionalidad nueva

### 6.1 Proveedores de IA (configurables desde el MVP)

Una capa `ai/` en el proceso principal con una interfaz común:

```
provider.run({ task, essay, selection?, instructions }, onEvent) → { text, sources[], comments[] }
```

| Proveedor | Fase | Cómo | Búsqueda web |
|---|---|---|---|
| **Claude Code** | MVP | `@anthropic-ai/claude-agent-sdk` desde `main.js`, con `cwd` = carpeta del ensayo. Usa el login local de Claude Code, sin API key | ✅ WebSearch/WebFetch nativos |
| **Compatible con OpenAI** (base URL + key + modelo) | 3b | Cubre OpenAI, OpenRouter, Cerebras, llama.cpp, Ollama, etc. | ⚠️ Solo si el modelo soporta tool-calling. Mutiny aporta una herramienta `fetch_url`; la búsqueda requiere configurar un backend de búsqueda o queda deshabilitada |
| Anthropic API directa | 3b | API key | ✅ con la herramienta web search del servidor |

**Seguridad del agente Claude Code:**
- Herramientas permitidas: solo `Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch`. **Sin `Bash`, `Write` ni `Edit`.**
- El agente nunca escribe en disco. Devuelve resultados estructurados (JSON) y Mutiny decide qué guardar.
- El directorio de trabajo es la carpeta del ensayo, con acceso de lectura a `estilo.md` en la raíz de la biblioteca.
- Cancelable en cualquier momento. Cada tarea muestra su progreso en streaming.

**Configuración:** Ajustes → IA: elegir proveedor, modelo, API key (cifrada) y "probar conexión". Si falta la IA, Mutiny funciona completo sin ella: la IA es opcional y no un requisito.

### 6.2 Marcas y comentarios (evolución de las notas adhesivas)

`stickies.json` se amplía, con compatibilidad hacia atrás:

```json
{
  "id": "s-…", "chapterId": "…", "resolved": false,
  "kind": "placeholder | critique | research | style",
  "author": "me | ai",
  "text": "…",
  "sources": ["src-…"],
  "created": "ISO-8601"
}
```

- Los comentarios de la IA se anclan igual que los placeholders (`ph-mark`) al párrafo o la frase a la que se refieren, con un color distinto.
- El panel derecho filtra por tipo y autor. Cada comentario se puede **resolver**, **descartar** o **convertir en nota** (enviarlo a `notes.html`).
- Los comentarios resueltos se conservan (con un filtro "mostrar resueltos") como historial del razonamiento.

### 6.3 Modo "Investigar y criticar"

Acciones disponibles desde el menú, el atajo o el clic derecho:

1. **Investigar esta marca.** Sobre un placeholder (`⌘⇧X`, p. ej. "[dato: % de población urbana en México 2020]"), la IA busca y devuelve un comentario `research` con la respuesta y **fuentes candidatas**.
2. **Criticar sección / ensayo.** Un "abogado del diablo" que genera comentarios `critique` anclados a párrafos, sobre:
   - la tesis poco clara o que no se sostiene;
   - saltos lógicos;
   - afirmaciones sin fuente;
   - el contraargumento más fuerte que no se aborda;
   - partes redundantes.
3. **Verificar fuentes** (antes de exportar): comprueba que cada cita del texto existe, que la URL responde y que la fuente dice lo que el texto afirma. Marca las dudosas.
4. **Chat del ensayo** (panel): conversación libre con contexto del outline, las notas y el texto. Cualquier respuesta se puede guardar como nota con un clic.

### 6.4 Modo "Mejorar redacción"

- Seleccionas texto (frase o párrafo) → **Mejorar** → la IA propone **2–3 variantes** con una línea de por qué ("más directa", "quita la voz pasiva", …).
- Vista comparativa con diff frente al original. **Aceptar** reemplaza el texto (con deshacer) y el original va a "Guardar para después", así que no se pierde nada.
- Opciones rápidas: *más claro · más corto · más contundente · menos formal*.
- **Rewrite manual** (sin IA, al estilo essay.app): escribir tus propias variantes de una frase en paralelo y elegir una. Comparte la UI con el modo con IA.

### 6.5 Fuentes y citas (versión ligera para divulgación)

- `sources.json` por ensayo:
  ```json
  { "id": "src-…", "url": "…", "title": "…", "site": "…", "author": "…",
    "published": "…", "accessed": "…", "quote": "…",
    "status": "candidate | accepted", "addedBy": "me | ai" }
  ```
- Las fuentes que propone la IA entran como `candidate`. **Solo las `accepted` pueden citarse.**
- Insertar cita: `⌘⇧K` → buscador de fuentes → inserta un enlace en línea (`<a class="cite" data-src="…">`).
- Al exportar: enlaces en línea (HTML/MD) o superíndices numerados, más una sección **"Fuentes"** al final (DOCX/PDF).
- Agregar fuentes a mano: pegar una URL y Mutiny obtiene título, sitio y fecha de sus metadatos (OpenGraph).

**Decisiones (2026-09-26):**
- **Cita en el texto:** con texto seleccionado, ese texto se vuelve la cita (estilo enlace); sin selección, se inserta una marca numerada [n].
- **La lista vive en una pestaña propia, "Fuentes".**
- **Metadatos:** al pegar una URL, Mutiny descarga la página sin preguntar (http/https, tiempo y tamaño limitados, sin ejecutar JavaScript).
- **DOI e ISBN:** un DOI se busca en Crossref y un ISBN en Open Library.
- **Exportación:** numeración por orden de primera aparición. PDF, DOCX y TXT llevan números volados y una lista "Fuentes" al final; Markdown y HTML llevan además el enlace en el texto.

**Decisiones de la fase 3a (2026-09-26):**
- **Modelo:** el predeterminado de tu Claude Code, con un ajuste para cambiarlo.
- **Chat del ensayo:** pasa a la fase 3b.
- **Crítica:** la IA devuelve solo sus 3 a 7 observaciones más importantes por pasada, ordenadas por gravedad.
- **Menos permisos que en el plan original:** las tareas llevan su texto en el prompt, así que no leen archivos. "Investigar" usa solo WebSearch y WebFetch; "Criticar" y "Mejorar" no usan ninguna herramienta. Todas corren en una carpeta vacía y aislada, sin cargar la configuración personal de Claude Code.
- **Licencia:** el Claude Agent SDK es de Anthropic y se rige por sus términos comerciales, no por MIT. Mutiny usa el `claude` que el usuario ya tiene instalado y no incluye su binario en el AppImage. Si se publica, el README debe decirlo.

**Decisiones y hallazgos de la fase 3b (2026-09-26):**
- **Proveedores con suscripción:** Claude Code (plan de Claude) y **Codex** (plan de ChatGPT), cada uno usando su propia CLI con la sesión del usuario.
- **Gemini con cuenta personal no es posible:** Google cerró el login de Gemini CLI para usuarios individuales y los manda a Antigravity, que es un editor y no sirve para usarse por debajo. Gemini queda disponible con una API key de AI Studio mediante el proveedor compatible con OpenAI.
- **"Investigar" con proveedores compatibles con OpenAI:** desactivado en el MVP (opción a), porque no tienen búsqueda web.
- **Chat:** cada mensaje se arma desde cero con el ensayo actual, el esquema, las notas, las fuentes y el historial. No se guardan sesiones fuera de la carpeta del ensayo: Claude Code corre con `persistSession: false` y Codex con `--ephemeral`.
- **Encierro de Codex:** se desactivan la shell y el resto de familias de herramientas. Se verificó que así no puede leer el disco.
- **Keys:** una key guardada en Mutiny tiene prioridad; si no hay, se usa la variable de entorno estándar del proveedor.

### 6.6 Reordenar (fase 4)

- Vista de **tarjetas**: cada párrafo de una sección se muestra como una tarjeta que se arrastra. Con zoom, también frases dentro de un párrafo.
- Pensado para responder "¿fluye el argumento?" sin editar el texto.

**Decisiones de la fase 4 (2026-09-26):**
- **Reordenar es un modo del Borrador:** un botón en la barra de abajo y `Ctrl+Shift+O`, no una pestaña propia.
- **Niveles:** párrafos (entre secciones incluso) y frases dentro de un párrafo, con doble clic; `Alt+↑/↓` para mover con el teclado.
- **Vista esqueleto:** muestra la primera frase de cada párrafo.
- **Barra izquierda:** sigue para navegar y mover secciones, y ahora, plegable por sección, muestra la primera frase de cada párrafo (clic → ir al párrafo).
- **Banco de versiones (`Ctrl+Shift+M`):** tu original, tus propias variantes y, si la IA está activa, las del asistente en la misma lista. Las versiones que no elijas van a "Para después", con una casilla para no guardarlas.

### 6.7 Mi estilo (fase 5a)

Automático, sin fine-tuning: la IA lee tus textos y escribe el perfil; tú solo lo revisas.

- **Estante "Mi voz"**: siempre existe y no se puede borrar. Recibe textos importados (.docx, .md, .txt) y **copias congeladas** de tus ensayos: se arrastra el ensayo al estante o se usa clic derecho → "Copiar a Mi voz". El ensayo original no se mueve, y copiarlo otra vez actualiza la misma copia. No cuenta en estadísticas ni en metas.
- **Medidor sin IA** en la cabecera del estante: textos, palabras y nivel de confianza, con un texto de qué esperar:
  - menos de 2,000 palabras: muy poco material;
  - menos de 5,000: confianza baja;
  - menos de 15,000: confianza media;
  - desde 15,000: confianza alta.
- **"Ver análisis"**: medidas exactas hechas por Mutiny, sin IA: frases, ritmo, párrafos, preguntas, persona, puntuación, conectores, giros repetidos y vocabulario. Avisa si hay un solo texto o si todos son del mismo tema.
- **"Generar mi estilo"**: se necesitan al menos 1,500 palabras, y por debajo de 5,000 avisa. La IA recibe los textos y las medidas, y escribe `estilo.md` en la raíz de la biblioteca, con 7 secciones:
  - voz y registro;
  - ritmo;
  - cómo argumenta;
  - palabras y giros, con cuántas veces aparecen para evitar la caricatura;
  - qué evita;
  - pasajes de ejemplo citados tal cual;
  - reglas para el asistente.
- Se revisa y edita antes de guardar. Con más de unas 22,000 palabras se toman fragmentos del inicio, medio y final de cada texto. Si editaste el archivo a mano, pregunta si conservar tus cambios o empezar de cero.
- **Versiones y el Chat lo usan solos.** El proceso principal lee `estilo.md`, así que el renderer no puede inyectar otro. Se desactiva con la casilla "Usar mi estilo".
- **Texto de la IA sin cambios**: al elegir una versión del asistente tal cual, Mutiny la registra. Al copiar el ensayo a Mi voz, si el 10% o más sigue intacto, avisa y ofrece copiar sin esos pasajes.
- Paso opcional en el onboarding: "Tu voz", con un botón para importar.
- Como `estilo.md` es un archivo plano, sirve también desde Claude Code en la terminal.

### 6.8 Onboarding para ensayistas

Se conserva el flujo de NEO: pocas preguntas, una sola vez, todo modificable después en Ajustes.

1. **Idioma** (nuevo, primer paso): Español / English. Define el idioma de la UI y el del corrector por defecto.
2. **Quién eres:** nombre (autor en cada exportación) y seudónimo o firma opcional.
3. **Cómo escribes** (equivalente a pantser/plotter):
   - **Descubro escribiendo:** los ensayos nuevos abren en página en blanco.
   - **Parto de un esquema:** los ensayos nuevos abren en Outline con la plantilla Peterson (tesis + frases-esqueleto).
4. **Cómo se ve la página:** tipografía con muestra WYSIWYG. Se quita la elección de capitulares.
5. **Asistente de IA** (nuevo, **opcional y saltable**):
   - Si detecta `claude` en el PATH, ofrece "Usar Claude Code" con un botón para probar la conexión.
   - Si no, muestra "Configurar después" o "Usar una API key" (a partir de la fase 3b).
   - Una línea clara sobre qué hace la IA y que nunca cambia tu texto sin permiso.

### 6.9 Idiomas (i18n)

- Una función `t('clave')` con diccionarios `locales/es.json` y `locales/en.json`. **Sin librerías.**
- Aplica a cadenas de la UI, menús nativos (`main.js`), toasts, onboarding y textos de exportación ("Fuentes" / "Sources").
- Las instrucciones a la IA también dependen del idioma: la IA responde en el idioma del ensayo.
- Contribuir un idioma nuevo = añadir un JSON.

## 7. Fases y criterios de aceptación

### Fase 0 — Fork habilitado ✅
- [x] `appId` propio, `productName: Mutiny`, biblioteca en `~/Documents/Mutiny Library`: **coexiste con NEO** sin tocar su biblioteca.
- [x] `electron-updater` desactivado o apuntando al repo propio. **Crítico: si no, se "actualizaría" a NEO.**
- [x] README con créditos a NEO / Hugh Howey. Se conserva el LICENSE MIT (copyright original + nuevo).
- [x] `npm start` funciona en Linux. `npm run package:linux` genera un AppImage que se instala como NEO (`~/.local/opt/mutiny` + `.desktop` en el launcher de Omarchy).

### Fase 1 — De novela a ensayo ✅
- [x] i18n (§6.9): extraer las cadenas existentes a `en.json` y traducir `es.json`.
- [x] Renombrados de §4 en la UI; sin capitulares ni numeración de secciones.
- [x] Onboarding para ensayistas (§6.8, pasos 1–4; el paso 5 llega en la fase 3a).
- [x] Outline con plantilla Peterson (tesis + frases-esqueleto → párrafos fantasma).
- [x] Corrector `es` + `en`.
- [x] Estadísticas y metas conservadas, con textos de ensayo.
- [x] Quitar la pintura de portadas con OpenAI y el EPUB.
- **Aceptación:** escribir un ensayo de 1 500 palabras de principio a fin y exportarlo a PDF/DOCX sin que aparezcan términos de novela.

### Fase 2 — Fuentes ✅
- [x] `sources.json`, panel de fuentes, pegar URL → metadatos, insertar cita, sección "Fuentes" al exportar.
- [x] DOI (Crossref) e ISBN (Open Library → Google Books); fuentes candidatas con "Aceptar" (listas para la fase 3).
- **Aceptación:** un ensayo con 5 citas se exporta con la bibliografía correcta en DOCX, PDF y MD.

### Fase 3a — IA con Claude Code (MVP de IA) ✅
- [x] Capa `ai/` con la interfaz de proveedores y el proveedor Claude Code (Agent SDK, herramientas restringidas).
- [x] Comentarios v2 (§6.2), Investigar marca, Criticar sección, Mejorar redacción. *(El chat del ensayo pasa a la fase 3b.)*
- **Aceptación:**
  - "Investigar" sobre una marca devuelve al menos una fuente candidata con URL real y cita textual.
  - La IA nunca modifica un archivo por sí misma.
  - Cancelar una tarea la detiene en menos de 1 s.

### Fase 3b — IA por API key + chat del ensayo ✅
- [x] Proveedor compatible con OpenAI (presets: OpenAI, Gemini, OpenRouter, Cerebras, Ollama, llama.cpp) y API de Anthropic; key cifrada o variable de entorno; "probar conexión".
- [x] **Codex con tu login de ChatGPT** (sin shell, solo lectura, efímero), además de Claude Code.
- [x] Chat del ensayo en el panel derecho ("En el texto | Chat", Ctrl+Shift+A).
- [x] Degradación clara: sin búsqueda web, "Investigar" se desactiva con una explicación.
- **Aceptación:** funciona con un endpoint local (llama.cpp/Ollama) y uno en la nube.

### Fase 4 — Reordenar + Rewrite manual ✅
- [x] Modo **Reordenar** dentro del Borrador (botón "⇅ Reordenar" o Ctrl+Shift+O): tarjetas por párrafo, arrastrar o Alt+↑/↓, también entre secciones; doble clic abre las frases del párrafo para reordenarlas.
- [x] Vista **Esqueleto**: solo la primera frase de cada párrafo; clic para ir ahí.
- [x] Panel izquierdo: cada sección se despliega (▸) con las primeras frases de sus párrafos.
- [x] **Versiones** (Ctrl+Shift+M): escribes alternativas junto al original, el asistente puede sumar las suyas, eliges una; el original y las no usadas van a Para después (casilla para desactivarlo).
- [x] Corte de frases que respeta abreviaturas ("Dr.", "EE. UU.", "3.5"), citas y marcas.
- **Aceptación:** reordenar y deshacer conservan citas, marcas ⚑ y formato.
### Fase 5a — Mi voz ✅
- [x] Estante "Mi voz" (importar y copias congeladas de ensayos) con medidor de confianza.
- [x] Análisis sin IA (frases, ritmo, persona, puntuación, conectores, giros).
- [x] "Generar mi estilo": la IA escribe `estilo.md`, revisable y editable, que Versiones y el Chat siguen.
- [x] Aviso y exclusión del texto de la IA sin cambios al copiar un ensayo.
- [x] Paso "Tu voz" en el onboarding.
- **Aceptación:** con 4 textos (unas 1,500 palabras) genera un perfil en segundos, y las versiones del asistente adoptan la voz sin caricaturizarla.

### Fase 5b — Verificar fuentes
### Fase 6 — Multiplataforma y publicación
- [ ] Builds de Mac (dmg) y Windows (exe) con GitHub Actions. NEO ya tiene la configuración de electron-builder para las tres plataformas.
- [ ] Notarización de Mac: requiere una cuenta de Apple Developer (99 USD/año). Sin ella, el usuario tiene que autorizar la app a mano en macOS.
- [ ] Auto-updater apuntando a los releases del repo propio.

### Notas de implementación — fase 1 (2026-09-25)

Decisiones tomadas en el camino que no estaban en el plan:

- **Vocabulario:** ensayo · sección · Borrador (pestaña del texto) · Esquema · Notas · **Para después** (antes "Darlings"). Enter ×2 = separador `***`, Enter ×3 = sección nueva.
- **Página continua:** el título encabeza la página y las secciones fluyen debajo con su título (o un `§` discreto). Nada de hojas separadas.
- **Tipografías incluidas:** Literata (por defecto), Source Serif 4, Lora y EB Garamond (OFL). Las de NEO eran de Mac y en Linux caían a otra fuente.
- **Plantilla Peterson:** 5 secciones y 9 frases guía como *placeholder*. El fantasma solo aparece en el borrador cuando escribes tu propia frase en el esquema.
- **Idiomas:** la interfaz se elige en el onboarding o en Metas y ajustes. Cada ensayo tiene su propio idioma (corrector y exportaciones). Los valores guardados en inglés por NEO ("Untitled", "Anonymous"…) se muestran traducidos.
- **Import de Markdown:** `#` es el título del ensayo y `##` crea secciones con nombre.
- **Bugs heredados de NEO corregidos:** temporizadores de guardado que se disparaban tras cerrar un libro (error visible y posible escritura en el libro equivocado), y HTML exportado sin escapar el título.

### Fase final — Pulido de la experiencia de usuario
- [ ] Revisión completa de la UX una vez que todas las funciones estén en su lugar (pedido 2026-09-26).
- [ ] **Progreso visible de la IA en todas sus tareas** (pedido 2026-09-27): sugerencias/Versiones, crítica, investigación y chat. Hoy solo aparece el chip de la barra inferior del editor. Usar el modelo de "Escribiendo tu estilo" (`styleProgress` en `voice.js`): una ventana con qué hace, sobre cuánto texto, los segundos y un botón Detener, y **conservar también el chip** de abajo. El usuario quiere las dos cosas.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| `app.js` monolítico (4.6k líneas) sobre `contentEditable`: se rompe fácil | Las funciones nuevas van en módulos aparte (`ai/`, `sources.js`, `comments.js`). Tocar el editor lo mínimo. Probar a mano el flujo de escritura en cada fase |
| La IA inventa fuentes | Fuentes `candidate` hasta que las aceptes, cita textual obligatoria y verificación antes de exportar |
| Coste o cuota de uso del agente | Tareas explícitas (nunca en segundo plano sin pedirlo), mostrar el uso por tarea y posibilidad de cancelar |
| Divergencia con NEO | Asumida (§9) |
| Nombre "Mutiny" muy usado fuera de la serie | Verificar la disponibilidad del repo y el nombre antes de publicar. Si hay conflicto, usar un sufijo (p. ej. `mutiny-write`) |
| Proveedores de API sin tool-calling | Detectarlo en "probar conexión" y desactivar las funciones que lo requieren |

## 9. Relación con NEO (upstream) y GitHub

- Local: remote `upstream` = `hughhowey/neo`. Sin merges automáticos: se revisan sus releases y se hace **cherry-pick manual** de arreglos del editor, import y export que apliquen.
- Créditos visibles en README y en "Acerca de". El LICENSE MIT conserva el copyright de Hugh Howey y añade el nuestro.
- **En GitHub: repo independiente, no "fork" de GitHub** (pendiente de confirmar):
  - Un *fork* de GitHub muestra la etiqueta "forked from hughhowey/neo" y está pensado para mandar cambios de vuelta al original.
  - Mutiny es otro producto, y los forks tienen limitaciones: no pueden ser privados, aparecen menos en búsquedas y tienen issues desactivados por defecto.
  - Un repo propio `mutiny` conserva todo el historial de NEO (el crédito queda en cada commit) y se puede mantener **privado** hasta que esté listo.
  - Si algún día un arreglo sirve a NEO, se le puede mandar un PR desde un fork aparte.

## 10. Decisiones tomadas (2026-09-25)

1. **UI:** español e inglés desde la fase 1.
2. **Plataformas:** MVP en Linux; Mac y Windows en la fase 6.
3. **Comillas:** inglesas “ ”.
4. **Onboarding:** se conserva, adaptado a ensayos.
5. **Estadísticas y metas:** se conservan completas.

## 11. Preguntas abiertas

1. Confirmar repo independiente frente a fork de GitHub (§9), el nombre del repo (`mutiny` o `mutiny-write`) y si empieza privado.
