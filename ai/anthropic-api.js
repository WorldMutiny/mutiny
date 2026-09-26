// Mutiny — the Anthropic API provider (main process), with the writer's API
// key (stored encrypted outside the library). Default model Claude Opus 5.
// - critique / rewrite: structured output (output_config.format json_schema)
// - research: Anthropic's server-side web search + fetch, JSON asked for in
//   the final message and validated (a paused server-tool turn is resumed)
// - chat: streamed; the essay context sits in a cached system block, so
//   follow-up messages bill it at cache-read rates
// On Claude Opus 5 a policy decline falls back server-side (fallbacks: "default").

'use strict';

const { parseJsonLoose, matchesSchema } = require('./tasks.js');

const MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'];
const DEFAULT_MODEL = 'claude-opus-5';
// $ per million tokens: input, output (cache reads 0.1×, cache writes 1.25× input)
const PRICES = {
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-haiku-4-5': [1, 5],
  'claude-opus-4-8': [5, 25]
};
const WEB_SEARCH_PER_USE = 0.01;

let AnthropicCtor = null;
function client(key) {
  if (!AnthropicCtor) AnthropicCtor = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
  return new AnthropicCtor({ apiKey: key, maxRetries: 1 });
}

function modelOf(settings) {
  return MODELS.includes(settings.apiModel) ? settings.apiModel : DEFAULT_MODEL;
}

// the request options that depend on the model
function modelParams(model, settings) {
  const p = { model };
  if (model === 'claude-haiku-4-5') return p; // no effort / adaptive thinking there
  p.thinking = { type: 'adaptive' };
  if (settings.effort) p.output_config = { effort: settings.effort };
  if (model === 'claude-opus-5') {
    p.betas = ['server-side-fallback-2026-07-01'];
    p.fallbacks = 'default';
  }
  return p;
}

function costOf(usage, model) {
  if (!usage) return null;
  const [inP, outP] = PRICES[usage.model || model] || PRICES[DEFAULT_MODEL];
  const m = 1e6;
  let usd = (usage.input_tokens || 0) * inP / m +
    (usage.cache_read_input_tokens || 0) * inP * 0.1 / m +
    (usage.cache_creation_input_tokens || 0) * inP * 1.25 / m +
    (usage.output_tokens || 0) * outP / m;
  const searches = usage.server_tool_use && usage.server_tool_use.web_search_requests;
  if (searches) usd += searches * WEB_SEARCH_PER_USE;
  return usd;
}

function addUsage(a, b) {
  if (!b) return a;
  const out = { ...(a || {}) };
  for (const k of ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']) {
    out[k] = (out[k] || 0) + (b[k] || 0);
  }
  const ws = (b.server_tool_use && b.server_tool_use.web_search_requests) || 0;
  out.server_tool_use = { web_search_requests: ((out.server_tool_use || {}).web_search_requests || 0) + ws };
  return out;
}

function errorOf(err) {
  const status = err && err.status;
  const msg = String((err && err.message) || err);
  if (err && err.name === 'APIUserAbortError') return { ok: false, error: 'cancelled' };
  if (status === 401 || status === 403) return { ok: false, error: 'badKey', detail: msg };
  if (/credit balance|billing|purchase credits/i.test(msg)) return { ok: false, error: 'noCredit', detail: msg };
  if (status === 429) return { ok: false, error: 'rateLimited', detail: msg };
  return { ok: false, error: 'failed', detail: msg };
}

function textOf(message) {
  return (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// a key saved in Mutiny wins; otherwise ANTHROPIC_API_KEY
const keyOf = (readSecret) => readSecret('ai-key-anthropic') || process.env.ANTHROPIC_API_KEY || null;

async function status(settings, { readSecret }) {
  return {
    installed: true, loggedIn: !!keyOf(readSecret), plan: 'API', model: modelOf(settings || {}),
    keyFromEnv: !readSecret('ai-key-anthropic') && process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY' : null
  };
}

const WEB_TOOLS = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6 }
];

