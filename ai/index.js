// Mutiny — AI in the main process: the IPC surface the renderer talks to.
// One job at a time; each can be cancelled. Providers share one shape
// ({ status, runTask }) so API-key providers can join later (PRD phase 3b).

'use strict';

const path = require('path');
const { app, ipcMain } = require('electron');
const tasks = require('./tasks.js');

const PROVIDERS = { 'claude-code': require('./claude-code.js') };

let current = null; // { id, controller }

function provider(settings) {
  return PROVIDERS[(settings && settings.provider) || 'claude-code'] || PROVIDERS['claude-code'];
}

function register(logError) {
  ipcMain.handle('ai:status', async (_e, settings) => {
    try {
      return await provider(settings).status((settings || {}).claudePath);
    } catch (err) {
      logError('ai-status', err);
      return { installed: false };
    }
  });

  ipcMain.handle('ai:run', async (e, jobId, taskName, input, settings) => {
    const build = tasks[taskName];
    if (typeof build !== 'function' || taskName === 'CATEGORIES' || taskName === 'MODES') {
      return { ok: false, error: 'failed', detail: 'unknown task' };
    }
    if (current) return { ok: false, error: 'busy' };
    const controller = new AbortController();
    current = { id: jobId, controller };
    const send = (p) => { if (!e.sender.isDestroyed()) e.sender.send('ai:progress', { jobId, ...p }); };
    try {
      return await provider(settings).runTask(build(input || {}), { ...(settings || {}), appVersion: app.getVersion() }, {
        signal: controller.signal,
        onProgress: send,
        // an empty folder of its own: the tasks carry their text in the prompt
        workDir: path.join(app.getPath('userData'), 'ai-workspace')
      });
    } catch (err) {
      logError('ai-run', err);
      return { ok: false, error: 'failed', detail: String((err && err.message) || err) };
    } finally {
      if (current && current.id === jobId) current = null;
    }
  });

  ipcMain.handle('ai:cancel', (_e, jobId) => {
    if (current && (!jobId || current.id === jobId)) current.controller.abort();
    return true;
  });
}

module.exports = { register };
