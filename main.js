// Mutiny — main process (fork of NEO by Hugh Howey)
// Owns the window and all file-system access. The renderer talks to this
// through the IPC handlers below (see preload.js for the exposed API).

const { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// macOS Chromium's "smart delete" also removes whitespace around a deleted
// selection, and that pass can duplicate characters. Deletes stay literal.
app.commandLine.appendSwitch('blink-settings', 'smartInsertDeleteEnabled=false');

// On Linux, Chromium only uses the Secret Service keychain on desktops it
// recognises; elsewhere (Hyprland, Sway…) it silently falls back to plain
// obfuscation. Ask for the keychain explicitly unless the user chose one.
if (process.platform === 'linux' && !app.commandLine.hasSwitch('password-store')) {
  const kde = /kde/i.test(process.env.XDG_CURRENT_DESKTOP || '');
  app.commandLine.appendSwitch('password-store', kde ? 'kwallet6' : 'gnome-libsecret');
}

// development/test runs keep their app data apart from the real install
if (process.env.MUTINY_USER_DATA) app.setPath('userData', process.env.MUTINY_USER_DATA);

// ---------------------------------------------------------------------------
// Library location: a folder of plain files the user can inspect, sync, back up.
// ---------------------------------------------------------------------------
// Resolved properly at startup via app.getPath('documents') — this default
// covers any early access and non-redirected setups.
let LIBRARY_DIR = path.join(os.homedir(), 'Documents', 'Mutiny Library');
let LIBRARY_FILE = path.join(LIBRARY_DIR, 'library.json');

function ensureLibrary() {
  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  if (!fs.existsSync(LIBRARY_FILE)) {
    const seed = {
      authorName: '',
      penNames: [],
      firstRunDone: false,
      pageTheme: 'night',
      shelves: [{ id: 'shelf-1', name: '', nameKey: 'shelf.inProgress', bookIds: [] }]
    };
    fs.writeFileSync(LIBRARY_FILE, JSON.stringify(seed, null, 2));
  }
}

// Every path the renderer names is checked here: ids are plain tokens (no
// slashes, dots or '..'), per-book file names come from fixed lists, and the
// result must sit directly inside the library. A compromised page can't
// reach a file outside it.
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,120}$/;
const AUX_NAMES = new Set(['notes', 'outline']);
const JSON_NAMES = new Set(['stickies', 'darlings', 'sources', 'chat']);

function bookDir(bookId) {
  if (!ID_RE.test(String(bookId))) throw new Error('invalid essay id');
  const dir = path.join(LIBRARY_DIR, bookId);
  if (path.dirname(dir) !== path.resolve(LIBRARY_DIR)) throw new Error('invalid essay id');
  return dir;
}

function chapterFile(bookId, chapterId) {
  if (!ID_RE.test(String(chapterId))) throw new Error('invalid section id');
  return path.join(bookDir(bookId), 'chapters', chapterId + '.html');
}

function auxFile(bookId, name) {
  if (!AUX_NAMES.has(name)) throw new Error('invalid file name');
  return path.join(bookDir(bookId), name + '.html');
}

function jsonFile(bookId, name) {
  if (!JSON_NAMES.has(name)) throw new Error('invalid file name');
  return path.join(bookDir(bookId), name + '.json');
}

// A human-readable map of the library, regenerated on every change:
// which folder is which book, and what shelf it lives on. Sorts to the
// top of the folder so browsing writers can always find their way.
function writeCatalog() {
  try {
    const lib = readJSON(LIBRARY_FILE, { shelves: [] });
    const onShelf = {};
    for (const s of lib.shelves || []) {
      for (const id of s.bookIds) onShelf[id] = s.name || mt(s.nameKey || 'shelf.new');
    }
    const lines = [];
    for (const d of fs.readdirSync(LIBRARY_DIR)) {
      if (!d.startsWith('book-')) continue;
      try {
        const m = JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, d, 'book.json'), 'utf8'));
        lines.push(`${m.title || 'Untitled'}  —  ${d}  —  shelf: ${onShelf[m.id] || '(none — removed from shelves)'}`);
      } catch { /* not a valid book folder */ }
    }
    lines.sort((a, b) => a.localeCompare(b));
    fs.writeFileSync(path.join(LIBRARY_DIR, '_catalog.txt'),
      'MUTINY LIBRARY CATALOG — which folder is which book\n' +
      '(regenerated automatically; edits here do nothing)\n\n' +
      lines.join('\n') + '\n');
  } catch (err) {
    logError('catalog', err);
  }
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file); // atomic-ish: never leave a half-written file
}

// ---------------------------------------------------------------------------
// Interface language: locales/<lang>.json, English as the fallback. The
// library remembers the choice; before there is one, the OS locale decides.
// ---------------------------------------------------------------------------
const LANGS = ['en', 'es'];
const localeCache = {};

function loadLocale(lang) {
  if (!localeCache[lang]) {
    localeCache[lang] = readJSON(path.join(__dirname, 'locales', lang + '.json'), {});
  }
  return localeCache[lang];
}

function uiLanguage() {
  const chosen = readJSON(LIBRARY_FILE, {}).language;
  if (LANGS.includes(chosen)) return chosen;
  let sys = 'en';
  try { sys = app.getLocale() || 'en'; } catch { /* before ready */ }
  return sys.toLowerCase().startsWith('es') ? 'es' : 'en';
}

// main-process strings (menus, dialogs)
let MAIN_LANG = 'en';
function mt(key, vars) {
  let s = loadLocale(MAIN_LANG)[key];
  if (s == null) s = loadLocale('en')[key];
  if (s == null) return key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}

// the renderer asks with no argument at startup, and with a language when
// the writer switches — which also rebuilds the menus
ipcMain.handle('i18n:load', (_e, lang) => {
  const next = LANGS.includes(lang) ? lang : uiLanguage();
  if (next !== MAIN_LANG) {
    MAIN_LANG = next;
    try { buildMenu(); } catch (err) { logError('menu', err); }
  }
  const all = {};
  for (const l of LANGS) all[l] = loadLocale(l);
  return { lang: next, strings: all[next], fallback: all.en, all };
});

// ---------------------------------------------------------------------------
// IPC — the renderer's whole view of the disk
// ---------------------------------------------------------------------------

