/* ============================ MUTINY ============================ */
/* The assistant, in the interface: settings, the progress chip, and   */
/* the three tasks — research a ⚑ note, critique, rewrite. The main    */
/* process runs them (ai/); nothing reaches the page until the writer  */
/* accepts it. Loaded after app.js and shares its globals.             */

'use strict';

let aiJob = null; // { id, label, dialog?, background? }
let aiLastBackground = false; // the last task finished after "Keep writing"
let aiReadyAction = null; // the chip, turned into "ready — see", runs this
const aiConf = () => (library && library.ai) || {};
const aiEnabled = () => !!aiConf().enabled;
// what the main process needs to pick and configure a provider
const aiSettings = () => { const { enabled, ...rest } = aiConf(); return rest; };
// OpenAI-compatible servers have no web access: research and web chat are off there
const aiHasWeb = () => (aiConf().provider || 'claude-code') !== 'compat';

// ---------------------------------------------------------------- progress chip

function aiChip(text) {
  const chip = $('#ai-status');
  if (!text) { chip.hidden = true; return; }
  chip.hidden = false;
  chip.querySelector('.ai-text').textContent = text;
}

window.neo.onAiProgress((m) => {
  if (!aiJob || m.jobId !== aiJob.id) return;
  const text = m.stage === 'search' && m.detail ? t('ai.progress.search', { q: m.detail })
    : m.stage === 'read' && m.detail ? t('ai.progress.read', { site: m.detail })
    : m.stage === 'search' ? t('chat.searching')
    : aiJob.label;
  aiChip(text);
  if (aiJob.dialog) aiJob.dialog.stage(text);
  if (typeof chatStatus === 'function' && chatLive) chatStatus(text);
});

// the chip stops a running task, or — once a task sent to the background is
// done — opens what it produced
$('#ai-status').onclick = () => {
  if (aiReadyAction) {
    const run = aiReadyAction;
    aiReadyAction = null;
    $('#ai-status').classList.remove('ready');
    aiChip(null);
    run();
    return;
  }
  aiCancel();
};

function aiReady(text, run) {
  aiReadyAction = run;
  aiChip(text);
  $('#ai-status').classList.add('ready');
}

// ---------------------------------------------------------------- progress dialog

const clipText = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// who is doing the work, as the writer set it up
function aiWho() {
  const c = aiConf();
  const p = c.provider || 'claude-code';
  if (p === 'compat') return [t('ai.preset.' + (c.compatPreset || 'custom')), c.compatModel].filter(Boolean).join(' · ');
  const name = { 'claude-code': 'Claude Code', codex: 'Codex', anthropic: t('ai.who.api') }[p] || p;
  const model = p === 'anthropic' ? c.apiModel : c.model;
  return name + ' · ' + (model || t('ai.who.defaultModel'));
}

