# Cómo usar Mutiny

*[Read in English](TUTORIAL.md)*

Mutiny es un procesador de textos para **ensayos** —de opinión y de divulgación—, construido sobre [NEO](https://github.com/hughhowey/neo) de Hugh Howey. De NEO conserva lo esencial: una página limpia, archivos normales en tu computadora, nada de cuentas ni nube. Encima le agrega estructura para argumentar, fuentes y citas, herramientas para reordenar y reescribir, y un asistente de IA **opcional** que investiga y critica, pero nunca toca tu texto sin que tú lo aceptes.

> En Mac, donde este tutorial dice **Ctrl**, usa **⌘**. Pulsa **Ctrl+/** en cualquier momento para ver todos los atajos.

*(El tutorial original de NEO está en [NEO-TUTORIAL.md](NEO-TUTORIAL.md).)*

---

## 1. Instalar

Descarga la versión para tu sistema en [Releases](https://github.com/worldmutiny/mutiny/releases). Las instrucciones para abrirla la primera vez (las apps no llevan firma de pago de Apple ni de Microsoft) están en el [README](README.md#download).

## 2. La primera vez

Mutiny te hace unas pocas preguntas, una sola vez. Todo se puede cambiar después en **Archivo → Metas y ajustes** (Ctrl+,):

1. **Idioma** de la interfaz: español o inglés.
2. **Quién eres**: tu nombre, que va en cada ensayo y en las exportaciones, y un seudónimo opcional.
3. **Cómo escribes**:
   - *Descubro escribiendo*: los ensayos nuevos abren en una página en blanco.
   - *Parto de un esquema*: abren en el **Esquema**, con una plantilla para ordenar tu argumento.
4. **Cómo se ve la página**: elige la tipografía con una muestra exacta de lo que verás.
5. **El asistente**, si lo quieres (ver [§ 10](#10-el-asistente-opcional)).
6. **Tu voz**: si tienes textos tuyos, súbelos para que el asistente aprenda cómo escribes (ver [§ 11](#11-mi-voz-que-el-asistente-escriba-como-tú)). Puedes saltar este paso.

## 3. El estante

Mutiny abre en un estante de ensayos:

- **+** empieza un ensayo nuevo.
- Crea más estantes con **+ Estante**. Renómbralos con un clic en su nombre y reordénalos arrastrándolos por el ⠿.
- Arrastra los ensayos para ordenarlos o moverlos de estante.
- **Clic derecho en un ensayo**: ponerle una meta de palabras (aparece una barrita de avance en la portada), cambiar la portada, copiarlo a *Mi voz*, quitarlo del estante o mandarlo a la papelera.
- **Portadas**: cada ensayo recibe una portada abstracta generada a partir de su título. El **↻** la cambia. También puedes arrastrar una imagen sobre el ensayo para usarla de portada.
- **Seudónimos**: clic en tu nombre, arriba a la derecha, para agregar otro nombre de autor con sus propios estantes y cambiar entre ellos.
- **Importar** (Ctrl+Shift+I, o arrastrando archivos al estante): documentos `.docx`, `.txt` y `.md`. En Markdown, `#` es el título del ensayo y `##` crea secciones.

## 4. Escribir

Escribe el título, pulsa Enter y empieza.

- **Enter dos veces**: un separador `***` dentro de la sección.
- **Enter tres veces**: una **sección nueva**. Un ensayo es una sola página continua: las secciones van una debajo de otra, cada una con su título opcional (una sección sin título se marca con un § discreto).
- `--` se convierte en raya (—), `...` en puntos suspensivos (…) y las comillas se curvan solas (“ ”).
- **La ortografía no te interrumpe mientras escribes.** Cuando quieras revisarla, pulsa **Ctrl+;**: se subrayan las palabras dudosas, y un clic derecho sobre ellas te da sugerencias. Pulsa Ctrl+; de nuevo para apagarla. Cada ensayo tiene su propio idioma para la ortografía y las exportaciones (en Metas y ajustes).
- **Buscar y reemplazar**: Ctrl+F.
- **Deshacer** los movimientos grandes (borrar una sección, reemplazar todo, mover a *Para después*, reordenar): Ctrl+Z cuando no estás escribiendo.

## 5. Marcar y seguir

¿Te falta un dato, una cifra, una fuente? Pulsa **Ctrl+Shift+X**. Mutiny deja una marca ⚑ en el texto y una nota en el panel derecho, **En el texto**, y tú sigues escribiendo. El panel izquierdo muestra un punto rojo en cada sección que tiene notas pendientes. Con el asistente activado, puedes **Investigar** una marca: busca el dato y te trae fuentes (ver [§ 10](#10-el-asistente-opcional)).

## 6. Los paneles escondidos y las pestañas

La pantalla está despejada hasta que necesitas algo:

- **Borde izquierdo**: la lista de secciones con sus palabras y una nota breve de qué va en cada una. Arrástralas para reordenarlas. El **▸** despliega la primera frase de cada párrafo; un clic en una te lleva ahí.
- **Borde derecho**: *En el texto* (tus marcas y los comentarios del asistente) y el *Chat*. El **☉** lo deja fijo.
- **Pestañas de abajo**:
  - **Borrador**: el texto.
  - **Notas**: una página libre para ideas sueltas.
  - **Esquema**: la estructura del argumento.
  - **Fuentes**: tus referencias.
  - **Para después**: lo que recortaste.

  Doble clic en una pestaña para renombrarla.
- **Contadores**: un clic alterna entre las palabras de todo el ensayo y las de la sección.

## 7. El Esquema

Mutiny parte del método de escritura de ensayos de Jordan Peterson: primero, en una frase, qué quieres decir en cada sección y en cada párrafo; después, escribirlo.

- Cada línea numerada es una **sección** y las líneas con sangría son sus **párrafos**. Enter crea una línea nueva, Tab convierte una sección vacía en párrafo, Shift+Tab hace lo contrario, y Retroceso en una línea vacía la quita.
- Lo que escribes en el Esquema aparece en el Borrador como **párrafo fantasma**, en gris y cursiva, en su lugar. Esa frase-guía queda esperando a que la conviertas en prosa.

## 8. Fuentes y citas

En la pestaña **Fuentes**:

- **Pega una URL, un DOI o un ISBN** y pulsa Añadir. Mutiny obtiene solo el título, el autor, el sitio y la fecha (de la página, de Crossref o de Open Library); revisas y guardas. También puedes añadir una a mano.
- **Citar** (Ctrl+Shift+K):
  - con palabras seleccionadas, esas palabras se vuelven la cita, subrayada y con su número;
  - sin selección, se inserta una marca **[n]** donde está el cursor.
- La numeración sigue el orden de aparición y se actualiza sola.
- **Al exportar**, PDF, Word y texto llevan números volados y una lista de **Fuentes** al final; Markdown y HTML llevan además el enlace.
- Las fuentes que encuentra el asistente llegan como **candidatas**, y solo se citan cuando las aceptas.

## 9. Reordenar y reescribir

**Reordenar** (Ctrl+Shift+O, o el botón ⇅ abajo a la izquierda) convierte el borrador en tarjetas, una por párrafo:

- **Arrastra** las tarjetas, o usa **Alt+↑/↓**, también entre secciones.
- **Doble clic** en una tarjeta muestra sus **frases** para reordenarlas.
- **Esqueleto**: solo la primera frase de cada párrafo. Leída sola, debería contar tu argumento.
- **Enter** abre ese párrafo en el borrador y **Esc** regresa.

**Versiones** (selecciona un pasaje y pulsa Ctrl+Shift+M): arriba ves el original; debajo escribes tus alternativas, que puedes editar en la misma lista. Si el asistente está activo, **Pedir al asistente** agrega las suyas, con una línea de por qué. Eliges una con **Usar esta**. El original y las versiones que no usaste se guardan en **Para después**; si no las quieres, desmarca la casilla.

**Para después**: en vez de borrar un pasaje que te gusta, selecciónalo y pulsa **Ctrl+Shift+D**, o arrástralo a la pestaña *Para después*. Sale del texto, pero no se pierde, y puedes **restaurarlo** en el lugar exacto de donde salió.

## 10. El asistente (opcional)

Actívalo en **Asistente → Ajustes del asistente…** y elige con qué trabaja:

| Proveedor | Qué necesitas |
|---|---|
| **Claude Code** | Claude Code instalado con tu sesión (tu plan de Claude) |
| **Codex** | El Codex CLI con tu sesión de ChatGPT |
| **API de Anthropic** | Una API key |
| **Compatible con OpenAI** | Una API key o un servidor local: OpenAI, Gemini, OpenRouter, Cerebras, Ollama, llama.cpp… (sin búsqueda web) |

Qué puede hacer:

- **Investigar una marca ⚑**: en el panel *En el texto*, botón **Investigar**. Busca en la web, responde con el dato y trae **fuentes candidatas** con la cita textual que lo prueba. Si una te sirve, **Citar aquí** la acepta y la pone junto a la marca.
- **Criticar** (Ctrl+Shift+C para la sección donde estás; el ensayo completo está en el menú Asistente): de 3 a 7 observaciones sobre la tesis, saltos lógicos, afirmaciones sin fuente o el contraargumento que falta. Aparecen como ✦ en el texto y en el panel.
- **Versiones** de un pasaje, dentro de la ventana de Versiones (ver [§ 9](#9-reordenar-y-reescribir)).
- **Chat** sobre tu ensayo (Ctrl+Shift+A): conversa con el texto actual, el esquema y las notas como contexto. Si seleccionas un pasaje antes, el chat trata de ese pasaje. Cualquier respuesta se puede mandar a Notas.

Mientras trabaja, una ventana te dice **qué está haciendo** (qué busca, qué página lee), sobre cuánto texto, con qué proveedor y cuántos segundos lleva. Tiene **Detener**, y en la crítica y la investigación también **Seguir escribiendo**: la tarea sigue en la barra de abajo y te avisa cuando termina. El chat muestra su progreso dentro de su propio panel.

El asistente **nunca escribe archivos ni cambia tu texto por su cuenta**. Solo le llega lo que le pides que trabaje, y solo al servicio que elegiste. Tus API keys se guardan cifradas con el llavero de tu sistema. Detalles en [SECURITY.md](SECURITY.md).

## 11. Mi voz: que el asistente escriba como tú

El estante **◉ Mi voz** guarda textos tuyos para que el asistente aprenda tu estilo:

- **Llénalo** importando textos (.docx, .md, .txt) o **copiando** ensayos tuyos: arrástralos al estante o usa clic derecho → *Copiar a Mi voz*. Es una copia congelada: tu ensayo se queda donde está, y copiarlo otra vez actualiza la copia.
- **El medidor** te dice cuánto material hay y qué esperar: con menos de 2,000 palabras es muy poco; de 5,000 a 10,000 alcanza para un buen primer perfil; con 15,000 o más en temas variados, el perfil es sólido.
- **Ver análisis** muestra lo que Mutiny mide sin IA: largo de frases y párrafos, ritmo, preguntas, persona, puntuación, conectores y los giros que repites.
- **✦ Generar mi estilo**: el asistente lee tus textos y escribe tu perfil (`estilo.md`, en la carpeta de tu biblioteca). Lo revisas y corriges antes de guardarlo.
- Desde entonces, **Versiones y el Chat escriben como tú**; se apaga con la casilla de *Mi estilo*. Cuando agregas más textos, **Actualizar mi estilo** lo rehace, y si lo editaste a mano te pregunta antes de reemplazarlo.
- Si un ensayo tiene mucho texto del asistente sin cambios, al copiarlo a *Mi voz* Mutiny te avisa y te ofrece dejar fuera esos pasajes, para que tu estilo no aprenda de la IA.

## 12. Metas, sprints y la gráfica

En **Metas y ajustes** (Ctrl+, o clic en el contador "hoy") pones una **meta diaria** y una **meta por ensayo**, empiezas un **sprint** de palabras y ves la **gráfica de tus últimos 30 días**. Ahí también se elige cuándo termina tu día de escritura (por si escribes pasada la medianoche), el idioma del ensayo y el de la interfaz.

## 13. Cómo se ve

- **Formato → Tipografía**: Literata, Source Serif, Lora, EB Garamond, iA Writer Quattro y Duo, todas incluidas, o una fuente de tu sistema. Tamaño: Ctrl+= y Ctrl+−.
- **Ver → Página**: **Noche** (hoja oscura) o **Papel** (hoja blanca).
- **Ver → Interfaz más clara**, si los controles te parecen demasiado tenues.
- **Zoom de la página**: Ctrl+rueda del ratón, o el control de abajo a la derecha.
- **Pantalla completa**: Ctrl+Shift+F. **Máquina de escribir**, que mantiene la línea actual centrada: Ctrl+Shift+T.

### En Omarchy

En [Omarchy](https://omarchy.org), la interfaz de Mutiny —estantes, paneles, ventanas y la **barra de menú**— toma los colores, la tipografía y las esquinas rectas de tu tema, y cambia **en vivo** cuando cambias de tema:

- Con la página en **Noche**, la hoja también toma los colores del tema y conserva tu tipografía de escritura. Con **Papel** tienes la hoja blanca.
- En la barra de menú propia, **Alt** entra al menú; las flechas se mueven, Enter elige y Esc sale.
- Para volver al aspecto clásico: **Metas y ajustes → Apariencia → La de Mutiny**.
- `scripts/install-linux.sh` agrega además una fila **Mutiny** al menú de Omarchy.

## 14. Sacar tu ensayo

- **Archivo → Exportar**: PDF, Word (.docx), página web (.html), Markdown y texto plano. Todos llevan tus citas numeradas y la lista de Fuentes.
- **Enviarme el borrador por correo** (Ctrl+E): te manda un PDF con fecha y hora y una huella digital del texto. Sirve como respaldo y como constancia de que esas palabras existían en esa fecha. Se configura en *Archivo → Ajustes de correo*.
- **Clic derecho en el nombre de un estante → Exportar como colección**: une todos sus ensayos en un solo documento con índice.

## 15. Tus archivos, a salvo

Todo se guarda solo, constantemente, en archivos normales dentro de **Documentos/Mutiny Library**: una carpeta por ensayo, con cada sección como un archivo. Puedes abrirla, respaldarla o sincronizarla como quieras. Mutiny hace además una **copia diaria** de toda la biblioteca en su carpeta *Backups* y conserva las últimas dos semanas. Si Mutiny desapareciera mañana, cada palabra seguiría ahí.

**Versiones nuevas**: una vez al día Mutiny revisa si hay una versión nueva y te avisa. Para actualizar, descarga la nueva e instálala encima; tus ensayos se conservan. El aviso se apaga en Metas y ajustes.

## 16. Qué se quitó de NEO (y por qué)

Mutiny es un fork: nació de NEO, que está hecho para novelistas. Esto es lo que dejó atrás:

| En NEO | En Mutiny | Por qué |
|---|---|---|
| **Portadas pintadas con IA** (OpenAI generaba una ilustración a partir del texto, con tu API key) | Solo portadas abstractas generadas localmente, o una imagen tuya | Para ensayos importa menos, costaba dinero y mandaba tu texto a un servicio de imágenes. La IA de Mutiny está enfocada en investigar, criticar y reescribir |
| **Exportar a EPUB** | Se quitó | Pensado para publicar novelas en Amazon; NEO lo marcaba como poco probado |
| **Capitulares** (la letra grande al inicio de cada capítulo) | Se quitó, también del onboarding | Estética de libro; un ensayo es una página continua |
| **Capítulos numerados en hojas separadas** | **Secciones** en una sola página continua | Así se lee y se escribe un ensayo |
| **"Darlings"** | **Para después**, que también guarda las versiones no usadas | El mismo concepto con nombre en español y más usos |
| *Pantser / plotter* | *Descubro escribiendo / Parto de un esquema* | El mismo concepto, con un esquema de ensayo en lugar de uno de novela |
| **NEO Pocket** (la app Android) | Se quitó | Mutiny es de escritorio (Linux, Windows, Mac) |
| **Actualización automática** desde los releases de NEO | Un aviso de versión nueva, desde los releases de Mutiny | Sin firma de pago, la actualización automática no funciona en Mac; y nunca debe bajar una versión de NEO sobre Mutiny |
| Biblioteca **NEO Library** | **Mutiny Library** | Las dos apps pueden convivir sin tocarse |

Se conservan de NEO: el estante y los seudónimos, las portadas abstractas, las marcas, los paneles escondidos, las metas, los sprints y la gráfica, la ortografía bajo demanda, el envío por correo, los respaldos diarios y los archivos planos.

## 17. Atajos

| Atajo | Qué hace |
|---|---|
| **Enter ×2 / ×3** | Separador `***` / sección nueva |
| **Ctrl+Shift+X** | Poner una marca ⚑ ("vuelve aquí") |
| **Ctrl+Shift+D** | Mandar el pasaje seleccionado a *Para después* |
| **Ctrl+Shift+K** | Citar una fuente |
| **Ctrl+Shift+M** | Versiones del texto seleccionado |
| **Ctrl+Shift+C** | Criticar la sección (el ensayo completo, en el menú Asistente) |
| **Ctrl+Shift+A** | Chat sobre el ensayo |
| **Ctrl+Shift+O** | Reordenar (tarjetas, frases, esqueleto) |
| **Alt+↑ / ↓** | Mover una tarjeta en Reordenar |
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
