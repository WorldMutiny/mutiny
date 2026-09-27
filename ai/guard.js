// Mutiny — checks shared by the AI providers and the source lookup (main
// process). Everything that arrives from the renderer is treated as untrusted.

'use strict';

const path = require('path');
const dns = require('dns').promises;
const net = require('net');

// A model name or alias as the CLIs and APIs spell them — never something
// that could pass for a command-line flag.
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,99}$/;
const EFFORTS = ['low', 'medium', 'high'];
const cleanModel = (m) => (m && MODEL_RE.test(String(m)) ? String(m) : '');
const cleanEffort = (e) => (EFFORTS.includes(e) ? e : '');

// A path the writer typed for claude/codex only counts if it names that tool.
function toolPathOk(p, name) {
  if (!p) return false;
  const base = path.basename(String(p)).toLowerCase();
  return path.isAbsolute(String(p)) && (base === name || base === name + '.exe' || base === name + '.cmd');
}

// The environment a CLI assistant needs to find its login and the network —
// not the writer's other secrets (unrelated API keys, tokens…).
const ENV_KEEP = [
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LANGUAGE', 'TZ', 'TMPDIR', 'TMP', 'TEMP',
  'DBUS_SESSION_BUS_ADDRESS', 'DISPLAY', 'WAYLAND_DISPLAY',
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'all_proxy',
  'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
  // Windows
  'SystemRoot', 'SYSTEMROOT', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'PATHEXT', 'COMSPEC', 'ProgramData'
];
function cliEnv(prefixes, extra) {
  const out = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v == null) continue;
    if (ENV_KEEP.includes(k) || k.startsWith('LC_') || k.startsWith('XDG_') || prefixes.some((p) => k.startsWith(p))) out[k] = v;
  }
  // an app opened from the Dock or Start gets a bare PATH; npm-installed CLIs
  // are scripts that need `node` from the same places they were found
  const pathKey = Object.keys(out).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
  out[pathKey] = [...new Set([...(out[pathKey] || '').split(path.delimiter), ...toolDirs()].filter(Boolean))].join(path.delimiter);
  return { ...out, ...(extra || {}) };
}

// Where Claude Code, Codex and node usually live, per system — searched in
// addition to PATH.
function toolDirs() {
  const fs = require('fs');
  const os = require('os');
  const home = os.homedir();
  const J = (...p) => path.join(...p);
  const dirs = [
    J(home, '.local', 'bin'), J(home, '.claude', 'local'), J(home, '.npm-global', 'bin'), J(home, '.bun', 'bin'),
    J(home, '.volta', 'bin'), J(home, '.local', 'share', 'mise', 'shims'), J(home, '.asdf', 'shims')
  ];
  // nvm: the newest node first
  try {
    const nvm = J(home, '.nvm', 'versions', 'node');
    for (const v of fs.readdirSync(nvm).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) dirs.push(J(nvm, v, 'bin'));
  } catch { /* no nvm */ }
  if (process.platform === 'darwin') dirs.push('/opt/homebrew/bin', '/usr/local/bin');
  if (process.platform === 'linux') dirs.push('/usr/local/bin', '/usr/bin');
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || J(home, 'AppData', 'Roaming');
    const local = process.env.LOCALAPPDATA || J(home, 'AppData', 'Local');
    dirs.push(J(appData, 'npm'), J(local, 'Programs', 'claude'), J(home, 'scoop', 'shims'), J(local, 'Microsoft', 'WinGet', 'Links'));
    for (const d of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) if (d) dirs.push(J(d, 'nodejs'));
  }
  return dirs;
}

// ---------------------------------------------------------------- addresses

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return privateIp(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') ||
      v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
  }
  return true;
}

const localName = (host) => /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|.*\.home\.arpa)$/i.test(host);

// true when a URL points at this machine or the local network
async function isPrivateUrl(url) {
  let u;
  try { u = new URL(url); } catch { return true; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (localName(host)) return true;
  if (net.isIP(host)) return privateIp(host);
  try {
    const addrs = await dns.lookup(host, { all: true });
    return !addrs.length || addrs.some((a) => privateIp(a.address));
  } catch {
    return false; // unresolvable: the fetch fails on its own
  }
}

// Same check without DNS, for a server the writer configured themselves:
// is it on this machine or the local network?
function isLocalHost(url) {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    return localName(host) || (net.isIP(host) ? privateIp(host) : false);
  } catch { return false; }
}

module.exports = { toolDirs, cleanModel, cleanEffort, toolPathOk, cliEnv, isPrivateUrl, isLocalHost };