// Every task shows itself where the writer is looking: what it does, on how
// much text, with whom, for how long, and Stop — the chip below stays too.
// d: { title, detail, wait, background } — background adds "Keep writing",
// for tasks whose results keep on their own (critique, research, style).
function aiDialog(d) {
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop ap-backdrop';
  bd.innerHTML = `
    <div class="modal ap-modal" style="width:470px">
      <h2 style="font-size:16px"></h2>
      <p class="ap-detail"></p>
      <div class="sp-line"><span class="ai-spin"></span><span class="ap-stage"></span><span class="ap-time soft"></span></div>
      <p class="soft ap-meta" style="font-size:12px"></p>
      <div class="ap-actions">
        ${d.background ? `<button class="ap-bg btn-quiet" title="${t('ai.keepWritingTitle')}">${t('ai.keepWriting')}</button>` : ''}
        <button class="ap-stop btn-quiet">${t('ai.stop')}</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  // titles and details can carry the writer's words: text, never markup
  bd.querySelector('h2').textContent = d.title || '';
  const detail = bd.querySelector('.ap-detail');
  if (d.detail) detail.textContent = d.detail; else detail.remove();
  bd.querySelector('.ap-meta').textContent = [aiWho(), d.wait].filter(Boolean).join(' · ');
  const stageEl = bd.querySelector('.ap-stage');
  const t0 = Date.now();
  const tick = () => { bd.querySelector('.ap-time').textContent = t('ai.secs', { n: Math.round((Date.now() - t0) / 1000) }); };
  tick();
  const timer = setInterval(tick, 1000);
  const api = {
    open: true,
    stage(text) { if (api.open) stageEl.textContent = text; },
    close() { clearInterval(timer); api.open = false; bd.remove(); }
  };
  const stop = () => { stageEl.textContent = t('ai.stopping'); aiCancel(); };
  bd.querySelector('.ap-stop').onclick = stop;
  const bg = bd.querySelector('.ap-bg');
  if (bg) bg.onclick = () => {
    if (aiJob) aiJob.background = true;
    api.close();
    toast(t('ai.inBackground'), 5000);
  };
  bd.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') stop(); });
  (bg || bd.querySelector('.ap-stop')).focus();
  return api;
}

function aiCancel() {
  if (!aiJob) return false;
  window.neo.aiCancel(aiJob.id);
  return true;
}

// Run a task with the chip up; resolves to its data, or null (and a toast)
// dialog: what aiDialog shows (see above); false for none
async function aiRun(task, input, label, dialog) {
  aiLastBackground = false;
  if (!aiEnabled()) {
    toast(t('ai.off'), 6000);
    openAiSettings();
    return null;
  }
  if (aiJob) { toast(t('ai.busy')); return null; }
  const id = 'job-' + Date.now().toString(36);
  aiJob = { id, label };
  aiReadyAction = null;
  $('#ai-status').classList.remove('ready');
  aiChip(label);
  if (dialog !== false) {
    aiJob.dialog = aiDialog(dialog || { title: label });
    aiJob.dialog.stage(label);
  }
  let res;
  try {
    res = await window.neo.aiRun(id, task, input, aiSettings());
  } catch (err) {
    res = { ok: false, error: 'failed', detail: String(err) };
  } finally {
    if (aiJob.dialog) aiJob.dialog.close();
    aiLastBackground = !!aiJob.background;
    aiJob = null;
    aiChip(null);
    if (typeof renderStickies === 'function' && book) renderStickies();
  }
  if (res.ok) return res.data;
  if (res.error === 'cancelled') { toast(t('ai.cancelled')); return null; }
  const login = /not logged in|\/login/i.test(res.detail || '');
  toast(aiErrorText(res), 9000);
  if (res.detail) window.neo.logError('ai: ' + res.error + ' — ' + res.detail);
  return null;
}

function aiErrorText(res) {
  const login = /not logged in|\/login/i.test(res.detail || '');
  if (login) return t((aiConf().provider || 'claude-code') === 'codex' ? 'ai.err.loginCodex' : 'ai.err.login');
  const known = ['notInstalled', 'busy', 'tooLong', 'badKey', 'noCredit', 'rateLimited', 'badModel', 'unreachable', 'noWeb', 'refused'];
  return t('ai.err.' + (known.includes(res.error) ? res.error : 'failed'));
}

// ---------------------------------------------------------------- settings

const AI_PROVIDERS = ['claude-code', 'codex', 'anthropic', 'compat'];
const COMPAT_PRESETS = ['openai', 'gemini', 'openrouter', 'cerebras', 'ollama', 'llamacpp', 'custom'];
const COMPAT_URLS = {
  openai: 'https://api.openai.com/v1', gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  openrouter: 'https://openrouter.ai/api/v1', cerebras: 'https://api.cerebras.ai/v1',
  ollama: 'http://127.0.0.1:11434/v1', llamacpp: 'http://127.0.0.1:8080/v1', custom: ''
};
const opt = (v, label, cur) => `<option value="${v}"${(cur || '') === v ? ' selected' : ''}>${label}</option>`;
const keySecret = (prov, preset) => (prov === 'anthropic' ? 'ai-key-anthropic' : 'ai-key-compat-' + preset);
const ENV_FOR = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', openrouter: 'OPENROUTER_API_KEY', cerebras: 'CEREBRAS_API_KEY' };

async function openAiSettings() {
  const c = { provider: 'claude-code', compatPreset: 'openai', ...aiConf() };
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  const field = (label, control, extra = '') => `<label class="st-field"${extra}><span>${label}</span>${control}</label>`;
  bd.innerHTML = `
    <div class="modal ai-settings settings-modal">
      <h2 style="font-size:17px">${t('ai.settings')}</h2>
      <p class="soft" style="font-size:13px;margin-bottom:12px">${t('ai.intro2')}</p>
      <label class="st-check"><input id="ai-on" type="checkbox"${c.enabled ? ' checked' : ''}/> ${t('ai.enable')}</label>

      <section class="st-sec">
        <h3>${t('ai.secProvider')}</h3>
        ${field(t('ai.provider'), `<select id="ai-provider">${AI_PROVIDERS.map((p) => opt(p, t('ai.prov.' + p), c.provider)).join('')}</select>`)}
        <p class="soft ai-prov-note" style="font-size:12px;margin:0"></p>
      </section>

      <section class="st-sec">
        <h3>${t('ai.secModel')}</h3>
        <div class="ai-sec" data-for="claude-code codex">
          <div class="st-grid">
            ${field(t('ai.model'), `<input id="ai-cli-model" type="text" spellcheck="false" list="ai-cli-models" placeholder="${t('ai.model.default')}"/>`)}
            ${field(t('ai.effort'), `<select id="ai-effort">${[['', t('ai.model.default')], ['low', t('ai.effort.low')], ['medium', t('ai.effort.medium')], ['high', t('ai.effort.high')]].map(([v, l]) => opt(v, l, c.effort)).join('')}</select>`)}
          </div>
          <datalist id="ai-cli-models"></datalist>
          <details class="st-advanced">
            <summary class="soft">${t('ai.advanced')}</summary>
            ${field(t('ai.path'), `<input id="ai-path" type="text" spellcheck="false"/>`)}
          </details>
        </div>
        <div class="ai-sec" data-for="anthropic">
          ${field(t('ai.apiModel'), `<select id="ai-api-model">${[['claude-opus-5', 'Claude Opus 5'], ['claude-sonnet-5', 'Claude Sonnet 5'], ['claude-haiku-4-5', 'Claude Haiku 4.5']].map(([v, l]) => opt(v, l, c.apiModel || 'claude-opus-5')).join('')}</select>`)}
        </div>
        <div class="ai-sec" data-for="compat">
          <div class="st-grid">
            ${field(t('ai.preset'), `<select id="ai-preset">${COMPAT_PRESETS.map((p) => opt(p, t('ai.preset.' + p), c.compatPreset)).join('')}</select>`)}
            ${field(t('ai.url'), `<input id="ai-url" type="text" spellcheck="false"/>`)}
          </div>
          <div class="st-grid st-grid-wide">
            ${field(t('ai.model'), `<span class="st-inline"><input id="ai-compat-model" type="text" spellcheck="false" list="ai-compat-models" style="width:100%"/><button class="btn-quiet st-btn ai-list-models">${t('ai.listModels')}</button></span>`)}
          </div>
          <datalist id="ai-compat-models"></datalist>
        </div>
      </section>

      <section class="st-sec">
        <h3>${t('ai.secConnection')}</h3>
        <div class="ai-sec" data-for="anthropic compat">
          ${field(t('ai.key'), `<input id="ai-key" type="password" autocomplete="off" spellcheck="false"/>`)}
          <p class="soft ai-key-note" style="font-size:12px;margin:6px 0 0"></p>
        </div>
        <div class="ai-status-box">
          <div class="ai-state">${t('ai.checking')}</div>
          <div class="ai-state-note soft" hidden></div>
          <div class="ai-usage soft"></div>
        </div>
      </section>

      <div class="st-foot-bar" style="justify-content:space-between">
        <button class="ai-test btn-quiet st-btn">${t('ai.test')}</button>
        <span>
          <button class="m-cancel btn-quiet" style="margin-right:10px">${t('common.cancel')}</button>
          <button class="m-ok btn-gold">${t('src.save')}</button>
        </span>
      </div>
    </div>`;
  document.body.appendChild(bd);
  const $m = (sel) => bd.querySelector(sel);
  const prov = () => $m('#ai-provider').value;
  const preset = () => $m('#ai-preset').value;
  // each provider keeps its own model and path while the writer flips between them
  const perProv = { 'claude-code': { model: c.claudeModel ?? c.model ?? '', path: c.claudePath || '' }, codex: { model: c.codexModel || '', path: c.codexPath || '' } };
  let shownProv = null;
  const stash = () => {
    if (perProv[shownProv]) perProv[shownProv] = { model: $m('#ai-cli-model').value.trim(), path: $m('#ai-path').value.trim() };
  };
  $m('#ai-url').value = c.compatUrl || COMPAT_URLS[c.compatPreset] || '';
  $m('#ai-compat-model').value = c.compatModel || '';

  const settingsNow = () => {
    stash();
    return {
      enabled: $m('#ai-on').checked,
      provider: prov(),
      effort: $m('#ai-effort').value,
      claudeModel: perProv['claude-code'].model, claudePath: perProv['claude-code'].path,
      codexModel: perProv.codex.model, codexPath: perProv.codex.path,
      // the running provider reads 'model' — keep it pointing at the chosen one's
      model: (perProv[prov()] || {}).model || '',
      apiModel: $m('#ai-api-model').value,
      compatPreset: preset(), compatUrl: $m('#ai-url').value.trim(), compatModel: $m('#ai-compat-model').value.trim()
    };
  };

  let token = 0;
  let keyNameNow = 'ai-key-anthropic'; // the name the main process files this key under
  const FIXED_URL = ['openai', 'gemini', 'openrouter', 'cerebras'];
  const refresh = async () => {
    const my = ++token;
    const p = prov();
    bd.querySelectorAll('.ai-sec').forEach((el) => { el.hidden = !el.dataset.for.split(' ').includes(p); });
    if (perProv[p] && shownProv !== p) {
      stash();
      $m('#ai-cli-model').value = perProv[p].model;
      $m('#ai-path').value = perProv[p].path;
      $m('#ai-cli-models').innerHTML = (p === 'claude-code' ? ['opus', 'sonnet', 'haiku'] : []).map((m) => `<option value="${m}">`).join('');
    }
    shownProv = p;
    $m('.ai-prov-note').textContent = t('ai.provNote.' + p);
    $m('.ai-usage').textContent = t(p === 'claude-code' || p === 'codex' ? 'ai.usagePlan' : 'ai.usageApi');
    const typedKey = $m('#ai-key').value.trim();
    // services with a key have a fixed address; only local/custom servers take a URL
    const fixed = p === 'compat' && FIXED_URL.includes(preset());
    $m('#ai-url').disabled = fixed;
    if (fixed) $m('#ai-url').value = COMPAT_URLS[preset()];
    const state = $m('.ai-state');
    state.textContent = t('ai.checking');
    $m('.ai-state-note').hidden = true;
    const st = await window.neo.aiStatus(settingsNow());
    if (my !== token || !bd.isConnected) return;
    if (p === 'claude-code' || p === 'codex') {
      const name = t('ai.prov.' + p);
      if (!st.installed) state.textContent = t('ai.state.missingCli', { name, cmd: p === 'codex' ? 'codex' : 'claude' });
      else if (!st.loggedIn) state.textContent = t('ai.state.loggedOutCli', { name, v: st.version, cmd: p === 'codex' ? 'codex login' : 'claude' });
      else state.textContent = t('ai.state.readyCli', { name, v: st.version, plan: st.plan || '—' });
      if (st.path) $m('#ai-path').placeholder = st.path;
    } else {
      keyNameNow = st.keyName || keySecret(p, preset());
      const hasSaved = await window.neo.hasSecret(keyNameNow);
      $m('#ai-key').placeholder = hasSaved ? t('ai.keySaved') : st.keyFromEnv ? t('ai.keyEnv', { env: st.keyFromEnv }) : (p === 'compat' && ['ollama', 'llamacpp'].includes(preset()) ? t('ai.keyNone') : '');
      $m('.ai-key-note').textContent = t(hasSaved ? 'ai.keyNoteSaved' : 'ai.keyNote');
      state.textContent = typedKey || st.loggedIn ? t('ai.state.apiReady', { model: st.model || '—' }) : t('ai.state.needKey');
      // one line per thing: the connection, then what this kind of service can't do
      const noteEl = $m('.ai-state-note');
      noteEl.hidden = !(p === 'compat' && !st.web);
      noteEl.textContent = noteEl.hidden ? '' : t('ai.noWebNote');
    }
  };
  refresh();
  $m('#ai-provider').onchange = refresh;
  $m('#ai-preset').onchange = () => { $m('#ai-url').value = COMPAT_URLS[preset()] || ''; $m('#ai-compat-model').value = ''; $m('#ai-key').value = ''; refresh(); };
  $m('#ai-path').addEventListener('change', refresh);
  $m('#ai-url').addEventListener('change', refresh);
  $m('.ai-list-models').onclick = async () => {
    await saveKey();
    const models = await window.neo.aiModels(settingsNow());
    $m('#ai-compat-models').innerHTML = models.map((m) => `<option value="${escHtml(m)}">`).join('');
    toast(models.length ? tn('ai.modelsFound', models.length) : t('ai.modelsNone'), 5000);
    if (models.length && !$m('#ai-compat-model').value) $m('#ai-compat-model').value = models[0];
  };
  // a typed key is saved (encrypted) as soon as it's needed; "remove" forgets it
  const saveKey = async () => {
    const k = $m('#ai-key').value.trim();
    if (!k || !['anthropic', 'compat'].includes(prov())) return true;
    const res = await window.neo.setSecret(keyNameNow, k === 'remove' ? '' : k);
    if (res && res.ok === false) {
      // no system keychain: the key is not written anywhere
      toast(t(res.error === 'noKeychain' ? 'ai.noKeychain' : 'ai.keyNotSaved', { env: ENV_FOR[prov() === 'anthropic' ? 'anthropic' : preset()] || '' }), 12000);
      return false;
    }
    $m('#ai-key').value = '';
    return true;
  };
  const close = () => bd.remove();
  $m('.m-cancel').onclick = close;
  bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  $m('.m-ok').onclick = async () => {
    if (!(await saveKey())) return;
    library.ai = { ...aiConf(), ...settingsNow() };
    await window.neo.writeLibrary(library);
    close();
    if (book) renderStickies();
    if (typeof renderChat === 'function') renderChat();
  };
  $m('.ai-test').onclick = async () => {
    await saveKey();
    const saved = library.ai;
    library.ai = { ...aiConf(), ...settingsNow(), enabled: true }; // test what's on screen
    const data = await aiRun('ping', { lang: I18N.lang }, t('ai.testing'));
    library.ai = saved;
    await refresh();
    if (data && bd.isConnected) $m('.ai-state').textContent = t('ai.testOk', { reply: data.greeting });
  };
}

// ---------------------------------------------------------------- research a ⚑ note

// the answer and sources under a note, or the button that asks for them
function renderResearch(s, el) {
  const ask = el.querySelector('.s-ask');
  if (ask && aiEnabled()) {
    ask.hidden = false;
    ask.textContent = t(s.research ? 'ai.researchAgain' : 'ai.research');
    if (aiHasWeb()) ask.onclick = () => researchSticky(s);
    else {
      // a provider without the web can't research: say so where the button is
      ask.disabled = true;
      ask.title = t('ai.researchNeedsWeb');
      const why = document.createElement('div');
      why.className = 's-why soft';
      why.textContent = t('ai.researchNeedsWeb');
      el.querySelector('.s-actions').before(why);
    }
  }
  const box = el.querySelector('.s-research');
  if (!box || !s.research) return;
  // the text sits inside the padded box, so a folded answer ends on a whole line
  box.innerHTML = `<div class="r-answer"><div class="r-answer-text"></div></div><div class="r-sources"></div>`;
  const ans = box.querySelector('.r-answer-text');
  ans.textContent = s.research.answer;
  // long answers fold to a few lines; a click unfolds them
  if (s.research.answer.length > 320) {
    ans.classList.add('clamped');
    const more = document.createElement('button');
    more.className = 'r-more';
    more.textContent = t('ai.more');
    const toggle = () => { const c = ans.classList.toggle('clamped'); more.textContent = t(c ? 'ai.more' : 'ai.less'); };
    ans.onclick = toggle;
    more.onclick = toggle;
    box.querySelector('.r-answer').after(more);
  }
  const list = box.querySelector('.r-sources');
  for (const id of s.research.sourceIds || []) {
    const src = sources.find((x) => x.id === id);
    if (!src) continue;
    const row = document.createElement('div');
    row.className = 'r-src' + (src.status === 'candidate' ? ' candidate' : '');
    row.innerHTML = `<a href="#" class="r-title"></a><div class="r-quote"></div>
      <div class="r-actions"><button class="r-cite" title="${t('ai.citeHereTitle')}">${t('ai.citeHere')}</button>${src.status === 'candidate' ? ` <button class="r-accept" title="${t('ai.keepSourceTitle')}">${t('ai.keepSource')}</button>` : ''}</div>`;
    const a = row.querySelector('.r-title');
    a.textContent = (src.title || src.url) + (src.site ? ' — ' + src.site : '');
    a.onclick = (e) => { e.preventDefault(); if (src.url) window.neo.openLink(src.url); };
    const q = row.querySelector('.r-quote');
    if (src.quote) q.textContent = '“' + src.quote + '”'; else q.remove();
    row.querySelector('.r-cite').onclick = () => citeAtMark(s, src);
    const acc = row.querySelector('.r-accept');
    if (acc) acc.onclick = () => { src.status = 'accepted'; saveSources(); renderStickies(); renumberCites(); };
    list.appendChild(row);
  }
}

async function researchSticky(s) {
  const mark = document.querySelector(`.ph-mark[data-sid="${s.id}"]`);
  if (!(s.text || '').trim()) { toast(t('ai.needNote')); return; }
  const para = mark && mark.closest('p');
  const bookId = book.id;
  const data = await aiRun('research', {
    note: s.text,
    paragraph: para ? para.innerText : '',
    title: displayTitle(book),
    lang: spellLang()
  }, t('ai.researching'), {
    title: t('ai.t.research'),
    detail: t('ai.d.research', { note: clipText(s.text, 140) }),
    wait: t('ai.wait.research'),
    background: true
  });
  if (!data) return;
  if (!book || book.id !== bookId) { toast(t('ai.bookClosed'), 7000); return; } // the essay was closed meanwhile
  // found sources join the list as candidates, merging with known ones
  const ids = [];
  for (const f of data.sources || []) {
    if (!f.url || !/^https?:\/\//.test(f.url)) continue;
    let src = sources.find((x) => x.url === f.url);
    if (!src) {
      src = {
        id: 'src-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        kind: 'web', url: f.url, title: f.title, author: f.author, site: f.site,
        published: f.published, quote: f.quote,
        status: 'candidate', addedBy: 'ai', added: new Date().toISOString(),
        accessed: new Date().toISOString().slice(0, 10)
      };
      sources.push(src);
    } else if (!src.quote && f.quote) {
      src.quote = f.quote;
    }
    ids.push(src.id);
  }
  s.research = { answer: data.answer, sourceIds: ids, at: new Date().toISOString() };
  saveSources();
  window.neo.writeJSON(book.id, 'stickies', stickies);
  renderStickies();
  $('#side-pane').classList.add('open');
  toast(tn('ai.researchDone', ids.length), 5000);
}

// accept a found source and cite it where the ⚑ sits
function citeAtMark(s, src) {
  const mark = document.querySelector(`.ph-mark[data-sid="${s.id}"]`);
  if (!mark) { toast(t('ai.markGone')); return; }
  snapshotStructure('cite');
  src.status = 'accepted';
  saveSources();
  const flag = document.createElement('span');
  flag.className = 'cite-mark';
  flag.dataset.src = src.id;
  flag.contentEditable = 'false';
  flag.textContent = '[·]';
  mark.before(flag);
  const body = mark.closest('.chapter-body');
  syncChapter(body, body.closest('.chapter').dataset.id);
  renderStickies();
  toast(t('ai.cited'));
}

// ---------------------------------------------------------------- critique

// scope: 'section' (the one the caret is in) or 'essay'
async function critique(scope) {
  if (!book) { toast(t('toast.openEssay')); return; }
  switchTab('manuscript');
  const chIds = scope === 'section'
    ? [currentChapterId || book.chapterOrder[0]].filter(Boolean)
    : [...book.chapterOrder];
  const paragraphs = [];
  const els = {};
  let n = 0;
  for (const chId of chIds) {
    const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
    if (!body) continue;
    const section = ((book.chapterTitles || {})[chId] || '').trim();
    for (const p of body.querySelectorAll('p')) {
      if (p.classList.contains('scene-break') || p.classList.contains('ghost')) continue;
      const clone = p.cloneNode(true);
      clone.querySelectorAll('.ph-mark, .cite-mark').forEach((x) => x.remove());
      const text = clone.textContent.trim();
      if (!text) continue;
      const id = 'p' + (++n);
      paragraphs.push({ id, section, text });
      els[id] = { p, chId };
    }
  }
  if (paragraphs.length < 2) { toast(t('ai.tooShort')); return; }
  const words = paragraphs.reduce((a, x) => a + countWords(x.text), 0);
  const bookId = book.id;
  const data = await aiRun('critique', { paragraphs, title: displayTitle(book), lang: spellLang(), scope },
    t(scope === 'section' ? 'ai.critiquingSection' : 'ai.critiquingEssay'), {
      title: t('ai.t.critique'),
      detail: scope === 'section'
        ? (paragraphs[0].section
          ? t('ai.d.critiqueSection', { name: paragraphs[0].section, paras: fmtN(paragraphs.length), words: fmtN(words) })
          : t('ai.d.critiqueSectionN', { n: book.chapterOrder.indexOf(chIds[0]) + 1, paras: fmtN(paragraphs.length), words: fmtN(words) }))
        : t('ai.d.critiqueEssay', { sections: fmtN(chIds.length), paras: fmtN(paragraphs.length), words: fmtN(words) }),
      wait: t(scope === 'section' ? 'ai.wait.critiqueSection' : 'ai.wait.critiqueEssay'),
      background: true
    });
  if (!data) return;
  if (!book || book.id !== bookId) { toast(t('ai.bookClosed'), 7000); return; } // the essay was closed meanwhile
  const comments = (data.comments || []).slice(0, 7);
  if (!comments.length) { toast(t('ai.noIssues'), 6000); return; }
  snapshotStructure('critique');
  const touched = new Set();
  const CATS = ['thesis', 'logic', 'evidence', 'counterargument', 'redundancy', 'clarity'];
  const SEVS = ['high', 'medium', 'low'];
  for (const c of comments) {
    // model output is data: only known values reach the page's markup
    c.category = CATS.includes(c.category) ? c.category : 'clarity';
    c.severity = SEVS.includes(c.severity) ? c.severity : 'medium';
    c.text = String(c.text || '').slice(0, 2000);
    const at = els[String(c.paragraph || '').replace(/[\[\]\s]/g, '')];
    const sid = 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (at) {
      const mark = document.createElement('span');
      mark.className = 'ph-mark ai';
      mark.dataset.sid = sid;
      mark.contentEditable = 'false';
      mark.textContent = '✦';
      at.p.appendChild(mark);
      touched.add(at.chId);
    }
    stickies.push({
      id: sid, chapterId: at ? at.chId : null, resolved: false,
      kind: 'critique', author: 'ai', text: c.text, category: c.category, severity: c.severity,
      created: new Date().toISOString()
    });
  }
  for (const chId of touched) {
    const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
    if (body) syncChapter(body, chId);
  }
  window.neo.writeJSON(book.id, 'stickies', stickies);
  sideFilter = 'ai';
  renderStickies();
  $('#side-pane').classList.add('open');
  toast(tn('ai.critiqueDone', comments.length), 6000);
}

// ---------------------------------------------------------------- rewrite

const RW_MODES = { clearer: 1, shorter: 1, stronger: 1, informal: 1 };

// the original goes to Later (restorable, undoable); the variant takes its place
async function applyRewrite(range, p, text) {
  if (!p.isConnected) { toast(t('ai.markGone')); return; }
  const body = p.closest('.chapter-body');
  body.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  const holder = document.createElement('div');
  holder.appendChild(range.cloneContents());
  await moveSelectionToDarlings(holder.innerHTML, sel.toString());
  const at = sel.rangeCount ? sel.getRangeAt(0) : null;
  if (!at) return;
  const node = document.createTextNode(text);
  at.insertNode(node);
  const after = document.createRange();
  after.setStartAfter(node);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  syncChapter(body, body.closest('.chapter').dataset.id);
  resetNativeUndo();
  toast(t('ai.rewritten', { undo: KZ }), 6000);
}

// ---------------------------------------------------------------- chat

// chat.json: [{ role: 'user'|'assistant', text, at, costUsd?, web?, stopped? }]
let chatLog = [];
let chatSelection = '';
let sideView = 'notes';

async function loadChat(bookId) {
  chatLog = await window.neo.readJSON(bookId, 'chat', []);
  chatSelection = '';
  renderChat();
}
const saveChat = () => { if (book) window.neo.writeJSON(book.id, 'chat', chatLog); };

function setSideView(view) {
  sideView = view;
  $$('.side-tab').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  $('#sticky-list').hidden = view !== 'notes';
  $('#chat-view').hidden = view !== 'chat';
  $('#side-pane').classList.toggle('chat-mode', view === 'chat');
  if (view === 'chat') renderChat();
}
$$('.side-tab').forEach((b) => { b.onclick = () => setSideView(b.dataset.view); });

// open the chat, carrying the current selection along as the subject
function openChat() {
  if (!book) { toast(t('toast.openEssay')); return; }
  const sel = window.getSelection();
  const el = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
  const inDraft = el && (el.nodeType === Node.TEXT_NODE ? el.parentElement : el).closest &&
    (el.nodeType === Node.TEXT_NODE ? el.parentElement : el).closest('.chapter-body');
  if (inDraft && !sel.isCollapsed) chatSelection = sel.toString().trim().slice(0, 3000);
  $('#side-pane').classList.add('open');
  setSideView('chat');
  $('.chat-input').focus();
}

// A few Markdown habits models have, rendered safely: **bold**, *italic*,
// `code`, bullet lines and paragraphs. Everything else stays plain text.
function miniMarkdown(text) {
  const inline = (s) => escHtml(s)
    // [label](https://…) and bare https://… become links that open in the browser
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => `<a class="ext" data-url="${url.replace(/"/g, '&quot;')}">${label}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => `${pre}<a class="ext" data-url="${url.replace(/"/g, '&quot;')}">${url}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  return String(text || '').split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
      return '<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, '')) + '</li>').join('') + '</ul>';
    }
    return '<p>' + lines.map(inline).join('<br>') + '</p>';
  }).join('');
}

