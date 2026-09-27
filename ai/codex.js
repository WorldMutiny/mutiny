// Mutiny — the Codex provider (main process): OpenAI's Codex CLI on the
// writer's own ChatGPT login. Each run is `codex exec` locked down harder
// than Codex's own read-only mode: the shell and every other tool family
// (apps, browser, computer use, plugins, hooks, image generation) are
// switched off, so it can't read the disk either; the writer's config and
// rules aren't loaded; nothing is persisted (--ephemeral); approvals are
// 'never'. Web search is turned on only for tasks that need it.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { chatAsPrompt, parseJsonLoose } = require('./tasks.js');
const { cleanModel, cleanEffort, toolPathOk, cliEnv, toolDirs } = require('./guard.js');

function candidatePaths() {
  const home = os.homedir();
  const exe = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const fromPath = (process.env.PATH || '').split(path.delimiter).filter(Boolean).map((d) => path.join(d, exe));
  const vendor = [];
  // npm on Windows: codex.cmd wraps a real binary shipped inside the package
  if (process.platform === 'win32') {
    const npm = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'npm', 'node_modules', '@openai', 'codex', 'vendor');
    for (const arch of ['x86_64-pc-windows-msvc', 'aarch64-pc-windows-msvc']) vendor.push(path.join(npm, arch, 'codex', exe));
  }
  return [...new Set([
    ...fromPath,
    path.join(home, '.local', 'share', 'mise', 'installs', 'codex', 'latest', 'bin', exe),
    ...toolDirs().map((d) => path.join(d, exe)),
    ...vendor
  ])];
}

function run(file, args, timeout = 15000) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve(err && !stdout ? null : String(stdout || '') + String(stderr || ''));
    });
  });
}

async function findCodex(preferred) {
  // a typed path is only tried if it names codex — it gets executed
  const list = toolPathOk(preferred, 'codex') ? [preferred, ...candidatePaths()] : candidatePaths();
  for (const p of list) {
    try { if (!fs.statSync(p).isFile()) continue; } catch { continue; }
    const out = await run(p, ['--version']);
    if (out && /codex/i.test(out)) return { path: p, version: (out.match(/[\d.]+/) || [''])[0] };
  }
  return null;
}

async function status(settings) {
  const found = await findCodex((settings || {}).codexPath);
  if (!found) return { installed: false };
  const out = (await run(found.path, ['login', 'status'])) || '';
  return {
    installed: true,
    path: found.path,
    version: found.version,
    loggedIn: /logged in/i.test(out) && !/not logged in/i.test(out),
    plan: /chatgpt/i.test(out) ? 'ChatGPT' : /api key/i.test(out) ? 'API key' : null
  };
}

const LOCKDOWN = ['shell_tool', 'unified_exec', 'apps', 'browser_use', 'computer_use', 'plugins', 'hooks', 'image_generation']
  .flatMap((f) => ['--disable', f]);

// Spawn one `codex exec`, feed the prompt on stdin, read JSONL events.
function exec(found, args, prompt, { signal, onEvent }) {
  return new Promise((resolve) => {
    // only what Codex needs (its login, the network) — not the writer's other secrets
    const child = spawn(found.path, args, { stdio: ['pipe', 'pipe', 'pipe'], env: cliEnv(['CODEX_', 'OPENAI_']) });
    let buf = '';
    let err = '';
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const onAbort = () => { try { child.kill('SIGTERM'); } catch { /* gone */ } finish({ cancelled: true }); };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try { onEvent(JSON.parse(line)); } catch { /* not JSON */ }
      }
    });
    child.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    child.on('error', (e) => finish({ error: String(e.message || e) }));
    child.on('close', (code) => finish({ code, stderr: err }));
    child.stdin.end(prompt);
  });
}

