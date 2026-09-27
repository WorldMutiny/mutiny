# How to use Mutiny

*[Leer en español](TUTORIAL_ES.md)*

Mutiny is a word processor for **essays** — opinion and popular non-fiction — built on [NEO](https://github.com/hughhowey/neo) by Hugh Howey. From NEO it keeps what matters: a clean page, plain files on your computer, no accounts, no cloud. On top of that it adds structure for making an argument, sources and citations, tools to reorder and rewrite, and an **optional** AI assistant that researches and critiques but never touches your text unless you accept.

> On a Mac, read **⌘** wherever this tutorial says **Ctrl**. Press **Ctrl+/** at any time to see every shortcut.

*(NEO's original tutorial is kept in [NEO-TUTORIAL.md](NEO-TUTORIAL.md).)*

---

## 1. Install

Download the version for your system from [Releases](https://github.com/worldmutiny/mutiny/releases). The [README](README.md#download) explains how to open it the first time: the builds aren't signed with paid Apple or Microsoft certificates.

## 2. The first time

Mutiny asks a few questions, once. You can change all of it later in **File → Goals & Settings…** (Ctrl+,):

1. **Language** of the interface: English or Spanish.
2. **Who you are**: your name, which goes on every essay and export, and an optional pen name.
3. **How you write**:
   - *I discover by writing*: new essays open on a blank page.
   - *I start from an outline*: they open in the **Outline**, with a template for laying out your argument.
4. **How the page looks**: pick a typeface from a sample that shows exactly what you'll see.
5. **The assistant**, if you want one (see [§ 10](#10-the-assistant-optional)).
6. **Your voice**: if you have texts of your own, add them so the assistant can learn how you write (see [§ 11](#11-my-voice-have-the-assistant-write-like-you)). You can skip this.

## 3. The shelf

Mutiny opens on a shelf of essays:

- **+** starts a new essay.
- Add shelves with **+ Shelf**. Rename one by clicking its name, and reorder shelves by dragging their ⠿.
- Drag essays to reorder them or move them between shelves.
- **Right-click an essay** to:
  - set a word goal (a small progress bar appears on the cover);
  - change the cover;
  - copy it to *My voice*;
  - remove it from the shelf or move it to the trash.
- **Covers**: every essay gets an abstract cover generated from its title. **↻** gives it another one. You can also drag an image onto an essay to make it the cover.
- **Pen names**: click your name at the top right to add another author name with its own shelves, and switch between them.
- **Import** (Ctrl+Shift+I, or drag files onto a shelf): `.docx`, `.txt` and `.md` documents. In Markdown, `#` is the essay's title and `##` starts a section.

## 4. Writing

Type the title, press Enter, and start.

- **Enter twice**: a `***` break inside the section.
- **Enter three times**: a **new section**. An essay is one continuous page: sections follow one another, each with an optional title. A section without a title is marked with a quiet §.
- `--` becomes an em dash (—), `...` an ellipsis (…), and quotes curl themselves (“ ”).
- **Spelling doesn't nag you while you write.** When you want to check it, press **Ctrl+;**: doubtful words are underlined, and right-clicking one gives suggestions. Press Ctrl+; again to turn it off. Each essay has its own language for spelling and exports (in Goals & Settings).
- **Find and replace**: Ctrl+F.
- **Undo** big moves too (deleting a section, replace all, sending a passage to *Later*, reordering): Ctrl+Z while you're not typing.

## 5. Mark it and keep going

Missing a fact, a figure, a source? Press **Ctrl+Shift+X**. Mutiny leaves a ⚑ mark in the text and a note in the right pane, **In the text**, and you keep writing. The left pane shows a red dot on every section with open notes. With the assistant on, you can **Research** a mark: it looks the fact up and brings back sources (see [§ 10](#10-the-assistant-optional)).

## 6. The hidden panes and the tabs

The screen stays clear until you need something:

- **Left edge**: the list of sections, with their word counts and a short note on what each one does. Drag them to reorder. The **▸** unfolds the first sentence of every paragraph; click one to go there.
- **Right edge**: *In the text* (your marks and the assistant's comments) and the *Chat*. The **☉** pins it open.
- **Tabs along the bottom**:
  - **Draft**: the text.
  - **Notes**: a free page for loose ideas.
  - **Outline**: the structure of your argument.
  - **Sources**: your references.
  - **Later**: what you cut.

  Double-click a tab to rename it.
- **Counters**: one click switches between the whole essay's words and this section's.

## 7. The Outline

Mutiny starts from Jordan Peterson's essay-writing method: first say, in one sentence, what each section and each paragraph will do — then write it.

- Each numbered line is a **section**, and the indented lines are its **paragraphs**.
  - Enter makes a new line.
  - Tab turns an empty section line into a paragraph of the one above; Shift+Tab does the reverse.
  - Backspace on an empty line removes it.
- What you write in the Outline appears in the Draft as a **ghost paragraph**, grey and italic, in its place. That guide sentence waits there for you to turn it into prose.

## 8. Sources and citations

In the **Sources** tab:

- **Paste a URL, a DOI or an ISBN** and press Add. Mutiny fetches only the title, author, site and date (from the page, Crossref or Open Library). You review them and save. You can also *Add one by hand*.
- **Cite** with Ctrl+Shift+K:
  - with words selected, those words become the citation, underlined and numbered;
  - with nothing selected, a **[n]** mark goes in at the cursor.
- Numbers follow the order of first appearance and update themselves.
- **When you export**, PDF, Word and plain text carry superscript numbers and a **Sources** list at the end; Markdown and HTML also carry the link.
- Sources the assistant finds arrive as **candidates**. They can only be cited once you accept them.

## 9. Reorder and rewrite

**Reorder** (Ctrl+Shift+O, or the ⇅ button at the bottom left) turns the draft into cards, one per paragraph:

- **Drag** the cards, or use **Alt+↑/↓**, across sections too.
- **Double-click** a card to see its **sentences** and reorder them.
- **Skeleton**: only the first sentence of each paragraph. Read on its own, it should tell your argument.
- **Enter** opens that paragraph in the draft, and **Esc** goes back.

**Versions** (select a passage and press Ctrl+Shift+M):
- The original sits at the top. Below it you write alternatives, and you can edit them in the list.
- If the assistant is on, **Ask the assistant** adds its own, each with a line on why.
- Pick one with **Use this**. The original and the versions you didn't use are kept in **Later**; untick the box if you don't want them.

**Later**: instead of deleting a passage you like, select it and press **Ctrl+Shift+D**, or drag it onto the *Later* tab. It leaves the text but isn't lost, and you can **restore** it to the exact spot it came from.

## 10. The assistant (optional)

Turn it on in **Assistant → Assistant Settings…** and choose what it runs on:

| Provider | What you need |
|---|---|
| **Claude Code** | Claude Code installed and logged in (your Claude plan) |
| **Codex** | The Codex CLI logged in with ChatGPT |
| **Anthropic API** | An API key |
| **OpenAI-compatible** | An API key or a local server: OpenAI, Gemini, OpenRouter, Cerebras, Ollama, llama.cpp… (no web search) |

What it can do:

- **Research a ⚑ mark**: in the *In the text* pane, press **Research**. It searches the web, answers with the fact and brings back **candidate sources**, each with the exact quote that proves it. If one works for you, **Cite here** accepts it and places it by the mark.
- **Critique**: Ctrl+Shift+C for the section you're in; *Critique the Whole Essay* is in the Assistant menu. You get 3 to 7 remarks on the thesis, logical leaps, unsourced claims or the missing counterargument, shown as ✦ in the text and in the pane.
- **Versions** of a passage, inside the Versions window (see [§ 9](#9-reorder-and-rewrite)).
- **Chat** about your essay (Ctrl+Shift+A): it sees the current text, the outline and your notes. If you select a passage first, the chat is about that passage. Any answer can be sent to your Notes (**→ Notes**).

While it works, a window shows **what it's doing** (what it searches, which page it reads), on how much text, with which provider, and for how many seconds. It has **Stop**. Critique and research also have **Keep writing**: the task goes on in the bottom bar and tells you when it's done. The chat shows its progress inside its own pane.

The assistant **never writes files or changes your text by itself**. It only receives what you ask it to work on, and only the service you chose receives it. Your API keys are encrypted by your system's keychain. Details in [SECURITY.md](SECURITY.md).

## 11. My voice: have the assistant write like you

The **◉ My voice** shelf keeps texts of yours so the assistant can learn your style:

- **Fill it** by importing texts (.docx, .md, .txt) or **copying** your essays: drag them onto the shelf, or right-click → *Copy to My voice*. It's a frozen copy: your essay stays where it is, and copying it again updates the copy.
- **The meter** tells you how much material there is and what to expect:
  - under 2,000 words is very little;
  - 5,000–10,000 is enough for a good first profile;
  - 15,000 or more, on varied topics, makes it solid.
- **Analysis** shows what Mutiny measures without AI: sentence and paragraph length, rhythm, questions, person, punctuation, connectors and the phrases you repeat.
- **✦ Generate my style**: the assistant reads your texts and writes your profile (`estilo.md`, in your library folder). You review and correct it before it's saved.
- From then on, **Versions and the Chat write like you**. The *Use my style in Versions and the Chat* box turns it off.
- When you add more texts, **Update my style** redoes the profile. If you edited it by hand, it asks before replacing it.
- If an essay has a lot of the assistant's text left unchanged, copying it to *My voice* warns you and offers to leave those passages out, so your style doesn't learn from the AI.

## 12. Goals, sprints and the chart

In **Goals & Settings…** (Ctrl+, or click the "today" counter) you can:
- set a **daily goal** and a **goal per essay**;
- start a word **sprint** and see the **chart of your last 30 days**;
- choose when your writing day ends (in case you write past midnight);
- set the essay's language and the interface's.

## 13. How it looks

- **Format → Body Font**: Literata, Source Serif, Lora, EB Garamond, iA Writer Quattro and Duo — all bundled — or a font from your system. Size: Ctrl+= and Ctrl+−.
- **View → Page**: **Night** (dark sheet) or **Paper** (white sheet).
- **View → Brighter Interface**, if the controls feel too faint.
- **Page zoom**: Ctrl+mouse wheel, or the control at the bottom right.
- **Full screen**: Ctrl+Shift+F. **Typewriter scrolling**, which keeps the current line centred: Ctrl+Shift+T.

### On Omarchy

On [Omarchy](https://omarchy.org), Mutiny's interface — shelves, panes, windows and the **menu bar** — takes your theme's colours, font and square corners, and changes **live** when you switch themes:

- With the page on **Night**, the sheet takes the theme's colours too and keeps your writing typeface. **Paper** gives you the white sheet.
- In the menu bar, **Alt** enters the menu; the arrows move, Enter picks and Esc leaves.
- For the classic look: **Goals & Settings → Appearance → Mutiny's own**.
- `scripts/install-linux.sh` also adds a **Mutiny** row to the Omarchy menu.

## 14. Getting your essay out

- **File → Export**: PDF, Word (.docx), web page (.html), Markdown and plain text. All of them carry your numbered citations and the Sources list.
- **Email Draft to Myself** (Ctrl+E): sends you a PDF stamped with the date and time and a digital fingerprint of the text. It's a backup, and a record that those words existed on that date. Set it up in *File → Email Settings…*.
- **Right-click a shelf's name → Export shelf as a collection…**: joins all its essays into one document with a table of contents.

## 15. Your files, safe

Everything saves by itself, constantly, into plain files in **Documents/Mutiny Library**: one folder per essay, each section a file. You can open it, back it up or sync it however you like. Mutiny also makes a **daily copy** of the whole library in its *Backups* folder and keeps the last two weeks. If Mutiny vanished tomorrow, every word would still be there.

**New versions**: once a day Mutiny checks whether there's a newer version and tells you. To update, download it and install it over the old one; your essays are kept. You can turn the check off in Goals & Settings.

## 16. What was taken out of NEO (and why)

Mutiny is a fork: it grew out of NEO, which is made for novelists. This is what it left behind:

| In NEO | In Mutiny | Why |
|---|---|---|
| **AI-painted covers** (OpenAI illustrated a cover from your text, with your API key) | Only abstract covers made locally, or your own image | They matter less for essays, cost money, and sent your text to an image service. Mutiny's AI is focused on research, critique and rewriting |
| **EPUB export** | Removed | Meant for publishing novels on Amazon; NEO flagged it as barely tested |
| **Drop caps** (the big first letter of each chapter) | Removed, also from the first-run questions | A book look; an essay is one continuous page |
| **Numbered chapters on separate sheets** | **Sections** on one continuous page | That's how an essay is read and written |
| **"Darlings"** | **Later**, which also keeps unused versions | The same idea, with more uses |
| *Pantser / plotter* | *I discover by writing / I start from an outline* | The same idea, with an essay outline instead of a novel's |
| **NEO Pocket** (the Android app) | Removed | Mutiny is for the desktop (Linux, Windows, Mac) |
| **Automatic updates** from NEO's releases | A new-version notice, from Mutiny's releases | Without paid signing, self-updating doesn't work on a Mac; and a NEO build must never replace Mutiny |
| The **NEO Library** folder | **Mutiny Library** | Both apps can live side by side without touching each other |

Kept from NEO:
- the shelf and pen names;
- the abstract covers;
- the marks and the hidden panes;
- the goals, sprints and chart;
- spellcheck on demand;
- emailing yourself the draft;
- daily backups and plain files.

## 17. Shortcuts

| Shortcut | What it does |
|---|---|
| **Enter ×2 / ×3** | `***` break / new section |
| **Ctrl+Shift+X** | Leave a ⚑ mark ("come back here") |
| **Ctrl+Shift+D** | Send the selected passage to *Later* |
| **Ctrl+Shift+K** | Cite a source |
| **Ctrl+Shift+M** | Versions of the selected text |
| **Ctrl+Shift+C** | Critique the section (the whole essay is in the Assistant menu) |
| **Ctrl+Shift+A** | Chat about the essay |
| **Ctrl+Shift+O** | Reorder (cards, sentences, skeleton) |
| **Alt+↑ / ↓** | Move a card in Reorder |
| **Ctrl+F** | Find and replace |
| **Ctrl+;** | Check spelling |
| **Ctrl+Z** | Undo (big moves too) |
| **Ctrl+= / Ctrl+− / Ctrl+0** | Larger / smaller / normal text |
| **Ctrl+Shift+F** | Full screen |
| **Ctrl+Shift+T** | Typewriter scrolling |
| **Ctrl+,** | Goals & Settings |
| **Ctrl+E** | Email the draft to yourself |
| **Ctrl+Shift+I** | Import documents |
| **Ctrl+/** | See every shortcut |
| **Esc** | Close whatever is open, or go back to the shelf |

---

Thanks to Hugh Howey for NEO, which made all of this possible. Now go write: a draft doesn't have to be good. It just has to exist.