ipcMain.handle('library:read', () => {
  ensureLibrary();
  return readJSON(LIBRARY_FILE, null);
});

let menuBright = true;
let menuTheme = 'auto';
// View → Theme (the looks themselves live in theme.js)
const MENU_THEMES = [
  { id: 'auto' }, { id: 'mutiny', name: 'Mutiny' }, { id: 'blackgold', name: 'BlackGold' },
  { id: 'black-arch', name: 'Black Arch' }, { id: 'matrix', name: 'Matrix' },
  { id: 'tokyo-night', name: 'Tokyo Night' }, { id: 'city-783', name: 'City 783' }
];
ipcMain.handle('library:write', (_e, data) => {
  ensureLibrary();
  writeJSON(LIBRARY_FILE, data);
  writeCatalog();
  // the View menu shows "Brighter Interface" and the theme as checks — keep them in step
  if ((data && data.uiBright !== false) !== menuBright || ((data && data.appearance) || 'auto') !== menuTheme) {
    try { buildMenu(); } catch (err) { logError('menu', err); }
  }
  return true;
});

// A book is a folder: book.json + chapters/*.html + notes.html + outline.html + darlings.json
ipcMain.handle('book:create', (_e, meta) => {
  ensureLibrary();
  // folders carry a slug of the title when it's known at creation (imports),
  // so the library reads like a bookshelf in Finder too
  const slug = String(meta.title || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  const id = 'book-' + (slug ? slug + '-' : '') +
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const dir = bookDir(id);
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  const book = {
    id,
    title: meta.title || 'Untitled',
    subtitle: '',
    series: '',
    author: meta.author || 'Anonymous',
    wordGoal: 0,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    chapterOrder: [],
    tabNames: {} // renamed tabs only; defaults come from the interface language
  };
  writeJSON(path.join(dir, 'book.json'), book);
  fs.writeFileSync(path.join(dir, 'notes.html'), '');
  fs.writeFileSync(path.join(dir, 'outline.html'), '');
  writeJSON(path.join(dir, 'darlings.json'), []);
  writeJSON(path.join(dir, 'stickies.json'), []);
  return book;
});

ipcMain.handle('book:readMeta', (_e, bookId) => {
  return readJSON(path.join(bookDir(bookId), 'book.json'), null);
});

ipcMain.handle('book:writeMeta', (_e, bookId, meta) => {
  meta.modified = new Date().toISOString();
  writeJSON(path.join(bookDir(bookId), 'book.json'), meta);
  writeCatalog();
  return true;
});

ipcMain.handle('chapter:read', (_e, bookId, chapterId) => {
  const file = chapterFile(bookId, chapterId);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
});

ipcMain.handle('chapter:write', (_e, bookId, chapterId, html) => {
  const file = chapterFile(bookId, chapterId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, String(html));
  return true;
});

ipcMain.handle('chapter:delete', (_e, bookId, chapterId) => {
  const file = chapterFile(bookId, chapterId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return true;
});

ipcMain.handle('aux:read', (_e, bookId, name) => {
  const file = auxFile(bookId, name);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
});

ipcMain.handle('aux:write', (_e, bookId, name, html) => {
  fs.writeFileSync(auxFile(bookId, name), String(html));
  return true;
});

ipcMain.handle('json:read', (_e, bookId, name, fallback) => {
  return readJSON(jsonFile(bookId, name), fallback);
});

ipcMain.handle('json:write', (_e, bookId, name, data) => {
  writeJSON(jsonFile(bookId, name), data);
  return true;
});

ipcMain.handle('book:delete', async (_e, bookId, title) => {
  const dir = bookDir(bookId); // validated before anything is shown or touched
  if (!fs.existsSync(path.join(dir, 'book.json'))) return false; // only ever an essay folder
  const win = BrowserWindow.getFocusedWindow();
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: [mt('dialog.cancel'), mt(process.platform === 'win32' ? 'dialog.recycle' : 'dialog.trash')],
    defaultId: 0,
    cancelId: 0,
    message: mt('dialog.trashQuestion', { title: String(title).slice(0, 200) }),
    detail: mt('dialog.trashDetail')
  });
  if (response === 1) {
    const { shell } = require('electron');
    try {
      await shell.trashItem(bookDir(bookId));
      return true;
    } catch (err) {
      // Some filesystems have no Trash (network mounts, odd drives).
      // Words are never lost: leave the book alone and show the writer where it lives.
      logError('trash', err);
      shell.showItemInFolder(bookDir(bookId));
      dialog.showMessageBox(win, {
        message: mt('dialog.trashFailed'),
        detail: mt('dialog.trashFailedDetail')
      });
      return false;
    }
  }
  return false;
});

// ---------------------------------------------------------------------------
// Cover art: images live inside the book's folder, so covers travel with
// the library. Timestamped filenames sidestep every caching gremlin.
// ---------------------------------------------------------------------------

const COVER_EXTS = ['png', 'jpg', 'jpeg', 'webp'];

ipcMain.handle('library:path', () => LIBRARY_DIR);

// estilo.md: the writer's style, a plain file at the library root so the same
// profile works from Claude Code in a terminal. One fixed name, never a path
// from the renderer.
const STYLE_FILE = () => path.join(LIBRARY_DIR, 'estilo.md');
const STYLE_MAX = 200000;
function readStyle() {
  try { return fs.readFileSync(STYLE_FILE(), 'utf8').slice(0, STYLE_MAX); } catch { return ''; }
}
ipcMain.handle('style:read', () => readStyle());
ipcMain.handle('style:write', (_e, text) => {
  ensureLibrary();
  const tmp = STYLE_FILE() + '.tmp';
  fs.writeFileSync(tmp, String(text || '').slice(0, STYLE_MAX));
  fs.renameSync(tmp, STYLE_FILE());
  return true;
});

ipcMain.handle('cover:pick', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: mt('dialog.pickCover'),
    properties: ['openFile'],
    filters: [{ name: mt('dialog.images'), extensions: COVER_EXTS }]
  });
  return canceled || !filePaths.length ? null : filePaths[0];
});

function clearCovers(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (/^cover-\d+\./.test(f)) fs.unlinkSync(path.join(dir, f));
  }
}

