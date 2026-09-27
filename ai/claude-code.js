// Mutiny — the Claude Code provider (main process).
// Runs tasks through the Claude Agent SDK on the writer's own Claude Code
// install and login: no API key, and the same binary and version they use
// in the terminal. Every run is locked down — only the tools a task names,
// permission mode 'dontAsk' (anything else is refused, never prompted),
// none of the writer's Claude Code settings/CLAUDE.md/hooks/MCP, and an
// empty scratch folder as the working directory. The agent never writes:
// it returns JSON against the task's schema and Mutiny decides what to keep.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { cleanModel, cleanEffort, toolPathOk, cliEnv, toolDirs } = require('./guard.js');

// Launched from a desktop launcher, the app may not see the shell's PATH
// (mise, nvm, ~/.local/bin), so the usual install spots are checked too.
function candidatePaths() {
  const home = os.homedir();
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
  const fromPath = (process.env.PATH || '').split(path.delimiter).filter(Boolean).map((d) => path.join(d, exe));
  // the native installer (every system) puts claude.exe/claude in ~/.local/bin;
  // an npm install on Windows leaves only claude.cmd, which can't be run safely
  const known = [
    path.join(home, '.local', 'share', 'mise', 'installs', 'claude', 'latest', exe),
    ...toolDirs().map((d) => path.join(d, exe))
  ];
  return [...new Set([...fromPath, ...known])];
}

function run(file, args, timeout = 15000) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      resolve(err ? null : String(stdout || ''));
    });
  });
}

// the first candidate that answers `--version` like Claude Code does
async function findClaude(preferred) {
  // a typed path is only tried if it names claude — it gets executed
  const list = toolPathOk(preferred, 'claude') ? [preferred, ...candidatePaths()] : candidatePaths();
  for (const p of list) {
    try {
      if (!fs.statSync(p).isFile()) continue;
    } catch { continue; }
    const out = await run(p, ['--version']);
    if (out && /claude code/i.test(out)) return { path: p, version: out.trim().split(/\s+/)[0] };
  }
  return null;
}

// installed? logged in? which plan? — free: no model call is made
async function status(preferred) {
  const found = await findClaude(preferred);
  if (!found) return { installed: false };
  const out = await run(found.path, ['auth', 'status', '--json']);
  let auth = {};
  try { auth = JSON.parse(out || '{}'); } catch { /* old CLI */ }
  return {
    installed: true,
    path: found.path,
    version: found.version,
    loggedIn: !!auth.loggedIn,
    plan: auth.subscriptionType || (auth.authMethod === 'api_key' ? 'api' : null)
  };
}

// What the agent is doing, in a few words, for the progress chip.
function progressFrom(message) {
  if (message.type !== 'assistant' || !message.message) return null;
  for (const block of message.message.content || []) {
    if (block.type !== 'tool_use') continue;
    const input = block.input || {};
    if (block.name === 'WebSearch' && input.query) return { stage: 'search', detail: String(input.query) };
    if (block.name === 'WebFetch' && input.url) {
      try { return { stage: 'read', detail: new URL(input.url).hostname.replace(/^www\./, '') }; } catch { /* keep going */ }
    }
  }
  return { stage: 'think' };
}

let sdk = null;
async function loadSdk() {
  // the SDK is an ES module; main.js is CommonJS
  if (!sdk) sdk = await import('@anthropic-ai/claude-agent-sdk');
  return sdk;
}

const WEB_TOOLS = ['WebSearch', 'WebFetch'];

// Everything every run shares: the lockdown, the model, and — so nothing of
// the essay is left behind in ~/.claude/projects — no session on disk.
function baseOptions(found, settings, workDir, controller, web, maxTurns) {
  const options = {
    pathToClaudeCodeExecutable: found.path,
    cwd: workDir,
    tools: web ? WEB_TOOLS : [],
    allowedTools: web ? WEB_TOOLS : [],
    permissionMode: 'dontAsk',
    settingSources: [],
    persistSession: false,
    maxTurns,
    abortController: controller,
    // only what Claude Code needs (its login, the network) — not the writer's other secrets
    env: cliEnv(['ANTHROPIC_', 'CLAUDE_'], { CLAUDE_AGENT_SDK_CLIENT_APP: 'mutiny/' + (settings.appVersion || '0') })
  };
  if (cleanModel(settings.model)) options.model = cleanModel(settings.model);
  if (cleanEffort(settings.effort)) options.effort = cleanEffort(settings.effort);
  return options;
}