function renderChat() {
  const view = $('#chat-view');
  if (!view || view.hidden) return;
  const log = view.querySelector('.chat-log');
  log.innerHTML = '';
  if (!aiEnabled()) {
    log.innerHTML = `<div class="stickies-empty">${t('chat.off')}</div>`;
  } else if (!chatLog.length) {
    log.innerHTML = `<div class="stickies-empty">${t('chat.empty')}</div>`;
  }
  for (const m of chatLog) log.appendChild(chatBubble(m));
  log.scrollTop = log.scrollHeight;
  const selBox = view.querySelector('.chat-sel');
  selBox.hidden = !chatSelection;
  view.querySelector('.chat-sel-text').textContent = chatSelection ? t('chat.about', { text: chatSelection.slice(0, 120) + (chatSelection.length > 120 ? '…' : '') }) : '';
  const webWrap = view.querySelector('.chat-web-wrap');
  webWrap.hidden = !aiHasWeb();
}

function chatBubble(m) {
  const el = document.createElement('div');
  el.className = 'chat-msg ' + (m.role === 'assistant' ? 'from-ai' : 'from-me');
  const body = document.createElement('div');
  body.className = 'chat-body';
  if (m.role === 'assistant') {
    body.innerHTML = miniMarkdown(m.text);
    body.querySelectorAll('a.ext').forEach((a) => { a.onclick = (e) => { e.preventDefault(); window.neo.openLink(a.dataset.url); }; });
  } else body.textContent = m.text;
  el.appendChild(body);
  if (m.role === 'assistant' && m.text) {
    const bar = document.createElement('div');
    bar.className = 'chat-actions';
    const cost = m.costUsd != null && !m.plan ? `<span class="soft">≈ $${m.costUsd < 0.01 ? m.costUsd.toFixed(4) : m.costUsd.toFixed(3)}</span>` : '';
    bar.innerHTML = `${m.stopped ? `<span class="soft">${t('chat.stopped')}</span>` : ''}${cost}<button class="c-insert" title="${t('chat.insertTitle')}">${t('chat.insert')}</button><button class="c-note">${t('side.toNotes')}</button><button class="c-copy">${t('chat.copy')}</button>`;
    // what's selected inside this answer, or all of it, goes where the caret was in the draft
    const insertBtn = bar.querySelector('.c-insert');
    insertBtn.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection in the bubble
    insertBtn.onclick = () => {
      const sel = window.getSelection();
      const picked = sel.rangeCount && body.contains(sel.anchorNode) && !sel.isCollapsed ? sel.toString() : m.text;
      insertFromChat(picked);
    };
    bar.querySelector('.c-note').onclick = async () => {
      flushAux();
      const html = await window.neo.readAux(book.id, 'notes');
      await window.neo.writeAux(book.id, 'notes', (html || '') + `<p><b>${escHtml(t('chat.noteHead'))}</b></p>` + miniMarkdown(m.text));
      toast(t('side.movedToNotes'));
    };
    bar.querySelector('.c-copy').onclick = () => { navigator.clipboard.writeText(m.text); toast(t('chat.copied')); };
    el.appendChild(bar);
  }
  return el;
}