ipcMain.handle('cover:set', (_e, bookId, srcPath) => {
  const ext = path.extname(srcPath).toLowerCase().replace('.', '');
  if (!COVER_EXTS.includes(ext)) return null;
  const dir = bookDir(bookId);
  if (!fs.existsSync(dir)) return null;
  clearCovers(dir);
  const fname = 'cover-' + Date.now() + '.' + (ext === 'jpeg' ? 'jpg' : ext);
  fs.copyFileSync(srcPath, path.join(dir, fname));
  return fname;
});

ipcMain.handle('cover:remove', (_e, bookId) => {
  const dir = bookDir(bookId);
  if (fs.existsSync(dir)) clearCovers(dir);
  return true;
});

ipcMain.handle('cover:read', (_e, bookId, fname) => {
  try {
    if (!/^(cover|art)-\d+\.(png|jpg|webp)$/.test(fname)) return null;
    const buf = fs.readFileSync(path.join(bookDir(bookId), fname));
    const ext = path.extname(fname).slice(1);
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { base64: buf.toString('base64'), mime, ext };
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------------------
// Secrets (API keys): encrypted in the app's own data folder — never in the
// library, which gets synced and backed up as plain files.
// ---------------------------------------------------------------------------

const SECRETS_FILE = () => path.join(app.getPath('userData'), 'secrets.json');
// only the assistant's API keys live here
const SECRET_NAME = /^ai-key-(anthropic|compat-[a-z0-9]+)$/;

// Keys are encrypted by the OS keychain (Keychain, DPAPI, Secret Service).
// Chromium's 'basic_text' fallback on Linux is obfuscation, not encryption,
// so it counts as no keychain: then nothing is saved (the env var works).
function keychainReady() {
  const { safeStorage } = require('electron');
  if (!safeStorage.isEncryptionAvailable()) return false;
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend &&
      ['basic_text', 'unknown'].includes(safeStorage.getSelectedStorageBackend())) return false;
  return true;
}

function writeSecrets(all) {
  writeJSON(SECRETS_FILE(), all);
  try { fs.chmodSync(SECRETS_FILE(), 0o600); } catch { /* best effort */ }
}

function readSecret(name) {
  try {
    if (!SECRET_NAME.test(String(name))) return null;
    const all = readJSON(SECRETS_FILE(), {});
    const entry = all[name];
    if (!entry) return null;
    if (!entry.enc) {
      // an older build could leave a key in plain text: never use it, drop it
      delete all[name];
      writeSecrets(all);
      logError('secret', 'discarded a key stored without encryption: ' + name);
      return null;
    }
    if (!keychainReady()) return null;
    const { safeStorage } = require('electron');
    return safeStorage.decryptString(Buffer.from(entry.value, 'base64'));
  } catch (err) {
    logError('secret', err && err.message);
    return null;
  }
}

ipcMain.handle('secret:set', (_e, name, value) => {
  if (!SECRET_NAME.test(String(name))) return { ok: false, error: 'badName' };
  const all = readJSON(SECRETS_FILE(), {});
  if (!value) {
    delete all[name];
    writeSecrets(all);
    return { ok: true };
  }
  if (!keychainReady()) return { ok: false, error: 'noKeychain' };
  const { safeStorage } = require('electron');
  all[name] = { enc: true, value: safeStorage.encryptString(String(value).trim()).toString('base64') };
  writeSecrets(all);
  return { ok: true };
});

ipcMain.handle('secret:has', (_e, name) => !!readSecret(name));
ipcMain.handle('secret:keychain', () => keychainReady());

// ---------------------------------------------------------------------------
// Sources: turn a pasted URL / DOI / ISBN into a draft record (see
// sources-lookup.js), and open a source's link in the writer's browser.
// ---------------------------------------------------------------------------

ipcMain.handle('sources:lookup', async (_e, input) => {
  // Node's fetch: redirects come back unfollowed, so each hop can be checked
  return require('./sources-lookup.js').lookup(String(input || '').slice(0, 2000), fetch);
});

// only web addresses ever leave the app — never file:// or custom schemes
ipcMain.handle('link:open', (_e, url) => {
  try {
    const u = new URL(String(url));
    if (u.protocol === 'http:' || u.protocol === 'https:') require('electron').shell.openExternal(u.href);
  } catch { /* not a URL */ }
  return true;
});

// AI assistant (ai/): research, critique, rewrite — see ai/index.js
require('./ai/index.js').register(logError, readSecret, readStyle);
// Omarchy: the interface follows the desktop's theme (see omarchy.js)
require('./omarchy.js').register(ipcMain, () => BrowserWindow.getAllWindows());

// ---------------------------------------------------------------------------
// Fullscreen
// ---------------------------------------------------------------------------

// ⌘Enter / Ctrl+Enter toggles fullscreen
ipcMain.handle('fullscreen:toggle', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.setFullScreen(!win.isFullScreen());
  return true;
});

// Regular fullscreen: Esc walks you out like any civilized app
ipcMain.handle('fullscreen:escape', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && win.isFullScreen()) {
    win.setFullScreen(false);
    return true;
  }
  return false;
});

// ---------------------------------------------------------------------------
// Export + email
// ---------------------------------------------------------------------------

async function renderPDF(html) {
  // the export is static HTML: no script runs while it prints
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  // Letter is a North American habit; most of the world prints A4.
  const letterCountries = ['US', 'CA', 'MX', 'PH'];
  try {
    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return await pdfWin.webContents.printToPDF({
      pageSize: letterCountries.includes(app.getLocaleCountryCode()) ? 'Letter' : 'A4',
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      printBackground: false
    });
  } finally {
    pdfWin.destroy();
  }
}

// zipEntries: [{path, content, base64?, store?}]
async function buildZip(zipEntries) {
  const JSZip = require('jszip');
  const zip = new JSZip();
  for (const e of zipEntries) {
    zip.file(e.path, e.base64 ? Buffer.from(e.content, 'base64') : e.content, {
      compression: e.store ? 'STORE' : 'DEFLATE'
    });
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

ipcMain.handle('export:save', async (_e, { format, defaultName, content, zipEntries }) => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(os.homedir(), 'Documents', defaultName + '.' + format),
    filters: [{ name: format.toUpperCase(), extensions: [format] }]
  });
  if (canceled || !filePath) return null;
  if (zipEntries) {
    fs.writeFileSync(filePath, await buildZip(zipEntries));
  } else if (format === 'pdf') {
    fs.writeFileSync(filePath, await renderPDF(content));
  } else {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return filePath;
});