function linkAbort(signal) {
  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller;
}

// Iterate a query until it ends or is cancelled; a cancel answers at once
// while Claude Code winds down in the background.
async function drain(stream, controller, onMessage) {
  const consume = (async () => {
    for await (const message of stream) {
      if (controller.signal.aborted) break;
      onMessage(message);
    }
  })();
  const cancelled = new Promise((resolve) => {
    if (controller.signal.aborted) resolve('cancelled');
    controller.signal.addEventListener('abort', () => resolve('cancelled'), { once: true });
  });
  const how = await Promise.race([consume.then(() => 'done'), cancelled]);
  if (how === 'cancelled') consume.catch(() => { /* surfaces once the process exits */ });
  return how;
}

/**
 * Run one task. Resolves { ok: true, data, costUsd } or { ok: false, error }.
 * task: { system, prompt, schema, web, maxTurns }
 * settings: { claudePath?, model?, effort? }
 */
async function runTask(task, settings, { signal, onProgress, workDir }) {
  const found = await findClaude(settings.claudePath);
  if (!found) return { ok: false, error: 'notInstalled' };
  const { query } = await loadSdk();
  const controller = linkAbort(signal);
  fs.mkdirSync(workDir, { recursive: true });
  const options = {
    ...baseOptions(found, settings, workDir, controller, task.web, task.maxTurns || 12),
    systemPrompt: task.system,
    outputFormat: { type: 'json_schema', schema: task.schema }
  };
  let result = null;
  try {
    const how = await drain(query({ prompt: task.prompt, options }), controller, (message) => {
      const p = progressFrom(message);
      if (p && onProgress) onProgress(p);
      if (message.type === 'result') result = message;
    });
    if (how === 'cancelled') return { ok: false, error: 'cancelled' };
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, error: 'cancelled' };
    return { ok: false, error: 'failed', detail: String((err && err.message) || err) };
  }
  if (controller.signal.aborted) return { ok: false, error: 'cancelled' };
  if (!result) return { ok: false, error: 'failed', detail: 'no result' };
  if (result.subtype !== 'success' || result.is_error) {
    return { ok: false, error: result.subtype === 'error_max_turns' ? 'tooLong' : 'failed', detail: result.subtype };
  }
  if (result.structured_output == null) return { ok: false, error: 'failed', detail: 'no structured output' };
  return { ok: true, data: result.structured_output, costUsd: result.total_cost_usd, plan: true };
}

// Chat: free text, streamed as it's written. req from tasks.chat().
async function chat(req, settings, { signal, onProgress, onDelta, workDir }) {
  const found = await findClaude(settings.claudePath);
  if (!found) return { ok: false, error: 'notInstalled' };
  const { query } = await loadSdk();
  const { chatAsPrompt } = require('./tasks.js');
  const controller = linkAbort(signal);
  fs.mkdirSync(workDir, { recursive: true });
  const options = {
    ...baseOptions(found, settings, workDir, controller, req.web, req.maxTurns || 4),
    systemPrompt: req.system,
    includePartialMessages: true
  };
  let result = null;
  let text = '';
  try {
    const how = await drain(query({ prompt: chatAsPrompt(req), options }), controller, (message) => {
      if (message.type === 'stream_event') {
        const ev = message.event || {};
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
          text += ev.delta.text;
          if (onDelta) onDelta(ev.delta.text);
        } else if (ev.type === 'message_start' && text) {
          // a new model turn after a tool call starts a fresh paragraph
          text += '\n\n';
          if (onDelta) onDelta('\n\n');
        }
        return;
      }
      const p = progressFrom(message);
      if (p && p.stage !== 'think' && onProgress) onProgress(p);
      if (message.type === 'result') result = message;
    });
    if (how === 'cancelled') return { ok: false, error: 'cancelled', text };
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, error: 'cancelled', text };
    return { ok: false, error: 'failed', detail: String((err && err.message) || err) };
  }
  if (!result || result.subtype !== 'success' || result.is_error) {
    return { ok: false, error: 'failed', detail: result ? (result.result || result.subtype) : 'no result', text };
  }
  // the final result is the authoritative text (streaming may interleave turns)
  return { ok: true, text: (result.result || text).trim(), costUsd: result.total_cost_usd, plan: true };
}

module.exports = { id: 'claude-code', web: true, status, runTask, chat, findClaude };
