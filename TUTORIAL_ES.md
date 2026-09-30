# Cómo usar Mutiny

*[Read in English](TUTORIAL.md)*

Mutiny es un procesador de textos para **ensayos** —de opinión y de divulgación— **y otros textos**: entradas de blog, newsletters, guiones de video o podcast y discursos. Está construido sobre [NEO](https://github.com/hughhowey/neo) de Hugh Howey. De NEO conserva lo esencial: una página limpia, archivos normales en tu computadora, nada de cuentas ni nube. Encima le agrega plantillas para estructurar lo que escribes, fuentes y citas, herramientas para reordenar y reescribir, y un asistente de IA **opcional** que investiga, critica y pregunta, pero nunca toca tu texto sin que tú lo aceptes.

> En Mac, donde este tutorial dice **Ctrl**, usa **⌘**. Pulsa **Ctrl+/** en cualquier momento para ver todos los atajos.

*(El tutorial original de NEO está en [NEO-TUTORIAL.md](NEO-TUTORIAL.md).)*

---

## 1. Instalar

Descarga la versión para tu sistema en [Releases](https://github.com/worldmutiny/mutiny/releases). Las instrucciones para abrirla la primera vez (las apps no llevan firma de pago de Apple ni de Microsoft) están en el [README](README.md#download).

## 2. La primera vez

Mutiny te hace unas pocas preguntas, una sola vez, en seis pasos (los puntos de arriba te dicen dónde vas y **← Atrás** te regresa). Todo se puede cambiar después en **Archivo → Metas y ajustes** (Ctrl+,):

1. **Idioma** de la interfaz: español o inglés.
2. **Quién eres y cómo escribes**: tu nombre, que va en cada texto y en las exportaciones, y un seudónimo opcional. Y si:
   - *Descubro escribiendo*: los textos nuevos abren en una página en blanco.
   - *Parto de un esquema*: abren en el **Esquema**, con las preguntas guía de su plantilla.
3. **¿Qué escribes?**: marca los tipos de texto que usas —ensayo, escritura libre, blog, newsletter, guion, discurso— y cada uno tendrá su estante. Puedes escribir cualquiera después aunque no lo marques.
4. **Cómo se ve**: el tema (los colores de toda la app, ver [§ 14](#14-cómo-se-ve)) y la tipografía de tu hoja, con una muestra exacta de lo que verás.
5. **El asistente**, si lo quieres (ver [§ 11](#11-el-asistente-opcional)).
6. **Tu voz**: si tienes textos tuyos, súbelos para que el asistente aprenda cómo escribes (ver [§ 12](#12-mi-voz-que-el-asistente-escriba-como-tú)). Puedes saltar este paso.

Al final puedes **empezar tu primer texto** de una vez o ir a tus estantes. Este manual está siempre a mano en **Ayuda → Manual** (F1).

## 3. El estante

- **+ Nuevo**, arriba a la derecha, empieza un texto: eliges su tipo y su forma (ver [§ 4](#4-tipos-de-texto-y-plantillas)) y va al estante de su tipo. Si todavía no tienes estante de blogs, por ejemplo, Mutiny lo crea y te avisa.
- El **+** dentro de un estante empieza un texto **en ese estante**.
- **+ Estante** crea un estante de uso general, que acepta cualquier tipo. Los estantes nuevos se colocan arriba de *Mi voz*. Renómbralos con un clic en su nombre y reordénalos arrastrándolos por el ⠿.
- Arrastra los textos para ordenarlos o moverlos de estante.
- **Clic derecho en un texto**: ponerle una meta de palabras (aparece una barrita de avance en la portada), cambiar la portada, copiarlo a *Mi voz*, quitarlo del estante o mandarlo a la papelera.
- **Portadas**: cada texto recibe una portada abstracta generada a partir de su título. El **↻** la cambia. También puedes arrastrar una imagen sobre el texto para usarla de portada.
- **Seudónimos**: clic en tu nombre, arriba a la derecha, para agregar otro nombre de autor con sus propios estantes y cambiar entre ellos.
- **Importar** (Ctrl+Shift+I, o arrastrando archivos al estante): documentos `.docx`, `.txt` y `.md`. En Markdown, `#` es el título y `##` crea secciones.

## 4. Tipos de texto y plantillas

Cada texto tiene un **tipo** y una **forma**. Juntos son su plantilla, que decide cuatro cosas: el **esquema** con sus preguntas guía, **qué mide la barra** de abajo, **en qué se fija el asistente** y los **datos extra** del texto. La plantilla nunca toca lo que escribiste.

| Tipo | Formas | La barra mide |
|---|---|---|
| **Ensayo** | Peterson · Dialéctico · Toulmin · Ellos dicen / Yo digo · Pirámide (SCQA) · Exploratorio · Cinco párrafos | palabras |
| **Escritura libre** | Libre · Páginas matutinas (meta de 750 palabras) | palabras |
| **Blog** | Opinión · Tutorial · Lista | palabras y minutos de lectura |
| **Newsletter** | Carta personal · Resumen | palabras y minutos de lectura |
| **Guion** | Video largo · Video corto (≤60 s) · Podcast | minutos en voz alta, contra tu duración objetivo |
| **Discurso** | Charla · Brindis | minutos en voz alta, contra tu duración objetivo |

Las formas de ensayo, en breve:

- **Peterson**: unas diez oraciones primero; luego un párrafo por cada una.
- **Dialéctico**: tesis, antítesis y síntesis, para temas polémicos.
- **Toulmin**: afirmación, pruebas, garantía, límites y refutación; el argumento más sólido.
- **Ellos dicen / Yo digo**: empiezas por lo que dicen otros y luego tomas postura.
- **Pirámide (SCQA)**: situación, complicación, pregunta, respuesta; breve y al grano.
- **Exploratorio**: escribes para descubrir qué piensas; el asistente te pregunta en vez de corregirte.
- **Cinco párrafos**: introducción, tres argumentos y conclusión; el clásico.

**Metas y ajustes → Tipo de texto** cambia la forma de un texto ya empezado. En **Este texto** están los datos propios de su tipo:

- **Blog**: meta-descripción y slug.
- **Newsletter**: asunto y pre-encabezado.
- **Guion y discurso**: duración objetivo.

## 5. Escribir

Escribe el título, pulsa Enter y empieza.

- **Enter dos veces**: un separador `***` dentro de la sección.
- **Enter tres veces**: una **sección nueva**. Un texto es una sola página continua: las secciones van una debajo de otra, cada una con su título opcional (una sección sin título se marca con un § discreto).
- `--` se convierte en raya (—), `...` en puntos suspensivos (…) y las comillas se curvan solas (“ ”).
- **Clic derecho** en el borrador:
  - siempre: cortar, copiar, pegar, poner una marca y citar una fuente;
  - con texto seleccionado, además: mandarlo a *Para después*;
  - con el asistente activado: versiones, criticar la sección y preguntar en el chat.

  Cada opción muestra su atajo, para irlos aprendiendo. Sobre una palabra mal escrita, arriba salen sus sugerencias.
- **La ortografía no te interrumpe mientras escribes.** Cuando quieras revisarla, pulsa **Ctrl+;**: se subrayan las palabras dudosas, y un clic derecho sobre ellas te da sugerencias. Pulsa Ctrl+; de nuevo para apagarla. Cada texto tiene su propio idioma para la ortografía y las exportaciones (en Metas y ajustes).
- **Buscar y reemplazar**: Ctrl+F.
- **Deshacer** los movimientos grandes (borrar una sección, reemplazar todo, mover a *Para después*, reordenar): Ctrl+Z cuando no estás escribiendo.

## 6. Marcar y seguir

¿Te falta un dato, una cifra, una fuente? Pulsa **Ctrl+Shift+X**, o usa el clic derecho o **Edición → Poner una marca**. Mutiny deja una marca ⚑ en el texto y abre su nota en el panel derecho, **En el texto**, lista para escribir. Un clic de vuelta en el texto y sigues escribiendo. El panel izquierdo muestra un punto rojo en cada sección que tiene notas pendientes.

Con el asistente activado, puedes **Investigar** una marca: busca el dato y te trae fuentes (ver [§ 11](#11-el-asistente-opcional)). **Resolver** una nota no la borra: queda en *Resueltas* y puedes reabrirla. El botón **→ Notas** la copia a la pestaña Notas, con un renglón en blanco entre cada nota.

## 7. Los paneles y las pestañas

La pantalla está despejada hasta que necesitas algo:

- **Panel izquierdo** (Ctrl+[, la pestaña ☰ en el borde o acercando el ratón al borde): la lista de secciones con sus palabras y una nota breve de qué va en cada una. Arrástralas para reordenarlas. El **▸** despliega la primera frase de cada párrafo; un clic en una te lleva ahí.
- **Panel derecho** (Ctrl+], la pestaña ⚑ o acercando el ratón al borde): *En el texto* (tus marcas y los comentarios del asistente) y el *Chat*. La pestaña del borde muestra cuántas notas tienes abiertas. La **chincheta** lo deja fijo: inclinada, el panel se cierra solo; derecha y en color, se queda abierto.
- Los dos paneles **empujan la hoja** en lugar de taparla.
- **Pestañas de abajo**:
  - **Borrador**: el texto.
  - **Notas**: una página libre para ideas sueltas.
  - **Esquema**: la estructura.
  - **Fuentes**: tus referencias.
  - **Para después**: lo que recortaste.

  Doble clic en una pestaña para renombrarla.
- **Contadores**: un clic alterna entre las palabras de todo el texto y las de la sección.

## 8. El Esquema

Primero, en una frase, qué quieres decir en cada sección y en cada párrafo; después, escribirlo. Así lo propone el método de Jordan Peterson, y así funcionan todas las plantillas.

- Arriba dice qué plantilla sigue el texto. Si el texto está vacío, el botón **Usar el esquema…** pone las preguntas guía de su forma.
- Cada línea numerada es una **sección** y las líneas con sangría son sus **párrafos**. Enter crea una línea nueva, Tab convierte una sección vacía en párrafo, Shift+Tab hace lo contrario, y Retroceso en una línea vacía la quita.
- Lo que escribes en el Esquema aparece en el Borrador como **párrafo fantasma**, en gris y cursiva, en su lugar. Esa frase-guía queda esperando a que la conviertas en prosa.

## 9. Fuentes y citas

En la pestaña **Fuentes**:

- **Pega una URL, un DOI o un ISBN** y pulsa Añadir. Mutiny obtiene solo el título, el autor, el sitio y la fecha (de la página, de Crossref o de Open Library); revisas y guardas. También puedes añadir una a mano.
- **Citar** (Ctrl+Shift+K):
  - con palabras seleccionadas, esas palabras se vuelven la cita, subrayada y con su número;
  - sin selección, se inserta una marca **[n]** donde está el cursor.
- La numeración sigue el orden de aparición y se actualiza sola.
- **Al exportar**, PDF, Word y texto llevan números volados y una lista de **Fuentes** al final; Markdown y HTML llevan además el enlace.
- Las fuentes que encuentra el asistente llegan como **candidatas**, y solo se citan cuando las aceptas.

## 10. Reordenar y reescribir

**Reordenar** (Ctrl+Shift+O, o el botón ⇅ abajo a la izquierda) convierte el borrador en tarjetas, una por párrafo:

- **Arrastra** las tarjetas, o usa **Alt+↑/↓**, también entre secciones.
- **Doble clic** en una tarjeta muestra sus **frases** para reordenarlas.
- **Esqueleto**: solo la primera frase de cada párrafo. Leída sola, debería contar tu argumento.
- **Enter** abre ese párrafo en el borrador y **Esc** regresa.

**Versiones** (selecciona un pasaje y pulsa Ctrl+Shift+M):

- Arriba ves el original; debajo escribes tus alternativas, que puedes editar en la misma lista.
- Si el asistente está activo, **Pedir al asistente** agrega las suyas, con una línea de por qué y las palabras que cambió marcadas.
- Eliges una con **Usar esta**.
- El original y las versiones que no usaste se guardan en **Para después**; si no las quieres, desmarca la casilla.

**Para después**: en vez de borrar un pasaje que te gusta, selecciónalo y pulsa **Ctrl+Shift+D**, o arrástralo a la pestaña *Para después*. Sale del texto, pero no se pierde, y puedes **restaurarlo** en el lugar exacto de donde salió.

## 11. El asistente (opcional)

Actívalo en **Asistente → Ajustes del asistente…** y elige con qué trabaja:

| Proveedor | Qué necesitas |
|---|---|
| **Claude Code** | Claude Code instalado con tu sesión (tu plan de Claude) |
| **Codex** | El Codex CLI con tu sesión de ChatGPT |
| **API de Anthropic** | Una API key |
| **Compatible con OpenAI** | Una API key o un servidor local: OpenAI, Gemini, OpenRouter, Cerebras, Ollama, llama.cpp… (sin búsqueda web) |

Qué puede hacer:

- **Investigar una marca ⚑**: en el panel *En el texto*, botón **Investigar**. Busca en la web, responde con el dato y trae **fuentes candidatas** con la cita textual que lo prueba. **Citar aquí** acepta una y la pone junto a la marca; **Guardar en Fuentes** solo la guarda.
- **Criticar** (Ctrl+Shift+C para la sección donde estás; el texto completo está en el menú Asistente): de 3 a 7 observaciones, que aparecen como ✦ en el texto y en el panel. En qué se fija **depende de la plantilla**:
  - un ensayo: tesis, lógica, evidencia y contraargumento (en Toulmin: afirmación, pruebas, garantía, límites y refutación);
  - un blog: gancho, estructura y llamada a la acción;
  - un guion o un discurso: si se entiende **al oído**, el ritmo y la apertura o el cierre.
- **Preguntas en vez de crítica**: en un ensayo *Exploratorio* y en *Escritura libre*, el asistente no corrige. Te deja de 3 a 7 preguntas abiertas para que sigas pensando.
- **Versiones** de un pasaje, dentro de la ventana de Versiones (ver [§ 10](#10-reordenar-y-reescribir)). En guiones y discursos propone frases fáciles de decir en voz alta.
- **Chat** sobre tu texto (Ctrl+Shift+A): conversa con el texto actual, el esquema y las notas como contexto, sabiendo qué tipo de texto es. Si seleccionas un pasaje antes, el chat trata de ese pasaje. Cualquier respuesta se puede **insertar** donde estabas escribiendo o mandar a Notas.

Mientras trabaja, una ventana te dice **qué está haciendo** (qué busca, qué página lee), sobre cuánto texto, con qué proveedor y cuántos segundos lleva. Tiene **Detener**, y en la crítica y la investigación también **Seguir escribiendo**: la tarea sigue en la barra de abajo y te avisa cuando termina. El chat muestra su progreso dentro de su propio panel.

El asistente **nunca escribe archivos ni cambia tu texto por su cuenta**. Solo le llega lo que le pides que trabaje, y solo al servicio que elegiste. Tus API keys se guardan cifradas con el llavero de tu sistema. Detalles en [SECURITY.md](SECURITY.md).

## 12. Mi voz: que el asistente escriba como tú

El estante **◉ Mi voz** guarda textos tuyos para que el asistente aprenda tu estilo:

- **Llénalo** importando textos (.docx, .md, .txt) o **copiando** textos tuyos: arrástralos al estante o usa clic derecho → *Copiar a Mi voz*. Es una copia congelada: tu texto se queda donde está, y copiarlo otra vez actualiza la copia.
- **El medidor** te dice cuánto material hay y qué esperar:
  - con menos de 2,000 palabras es muy poco;
  - de 5,000 a 10,000 alcanza para un buen primer perfil;
  - con 15,000 o más en temas variados, el perfil es sólido.
- **Ver análisis** muestra lo que Mutiny mide sin IA: largo de frases y párrafos, ritmo, preguntas, persona, puntuación, conectores y los giros que repites.
- **✦ Generar mi estilo**: el asistente lee tus textos y escribe tu perfil (`estilo.md`, en la carpeta de tu biblioteca). Lo revisas y corriges antes de guardarlo.
- Desde entonces, **Versiones y el Chat escriben como tú**; se apaga con la casilla de *Mi estilo*. Cuando agregas más textos, **Actualizar mi estilo** lo rehace, y si lo editaste a mano te pregunta antes de reemplazarlo.
- Si un texto tiene mucho texto del asistente sin cambios, al copiarlo a *Mi voz* Mutiny te avisa y te ofrece dejar fuera esos pasajes, para que tu estilo no aprenda de la IA.

## 13. Metas, sprints y la gráfica

En **Metas y ajustes** (Ctrl+, o clic en el contador "hoy") tienes:

- una **meta diaria** y una **meta por texto**;
- **sprints** de palabras;
- la **gráfica de tus últimos 30 días**;
- cuándo termina tu día de escritura (por si escribes pasada la medianoche);
- el tipo de texto, el idioma del texto y el de la interfaz;
- el tema.

## 14. Cómo se ve

- **Temas**: *Mutiny*, *BlackGold*, *Black Arch*, *Matrix*, *Tokyo Night* y *City 783*, basados en temas de Omarchy. Se eligen en **Ver → Tema** o en **Metas y ajustes**, y cambian toda la interfaz al instante. Conservan tu tipografía; en la hoja **Noche** toman sus colores y **Papel** sigue siendo blanca.
- **Formato → Tipografía**: Literata, Source Serif, Lora, EB Garamond, iA Writer Quattro y Duo, todas incluidas, o una fuente de tu sistema. Tamaño: Ctrl+= y Ctrl+−.
- **Ver → Página**: **Noche** (hoja oscura) o **Papel** (hoja blanca).
- **Ver → Interfaz más clara**: viene activada; quítale la ✓ si prefieres controles más tenues.
- **Zoom de la página**: Ctrl+rueda del ratón, o el control de abajo a la derecha.
- **Pantalla completa**: Ctrl+Shift+F. **Máquina de escribir**, que mantiene la línea actual centrada: Ctrl+Shift+T.

### En Omarchy

En [Omarchy](https://omarchy.org), el tema **Omarchy (sistema)** hace que la interfaz de Mutiny —estantes, paneles, ventanas y la **barra de menú**— tome los colores, la tipografía y las esquinas rectas de tu tema, y cambie **en vivo** cuando cambias de tema:

- Con la página en **Noche**, la hoja también toma los colores del tema y conserva tu tipografía de escritura. Con **Papel** tienes la hoja blanca.
- En la barra de menú propia, **Alt** entra al menú; las flechas se mueven, Enter elige y Esc sale.
- `scripts/install-linux.sh` agrega además una fila **Mutiny** al menú de Omarchy.

## 15. Sacar tu texto

- **Archivo → Exportar**: PDF, Word (.docx), página web (.html), Markdown y texto plano. Todos llevan tus citas numeradas y la lista de Fuentes. El PDF de un guion o un discurso sale con letra grande, para leerlo en voz alta.
- **Markdown para web (con encabezado)**: el texto con sus datos arriba (título, descripción, slug, autor, fecha, idioma), listo para Astro, Hugo, Jekyll o Eleventy.
- **Copiar con formato**: pégalo en el editor de WordPress, Ghost, Medium o Substack y conserva subtítulos, negritas y enlaces. El título no va incluido, porque esos editores tienen su propio campo.
- **Enviarme el borrador por correo** (Ctrl+E): te manda un PDF con fecha y hora y una huella digital del texto. Sirve como respaldo y como constancia de que esas palabras existían en esa fecha. Se configura en *Archivo → Ajustes de correo*.
- **Clic derecho en el nombre de un estante → Exportar como colección**: une todos sus textos en un solo documento con índice.

## 16. Tus archivos, a salvo

Todo se guarda solo, constantemente, en archivos normales dentro de **Documentos/Mutiny Library**: una carpeta por texto, con cada sección como un archivo. Puedes abrirla, respaldarla o sincronizarla como quieras. Mutiny hace además una **copia diaria** de toda la biblioteca en su carpeta *Backups* y conserva las últimas dos semanas. Si Mutiny desapareciera mañana, cada palabra seguiría ahí.

**Versiones nuevas**: una vez al día Mutiny revisa si hay una versión nueva y te avisa. Para actualizar, descarga la nueva e instálala encima; tus textos se conservan. El aviso se apaga en Metas y ajustes.

### Qué se guarda y dónde

| Dónde | Qué |
|---|---|
| **Documentos/Mutiny Library** | Tus textos (una carpeta por texto: secciones, notas, esquema, fuentes, *Para después* y el chat del asistente de ese texto), tu perfil de estilo `estilo.md`, las copias diarias (*Backups*), los PDF de "Enviarme el borrador" (*Exports*) y un registro de errores (`neo-errors.log`, sin tu texto) |
| **La carpeta de la app** (Linux `~/.config/Mutiny`, Mac `~/Library/Application Support/Mutiny`, Windows `%APPDATA%\Mutiny`) | Tus API keys en `secrets.json`, **cifradas con el llavero de tu sistema**; una carpeta de trabajo vacía para el asistente (`ai-workspace`); y las cachés propias del motor de la ventana |

Nada de esto se sube a ningún lado: Mutiny no tiene cuentas, ni nube, ni estadísticas de uso.

### Qué sale de tu computadora

Las ventanas de Mutiny **no pueden conectarse a internet**. Solo salen datos cuando tú usas una de estas funciones:

- **El asistente**: el texto con el que le pides trabajar va al servicio que elegiste (Claude Code → Anthropic, Codex → OpenAI, la API de Anthropic o el servicio compatible que configures). Mutiny no guarda nada en la nube, y a Claude Code y Codex los lanza en modo solo lectura y **sin guardar la conversación**. Lo que cada proveedor haga con tu texto —si lo conserva, cuánto tiempo, si lo usa para entrenar— **depende de su política y de la configuración de tu cuenta**; revísala con él. Con Ollama o llama.cpp en tu propia máquina, nada sale.
- **Buscar una fuente** (URL, DOI o ISBN): pide los datos a esa página, a Crossref, Open Library o Google Books. Nunca a tu computadora ni a tu red local.
- **El aviso de versiones**: una vez al día lee la lista pública de versiones en GitHub, sin enviar nada tuyo. Se apaga en Metas y ajustes.
- **Enviarme el borrador** y los **enlaces**: se abren en tu correo o tu navegador; lo que se envía, lo envías tú.

Procesos que Mutiny lanza en tu sistema: el programa de **Claude Code** o **Codex**, solo mientras el asistente trabaja con ellos; en Omarchy, los comandos que leen tu tema (`omarchy-theme-color`, `omarchy-font-current`); en Mac, *osascript* para abrir Mail. Nada más.

## 17. Qué se quitó de NEO (y por qué)

Mutiny es un fork: nació de NEO, que está hecho para novelistas. Esto es lo que dejó atrás:

| En NEO | En Mutiny | Por qué |
|---|---|---|
| **Portadas pintadas con IA** (OpenAI generaba una ilustración a partir del texto, con tu API key) | Solo portadas abstractas generadas localmente, o una imagen tuya | Para ensayos importa menos, costaba dinero y mandaba tu texto a un servicio de imágenes. La IA de Mutiny está enfocada en investigar, criticar y reescribir |
| **Exportar a EPUB** | Se quitó | Pensado para publicar novelas en Amazon; NEO lo marcaba como poco probado |
| **Capitulares** (la letra grande al inicio de cada capítulo) | Se quitó, también del onboarding | Estética de libro; un texto es una página continua |
| **Capítulos numerados en hojas separadas** | **Secciones** en una sola página continua | Así se lee y se escribe un ensayo |
| **"Darlings"** | **Para después**, que también guarda las versiones no usadas | El mismo concepto con nombre en español y más usos |
| *Pantser / plotter* | *Descubro escribiendo / Parto de un esquema* | El mismo concepto, con plantillas de ensayo, blog, guion y discurso en lugar de una de novela |
| **NEO Pocket** (la app Android) | Se quitó | Mutiny es de escritorio (Linux, Windows, Mac) |
| **Actualización automática** desde los releases de NEO | Un aviso de versión nueva, desde los releases de Mutiny | Sin firma de pago, la actualización automática no funciona en Mac; y nunca debe bajar una versión de NEO sobre Mutiny |
| Biblioteca **NEO Library** | **Mutiny Library** | Las dos apps pueden convivir sin tocarse |

Se conservan de NEO: el estante y los seudónimos, las portadas abstractas, las marcas, los paneles escondidos, las metas, los sprints y la gráfica, la ortografía bajo demanda, el envío por correo, los respaldos diarios y los archivos planos.

## 18. Atajos

| Atajo | Qué hace |
|---|---|
| **Enter ×2 / ×3** | Separador `***` / sección nueva |
| **Ctrl+Shift+X** | Poner una marca ⚑ (abre su nota) |
| **Ctrl+Shift+D** | Mandar el pasaje seleccionado a *Para después* |
| **Ctrl+Shift+K** | Citar una fuente |
| **Ctrl+Shift+M** | Versiones del texto seleccionado |
| **Ctrl+Shift+C** | Criticar la sección (o preguntas, en exploratorio y escritura libre) |
| **Ctrl+Shift+A** | Chat sobre el texto |
| **Ctrl+Shift+O** | Reordenar (tarjetas, frases, esqueleto) |
| **Alt+↑ / ↓** | Mover una tarjeta en Reordenar |
| **Ctrl+[ / Ctrl+]** | Panel de secciones / panel En el texto |
| **Ctrl+F** | Buscar y reemplazar |
| **Ctrl+;** | Revisar ortografía |
| **Ctrl+Z** | Deshacer (también los movimientos grandes) |
| **Ctrl+= / Ctrl+− / Ctrl+0** | Texto más grande / más pequeño / normal |
| **Ctrl+Shift+F** | Pantalla completa |
| **Ctrl+Shift+T** | Máquina de escribir |
| **Ctrl+,** | Metas y ajustes |
| **Ctrl+E** | Enviarte el borrador por correo |
| **Ctrl+Shift+I** | Importar documentos |
| **Ctrl+/** | Ver todos los atajos |
| **Esc** | Cerrar lo que esté abierto, o volver al estante |

---

Gracias a Hugh Howey por NEO, que hizo posible todo esto. Y ahora a escribir: un borrador no tiene que ser bueno, solo tiene que existir.
