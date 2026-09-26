// Mutiny — the OpenAI-compatible provider (main process): any server that
// speaks /v1/chat/completions — OpenAI, Gemini's OpenAI endpoint, OpenRouter,
// Cerebras, llama.cpp, Ollama, LM Studio… — with a base URL, an optional key
// and a model. No web access here: tasks that need it are refused up front
// (the interface hides them).
// Structured output is asked for as json_schema; servers that don't take it
// are retried with json_object, then with the schema in the prompt only, and
// the answer is validated either way. Reasoning models' reasoning_content is
// ignored — only the final content counts.

'use strict';

const { parseJsonLoose, matchesSchema } = require('./tasks.js');
const { cleanModel, cleanEffort, isLocalHost } = require('./guard.js');

const PRESETS = {
  openai: { url: 'https://api.openai.com/v1', model: 'gpt-5-mini', key: true, env: 'OPENAI_API_KEY' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', key: true, env: 'GEMINI_API_KEY' },
  openrouter: { url: 'https://openrouter.ai/api/v1', model: '', key: true, env: 'OPENROUTER_API_KEY' },
  cerebras: { url: 'https://api.cerebras.ai/v1', model: 'gpt-oss-120b', key: true, env: 'CEREBRAS_API_KEY' },
  ollama: { url: 'http://127.0.0.1:11434/v1', model: '', key: false },
  llamacpp: { url: 'http://127.0.0.1:8080/v1', model: '', key: false },
  custom: { url: '', model: '', key: false }
};

// Services with a key have a fixed address: the URL can't be pointed
// elsewhere, so a saved key only ever travels to its own service. Local and
// custom servers take any URL, and their key is bound to that server's host.
const FIXED = (preset) => !!(PRESETS[preset] && PRESETS[preset].key);

function conf(settings) {
  const preset = PRESETS[settings.compatPreset] ? settings.compatPreset : 'custom';
  const url = FIXED(preset) ? PRESETS[preset].url : String(settings.compatUrl || PRESETS[preset].url || '');
  let clean = '';
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:') clean = u.href.replace(/\/+$/, '');
  } catch { /* not a URL */ }
  return { preset, url: clean, model: cleanModel(settings.compatModel) || PRESETS[preset].model || '' };
}

const hostTag = (url) => { try { return new URL(url).host.toLowerCase().replace(/[^a-z0-9]/g, ''); } catch { return ''; } };
const keyName = (preset, url) => 'ai-key-compat-' + (FIXED(preset) ? preset : preset + hostTag(url));

// a key saved in Mutiny wins; otherwise the service's usual environment
// variable (fixed services only). Never over plain http to another machine.
function keyFor(c, readSecret) {
  if (c.url.startsWith('http:') && !isLocalHost(c.url)) return null;
  const env = FIXED(c.preset) && PRESETS[c.preset].env;
  return readSecret(keyName(c.preset, c.url)) || (env && process.env[env]) || null;
}

function headers(key) {
  const h = { 'Content-Type': 'application/json', 'User-Agent': 'Mutiny' };
  if (key) h.Authorization = 'Bearer ' + key;
  return h;
}

async function post(c, key, body, signal) {
  if (!c.url) return { error: 'failed', detail: 'no base URL' };
  let res;
  try {
    // no redirects: a key must not follow a 30x to some other host
    res = await fetch(c.url + '/chat/completions', { method: 'POST', headers: headers(key), body: JSON.stringify(body), signal, redirect: 'error' });
  } catch (err) {
    if (signal && signal.aborted) return { error: 'cancelled' };
    return { error: 'unreachable', detail: String((err && err.cause && err.cause.code) || err.message || err) };
  }
  return { res };
}

async function errorFrom(res) {
  let detail = '';
  try { detail = (await res.text()).slice(0, 600); } catch { /* none */ }
  if (res.status === 401 || res.status === 403) return { ok: false, error: 'badKey', detail };
  if (res.status === 402 || /quota|billing|credit|insufficient/i.test(detail)) return { ok: false, error: 'noCredit', detail };
  if (res.status === 429) return { ok: false, error: 'rateLimited', detail };
  if (res.status === 404 && /model/i.test(detail)) return { ok: false, error: 'badModel', detail };
  return { ok: false, error: 'failed', detail: `HTTP ${res.status} ${detail}`, status: res.status };
}

