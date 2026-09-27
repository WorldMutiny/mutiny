// Mutiny — Omarchy (main process).
// On an Omarchy desktop the interface takes the system theme: its palette
// (omarchy-theme-color resolves named colours and light/dark), the control
// styling of its shell (shell.toml) and its font (omarchy-font-current). The
// page is never themed — that is decided in the renderer (theme.js).
// Nothing here writes anywhere; when Omarchy isn't present, it's all a no-op.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const STATE = path.join(os.homedir(), '.local', 'state', 'omarchy', 'current');
const THEME = path.join(STATE, 'theme');
const HEX = /^#[0-9a-fA-F]{6}$/;

const available = () => process.platform === 'linux' && fs.existsSync(path.join(THEME, 'colors.toml'));

// Omarchy's own commands, from its install when they're not on PATH (a
// launcher may start Mutiny with a thin environment)
function bin(name) {
  const dirs = [process.env.OMARCHY_PATH && path.join(process.env.OMARCHY_PATH, 'bin'), '/usr/share/omarchy/bin'];
  for (const d of dirs) if (d && fs.existsSync(path.join(d, name))) return path.join(d, name);
  return name;
}

function run(name, args) {
  return new Promise((resolve) => {
    execFile(bin(name), args, { timeout: 3000, maxBuffer: 256 * 1024 }, (err, stdout) => resolve(err ? '' : String(stdout)));
  });
}

// key = "value" / key = 0.4 lines, by [section] — enough TOML for these files
function parseToml(text) {
  const out = {};
  let section = '';
  for (const raw of String(text || '').split('\n')) {
    const line = raw.replace(/#(?![0-9a-fA-F]{6}\b).*$/, '').trim();
    if (!line) continue;
    const sec = line.match(/^\[([\w.-]+)\]$/);
    if (sec) { section = sec[1]; continue; }
    const kv = line.match(/^([\w.-]+)\s*=\s*(?:"([^"]*)"|([\d.]+))\s*$/);
    if (!kv) continue;
    (out[section] = out[section] || {})[kv[1]] = kv[2] !== undefined ? kv[2] : Number(kv[3]);
  }
  return out;
}

async function read() {
  if (!available()) return { available: false };
  const colors = {};
  // named colours resolved by Omarchy itself (red, green, muted, mode…)
  for (const line of (await run('omarchy-theme-color', ['--file', path.join(THEME, 'colors.toml'), '--all'])).split('\n')) {
    const [k, v] = line.split('\t');
    if (!k || !v) continue;
    if (HEX.test(v.trim()) || (k === 'mode' && /^(light|dark)$/.test(v.trim()))) colors[k.trim()] = v.trim();
  }
  // no helper: the file itself, with the terminal's colour names
  if (!colors.background) {
    let raw = {};
    try { raw = parseToml(fs.readFileSync(path.join(THEME, 'colors.toml'), 'utf8'))[''] || {}; } catch { /* unreadable */ }
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' && HEX.test(v)) colors[k] = v;
    const named = { red: 'color1', green: 'color2', yellow: 'color3', blue: 'color4', magenta: 'color5', cyan: 'color6' };
    for (const [n, c] of Object.entries(named)) if (!colors[n] && colors[c]) colors[n] = colors[c];
  }
  if (!colors.background || !colors.foreground) return { available: false };
  let controls = {};
  try {
    const shell = parseToml(fs.readFileSync(path.join(THEME, 'shell.toml'), 'utf8'));
    controls = shell.controls || {};
  } catch { /* a theme may not have one */ }
  // only what the renderer uses, and only well-formed values
  const ctl = {};
  for (const [k, v] of Object.entries(controls)) {
    if (typeof v === 'string' && HEX.test(v)) ctl[k] = v;
    else if (typeof v === 'number' && v >= 0 && v <= 8) ctl[k] = v;
  }
  const font = (await run('omarchy-font-current', [])).trim();
  let name = '';
  try { name = fs.readFileSync(path.join(STATE, 'theme.name'), 'utf8').trim().slice(0, 80); } catch { /* unnamed */ }
  return {
    available: true,
    name,
    colors,
    controls: ctl,
    font: /^[\w .+-]{1,80}$/.test(font) ? font : ''
  };
}

// A theme switch rewrites theme.name last; watch the folder and tell every
// window (debounced — the switch touches several files).
function watch(onChange) {
  if (!available()) return;
  let timer = null;
  try {
    fs.watch(STATE, (_ev, file) => {
      if (file && !/^theme(\.name)?$/.test(String(file))) return;
      clearTimeout(timer);
      timer = setTimeout(onChange, 400);
    });
  } catch { /* no watching: the theme is still read at start and on focus */ }
}

function register(ipcMain, windows) {
  ipcMain.handle('omarchy:theme', () => read());
  watch(() => { for (const w of windows()) if (!w.isDestroyed()) w.webContents.send('omarchy:changed'); });
}

module.exports = { register, read, parseToml };