// Writes a timestamped snapshot to the library's Exports folder, then hands it
// to your email — an outside-the-machine paper trail for provenance.
ipcMain.handle('email:draft', async (_e, { to, subject, body, html, defaultName, method }) => {
  const { shell } = require('electron');
  const exportsDir = path.join(LIBRARY_DIR, 'Exports');
  if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(exportsDir, `${defaultName}-${stamp}.pdf`);
  fs.writeFileSync(file, await renderPDF(html));

  if (method === 'gmail') {
    // Gmail compose in the browser can't take an attachment from outside,
    // so open the draft pre-filled and reveal the PDF right next to it to drag in.
    const url = 'https://mail.google.com/mail/?view=cm&fs=1'
      + '&to=' + encodeURIComponent(to)
      + '&su=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);
    await shell.openExternal(url);
    shell.showItemInFolder(file);
    return { ok: true, method: 'gmail', file };
  }

  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const script = `
    tell application "Mail"
      set msg to make new outgoing message with properties {subject:"${esc(subject)}", content:"${esc(body)}" & return & return, visible:true}
      tell msg to make new to recipient at end of to recipients with properties {address:"${esc(to)}"}
      tell msg to make new attachment with properties {file name:(POSIX file "${esc(file)}")} at after the last paragraph of content
      activate
    end tell`;
  return new Promise((resolve) => {
    require('child_process').execFile('osascript', ['-e', script], (err) => {
      if (err) {
        // Mail not available — at least reveal the snapshot we saved
        shell.showItemInFolder(file);
        resolve({ ok: false, file });
      } else {
        resolve({ ok: true, method: 'mail', file });
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Import: .docx / .txt / .md → chapters
// ---------------------------------------------------------------------------

const decodeEntities = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

async function importFile(fp) {
  const name = path.basename(fp).replace(/\.[^.]+$/, '');
  const ext = path.extname(fp).toLowerCase();
  let paras = [];

  if (ext === '.docx') {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(fs.readFileSync(fp));
    const docFile = zip.file('word/document.xml');
    if (!docFile) throw new Error('Not a valid .docx: ' + fp);
    const xml = await docFile.async('string');
    paras = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => {
      const p = m[0];
      // <w:t> or <w:t attr...> ONLY — never <w:tab>/<w:tabs>, which share
      // the same first letters and once leaked raw XML into a manuscript
      const text = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((t) => decodeEntities(t[1])).join('');
      const pageBreak = /<w:br [^>]*w:type="page"/.test(p) || /<w:pageBreakBefore/.test(p);
      return { text: text.trim(), pageBreak };
    });
  } else {
    const raw = fs.readFileSync(fp, 'utf8');
    // a Markdown heading is its own paragraph even without a blank line after it
    const spaced = ext === '.md' ? raw.replace(/^(#{1,6}[ \t].*)$/gm, '\n$1\n') : raw;
    paras = spaced.split(/\r?\n\s*\r?\n/)
      .map((b) => ({ text: b.replace(/\s*\r?\n\s*/g, ' ').trim(), pageBreak: false }))
      .filter((p) => p.text);
  }

  // Chapterize: page breaks and heading lines start new chapters. Headings
  // include "Chapter N" styles plus bare chapter numbers — "7", "VII",
  // "Seven" — which get stripped so NEO's own numbering doesn't duplicate them.
  const SPELLED = /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\.?$/i;
  const isNumeralish = (t) => /^\d{1,3}\.?$/.test(t) || /^[IVXLC]{1,7}\.?$/.test(t) || SPELLED.test(t);
  // Bare numbers only count as chapter markers when there's a ladder of them —
  // a story that merely OPENS with "Seven." keeps its seven.
  const numeralMode = paras.filter((p) => p.text && isNumeralish(p.text.trim())).length >= 2;
  // "## Why cities matter" — a titled section; the first # is the essay title
  const mdHeading = (t) => {
    const m = ext === '.md' && t ? t.match(/^(#{1,6})\s+(.+?)\s*#*$/) : null;
    return m ? { level: m[1].length, title: m[2].trim() } : null;
  };
  const isHeading = (t) => t && (
    (/^(chapter|prologue|epilogue|part)\b/i.test(t) && t.length < 60) ||
    (numeralMode && isNumeralish(t)) ||
    (mdHeading(t) && mdHeading(t).level > 1)
  );
  const isBreak = (t) => /^\s*([*#•~⁂—–-]\s*){1,7}$/.test(t || '');

  const chapterize = (usePageBreaks) => {
    const chapters = [];
    let cur = [];
    for (const p of paras) {
      const brk = usePageBreaks && p.pageBreak;
      if (!p.text && !brk) continue;
      if ((brk || isHeading(p.text)) && (cur.length || cur.title)) {
        chapters.push(cur);
        cur = [];
      }
      if (isHeading(p.text)) {
        // Markdown headings name their section; other heading lines just split
        const h = mdHeading(p.text);
        if (h) cur.title = h.title;
        continue;
      }
      if (isBreak(p.text)) { cur.push({ scene: true }); continue; }
      if (p.text) cur.push({ text: p.text });
    }
    if (cur.length) chapters.push(cur);
    return chapters;
  };

  const countAllWords = (list) =>
    list.reduce((n, ch) => n + ch.reduce((m, p) => m + (p.text ? p.text.trim().split(/\s+/).length : 0), 0), 0);

  // First pass trusts page breaks. Some word processors sprinkle page-break
  // formatting on every paragraph, exploding a story into confetti — if the
  // result is absurd (lots of tiny "chapters"), re-run trusting headings only.
  let chapters = chapterize(true);
  if (chapters.length > 6 && countAllWords(chapters) / chapters.length < 250) {
    chapters = chapterize(false);
  }
  if (!chapters.length) chapters.push([{ text: '' }]);

  // Front matter: a short title line and a "by Author" line belong on the
  // title page, not in the body. Detect, harvest, and remove them.
  let title = null;
  let author = null;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const first = chapters[0];
  if (first && first.length) {
    const t0 = (first[0].text || '').trim();
    const t1 = first.length > 1 ? (first[1].text || '').trim() : '';
    const h1 = mdHeading(t0);
    const titleish = t0 && t0.length < 90 && !/[.!?]$/.test(t0) && (
      (norm(t0).length > 3 && norm(name).includes(norm(t0))) ||
      /^(by|por)\s+\S/i.test(t1) ||
      (t0 === t0.toUpperCase() && /[A-Z].*[A-Z]/.test(t0) && t0.length < 60)
    );
    if (h1 && h1.level === 1) {
      title = h1.title; // "# The essay's title"
      first.shift();
    } else if (titleish) {
      title = t0;
      first.shift();
    }
    const bl = first.length ? (first[0].text || '').trim().match(/^(?:by|por)\s+(.{2,60})$/i) : null;
    if (bl) {
      author = bl[1].trim();
      first.shift();
    }
    if (!first.length && !first.title) chapters.shift();
    if (!chapters.length) chapters.push([{ text: '' }]);
  }

  // chapters travel as plain arrays of paragraphs; titles ride alongside
  const titles = chapters.map((ch) => ch.title || '');
  return { name, title, author, chapters: chapters.map((ch) => [...ch]), titles };
}

// Same parsing as the picker, but for files dropped from Finder/Explorer
ipcMain.handle('import:files', async (_e, paths) => {
  const out = [];
  for (const fp of paths || []) {
    if (!/\.(docx|txt|md)$/i.test(fp)) continue;
    try {
      out.push(await importFile(fp));
    } catch (err) {
      logError('import', err);
      out.push({ name: path.basename(fp), error: String(err.message || err) });
    }
  }
  return out;
});

ipcMain.handle('import:pick', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: mt('dialog.importTitle'),
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: mt('dialog.documents'), extensions: ['docx', 'txt', 'md'] }]
  });
  if (canceled || !filePaths.length) return [];
  const out = [];
  for (const fp of filePaths) {
    try {
      out.push(await importFile(fp));
    } catch (err) {
      logError('import', err);
      out.push({ name: path.basename(fp), error: String(err.message || err) });
    }
  }
  return out;
});

// ---------------------------------------------------------------------------
// Robustness: error log, daily backups, single instance
// ---------------------------------------------------------------------------
const ERROR_LOG = () => path.join(LIBRARY_DIR, 'neo-errors.log');

function logError(source, err) {
  try {
    ensureLibrary();
    const line = `[${new Date().toISOString()}] [${source}] ${err && err.stack ? err.stack : String(err)}\n`;
    fs.appendFileSync(ERROR_LOG(), line);
  } catch { /* never let logging crash the app */ }
}

process.on('uncaughtException', (err) => logError('main', err));
process.on('unhandledRejection', (err) => logError('main-promise', err));
ipcMain.handle('log:error', (_e, msg) => logError('renderer', String(msg).slice(0, 4000)));

// One zip of the whole library per day, keeping the last 14. Cheap insurance.
async function dailyBackup() {
  try {
    ensureLibrary();
    const backupsDir = path.join(LIBRARY_DIR, 'Backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const target = path.join(backupsDir, `neo-backup-${today}.zip`);
    if (fs.existsSync(target)) return;

    const JSZip = require('jszip');
    const zip = new JSZip();
    const skip = new Set(['Backups', 'Exports']);
    const walk = (dir, rel) => {
      for (const name of fs.readdirSync(dir)) {
        if (rel === '' && skip.has(name)) continue;
        const full = path.join(dir, name);
        const relPath = rel ? rel + '/' + name : name;
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, relPath);
        else zip.file(relPath, fs.readFileSync(full));
      }
    };
    walk(LIBRARY_DIR, '');
    fs.writeFileSync(target, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

    // prune old backups
    const backups = fs.readdirSync(backupsDir).filter((f) => f.startsWith('neo-backup-')).sort();
    while (backups.length > 14) fs.unlinkSync(path.join(backupsDir, backups.shift()));
  } catch (err) {
    logError('backup', err);
  }
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Hardening: the page is Mutiny's own files and nothing else. It never
// navigates away (a dropped or clicked link must not load a web page that
// would inherit the preload bridge), opens no windows of its own (links go
// through link:open, http(s) only), embeds no webviews, and gets only the
// permissions it uses: local fonts (the font picker) and clipboard writes.
// ---------------------------------------------------------------------------
const ALLOWED_PERMISSIONS = new Set(['local-fonts', 'clipboard-sanitized-write']);

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (ev, url) => {
    if (url !== contents.getURL()) ev.preventDefault();
  });
  contents.on('will-redirect', (ev) => ev.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-attach-webview', (ev) => ev.preventDefault());
});

function lockPermissions(session) {
  session.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));
  session.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0e091d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      // The engine is available, but every editable element starts with
      // spellcheck="false" — NEO never nags. A spellcheck pass is a
      // deliberate act (Edit → Spellcheck Pass), not a klaxon.
      spellcheck: true
    }
  });
  lockPermissions(win.webContents.session);
  win.loadFile('index.html');

  // NEO does its own spellchecking (see spell:* handlers) — the engine's
  // checker proved unreliable at scanning existing text, so it stays off
  win.webContents.session.setSpellCheckerEnabled(false);
}

// ---------------------------------------------------------------------------
// Spellcheck: our own Hunspell dictionaries via nspell, identical on every
// platform — English and Spanish, chosen per essay. Each loads on first use
// (Spanish takes about a second). The renderer paints the squiggles and asks
// for suggestions.
// ---------------------------------------------------------------------------
const SPELL_DICTS = { en: 'dictionary-en-us', es: 'dictionary-es' };
const spellers = {}; // lang → nspell instance

function speller(lang) {
  if (!SPELL_DICTS[lang]) lang = 'en';
  if (spellers[lang]) return spellers[lang];
  try {
    const nspell = require('nspell');
    const dir = path.join(__dirname, 'node_modules', SPELL_DICTS[lang]);
    const sp = nspell({
      aff: fs.readFileSync(path.join(dir, 'index.aff')),
      dic: fs.readFileSync(path.join(dir, 'index.dic'))
    });
    try {
      const lib = readJSON(LIBRARY_FILE, {});
      for (const w of lib.customWords || []) sp.add(w);
    } catch { /* custom words are a nicety */ }
    spellers[lang] = sp;
  } catch (err) {
    logError('spell', err);
    spellers[lang] = null;
  }
  return spellers[lang];
}

// warm the library's language after startup so the first pass is instant
function initSpell() {
  setTimeout(() => {
    const lib = readJSON(LIBRARY_FILE, {});
    speller(lib.language || 'en');
  }, 3000);
}

ipcMain.handle('spell:check', (_e, words, lang) => {
  const sp = speller(lang);
  const out = {};
  // no dictionary: report everything correct rather than crying wolf
  for (const w of words) out[w] = sp ? sp.correct(w) : true;
  return out;
});

ipcMain.handle('spell:suggest', (_e, word, lang) => {
  const sp = speller(lang);
  return sp ? sp.suggest(word).slice(0, 6) : [];
});

// a learned word is learned in every language
ipcMain.handle('spell:learn', (_e, word) => {
  if (typeof word !== 'string') return true;
  for (const sp of Object.values(spellers)) if (sp) sp.add(word);
  return true;
});

// ---------------------------------------------------------------------------
// Application menu — Help and Format live here, out of the writing room
// ---------------------------------------------------------------------------
function sendToWindow(msg) {
  const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (w) w.webContents.send('menu', msg);
}

function buildMenu() {
  const lib = readJSON(LIBRARY_FILE, {});
  menuBright = lib.uiBright !== false;
  menuTheme = lib.appearance || 'auto';
  const isMac = process.platform === 'darwin';
  // "&" marks a mnemonic outside macOS — a literal one is written "&&"
  const T = (key) => (isMac ? mt(key) : mt(key).replace(/&/g, '&&'));
  // bundled typefaces — keep in step with BODY_FONTS in app.js
  const bodyFonts = ['Literata', 'Source Serif', 'Lora', 'EB Garamond', 'iA Writer Quattro', 'iA Writer Duo'];
  const template = [
    // appMenu exists only on macOS — including it on Windows throws,
    // which is exactly what kept NEO from ever opening a window there
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: T('menu.file'),
      submenu: [
        {
          label: T('menu.export'),
          submenu: [
            { label: T('menu.export.txt'), click: () => sendToWindow({ type: 'export', format: 'txt' }) },
            { label: T('menu.export.md'), click: () => sendToWindow({ type: 'export', format: 'md' }) },
            { label: T('menu.export.html'), click: () => sendToWindow({ type: 'export', format: 'html' }) },
            { label: T('menu.export.pdf'), click: () => sendToWindow({ type: 'export', format: 'pdf' }) },
            { label: T('menu.export.docx'), click: () => sendToWindow({ type: 'export', format: 'docx' }) }
          ]
        },
        { type: 'separator' },
        {
          label: T('menu.emailDraft'),
          accelerator: 'CmdOrCtrl+E',
          click: () => sendToWindow({ type: 'emailDraft' })
        },
        { label: T('menu.emailSettings'), click: () => sendToWindow({ type: 'emailSettings' }) },
        {
          label: T('menu.goals'),
          accelerator: 'CmdOrCtrl+,',
          click: () => sendToWindow({ type: 'stats' })
        },
        { type: 'separator' },
        {
          label: T('menu.importFiles'),
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => sendToWindow({ type: 'import' })
        },
        { type: 'separator' },
        ...(isMac ? [{ role: 'close', label: T('menu.close') }] : [{ role: 'quit', label: T('menu.quit') }])
      ]
    },
    {
      label: T('menu.edit'),
      submenu: [
        { role: 'undo', label: T('menu.undo') }, { role: 'redo', label: T('menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: T('menu.cut') }, { role: 'copy', label: T('menu.copy') }, { role: 'paste', label: T('menu.paste') },
        { role: 'pasteAndMatchStyle', label: T('menu.pastePlain') }, { role: 'selectAll', label: T('menu.selectAll') },
        { type: 'separator' },
        {
          label: T('menu.find'),
          accelerator: 'CmdOrCtrl+F',
          click: () => sendToWindow({ type: 'find' })
        },
        {
          label: T('menu.spellcheck'),
          accelerator: 'CmdOrCtrl+;',
          click: () => sendToWindow({ type: 'spellcheck' })
        },
        { type: 'separator' },
        { label: T('menu.mark'), accelerator: 'CmdOrCtrl+Shift+X', registerAccelerator: false, click: () => sendToWindow({ type: 'mark' }) },
        { label: T('menu.cite'), accelerator: 'CmdOrCtrl+Shift+K', registerAccelerator: false, click: () => sendToWindow({ type: 'cite' }) }
      ]
    },
    {
      label: T('menu.format'),
      submenu: [
        {
          label: T('menu.bodyFont'),
          submenu: [
            ...bodyFonts.map((f) => ({
              label: f,
              click: () => sendToWindow({ type: 'bodyFont', value: f })
            })),
            { type: 'separator' },
            { label: T('menu.systemFont'), click: () => sendToWindow({ type: 'systemFont' }) }
          ]
        },
        {
          label: T('menu.align'),
          submenu: [
            { label: T('menu.align.left'), click: () => sendToWindow({ type: 'align', value: 'left' }) },
            { label: T('menu.align.center'), click: () => sendToWindow({ type: 'align', value: 'center' }) },
            { label: T('menu.align.right'), click: () => sendToWindow({ type: 'align', value: 'right' }) },
            { label: T('menu.align.justify'), click: () => sendToWindow({ type: 'align', value: 'justify' }) }
          ]
        },
        { type: 'separator' },
        { label: T('menu.textLarger'), accelerator: 'CmdOrCtrl+=', click: () => sendToWindow({ type: 'fontSize', value: 1 }) },
        { label: T('menu.textSmaller'), accelerator: 'CmdOrCtrl+-', click: () => sendToWindow({ type: 'fontSize', value: -1 }) },
        { label: T('menu.textReset'), accelerator: 'CmdOrCtrl+0', click: () => sendToWindow({ type: 'fontSize', value: 0 }) },
        { type: 'separator' },
        {
          label: T('menu.typewriter'),
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => sendToWindow({ type: 'typewriter' })
        }
      ]
    },
    {
      label: T('menu.assistant'),
      submenu: [
        { label: T('menu.aiRewrite'), accelerator: 'CmdOrCtrl+Shift+M', registerAccelerator: false, click: () => sendToWindow({ type: 'ai', action: 'rewrite' }) },
        { label: T('menu.aiCritiqueSection'), accelerator: 'CmdOrCtrl+Shift+C', registerAccelerator: false, click: () => sendToWindow({ type: 'ai', action: 'critique-section' }) },
        { label: T('menu.aiCritiqueEssay'), click: () => sendToWindow({ type: 'ai', action: 'critique-essay' }) },
        { label: T('menu.aiChat'), accelerator: 'CmdOrCtrl+Shift+A', registerAccelerator: false, click: () => sendToWindow({ type: 'ai', action: 'chat' }) },
        { type: 'separator' },
        { label: T('menu.aiSettings'), click: () => sendToWindow({ type: 'ai', action: 'settings' }) }
      ]
    },
    {
      label: T('menu.view'),
      submenu: [
        {
          label: T('menu.fullScreen'),
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            const w = BrowserWindow.getFocusedWindow();
            if (w) w.setFullScreen(!w.isFullScreen());
          }
        },
        { type: 'separator' },
        {
          label: T('menu.page'),
          submenu: [
            { label: T('menu.page.night'), click: () => sendToWindow({ type: 'pageTheme', value: 'night' }) },
            { label: T('menu.page.paper'), click: () => sendToWindow({ type: 'pageTheme', value: 'paper' }) }
          ]
        },
        {
          label: T('menu.theme'),
          submenu: MENU_THEMES.filter((th) => th.id !== 'auto' || process.platform === 'linux').map((th) => ({
            label: th.id === 'auto' ? T('theme.omarchy') : th.name,
            type: 'radio',
            checked: menuTheme === th.id,
            click: () => sendToWindow({ type: 'theme', value: th.id })
          }))
        },
        { type: 'separator' },
        { label: T('menu.navPane'), accelerator: 'CmdOrCtrl+[', click: () => sendToWindow({ type: 'togglePane', value: 'nav' }) },
        { label: T('menu.sidePane'), accelerator: 'CmdOrCtrl+]', click: () => sendToWindow({ type: 'togglePane', value: 'side' }) },
        { type: 'separator' },
        {
          label: T('menu.brighter'),
          type: 'checkbox',
          checked: menuBright,
          click: () => sendToWindow({ type: 'uiBright' })
        }
      ]
    },
    {
      label: T('menu.window'),
      role: 'window',
      submenu: [
        { role: 'minimize', label: T('menu.minimize') },
        { role: 'zoom', label: T('menu.zoom') },
        ...(isMac ? [{ type: 'separator' }, { role: 'front', label: T('menu.front') }] : [{ role: 'close', label: T('menu.close') }])
      ]
    },
    {
      label: T('menu.help'),
      submenu: [
        {
          label: T('menu.shortcuts'),
          accelerator: 'CmdOrCtrl+/',
          click: () => sendToWindow({ type: 'help' })
        },
        { type: 'separator' },
        {
          label: T('menu.about'),
          click: () => sendToWindow({ type: 'about' })
        },
        {
          label: T('menu.checkUpdate'),
          click: () => sendToWindow({ type: 'checkUpdate' })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  // the same menu for a window that draws its own bar (a themed desktop)
  appMenuActions = new Map();
  appMenuModel = menuModel(template);
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('appmenu:changed');
}

// ---------------------------------------------------------------------------
// The menu as data, for a bar drawn by the page. On Omarchy the native bar
// can't take the desktop's theme, so the page draws its own from this model;
// every item still runs here, through the same click or role. Ids come from
// this list only — the page can't name anything else.
// ---------------------------------------------------------------------------
let appMenuModel = [];
let appMenuActions = new Map();
const ROLE_ACCEL = {
  undo: 'CmdOrCtrl+Z', redo: 'CmdOrCtrl+Shift+Z', cut: 'CmdOrCtrl+X', copy: 'CmdOrCtrl+C', paste: 'CmdOrCtrl+V',
  pasteAndMatchStyle: 'CmdOrCtrl+Shift+V', selectAll: 'CmdOrCtrl+A', quit: 'CmdOrCtrl+Q', close: 'CmdOrCtrl+W'
};
const accelText = (a) => (a ? String(a).replace(/CmdOrCtrl|CommandOrControl/g, process.platform === 'darwin' ? '⌘' : 'Ctrl') : '');

function menuModel(items) {
  const out = [];
  for (const it of items || []) {
    if (it.role === 'appMenu') continue;
    if (it.type === 'separator') { out.push({ sep: true }); continue; }
    const label = String(it.label || '').replace(/&&/g, '&');
    if (it.submenu) { out.push({ label, items: menuModel(it.submenu) }); continue; }
    const id = 'm' + appMenuActions.size;
    appMenuActions.set(id, it);
    out.push({ id, label, accel: accelText(it.accelerator || ROLE_ACCEL[it.role]), ...(it.type === 'checkbox' || it.type === 'radio' ? { checked: !!it.checked } : {}) });
  }
  return out;
}

ipcMain.handle('appmenu:get', () => appMenuModel);

// the right-click menu's Cut / Copy / Paste, done by the page like the Edit menu's
ipcMain.handle('edit:role', (e, role) => {
  if (!['cut', 'copy', 'paste'].includes(role)) return false;
  e.sender[role]();
  return true;
});

ipcMain.handle('appmenu:run', (e, id) => {
  const it = appMenuActions.get(String(id));
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!it || !win) return false;
  if (typeof it.click === 'function') { it.click(); return true; }
  const wc = win.webContents;
  switch (it.role) {
    case 'undo': case 'redo': case 'cut': case 'copy': case 'paste': case 'pasteAndMatchStyle': case 'selectAll':
      wc[it.role](); break;
    case 'minimize': win.minimize(); break;
    case 'zoom': if (win.isMaximized()) win.unmaximize(); else win.maximize(); break;
    case 'close': win.close(); break;
    case 'quit': app.quit(); break;
    default: return false;
  }
  return true;
});

// the page draws the bar itself: the native one steps aside (the menu stays
// attached, so every shortcut keeps working)
ipcMain.handle('appmenu:native', (e, visible) => {
  if (process.platform === 'darwin') return false;
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return false;
  win.setAutoHideMenuBar(false);
  win.setMenuBarVisibility(!!visible);
  return true;
});

// Manual update check (Help → Check for Update…): a direct GitHub Releases
// lookup, separate from the silent auto-updater. Works in dev builds too.
let lastReleaseUrl = null;

// semver order, pre-releases included: 0.9.0-beta.2 < 0.9.0-beta.10 < 0.9.0 < 0.9.1
function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre] = String(v).replace(/^v/, '').split('-', 2);
    return { nums: core.split('.').map((n) => parseInt(n, 10) || 0), pre: pre ? pre.split('.') : [] };
  };
  const pa = parse(a), pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa.nums[i] || 0) - (pb.nums[i] || 0);
    if (d) return d;
  }
  if (!pa.pre.length || !pb.pre.length) return pb.pre.length - pa.pre.length; // a release beats its pre-releases
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const x = pa.pre[i], y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    const d = nx && ny ? Number(x) - Number(y) : nx ? -1 : ny ? 1 : x.localeCompare(y);
    if (d) return d;
  }
  return 0;
}