async function status(settings, { readSecret }) {
  const c = conf(settings || {});
  return {
    installed: !!c.url,
    loggedIn: !PRESETS[c.preset].key || !!keyFor(c, readSecret),
    keyFromEnv: !readSecret(keyName(c.preset, c.url)) && !!keyFor(c, readSecret) ? PRESETS[c.preset].env : null,
    keyName: keyName(c.preset, c.url),
    plan: 'API',
    model: c.model,
    url: c.url
  };
}

// GET /models — fills the model picker in settings
async function listModels(settings, { readSecret }) {
  const c = conf(settings || {});
  if (!c.url) return [];
  try {
    const res = await fetch(c.url + '/models', { headers: headers(keyFor(c, readSecret)), signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.data || d.models || []).map((m) => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean).sort();
  } catch { return []; }
}

async function runTask(task, settings, { signal, onProgress, readSecret }) {
  if (task.web) return { ok: false, error: 'noWeb' };
  const c = conf(settings);
  if (!c.model) return { ok: false, error: 'badModel', detail: 'no model set' };
  const key = keyFor(c, readSecret);
  const messages = [
    { role: 'system', content: `${task.system}\n\nReply with only a JSON object matching this schema — no prose, no code fences:\n${JSON.stringify(task.schema)}` },
    { role: 'user', content: task.prompt }
  ];
  const formats = [
    { type: 'json_schema', json_schema: { name: 'result', strict: true, schema: task.schema } },
    { type: 'json_object' },
    null
  ];
  let last = null;
  for (const fmt of formats) {
    if (onProgress) onProgress({ stage: 'think' });
    const body = { model: c.model, messages, stream: false };
    if (fmt) body.response_format = fmt;
    if (cleanEffort(settings.effort)) body.reasoning_effort = cleanEffort(settings.effort);
    const r = await post(c, key, body, signal);
    if (r.error) return { ok: false, error: r.error, detail: r.detail };
    if (!r.res.ok) {
      last = await errorFrom(r.res);
      // an unsupported response_format (or reasoning_effort) is a 400/422: try the next form
      if ((last.status === 400 || last.status === 422) && fmt) {
        if (/reasoning_effort/i.test(last.detail || '')) delete settings.effort;
        continue;
      }
      return last;
    }
    const d = await r.res.json();
    const content = (((d.choices || [])[0] || {}).message || {}).content;
    const data = parseJsonLoose(Array.isArray(content) ? content.map((p) => p.text || '').join('') : content);
    if (data && matchesSchema(data, task.schema)) return { ok: true, data, usage: d.usage };
    last = { ok: false, error: 'failed', detail: 'answer did not match the format: ' + String(content || '').slice(0, 300) };
  }
  return last || { ok: false, error: 'failed' };
}

async function chat(req, settings, { signal, onDelta, readSecret }) {
  if (req.web) return { ok: false, error: 'noWeb' };
  const c = conf(settings);
  if (!c.model) return { ok: false, error: 'badModel', detail: 'no model set' };
  const body = {
    model: c.model,
    stream: true,
    messages: [{ role: 'system', content: req.system }, ...req.messages]
  };
  if (cleanEffort(settings.effort)) body.reasoning_effort = cleanEffort(settings.effort);
  const r = await post(c, keyFor(c, readSecret), body, signal);
  if (r.error) return { ok: false, error: r.error, detail: r.detail };
  if (!r.res.ok) return errorFrom(r.res);
  let text = '';
  let usage = null;
  try {
    const decoder = new TextDecoder();
    let buf = '';
    for await (const chunk of r.res.body) {
      buf += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        let d;
        try { d = JSON.parse(payload); } catch { continue; }
        if (d.usage) usage = d.usage;
        const delta = (((d.choices || [])[0] || {}).delta || {}).content;
        if (delta) { text += delta; if (onDelta) onDelta(delta); }
      }
    }
  } catch (err) {
    if (signal && signal.aborted) return { ok: false, error: 'cancelled', text };
    return { ok: false, error: 'failed', detail: String(err.message || err), text };
  }
  if (signal && signal.aborted) return { ok: false, error: 'cancelled', text };
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!text) return { ok: false, error: 'failed', detail: 'empty answer' };
  return { ok: true, text, usage };
}

module.exports = { id: 'compat', web: false, status, runTask, chat, listModels, PRESETS, keyName };
