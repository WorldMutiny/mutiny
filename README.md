<p align="center"><img src="brand/mutiny-logo.svg" alt="Mutiny" width="520"></p>

<h1 align="center">Mutiny</h1>

> *"Computers aren't the thing. They're the thing that gets us to the thing."*

**A distraction-free writer for essays — opinion and popular non-fiction — and other texts (blog posts, newsletters, scripts, speeches), with an optional AI assistant that researches, critiques and asks questions, but never touches your page without asking.**

Mutiny is built on [NEO](https://github.com/hughhowey/neo) by Hugh Howey, a lovely word processor made for novelists. It keeps what makes NEO great — a clean page, plain files on your disk, no accounts, no cloud — and retargets it at essays and other non-fiction: templates for seven essay methods plus blog posts, newsletters, scripts and speeches, sources and citations, reordering, versions of a sentence, six themes, and an assistant that adapts to what you're writing and can learn your voice.

**New here?** The [tutorial](TUTORIAL.md) walks through everything ([en español](TUTORIAL_ES.md)).

> **Status: 1.0.** The first stable release. If something breaks, please [report it](https://github.com/worldmutiny/mutiny/issues).

**Español:** Mutiny es un procesador de textos para ensayos (opinión y divulgación) y otros textos —blog, newsletter, guiones, discursos—, con la interfaz en español e inglés. Abajo están las instrucciones de instalación, y en [TUTORIAL_ES.md](TUTORIAL_ES.md) cómo usar todo.

## Download

Get the latest version from [Releases](https://github.com/worldmutiny/mutiny/releases).

The builds are **not signed** with paid Apple or Microsoft certificates, so your system will ask once before opening Mutiny:

| System | File | First time |
|---|---|---|
| **Windows** | `Mutiny-…-windows-setup.exe` (or the `portable` one) | SmartScreen says "Windows protected your PC": click **More info → Run anyway**. |
| **macOS** (Apple Silicon: `arm64`, Intel: `x64`) | `Mutiny-…-mac-arm64.dmg` | Drag Mutiny to Applications. The first time, **right-click the app → Open → Open**. If macOS says it's "damaged", run `xattr -cr /Applications/Mutiny.app` in Terminal once. |
| **Linux** | `Mutiny-…-linux-x86_64.AppImage` | `chmod +x` it and run it — or, from a clone, `scripts/install-linux.sh` to install it with a launcher entry. |

Mutiny checks once a day whether a newer version exists (it reads the public list of releases; you can turn this off in **File → Goals & settings**). It doesn't update itself: download the new version and install it over the old one — your texts are kept.

### On Omarchy

On [Omarchy](https://omarchy.org), Mutiny follows your desktop theme — colours, font and square corners — and changes with it live, including its menu bar. The writing typefaces stay yours. `scripts/install-linux.sh` also adds a **Mutiny** row to the Omarchy menu. Prefer another look? **View → Theme**.

## Your files

Your texts live in `Documents/Mutiny Library`, one folder per text, as plain HTML and JSON you can open, sync or back up. Mutiny keeps a daily backup of the library in its `Backups` folder.

What leaves your computer — and only when you use it:

- **The assistant**, if you turn it on: the text it works on goes to the service you chose.
- **Source lookup**: when you paste a URL, DOI or ISBN, Mutiny fetches that page's metadata (or asks Crossref / Open Library).
- **The daily version check**, described above.

Nothing else: no accounts, no analytics, no telemetry.

## The assistant (optional)

Mutiny can research the facts you mark, critique your argument, offer versions of a sentence, chat about your essay, and write a profile of your style from your own texts (**My voice** shelf). It never writes files and never changes your text unless you accept a suggestion. Turn it on in the **Assistant** menu and pick what it runs on:

- **Claude Code** — your own install and Claude plan, through the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview). Install it with Anthropic's native installer (on Windows, the `npm` install isn't supported by Mutiny).
- **Codex** — OpenAI's Codex CLI on your ChatGPT plan.
- **Anthropic API** — an API key.
- **OpenAI-compatible** — OpenAI, Google Gemini (AI Studio key), OpenRouter, Cerebras, Ollama, llama.cpp… (no web research).

API keys are encrypted by your system's keychain and only sent to their own service. See [SECURITY.md](SECURITY.md) for how the assistant is locked down.

The Claude Agent SDK is © Anthropic and licensed under [Anthropic's terms](https://code.claude.com/docs/en/legal-and-compliance), not MIT. Mutiny doesn't bundle the Claude Code binary; it uses the one you already have.

## Running from source

Requires [Node.js](https://nodejs.org) 22.

```
git clone https://github.com/worldmutiny/mutiny.git
cd mutiny
npm install
npm start
```

`npm run package:linux` builds an AppImage in `dist/`. Tagging `vX.Y.Z` on GitHub builds all three systems (see `.github/workflows/build.yml`). The product plan and the decisions behind it are in [`prd.md`](prd.md) (in Spanish).

## Contact

Maxx Darko · [worldmutiny.com](https://worldmutiny.com) · mutiny@worldmutiny.com

Bugs and ideas: [Issues](https://github.com/worldmutiny/mutiny/issues). Security problems: see [SECURITY.md](SECURITY.md).

## Credits

Mutiny stands on NEO, created by [Hugh Howey](https://hughhowey.com/neo/); NEO's original README and tutorial are kept in [`NEO-README.md`](NEO-README.md) and [`NEO-TUTORIAL.md`](NEO-TUTORIAL.md) and its history is preserved in this repository. Bundled typefaces (Literata, Source Serif 4, Lora, EB Garamond, iA Writer Quattro/Duo and the cover faces) are under the SIL Open Font License.

## License

[MIT](LICENSE).