async function runTask(task, settings, { signal, onProgress, readSecret }) {
  const key = keyOf(readSecret);
  if (!key) return { ok: false, error: 'badKey', detail: 'no key' };
  const api = client(key);
  const model = modelOf(settings);
  const { betas, ...params } = modelParams(model, settings);
  const call = (body) => (betas
    ? api.beta.messages.stream({ ...body, betas }, { signal })
    : api.messages.stream(body, { signal })).finalMessage();
  let usage = null;
  try {
    if (!task.web) {
      const msg = await call({
        ...params, max_tokens: 16000, system: task.system,
        messages: [{ role: 'user', content: task.prompt }],
        output_config: { ...(params.output_config || {}), format: { type: 'json_schema', schema: task.schema } }
      });
      usage = msg.usage;
      if (msg.stop_reason === 'refusal') return { ok: false, error: 'refused', detail: JSON.stringify(msg.stop_details || {}) };
      const data = parseJsonLoose(textOf(msg));
      if (!data) return { ok: false, error: 'failed', detail: 'no JSON' };
      return { ok: true, data, costUsd: costOf(usage, model) };
    }
    // research: server web tools, then JSON in the final text
    const system = `${task.system}\n\nWhen you are done, reply with only a JSON object matching this schema — no prose, no code fences:\n${JSON.stringify(task.schema)}`;
    const messages = [{ role: 'user', content: task.prompt }];
    let msg = null;
    for (let turn = 0; turn < 4; turn++) {
      if (onProgress) onProgress({ stage: 'search', detail: '' });
      msg = await call({ ...params, max_tokens: 32000, system, tools: WEB_TOOLS, messages });
      usage = addUsage(usage, msg.usage);
      for (const b of msg.content || []) {
        if (b.type === 'server_tool_use' && onProgress) {
          const inp = b.input || {};
          if (inp.query) onProgress({ stage: 'search', detail: inp.query });
          else if (inp.url) { try { onProgress({ stage: 'read', detail: new URL(inp.url).hostname.replace(/^www\./, '') }); } catch { /* skip */ } }
        }
      }
      if (msg.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: msg.content }); // resume the paused server-tool turn
    }
    if (msg.stop_reason === 'refusal') return { ok: false, error: 'refused', detail: JSON.stringify(msg.stop_details || {}) };
    const data = parseJsonLoose(textOf(msg));
    if (!data || !matchesSchema(data, task.schema)) return { ok: false, error: 'failed', detail: 'no JSON: ' + textOf(msg).slice(0, 300) };
    return { ok: true, data, costUsd: costOf(usage, model) };
  } catch (err) {
    if (signal && signal.aborted) return { ok: false, error: 'cancelled' };
    return errorOf(err);
  }
}

async function chat(req, settings, { signal, onProgress, onDelta, readSecret }) {
  const key = keyOf(readSecret);
  if (!key) return { ok: false, error: 'badKey', detail: 'no key' };
  const api = client(key);
  const model = modelOf(settings);
  const { betas, ...params } = modelParams(model, settings);
  const body = {
    ...params,
    max_tokens: 16000,
    // the essay context changes rarely between messages: cache it
    system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
    messages: req.messages,
    ...(req.web ? { tools: WEB_TOOLS } : {})
  };
  let text = '';
  try {
    const stream = betas ? api.beta.messages.stream({ ...body, betas }, { signal }) : api.messages.stream(body, { signal });
    stream.on('text', (d) => { text += d; if (onDelta) onDelta(d); });
    stream.on('contentBlock', (b) => {
      if (b.type === 'server_tool_use' && onProgress && b.input && b.input.query) onProgress({ stage: 'search', detail: b.input.query });
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') return { ok: false, error: 'refused', text };
    return { ok: true, text: (textOf(msg) || text).trim(), costUsd: costOf(msg.usage, model) };
  } catch (err) {
    if (signal && signal.aborted) return { ok: false, error: 'cancelled', text };
    return errorOf(err);
  }
}

module.exports = { id: 'anthropic', web: true, status, runTask, chat, MODELS };
