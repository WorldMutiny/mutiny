# Security

Mutiny is a local app: your essays, notes and sources are plain files in your own library folder, and nothing leaves your computer unless you use the assistant or look up a source.

## API keys

- Keys are encrypted by your operating system's keychain (macOS Keychain, Windows DPAPI, Secret Service on Linux — GNOME Keyring, KWallet, KeePassXC) and kept in the app's data folder, never in your library.
- On Linux, Mutiny asks for the Secret Service explicitly, because Chromium otherwise falls back to a plain-text "basic" store on desktops it doesn't recognise (Hyprland, Sway…). **If no keychain is available, Mutiny refuses to store a key** rather than keep it in plain text; set the service's usual environment variable instead (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `CEREBRAS_API_KEY`).
- Keys never reach the interface: only the main process reads them, and only to call the service they belong to. Services with a key have a fixed address, so a key can't be redirected to another server; a key for a local or custom server is bound to that server's host, never sent over plain `http://` to another machine, and requests don't follow redirects.

## The assistant

- **Claude Code / Codex** run your own installed CLI with your own login. Every run is locked down: Claude Code gets only web search/fetch (research) or no tools at all, in `dontAsk` permission mode, without your Claude Code settings, hooks or MCP servers, and without saving a session; Codex runs with its shell and every other tool family disabled, read-only, ephemeral, without your config or rules. Both work in an empty scratch folder and receive a minimal environment (your login and proxy settings, not your other secrets). The assistant never writes files; it returns JSON and Mutiny decides what to keep.
- Text from your essay, and pages the assistant reads, are treated as data, not instructions. Model output is shown as text; only whitelisted values reach the page's markup, and links open in your browser (http/https only).

## The app

- The window loads only Mutiny's own files under a strict Content-Security-Policy (no remote scripts, no network access from the page), runs sandboxed with context isolation, never navigates away or opens windows, and grants no permissions beyond local fonts and clipboard writes.
- Every file request from the page is validated: ids are plain tokens, file names come from fixed lists, paths must stay inside the library.
- Source lookups refuse this computer and the local network (every redirect hop is checked).
- Pasted HTML is parsed in an inert document, so nothing in it runs or loads.
- Packaged builds disable Electron's run-as-Node mode, `NODE_OPTIONS` and `--inspect`, and load the app only from its archive.

## Reporting

Please report security issues privately to the maintainer through GitHub (a private security advisory on the repository) rather than a public issue.
