# How to use Mutiny

*[Leer en español](TUTORIAL_ES.md)*

Mutiny is a word processor for **essays** — opinion and popular non-fiction — **and other texts**: blog posts, newsletters, video or podcast scripts, and speeches. It's built on [NEO](https://github.com/hughhowey/neo) by Hugh Howey. From NEO it keeps what matters: a clean page, plain files on your computer, no accounts, no cloud. On top of that it adds templates that give your writing a structure, sources and citations, tools to reorder and rewrite, and an **optional** AI assistant that researches, critiques and asks questions but never touches your text unless you accept.

> On a Mac, read **⌘** wherever this tutorial says **Ctrl**. Press **Ctrl+/** at any time to see every shortcut.

*(NEO's original tutorial is kept in [NEO-TUTORIAL.md](NEO-TUTORIAL.md).)*

---

## 1. Install

Download the version for your system from [Releases](https://github.com/worldmutiny/mutiny/releases). The [README](README.md#download) explains how to open it the first time: the builds aren't signed with paid Apple or Microsoft certificates.

## 2. The first time

Mutiny asks a few questions, once, in six steps (the dots at the top show where you are, and **← Back** takes you back). You can change all of it later in **File → Goals & Settings…** (Ctrl+,):

1. **Language** of the interface: English or Spanish.
2. **Who you are and how you write**: your name, which goes on every text and export, and an optional pen name. And whether:
   - *I discover by writing*: new texts open on a blank page.
   - *I start from an outline*: they open in the **Outline**, with their template's guiding questions.
3. **What do you write?**: tick the kinds of text you write — essay, free writing, blog, newsletter, script, speech — and each gets its own shelf. You can write any of them later even if you don't tick it.
4. **How it looks**: the theme (the colours of the whole app, see [§ 14](#14-how-it-looks)) and your page's typeface, from a sample that shows exactly what you'll see.
5. **The assistant**, if you want one (see [§ 11](#11-the-assistant-optional)).
6. **Your voice**: if you have texts of your own, add them so the assistant can learn how you write (see [§ 12](#12-my-voice-have-the-assistant-write-like-you)). You can skip this.

At the end you can **start your first text** right away or go to your shelves. This manual is always at hand in **Help → Manual** (F1).

## 3. The shelf

- **+ New**, at the top right, starts a text: you pick its type and its form (see [§ 4](#4-types-of-text-and-templates)), and it goes to the shelf for its type. If you don't have a blog shelf yet, for example, Mutiny makes one and tells you.
- The **+** inside a shelf starts a text **on that shelf**.
- **+ Shelf** adds a general-purpose shelf that takes any type. New shelves go in above *My voice*. Rename one by clicking its name, and reorder shelves by dragging their ⠿.
- Drag texts to reorder them or move them between shelves.
- **Right-click a text** to:
  - set a word goal (a small progress bar appears on the cover);
  - change the cover;
  - copy it to *My voice*;
  - remove it from the shelf or move it to the trash.
- **Covers**: every text gets an abstract cover generated from its title. **↻** gives it another one. You can also drag an image onto a text to make it the cover.
- **Pen names**: click your name at the top right to add another author name with its own shelves, and switch between them.
- **Import** (Ctrl+Shift+I, or drag files onto a shelf): `.docx`, `.txt` and `.md` documents. In Markdown, `#` is the title and `##` starts a section.

## 4. Types of text and templates

Every text has a **type** and a **form**. Together they are its template, which decides four things: the **outline** and its guiding questions, **what the bottom bar measures**, **what the assistant looks for**, and the text's **extra details**. A template never touches what you've written.

| Type | Forms | The bar measures |
|---|---|---|
| **Essay** | Peterson · Dialectic · Toulmin · They say / I say · Pyramid (SCQA) · Exploratory · Five paragraphs | words |
| **Free writing** | Free · Morning pages (a 750-word goal) | words |
| **Blog post** | Opinion · How-to · List | words and reading time |
| **Newsletter** | Personal letter · Digest | words and reading time |
| **Script** | Long video · Short (≤60 s) · Podcast | minutes out loud, against your target length |
| **Speech** | Talk · Toast | minutes out loud, against your target length |

The essay forms, briefly:

- **Peterson**: ten-odd sentences first, then a paragraph for each.
- **Dialectic**: thesis, antithesis, synthesis — for divisive topics.
- **Toulmin**: claim, grounds, warrant, limits, rebuttal — the soundest argument.
- **They say / I say**: start from what others say, then take your stand.
- **Pyramid (SCQA)**: situation, complication, question, answer — short and to the point.
- **Exploratory**: write to find out what you think; the assistant asks instead of correcting.
- **Five paragraphs**: introduction, three arguments, conclusion — the classic.

**Goals & Settings → Type of text** changes the form of a text you've already started. **This text** holds the details its type keeps:

- **Blog post**: meta description and slug.
- **Newsletter**: email subject and preheader.
- **Script and speech**: target length.

## 5. Writing

Type the title, press Enter, and start.

- **Enter twice**: a `***` break inside the section.
- **Enter three times**: a **new section**. A text is one continuous page: sections follow one another, each with an optional title. A section without a title is marked with a quiet §.
- `--` becomes an em dash (—), `...` an ellipsis (…), and quotes curl themselves (“ ”).
- **Right-click** in the draft:
  - always: cut, copy, paste, add a mark and cite a source;
  - with text selected, also: send it to *Later*;
  - with the assistant on: versions, critique the section and ask in the chat.

  Every option shows its shortcut, so you pick them up as you go. On a misspelled word, its suggestions come first.
- **Spelling doesn't nag you while you write.** When you want to check it, press **Ctrl+;**: doubtful words are underlined, and right-clicking one gives suggestions. Press Ctrl+; again to turn it off. Each text has its own language for spelling and exports (in Goals & Settings).
- **Find and replace**: Ctrl+F.
- **Undo** big moves too (deleting a section, replace all, sending a passage to *Later*, reordering): Ctrl+Z while you're not typing.

## 6. Mark it and keep going

Missing a fact, a figure, a source? Press **Ctrl+Shift+X**, or use the right-click menu or **Edit → Add a Mark (Note)**. Mutiny leaves a ⚑ mark in the text and opens its note in the right pane, **In the text**, ready to write in. Click back in the text and keep going. The left pane shows a red dot on every section with open notes.

With the assistant on, you can **Research** a mark: it looks the fact up and brings back sources (see [§ 11](#11-the-assistant-optional)). **Resolving** a note doesn't delete it: it moves to *Resolved*, and you can reopen it. **→ Notes** copies it to the Notes tab, one blank line apart from the last.

## 7. The panes and the tabs

The screen stays clear until you need something:

- **Left pane** (Ctrl+[, the ☰ tab on the edge, or move the mouse to the edge): the list of sections, with their word counts and a short note on what each one does. Drag them to reorder. The **▸** unfolds the first sentence of every paragraph; click one to go there.
- **Right pane** (Ctrl+], the ⚑ tab, or move the mouse to the edge): *In the text* (your marks and the assistant's comments) and the *Chat*. The tab on the edge shows how many notes are open. The **push-pin** keeps it open: tilted, the pane closes by itself; upright and coloured, it stays.
- Both panes **push the page aside** instead of covering it.
- **Tabs along the bottom**:
  - **Draft**: the text.
  - **Notes**: a free page for loose ideas.
  - **Outline**: the structure.
  - **Sources**: your references.
  - **Later**: what you cut.

  Double-click a tab to rename it.
- **Counters**: one click switches between the whole text's words and this section's.

## 8. The Outline

First say, in one sentence, what each section and each paragraph will do — then write it. That's Jordan Peterson's method, and every template works that way.

- The top says which template the text follows. While the text is empty, **Use the … outline** fills in its form's guiding questions.
- Each numbered line is a **section**, and the indented lines are its **paragraphs**.
  - Enter makes a new line.
  - Tab turns an empty section line into a paragraph of the one above; Shift+Tab does the reverse.
  - Backspace on an empty line removes it.
- What you write in the Outline appears in the Draft as a **ghost paragraph**, grey and italic, in its place. That guide sentence waits there for you to turn it into prose.

## 9. Sources and citations

In the **Sources** tab:

- **Paste a URL, a DOI or an ISBN** and press Add. Mutiny fetches only the title, author, site and date (from the page, Crossref or Open Library). You review them and save. You can also *Add one by hand*.
- **Cite** with Ctrl+Shift+K:
  - with words selected, those words become the citation, underlined and numbered;
  - with nothing selected, a **[n]** mark goes in at the cursor.
- Numbers follow the order of first appearance and update themselves.
- **When you export**, PDF, Word and plain text carry superscript numbers and a **Sources** list at the end; Markdown and HTML also carry the link.
- Sources the assistant finds arrive as **candidates**. They can only be cited once you accept them.

## 10. Reorder and rewrite

**Reorder** (Ctrl+Shift+O, or the ⇅ button at the bottom left) turns the draft into cards, one per paragraph:

- **Drag** the cards, or use **Alt+↑/↓**, across sections too.
- **Double-click** a card to see its **sentences** and reorder them.
- **Skeleton**: only the first sentence of each paragraph. Read on its own, it should tell your argument.
- **Enter** opens that paragraph in the draft, and **Esc** goes back.

**Versions** (select a passage and press Ctrl+Shift+M):
- The original sits at the top. Below it you write alternatives, and you can edit them in the list.
- If the assistant is on, **Ask the assistant** adds its own, each with a line on why and the words it changed highlighted.
- Pick one with **Use this**. The original and the versions you didn't use are kept in **Later**; untick the box if you don't want them.

**Later**: instead of deleting a passage you like, select it and press **Ctrl+Shift+D**, or drag it onto the *Later* tab. It leaves the text but isn't lost, and you can **restore** it to the exact spot it came from.

## 11. The assistant (optional)

Turn it on in **Assistant → Assistant Settings…** and choose what it runs on:

| Provider | What you need |
|---|---|
| **Claude Code** | Claude Code installed and logged in (your Claude plan) |
| **Codex** | The Codex CLI logged in with ChatGPT |
| **Anthropic API** | An API key |
| **OpenAI-compatible** | An API key or a local server: OpenAI, Gemini, OpenRouter, Cerebras, Ollama, llama.cpp… (no web search) |

What it can do:

- **Research a ⚑ mark**: in the *In the text* pane, press **Research**. It searches the web, answers with the fact and brings back **candidate sources**, each with the exact quote that proves it. **Cite here** accepts one and places it by the mark; **Save to Sources** just keeps it.
- **Critique**: Ctrl+Shift+C for the section you're in; *Critique the Whole Text* is in the Assistant menu. You get 3 to 7 remarks, shown as ✦ in the text and in the pane. What it looks for **depends on the template**:
  - an essay: thesis, logic, evidence and the missing counterargument (in Toulmin: claim, grounds, warrant, limits and rebuttal);
  - a blog post: the hook, the structure and the call to action;
  - a script or a speech: whether it works **by ear**, the pacing, and the opening or the ending.
- **Questions instead of critique**: in an *Exploratory* essay and in *Free writing*, the assistant doesn't correct. It leaves 3 to 7 open questions to take your thinking further.
- **Versions** of a passage, inside the Versions window (see [§ 10](#10-reorder-and-rewrite)). For scripts and speeches it proposes lines that are easy to say out loud.
- **Chat** about your text (Ctrl+Shift+A): it sees the current text, the outline and your notes, and knows what kind of text it is. If you select a passage first, the chat is about that passage. Any answer can be **inserted** where you were writing, or sent to your Notes (**→ Notes**).

While it works, a window shows **what it's doing** (what it searches, which page it reads), on how much text, with which provider, and for how many seconds. It has **Stop**. Critique and research also have **Keep writing**: the task goes on in the bottom bar and tells you when it's done. The chat shows its progress inside its own pane.

The assistant **never writes files or changes your text by itself**. It only receives what you ask it to work on, and only the service you chose receives it. Your API keys are encrypted by your system's keychain. Details in [SECURITY.md](SECURITY.md).

## 12. My voice: have the assistant write like you

The **◉ My voice** shelf keeps texts of yours so the assistant can learn your style:

- **Fill it** by importing texts (.docx, .md, .txt) or **copying** your own texts: drag them onto the shelf, or right-click → *Copy to My voice*. It's a frozen copy: your text stays where it is, and copying it again updates the copy.
- **The meter** tells you how much material there is and what to expect:
  - under 2,000 words is very little;
  - 5,000–10,000 is enough for a good first profile;
  - 15,000 or more, on varied topics, makes it solid.
- **Analysis** shows what Mutiny measures without AI: sentence and paragraph length, rhythm, questions, person, punctuation, connectors and the phrases you repeat.
- **✦ Generate my style**: the assistant reads your texts and writes your profile (`estilo.md`, in your library folder). You review and correct it before it's saved.
- From then on, **Versions and the Chat write like you**. The *Use my style in Versions and the Chat* box turns it off.
- When you add more texts, **Update my style** redoes the profile. If you edited it by hand, it asks before replacing it.
- If a text has a lot of the assistant's writing left unchanged, copying it to *My voice* warns you and offers to leave those passages out, so your style doesn't learn from the AI.

## 13. Goals, sprints and the chart

In **Goals & Settings…** (Ctrl+, or click the "today" counter) you can:
- set a **daily goal** and a **goal per text**;
- start a word **sprint** and see the **chart of your last 30 days**;
- choose when your writing day ends (in case you write past midnight);
- set the type of text, the text's language and the interface's;
- pick the theme.

## 14. How it looks

- **Themes**: *Mutiny*, *BlackGold*, *Black Arch*, *Matrix*, *Tokyo Night* and *City 783*, based on Omarchy themes. Pick one in **View → Theme** or in **Goals & Settings**; the whole interface changes at once. They keep your typeface; the **Night** page takes their colours, and **Paper** stays white.
- **Format → Body Font**: Literata, Source Serif, Lora, EB Garamond, iA Writer Quattro and Duo — all bundled — or a font from your system. Size: Ctrl+= and Ctrl+−.
- **View → Page**: **Night** (dark sheet) or **Paper** (white sheet).
- **View → Brighter Interface**: on by default; untick it if you prefer fainter controls.
- **Page zoom**: Ctrl+mouse wheel, or the control at the bottom right.
- **Full screen**: Ctrl+Shift+F. **Typewriter scrolling**, which keeps the current line centred: Ctrl+Shift+T.

### On Omarchy

On [Omarchy](https://omarchy.org), the **Omarchy (system)** theme makes Mutiny's interface — shelves, panes, windows and the **menu bar** — take your theme's colours, font and square corners, and change **live** when you switch themes:

- With the page on **Night**, the sheet takes the theme's colours too and keeps your writing typeface. **Paper** gives you the white sheet.
- In the menu bar, **Alt** enters the menu; the arrows move, Enter picks and Esc leaves.
- `scripts/install-linux.sh` also adds a **Mutiny** row to the Omarchy menu.

## 15. Getting your text out

- **File → Export**: PDF, Word (.docx), web page (.html), Markdown and plain text. All of them carry your numbered citations and the Sources list. A script's or a speech's PDF comes out in large type, to read aloud from.
- **Markdown for a Website (with Front Matter)**: the text with its details on top (title, description, slug, author, date, language), ready for Astro, Hugo, Jekyll or Eleventy.
- **Copy with Formatting**: paste it into WordPress, Ghost, Medium or Substack and it keeps headings, bold and links. The title isn't included, since those editors have their own field for it.
- **Email Draft to Myself** (Ctrl+E): sends you a PDF stamped with the date and time and a digital fingerprint of the text. It's a backup, and a record that those words existed on that date. Set it up in *File → Email Settings…*.
- **Right-click a shelf's name → Export shelf as a collection…**: joins all its texts into one document with a table of contents.

## 16. Your files, safe

Everything saves by itself, constantly, into plain files in **Documents/Mutiny Library**: one folder per text, each section a file. You can open it, back it up or sync it however you like. Mutiny also makes a **daily copy** of the whole library in its *Backups* folder and keeps the last two weeks. If Mutiny vanished tomorrow, every word would still be there.

**New versions**: once a day Mutiny checks whether there's a newer version and tells you. To update, download it and install it over the old one; your texts are kept. You can turn the check off in Goals & Settings.

### What's kept, and where

| Where | What |
|---|---|
| **Documents/Mutiny Library** | Your texts (one folder per text: sections, notes, outline, sources, *Later* and that text's assistant chat), your style profile `estilo.md`, the daily copies (*Backups*), the "Email Draft" PDFs (*Exports*) and an error log (`neo-errors.log`, without your text) |
| **The app's folder** (Linux `~/.config/Mutiny`, Mac `~/Library/Application Support/Mutiny`, Windows `%APPDATA%\Mutiny`) | Your API keys in `secrets.json`, **encrypted by your system's keychain**; an empty working folder for the assistant (`ai-workspace`); and the window engine's own caches |

None of it is uploaded anywhere: Mutiny has no accounts, no cloud and no usage statistics.

### What leaves your computer

Mutiny's windows **cannot connect to the internet**. Data only leaves when you use one of these:

- **The assistant**: the text you ask it to work on goes to the service you chose (Claude Code → Anthropic, Codex → OpenAI, the Anthropic API, or the compatible service you set up). Mutiny keeps nothing in the cloud, and it runs Claude Code and Codex read-only and **without saving the conversation**. What each provider does with your text — whether it keeps it, for how long, whether it trains on it — **depends on its policy and your account settings**; check with them. With Ollama or llama.cpp on your own machine, nothing leaves.
- **Looking up a source** (URL, DOI or ISBN): asks that page, Crossref, Open Library or Google Books for its details. Never your computer or your local network.
- **The update notice**: once a day it reads the public list of releases on GitHub, sending nothing of yours. Turn it off in Goals & Settings.
- **Email Draft** and **links**: they open in your email or your browser; what gets sent, you send.

Processes Mutiny starts on your system: the **Claude Code** or **Codex** program, only while the assistant works with them; on Omarchy, the commands that read your theme (`omarchy-theme-color`, `omarchy-font-current`); on a Mac, *osascript* to open Mail. Nothing else.

## 17. What was taken out of NEO (and why)

Mutiny is a fork: it grew out of NEO, which is made for novelists. This is what it left behind:

| In NEO | In Mutiny | Why |
|---|---|---|
| **AI-painted covers** (OpenAI illustrated a cover from your text, with your API key) | Only abstract covers made locally, or your own image | They matter less for essays, cost money, and sent your text to an image service. Mutiny's AI is focused on research, critique and rewriting |
| **EPUB export** | Removed | Meant for publishing novels on Amazon; NEO flagged it as barely tested |
| **Drop caps** (the big first letter of each chapter) | Removed, also from the first-run questions | A book look; a text is one continuous page |
| **Numbered chapters on separate sheets** | **Sections** on one continuous page | That's how an essay is read and written |
| **"Darlings"** | **Later**, which also keeps unused versions | The same idea, with more uses |
| *Pantser / plotter* | *I discover by writing / I start from an outline* | The same idea, with essay, blog, script and speech templates instead of a novel's |
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

## 18. Shortcuts

| Shortcut | What it does |
|---|---|
| **Enter ×2 / ×3** | `***` break / new section |
| **Ctrl+Shift+X** | Leave a ⚑ mark (opens its note) |
| **Ctrl+Shift+D** | Send the selected passage to *Later* |
| **Ctrl+Shift+K** | Cite a source |
| **Ctrl+Shift+M** | Versions of the selected text |
| **Ctrl+Shift+C** | Critique the section (or questions, in exploratory and free writing) |
| **Ctrl+Shift+A** | Chat about the text |
| **Ctrl+Shift+O** | Reorder (cards, sentences, skeleton) |
| **Alt+↑ / ↓** | Move a card in Reorder |
| **Ctrl+[ / Ctrl+]** | Sections pane / In the text pane |
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
