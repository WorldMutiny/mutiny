// Mutiny — AI in the main process: the IPC surface the renderer talks to.
// One job at a time; each can be cancelled. Every provider has the same
// shape — { id, web, status, runTask, chat } — and reads API keys itself
// through readSecret; keys never travel to the renderer.

'use strict';

const path = require('path');
const { app, ipcMain } = require('electron');
const tasks = require('./tasks.js');

const PROVIDERS = {
  'claude-code': require('./claude-code.js'),
  codex: require('./codex.js'),
  anthropic: require('./anthropic-api.js'),
  compat: require('./openai-compat.js')
};
const RUNNABLE = ['research', 'critique', 'rewrite', 'ping', 'styleProfile'];
// tasks that write in the writer's voice read estilo.md here, in the main
// process — the renderer can't feed a different "style" into the prompt
const STYLED = ['rewrite'];

let current = null; // { id, controller }

function provider(settings) {
  return PROVIDERS[(settings && settings.provider) || 'claude-code'] || PROVIDERS['claude-code'];
}

function register(logError, readSecret, readStyle) {
  const styleFor = (settings) => (settings && settings.useStyle === false ? '' : readStyle());
  const deps = { readSecret };
  const workDir = () => path.join(app.getPath('userData'), 'ai-workspace');

  ipcMain.handle('ai:status', async (_e, settings) => {
    try {
      const p = provider(settings);
      return { ...(await p.status({ ...(settings || {}) }, deps)), provider: p.id, web: p.web };
    } catch (err) {
      logError('ai-status', err);
      return { installed: false };
    }
  });

  ipcMain.handle('ai:models', async (_e, settings) => {
    const p = provider(settings);
    return p.listModels ? p.listModels({ ...(settings || {}) }, deps) : (p.MODELS || []);
  });

  // one job at a time — task (structured) or chat (streamed text)
  async function guarded(e, jobId, fn) {
    if (current) return { ok: false, error: 'busy' };
    const controller = new AbortController();
    current = { id: jobId, controller };
    const send = (channel, payload) => { if (!e.sender.isDestroyed()) e.sender.send(channel, { jobId, ...payload }); };
    try {
      return await fn(controller.signal, send);
    } catch (err) {
      logError('ai', err);
      return { ok: false, error: 'failed', detail: String((err && err.message) || err) };
    } finally {
      if (current && current.id === jobId) current = null;
    }
  }

  ipcMain.handle('ai:run', (e, jobId, taskName, input, settings) => {
    if (!RUNNABLE.includes(taskName)) return { ok: false, error: 'failed', detail: 'unknown task' };
    const p = provider(settings);
    const clean = { ...(input || {}) };
    delete clean.style;
    if (STYLED.includes(taskName)) clean.style = styleFor(settings);
    const task = tasks[taskName](clean);
    if (task.web && !p.web) return { ok: false, error: 'noWeb' };
    return guarded(e, jobId, (signal, send) => p.runTask(task,
      { ...(settings || {}), appVersion: app.getVersion() },
      { signal, onProgress: (x) => send('ai:progress', x), workDir: workDir(), readSecret }));
  });

  ipcMain.handle('ai:chat', (e, jobId, input, settings) => {
    const p = provider(settings);
    const req = tasks.chat({ ...(input || {}), style: styleFor(settings), web: !!(input && input.web && p.web) });
    if (!req.messages.length) return { ok: false, error: 'failed', detail: 'empty' };
    return guarded(e, jobId, (signal, send) => p.chat(req,
      { ...(settings || {}), appVersion: app.getVersion() },
      {
        signal,
        onProgress: (x) => send('ai:progress', x),
        onDelta: (text) => send('ai:delta', { text }),
        workDir: workDir(),
        readSecret
      }));
  });

  ipcMain.handle('ai:cancel', (_e, jobId) => {
    if (current && (!jobId || current.id === jobId)) current.controller.abort();
    return true;
  });
}

module.exports = { register, PRESETS: PROVIDERS.compat.PRESETS };
