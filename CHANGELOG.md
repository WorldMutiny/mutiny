# Changelog

## 1.0.0 — first stable release

Everything from the 0.9 betas — essays and other texts with their templates, sources and citations, Reorder and Versions, the optional assistant that follows your template, My voice, six themes and the Omarchy edition — now considered stable. New since 0.9.0-beta.4:

- **A manual inside the app:** Help → Manual (F1) opens the whole manual in its own window, laid out like Omarchy's — chapters on the left, one at a time, in your theme's colours, in English or Spanish, offline.
- **A shorter, friendlier first run:** six steps with a progress indicator and a Back button; theme and typeface together in "How it looks"; the Omarchy theme only offered where Omarchy is installed; the assistant step names every provider; it ends with "Start my first text".
- **My voice** stays one quiet line until you add a text.
- **Template sections** show their guiding question as a grey heading in the draft until you give them a title.
- **Help (Ctrl+/)** covers the right-click menu, + New, the push-pin and F1; the chat offers a button to turn the assistant on; Goals & settings names the template in full ("Essay · Toulmin").
- **About** links to worldmutiny.com.
- Fixed: the Notes page's placeholder was in English in the Spanish interface.
- Builds run on Node 24 GitHub Actions.

## 0.9.0-beta.4

- **Types of text and templates:** + New asks what you're writing — an essay (Peterson, Dialectic, Toulmin, They say / I say, Pyramid SCQA, Exploratory, Five paragraphs), free writing (Free, Morning pages), a blog post (Opinion, How-to, List), a newsletter (Personal letter, Digest), a script (Long video, Short, Podcast) or a speech (Talk, Toast). Each form brings its own outline of guiding questions, and a text's form can be changed later in Goals & settings. Existing essays are Essay · Peterson.
- **Shelves by type:** + New files a text on the shelf for its type, making it the first time; the + on a shelf keeps it there. New shelves go in above My voice. The first run asks what you write and makes those shelves.
- **The bottom bar** shows reading time for blog posts and newsletters, and time out loud — against a target length — for scripts and speeches.
- **Details per type** in Goals & settings → This text: meta description and slug, email subject and preheader, target length.
- **Exports:** Markdown for a website (with front matter for Astro, Hugo, Jekyll…), Copy with formatting to paste into WordPress, Ghost, Medium or Substack, and a large-type PDF to read scripts and speeches aloud from.
- **The assistant follows the template:** each type and form gets its own critique (Toulmin's claim, grounds and warrant; a blog's hook and call to action; a script's hook, pacing and how it sounds out loud…); in Exploratory and Free writing it asks questions instead of correcting; Versions and the Chat know what kind of text it is.
- The interface says "text" instead of "essay" wherever it means any kind of text.

## 0.9.0-beta.3

- **Themes:** six looks — Mutiny, BlackGold, Black Arch, Matrix, Tokyo Night and City 783 (from Omarchy palettes, with Mutiny's typefaces) — plus "follow Omarchy" on Linux. Pick one when you first open Mutiny, in Goals & settings, or in View → Theme. Paper stays white.
- **Brighter interface** is now on by default, with a check mark in the View menu.
- The Assistant menu shows its shortcuts like every other menu.
- The pull tabs on the edges are bigger and wear the theme's accent; pinning the right pane is a push-pin that shows whether it's pinned.
- Notes sent to the Notes page are kept one blank line apart.
- **Right-click menu** in the Draft: cut, copy and paste, add a mark, cite a source, send to Later, and the assistant's actions — each with its shortcut — plus spelling suggestions. Add a mark and Cite a source are also in the Edit menu.
- A new mark opens its note in the right pane, ready to write in.
- Restoring from Later no longer drops a passage into the *** line when it had been cut from the start of a paragraph.

## 0.9.0-beta.2

- **New look:** Mutiny's own look uses the Aetheria palette — deep violet background, teal text, red accent — and the Night page follows it (Paper stays white). The themed menu bar is now used in both looks on Linux and Windows.
- **New icon:** a pixel-art M, on every platform.
- **Roomier settings:** Goals & settings and Assistant settings are laid out in sections.
- **Notes pane:** filters always visible, notes show which section they belong to, long critiques fold, your own notes grow as you type, resolved notes are kept (reopen or delete them; Ctrl+Z brings the mark back), and clicking a ✦ or ⚑ points out its note.
- **Panes:** both side panes push the page instead of covering it; pull tabs on the edges show they are there (the right one counts open notes); Ctrl+[ and Ctrl+] toggle them.
- **Assistant:** Versions highlight the words the assistant changed; Research explains when the provider has no web access; research answers can be cited or saved to Sources; chat answers can be inserted where you were writing.
- Smaller fixes across the bottom bar, help and keyboard focus.

## 0.9.0-beta.1 — first public beta

Mutiny, an essay writer built on NEO by Hugh Howey.

- **Essays, not novels:** one continuous page with sections, an outline built on the Peterson method, "Later" for cut passages, Spanish and English interface and spellcheck.
- **Sources and citations:** paste a URL, DOI or ISBN; cite with Ctrl+Shift+K; numbered citations and a Sources list in every export.
- **Reorder** paragraphs and sentences, with a skeleton view of your argument (Ctrl+Shift+O).
- **Versions** of a passage side by side (Ctrl+Shift+M), yours and the assistant's.
- **Optional assistant** on Claude Code, Codex, the Anthropic API or any OpenAI-compatible server: research marked facts, critique the argument, chat about the essay — with visible progress and a Stop button.
- **My voice:** the assistant studies your own texts and writes your style profile (`estilo.md`), which Versions and the Chat follow.
- **Omarchy edition:** on Omarchy the interface follows your desktop theme live.
- Builds for Linux, Windows and macOS (unsigned), and a once-a-day check for new versions.