function baseArgs(settings, workDir, web) {
  const args = ['exec', '--json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check',
    '-s', 'read-only', '-C', workDir, '-c', 'approval_policy="never"', ...LOCKDOWN];
  args.push('-c', web ? 'web_search="live"' : 'web_search="disabled"');
  if (cleanModel(settings.model)) args.push('-m', cleanModel(settings.model));
  if (cleanEffort(settings.effort)) args.push('-c', `model_reasoning_effort="${cleanEffort(settings.effort)}"`);
  return args;
}

function progressFrom(ev) {
  const it = ev.item || {};
  if (it.type === 'web_search') {
    const q = it.query || (it.action && it.action.query);
    return q ? { stage: 'search', detail: q } : { stage: 'think' };
  }
  return null;
}

function failure(res, text) {
  if (res.cancelled) return { ok: false, error: 'cancelled', text };
  const detail = (res.error || res.stderr || '').slice(-600);
  if (/not logged in|login|unauthori[sz]ed|401/i.test(detail)) return { ok: false, error: 'failed', detail: 'Not logged in · ' + detail };
  if (/usage limit|rate limit|429/i.test(detail)) return { ok: false, error: 'rateLimited', detail };
  return { ok: false, error: 'failed', detail: detail || 'exit ' + res.code };
}

async function runTask(task, settings, { signal, onProgress, workDir }) {
  const found = await findCodex(settings.codexPath);
  if (!found) return { ok: false, error: 'notInstalled' };
  fs.mkdirSync(workDir, { recursive: true });
  const schemaFile = path.join(workDir, 'schema-' + process.pid + '-' + Date.now() + '.json');
  fs.writeFileSync(schemaFile, JSON.stringify(task.schema));
  let last = null;
  let usage = null;
  try {
    const res = await exec(found, [...baseArgs(settings, workDir, task.web), '--output-schema', schemaFile, '-'],
      // Codex takes no separate system prompt: the instructions lead the message
      `${task.system}\n\n---\n\n${task.prompt}`,
      {
        signal,
        onEvent: (ev) => {
          const p = progressFrom(ev);
          if (p && onProgress) onProgress(p);
          if (ev.type === 'item.completed' && ev.item && ev.item.type === 'agent_message') last = ev.item.text;
          if (ev.type === 'turn.completed') usage = ev.usage;
        }
      });
    if (res.cancelled || last == null) return failure(res);
    const data = parseJsonLoose(last);
    if (!data) return { ok: false, error: 'failed', detail: 'unparseable: ' + String(last).slice(0, 300) };
    return { ok: true, data, usage, plan: true };
  } finally {
    fs.rmSync(schemaFile, { force: true });
  }
}

async function chat(req, settings, { signal, onProgress, onDelta, workDir }) {
  const found = await findCodex(settings.codexPath);
  if (!found) return { ok: false, error: 'notInstalled' };
  fs.mkdirSync(workDir, { recursive: true });
  const parts = [];
  let usage = null;
  const res = await exec(found, [...baseArgs(settings, workDir, req.web), '-'],
    `${req.system}\n\n---\n\n${chatAsPrompt(req)}`,
    {
      signal,
      onEvent: (ev) => {
        const p = progressFrom(ev);
        if (p && onProgress) onProgress(p);
        if (ev.type === 'item.completed' && ev.item && ev.item.type === 'agent_message' && ev.item.text) {
          // Codex hands over whole messages, not deltas
          const chunk = (parts.length ? '\n\n' : '') + ev.item.text;
          parts.push(ev.item.text);
          if (onDelta) onDelta(chunk);
        }
        if (ev.type === 'turn.completed') usage = ev.usage;
      }
    });
  // earlier messages are Codex narrating its steps ("Let me check…"); the last one is the answer
  const text = (parts[parts.length - 1] || '').trim();
  if (res.cancelled || !text) return failure(res, parts.join('\n\n').trim());
  return { ok: true, text, usage, plan: true };
}

module.exports = { id: 'codex', web: true, status, runTask, chat };