// the last caret in the draft, so a chat answer can go back to it
let lastDraftRange = null;
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const n = sel.anchorNode;
  const el = n && (n.nodeType === Node.TEXT_NODE ? n.parentElement : n);
  if (el && el.closest && el.closest('.chapter-body')) lastDraftRange = sel.getRangeAt(0).cloneRange();
});

function insertFromChat(text) {
  const clean = String(text || '').replace(/\*\*|__|`/g, '').replace(/^["“]|["”]$/g, '').trim();
  if (!clean) return;
  const r = lastDraftRange;
  const body = r && r.startContainer.isConnected && (r.startContainer.nodeType === Node.TEXT_NODE ? r.startContainer.parentElement : r.startContainer).closest('.chapter-body');
  if (!body) { toast(t('chat.insertWhere'), 5000); return; }
  switchTab('manuscript');
  snapshotStructure('chat insert');
  const at = r.cloneRange();
  at.deleteContents();
  const node = document.createTextNode(clean);
  at.insertNode(node);
  const after = document.createRange();
  after.setStartAfter(node);
  after.collapse(true);
  body.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(after);
  syncChapter(body, body.closest('.chapter').dataset.id);
  if (typeof resetNativeUndo === 'function') resetNativeUndo();
  toast(t('chat.inserted', { undo: KZ }), 5000);
}

// the essay as the assistant sees it: current text, outline, notes, sources
async function chatContext(scope) {
  const chIds = scope === 'section' ? [currentChapterId || book.chapterOrder[0]].filter(Boolean) : book.chapterOrder;
  const essay = chIds.map((chId) => {
    const holder = cleanChapterEl(chId);
    holder.querySelectorAll('.cite-mark').forEach((n) => n.remove());
    return { section: ((book.chapterTitles || {})[chId] || '').trim(), text: holder.innerText.trim() };
  }).filter((x) => x.text);
  const outline = book.chapterOrder.map((chId, i) => {
    const lines = [];
    const main = (book.chapterNotes || {})[chId];
    if (main) lines.push(`${i + 1}. ${main}`);
    for (const sec of (book.sectionNotes || {})[chId] || []) if (sec.text) lines.push(`   - ${sec.text}`);
    return lines.join('\n');
  }).filter(Boolean).join('\n');
  flushAux();
  const holder = document.createElement('div');
  holder.innerHTML = (await window.neo.readAux(book.id, 'notes')) || '';
  return {
    title: displayTitle(book),
    lang: spellLang(),
    essay,
    outline,
    notes: holder.innerText.trim(),
    sources: sources.filter((s) => s.status !== 'candidate').map((s) => [s.title || s.url, s.site].filter(Boolean).join(' — ')),
    selection: chatSelection
  };
}

let chatLive = null; // the assistant message being streamed into

// The chat shows its progress inside its own pane (a dialog would cover the
// answer as it arrives): what it's doing, for how long, and Stop.
let chatTimer = null;
function chatStatus(text) {
  const box = $('#chat-view .chat-status');
  if (!box) return;
  if (text === null) {
    clearInterval(chatTimer);
    chatTimer = null;
    box.hidden = true;
    return;
  }
  box.querySelector('.cs-stage').textContent = text;
  if (!chatTimer) {
    const t0 = Date.now();
    const tick = () => { box.querySelector('.cs-time').textContent = t('ai.secs', { n: Math.round((Date.now() - t0) / 1000) }); };
    tick();
    chatTimer = setInterval(tick, 1000);
    box.querySelector('.cs-who').textContent = aiWho();
  }
  box.hidden = false;
}
$('#chat-view .cs-stop').onclick = () => { if (chatLive) { chatStatus(t('ai.stopping')); aiCancel(); } };
window.neo.onAiDelta((m) => {
  if (!aiJob || m.jobId !== aiJob.id || !chatLive) return;
  chatLive.msg.text += m.text;
  chatLive.el.querySelector('.chat-body').textContent = chatLive.msg.text;
  const log = $('#chat-view .chat-log');
  log.scrollTop = log.scrollHeight;
});

async function sendChat() {
  if (!book) return;
  const input = $('.chat-input');
  const q = input.value.trim();
  if (!q) return;
  if (!aiEnabled()) { openAiSettings(); return; }
  if (aiJob) { toast(t('ai.busy')); return; }
  const web = aiHasWeb() && $('.chat-web').checked;
  const scope = $('.chat-scope').value;
  chatLog.push({ role: 'user', text: q, at: new Date().toISOString(), web });
  input.value = '';
  const ctx = await chatContext(scope);
  const history = chatLog.map((m) => ({ role: m.role, text: m.text }));
  const msg = { role: 'assistant', text: '', at: new Date().toISOString() };
  chatLog.push(msg);
  renderChat();
  chatLive = { msg, el: $('#chat-view .chat-log').lastElementChild };
  chatLive.el.classList.add('live');
  const id = 'chat-' + Date.now().toString(36);
  aiJob = { id, label: t('chat.thinking') };
  aiChip(t(web ? 'chat.searching' : 'chat.thinking'));
  chatStatus(t(web ? 'chat.searching' : 'chat.thinking'));
  let res;
  try {
    res = await window.neo.aiChat(id, { ctx, history, web }, aiSettings());
  } catch (err) {
    res = { ok: false, error: 'failed', detail: String(err) };
  } finally {
    aiJob = null;
    aiChip(null);
    chatStatus(null);
    chatLive = null;
  }
  if (res.ok) {
    msg.text = res.text;
    if (res.costUsd != null) msg.costUsd = res.costUsd;
    if (res.plan) msg.plan = true;
  } else if (res.error === 'cancelled') {
    msg.text = res.text || msg.text;
    msg.stopped = true;
    toast(t('ai.cancelled'));
  } else {
    chatLog.pop(); // no answer: leave the question for a retry
    toast(aiErrorText(res), 9000);
    if (res.detail) window.neo.logError('ai chat: ' + res.error + ' — ' + res.detail);
  }
  if (!msg.text) chatLog = chatLog.filter((m) => m !== msg);
  chatSelection = '';
  saveChat();
  renderChat();
}

$('.chat-send').onclick = sendChat;
$('.chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(); }
  if (e.key !== 'Escape') e.stopPropagation(); // editor shortcuts stay out of the chat box; Esc still stops the assistant
});
$('.chat-sel-x').onclick = () => { chatSelection = ''; renderChat(); };
$('.chat-clear').onclick = async () => {
  if (!chatLog.length) return;
  const ok = await optionModal(t('chat.clearQ'), t('chat.clearNote'), [{ label: t('chat.clear'), danger: true, value: 'y' }]);
  if (ok !== 'y') return;
  chatLog = [];
  saveChat();
  renderChat();
};

// ---------------------------------------------------------------- entry points

document.addEventListener('keydown', (e) => {
  if ($('#editor-view').hidden) return;
  if (document.querySelector('.modal-backdrop:not([hidden])')) return;
  const cmd = e.metaKey || e.ctrlKey;
  if (cmd && e.shiftKey && e.code === 'KeyM') { e.preventDefault(); openVersions(); } // versions.js
  if (cmd && e.shiftKey && e.code === 'KeyC') { e.preventDefault(); critique('section'); } // the section the caret is in
  if (cmd && e.shiftKey && e.code === 'KeyA') { e.preventDefault(); openChat(); }
});

window.neo.onMenu((msg) => {
  if (msg.type !== 'ai') return;
  if (msg.action === 'settings') openAiSettings();
  else if (msg.action === 'critique-section') critique('section');
  else if (msg.action === 'critique-essay') critique('essay');
  else if (msg.action === 'rewrite') openVersions();
  else if (msg.action === 'chat') openChat();
});