// toggling at the session level forces the engine to re-scan visible text —
// newer Chromium ignores attribute changes on text it has already looked at
ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('update:check', async () => {
  try {
    // the list, not /latest: that one skips pre-releases, and the betas are ones
    const res = await fetch('https://api.github.com/repos/worldmutiny/mutiny/releases?per_page=20', {
      headers: { 'User-Agent': 'Mutiny-App', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('GitHub API returned ' + res.status);
    const list = (await res.json()).filter((r) => r && !r.draft && /^v?\d+\.\d+\.\d+/.test(String(r.tag_name || '')));
    const currentVersion = app.getVersion();
    const newest = list.sort((x, y) => compareVersions(y.tag_name, x.tag_name))[0];
    const latestVersion = newest ? String(newest.tag_name).replace(/^v/, '') : currentVersion;
    lastReleaseUrl = newest && /^https:\/\/github\.com\/worldmutiny\/mutiny\/releases\//i.test(newest.html_url || '') ? newest.html_url : null;
    return {
      hasUpdate: !!newest && compareVersions(latestVersion, currentVersion) > 0,
      latestVersion,
      currentVersion,
      packaged: app.isPackaged
    };
  } catch (err) {
    logError('update', err);
    return { error: true };
  }
});

// the renderer may only open the release page fetched above — never arbitrary URLs
ipcMain.handle('update:openRelease', () => {
  if (lastReleaseUrl && /^https:\/\/github\.com\//.test(lastReleaseUrl)) {
    require('electron').shell.openExternal(lastReleaseUrl);
  }
  return true;
});

// Two copies of NEO editing the same library is how words get eaten
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// Auto-update from GitHub releases. Deliberately defensive: any failure is
// logged and swallowed, so an unsigned build or offline machine never notices.
// (macOS auto-update only works once the app is code-signed.)
// Off until Mutiny publishes its own releases (PRD phase 6); inherited
// config must never pull a NEO build over a Mutiny install.
const AUTO_UPDATE_ENABLED = false;

function checkForUpdates() {
  if (!AUTO_UPDATE_ENABLED || !app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.logger = null;
    autoUpdater.on('error', (err) => logError('updater', err));
    autoUpdater.checkForUpdatesAndNotify().catch((err) => logError('updater', err));
  } catch (err) {
    logError('updater', err);
  }
}

app.whenReady().then(() => {
  // Packaged builds get name/icon from electron-builder; this covers `npm start`.
  try {
    const devIcon = path.join(__dirname, 'build', 'icon.png');
    if (process.platform === 'darwin' && fs.existsSync(devIcon)) {
      if (app.dock) app.dock.setIcon(devIcon);
      app.setAboutPanelOptions({
        applicationName: 'Mutiny',
        applicationVersion: app.getVersion(),
        iconPath: devIcon
      });
    }
  } catch { /* cosmetic only */ }
  // Startup discipline: the window is created first, and every other step is
  // individually guarded so no single failure can leave the app running
  // invisibly with no window.
  try {
    // the real Documents folder (handles OneDrive-redirected Windows setups)
    try {
      // MUTINY_LIBRARY_DIR points a development/test run at another library
      // without xdg-user-dirs, Linux reports the home folder itself as
      // "documents" — keep the library in ~/Documents there too
      let docs = app.getPath('documents');
      if (path.resolve(docs) === path.resolve(os.homedir())) docs = path.join(os.homedir(), 'Documents');
      LIBRARY_DIR = process.env.MUTINY_LIBRARY_DIR || path.join(docs, 'Mutiny Library');
      LIBRARY_FILE = path.join(LIBRARY_DIR, 'library.json');
    } catch (err) {
      logError('paths', err);
    }

    // macOS press-and-hold accent picker can open invisibly inside Chromium
    // and re-emit swallowed keys as phantom repeated letters. Within NEO,
    // held keys simply repeat — which is what writers expect anyway.
    if (process.platform === 'darwin') {
      try {
        const { systemPreferences } = require('electron');
        systemPreferences.setUserDefault('ApplePressAndHoldEnabled', 'boolean', false);
        // macOS injects its own items into any menu named "Edit" —
        // these two official switches remove the ones writers can't use here
        systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true);
        systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true);
      } catch (err) {
        logError('prefs', err);
      }
    }

    try { ensureLibrary(); } catch (err) { logError('library', err); }
    createWindow();
    try { initSpell(); } catch (err) { logError('spell', err); }
    MAIN_LANG = uiLanguage();
    try { buildMenu(); } catch (err) { logError('menu', err); }
    try { dailyBackup(); } catch (err) { logError('backup', err); }
    try { checkForUpdates(); } catch (err) { logError('updater', err); }
  } catch (err) {
    // catastrophic: tell the human instead of dying in silence
    logError('startup', err);
    try {
      dialog.showErrorBox(mt('dialog.startFailed'),
        mt('dialog.startFailedDetail') + '\n\n' + String((err && err.stack) || err));
    } catch { /* nothing left to try */ }
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
