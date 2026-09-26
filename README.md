# Mutiny

> *"Computers aren't the thing. They're the thing that gets us to the thing."*

**A distraction-free writer for essays — opinion and popular non-fiction — with an optional AI assistant that researches and critiques, but never touches your page without asking.**

Mutiny is a fork of [NEO](https://github.com/hughhowey/neo) by Hugh Howey, a lovely word processor built for novelists. Mutiny keeps what makes NEO great (a clean page, plain files on your disk, no accounts, no cloud) and retargets it at essays: outline-first structure, sources and citations, and an AI research & critique assistant.

> **Status:** early development. See [`prd.md`](prd.md) for the plan (in Spanish).

## Running from source

Requires [Node.js](https://nodejs.org).

```
git clone https://github.com/worldmutiny/mutiny.git
cd mutiny
npm install
npm start
```

Build a Linux AppImage with `npm run package:linux` (output in `dist/`).

Your essays live in `~/Documents/Mutiny Library` — separate from any NEO library, so both apps can be installed side by side.

## Credits

Mutiny stands on NEO, created by [Hugh Howey](https://hughhowey.com/neo/). NEO's original README is kept in [`NEO-README.md`](NEO-README.md). All of NEO's history is preserved in this repository.

## License

[MIT](LICENSE).
