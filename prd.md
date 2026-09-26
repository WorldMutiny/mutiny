# Mutiny — PRD

> *"Computers aren't the thing. They're the thing that gets us to the thing."*
> — Joe MacMillan, *Halt and Catch Fire*

**Estado:** borrador v0.1 · 2026-09-25
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
| Metas diarias estilo NaNoWriMo | Meta de palabras por ensayo | Simplificar |
| Corrector `en-US` | **`es` + `en`** | Añadir `dictionary-es` y elegir idioma por ensayo |
| Autotipografía (comillas curvas, —, …) | + reglas de español | Comillas «» o “” configurables, ¿¡ sin romper el autoformato |

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

### 6.6 Reordenar (fase 4)

- Vista de **tarjetas**: cada párrafo de una sección se muestra como una tarjeta que se arrastra. Con zoom, también frases dentro de un párrafo.
- Pensado para responder "¿fluye el argumento?" sin editar el texto.

### 6.7 Mi estilo (fase 5)

La versión sin complicaciones, sin fine-tuning:

- `estilo.md` en la raíz de la biblioteca: reglas de voz en prosa ("frases cortas", "nada de 'cabe destacar'", "tuteo", …). Editable desde Ajustes.
- **Ensayos de referencia:** marcar 2–5 ensayos propios como "representativos de mi voz". Se envían como ejemplos (fragmentos) a "Mejorar redacción".
- **Extraer mi estilo:** la IA lee tus ensayos marcados y propone un borrador de `estilo.md`, que tú editas.
- Como es un archivo plano, el mismo `estilo.md` sirve desde Claude Code en la terminal.

## 7. Fases y criterios de aceptación

### Fase 0 — Fork habilitado
- [ ] `appId` propio, `productName: Mutiny`, biblioteca en `~/Documents/Mutiny Library`: **coexiste con NEO** sin tocar su biblioteca.
- [ ] `electron-updater` desactivado o apuntando al repo propio. **Crítico: si no, se "actualizaría" a NEO.**
- [ ] README con créditos a NEO / Hugh Howey. Se conserva el LICENSE MIT (copyright original + nuevo).
- [ ] `npm start` funciona en Linux y el `.desktop` aparece en el launcher de Omarchy.

### Fase 1 — De novela a ensayo
- [ ] Renombrados de §4 en la UI; sin capitulares ni numeración de secciones.
- [ ] Outline con plantilla Peterson (tesis + frases-esqueleto → párrafos fantasma).
- [ ] Corrector en español y autotipografía española.
- [ ] Quitar la pintura de portadas con OpenAI, el EPUB y el tracker NaNoWriMo.
- **Aceptación:** escribir un ensayo de 1 500 palabras de principio a fin y exportarlo a PDF/DOCX sin que aparezcan términos de novela.

### Fase 2 — Fuentes
- [ ] `sources.json`, panel de fuentes, pegar URL → metadatos, insertar cita, sección "Fuentes" al exportar.
- **Aceptación:** un ensayo con 5 citas se exporta con la bibliografía correcta en DOCX, PDF y MD.

### Fase 3a — IA con Claude Code (MVP de IA)
- [ ] Capa `ai/` con la interfaz de proveedores y el proveedor Claude Code (Agent SDK, herramientas restringidas).
- [ ] Comentarios v2 (§6.2), Investigar marca, Criticar sección, Mejorar redacción, Chat del ensayo.
- **Aceptación:**
  - "Investigar" sobre una marca devuelve al menos una fuente candidata con URL real y cita textual.
  - La IA nunca modifica un archivo por sí misma.
  - Cancelar una tarea la detiene en menos de 1 s.

### Fase 3b — IA por API key
- [ ] Proveedor compatible con OpenAI y Anthropic API; key cifrada; "probar conexión".
- [ ] Degradación clara: sin búsqueda web, "Investigar" se desactiva con una explicación.
- **Aceptación:** funciona con un endpoint local (llama.cpp/Ollama) y uno en la nube.

### Fase 4 — Reordenar + Rewrite manual
### Fase 5 — Mi estilo + Verificar fuentes

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| `app.js` monolítico (4.6k líneas) sobre `contentEditable`: se rompe fácil | Las funciones nuevas van en módulos aparte (`ai/`, `sources.js`, `comments.js`). Tocar el editor lo mínimo. Probar a mano el flujo de escritura en cada fase |
| La IA inventa fuentes | Fuentes `candidate` hasta que las aceptes, cita textual obligatoria y verificación antes de exportar |
| Coste o cuota de uso del agente | Tareas explícitas (nunca en segundo plano sin pedirlo), mostrar el uso por tarea y posibilidad de cancelar |
| Divergencia con NEO | Asumida (§9) |
| Nombre "Mutiny" muy usado fuera de la serie | Verificar la disponibilidad del repo y el nombre antes de publicar. Si hay conflicto, usar un sufijo (p. ej. `mutiny-write`) |
| Proveedores de API sin tool-calling | Detectarlo en "probar conexión" y desactivar las funciones que lo requieren |

## 9. Relación con NEO (upstream)

- Remote `upstream` = `hughhowey/neo`. Sin merges automáticos: se revisan sus releases y se hace **cherry-pick manual** de arreglos del editor, import y export que apliquen.
- Créditos visibles en README y en "Acerca de".

## 10. Preguntas abiertas

1. **Idioma de la UI:** ¿solo español, o i18n (es/en) desde la fase 1? (Recomendación: un `t()` mínimo desde la fase 1 si se quiere contribuir a la comunidad; retrofitearlo después cuesta más.)
2. **Repo público:** nombre y cuenta de GitHub, y cuándo publicarlo.
3. **Plataformas de build:** ¿solo Linux (AppImage) al inicio, o también Mac/Windows?
4. **Comillas por defecto:** ¿«latinas» o “inglesas”?
