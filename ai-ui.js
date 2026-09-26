/* ============================ MUTINY ============================ */
/* The assistant, in the interface: settings, the progress chip, and   */
/* the three tasks — research a ⚑ note, critique, rewrite. The main    */
/* process runs them (ai/); nothing reaches the page until the writer  */
/* accepts it. Loaded after app.js and shares its globals.             */

'use strict';

let aiJob = null; // { id, label }
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
  if (m.stage === 'search') aiChip(t('ai.progress.search', { q: m.detail }));
  else if (m.stage === 'read') aiChip(t('ai.progress.read', { site: m.detail }));
  else aiChip(aiJob.label);
});

$('#ai-status').onclick = () => aiCancel();

function aiCancel() {
  if (!aiJob) return false;
  window.neo.aiCancel(aiJob.id);
  return true;
}

// Run a task with the chip up; resolves to its data, or null (and a toast)
async function aiRun(task, input, label) {
  if (!aiEnabled()) {
    toast(t('ai.off'), 6000);
    openAiSettings();
    return null;
  }
  if (aiJob) { toast(t('ai.busy')); return null; }
  const id = 'job-' + Date.now().toString(36);
  aiJob = { id, label };
  aiChip(label);
  let res;
  try {
    const c = aiConf();
    res = await window.neo.aiRun(id, task, input, aiSettings());
  } catch (err) {
    res = { ok: false, error: 'failed', detail: String(err) };
  } finally {
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

async function openAiSettings() {
  const c = { provider: 'claude-code', compatPreset: 'openai', ...aiConf() };
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal ai-settings" style="width:580px">
      <h2 style="font-size:17px">${t('ai.settings')}</h2>
      <p>${t('ai.intro2')}</p>
      <label class="st-check" style="margin:4px 0 14px"><input id="ai-on" type="checkbox"${c.enabled ? ' checked' : ''}/> ${t('ai.enable')}</label>
      <label>${t('ai.provider')}
        <select id="ai-provider">${AI_PROVIDERS.map((p) => opt(p, t('ai.prov.' + p), c.provider)).join('')}</select>
      </label>
      <p class="soft ai-prov-note" style="font-size:12px;margin:-8px 0 12px"></p>

      <div class="ai-sec" data-for="claude-code codex">
        <div class="stats-row">
          <label>${t('ai.model')} <input id="ai-cli-model" type="text" spellcheck="false" list="ai-cli-models" placeholder="${t('ai.model.default')}"/></label>
          <label>${t('ai.effort')}
            <select id="ai-effort">${[['', t('ai.model.default')], ['low', t('ai.effort.low')], ['medium', t('ai.effort.medium')], ['high', t('ai.effort.high')]].map(([v, l]) => opt(v, l, c.effort)).join('')}</select>
          </label>
        </div>
        <datalist id="ai-cli-models"></datalist>
        <details class="st-advanced">
          <summary class="soft">${t('ai.advanced')}</summary>
          <label>${t('ai.path')} <input id="ai-path" type="text" spellcheck="false" style="width:100%"/></label>
        </details>
      </div>

      <div class="ai-sec" data-for="anthropic">
        <label>${t('ai.apiModel')}
          <select id="ai-api-model">${[['claude-opus-5', 'Claude Opus 5'], ['claude-sonnet-5', 'Claude Sonnet 5'], ['claude-haiku-4-5', 'Claude Haiku 4.5']].map(([v, l]) => opt(v, l, c.apiModel || 'claude-opus-5')).join('')}</select>
        </label>
      </div>

      <div class="ai-sec" data-for="compat">
        <div class="stats-row">
          <label>${t('ai.preset')}
            <select id="ai-preset">${COMPAT_PRESETS.map((p) => opt(p, t('ai.preset.' + p), c.compatPreset)).join('')}</select>
          </label>
          <label style="flex:1">${t('ai.url')} <input id="ai-url" type="text" spellcheck="false" style="width:100%"/></label>
        </div>
        <div class="stats-row">
          <label style="flex:1">${t('ai.model')} <input id="ai-compat-model" type="text" spellcheck="false" list="ai-compat-models" style="width:100%"/></label>
          <button class="btn-quiet ai-list-models" style="margin-top:14px">${t('ai.listModels')}</button>
        </div>
        <datalist id="ai-compat-models"></datalist>
      </div>

      <div class="ai-sec" data-for="anthropic compat">
        <label>${t('ai.key')} <input id="ai-key" type="password" autocomplete="off" spellcheck="false" style="width:100%"/></label>
        <p class="soft ai-key-note" style="font-size:12px;margin:-8px 0 10px"></p>
      </div>

      <div class="ai-state soft">${t('ai.checking')}</div>
      <p class="soft ai-usage" style="font-size:12px;margin-top:10px"></p>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
        <button class="ai-test btn-quiet">${t('ai.test')}</button>
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
    const state = $m('.ai-state');
    state.textContent = t('ai.checking');
    const st = await window.neo.aiStatus(settingsNow());
    if (my !== token || !bd.isConnected) return;
    if (p === 'claude-code' || p === 'codex') {
      const name = t('ai.prov.' + p);
      if (!st.installed) state.textContent = t('ai.state.missingCli', { name, cmd: p === 'codex' ? 'codex' : 'claude' });
      else if (!st.loggedIn) state.textContent = t('ai.state.loggedOutCli', { name, v: st.version, cmd: p === 'codex' ? 'codex login' : 'claude' });
      else state.textContent = t('ai.state.readyCli', { name, v: st.version, plan: st.plan || '—' });
      if (st.path) $m('#ai-path').placeholder = st.path;
    } else {
      const hasSaved = await window.neo.hasSecret(keySecret(p, preset()));
      $m('#ai-key').placeholder = hasSaved ? t('ai.keySaved') : st.keyFromEnv ? t('ai.keyEnv', { env: st.keyFromEnv }) : (p === 'compat' && ['ollama', 'llamacpp'].includes(preset()) ? t('ai.keyNone') : '');
      $m('.ai-key-note').textContent = t(hasSaved ? 'ai.keyNoteSaved' : 'ai.keyNote');
      state.textContent = typedKey || st.loggedIn ? t('ai.state.apiReady', { model: st.model || '—' }) : t('ai.state.needKey');
      if (p === 'compat' && !st.web) state.textContent += ' ' + t('ai.noWebNote');
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
    if (!k || !['anthropic', 'compat'].includes(prov())) return;
    await window.neo.setSecret(keySecret(prov(), preset()), k === 'remove' ? '' : k);
    $m('#ai-key').value = '';
  };
  const close = () => bd.remove();
  $m('.m-cancel').onclick = close;
  bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  $m('.m-ok').onclick = async () => {
    await saveKey();
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
  if (ask && aiEnabled() && aiHasWeb()) {
    ask.hidden = false;
    ask.textContent = t(s.research ? 'ai.researchAgain' : 'ai.research');
    ask.onclick = () => researchSticky(s);
  }
  const box = el.querySelector('.s-research');
  if (!box || !s.research) return;
  box.innerHTML = `<div class="r-answer"></div><div class="r-sources"></div>`;
  const ans = box.querySelector('.r-answer');
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
    ans.after(more);
  }
  const list = box.querySelector('.r-sources');
  for (const id of s.research.sourceIds || []) {
    const src = sources.find((x) => x.id === id);
    if (!src) continue;
    const row = document.createElement('div');
    row.className = 'r-src' + (src.status === 'candidate' ? ' candidate' : '');
    row.innerHTML = `<a href="#" class="r-title"></a><div class="r-quote"></div>
      <div class="r-actions"><button class="r-cite">${t('ai.citeHere')}</button>${src.status === 'candidate' ? ` <button class="r-accept">${t('src.accept')}</button>` : ''}</div>`;
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
  const data = await aiRun('research', {
    note: s.text,
    paragraph: para ? para.innerText : '',
    title: displayTitle(book),
    lang: spellLang()
  }, t('ai.researching'));
  if (!data) return;
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
  const data = await aiRun('critique', { paragraphs, title: displayTitle(book), lang: spellLang(), scope },
    t(scope === 'section' ? 'ai.critiquingSection' : 'ai.critiquingEssay'));
  if (!data) return;
  const comments = (data.comments || []).slice(0, 7);
  if (!comments.length) { toast(t('ai.noIssues'), 6000); return; }
  snapshotStructure('critique');
  const touched = new Set();
  for (const c of comments) {
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

async function rewriteSelection(mode) {
  if (!book || currentTab !== 'manuscript') { toast(t('ai.selectFirst', { key: K('⌘⇧M', 'Ctrl+Shift+M') })); return; }
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) { toast(t('ai.selectFirst', { key: K('⌘⇧M', 'Ctrl+Shift+M') })); return; }
  const range = sel.getRangeAt(0).cloneRange();
  const node = (n) => (n.nodeType === Node.TEXT_NODE ? n.parentElement : n);
  const p = node(range.startContainer).closest && node(range.startContainer).closest('.chapter-body p');
  if (!p || p !== (node(range.endContainer).closest && node(range.endContainer).closest('.chapter-body p'))) {
    toast(t('ai.oneParagraph'));
    return;
  }
  const frag = range.cloneContents();
  if (frag.querySelector && frag.querySelector('.cite, .cite-mark, .ph-mark')) { toast(t('ai.noMarksInside')); return; }
  const passage = sel.toString().trim();
  if (countWords(passage) < 3) { toast(t('ai.selectMore')); return; }
  const ask = (m) => aiRun('rewrite', { passage, paragraph: p.innerText, lang: spellLang(), mode: m }, t('ai.rewriting'));
  let data = await ask(mode);
  if (!data) return;

  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  const draw = () => {
    bd.innerHTML = `
      <div class="modal rw-modal" style="width:620px">
        <h2 style="font-size:16px">${t('ai.rewriteTitle')}</h2>
        <div class="rw-orig"><div class="soft">${t('ai.original')}</div><div class="rw-text"></div></div>
        <div class="rw-variants"></div>
        <div class="rw-modes">${Object.keys(RW_MODES).map((m) => `<button data-m="${m}" class="btn-quiet">${t('ai.mode.' + m)}</button>`).join('')}</div>
        <div style="text-align:right;margin-top:12px"><button class="m-cancel btn-quiet">${t('common.cancel')}</button></div>
      </div>`;
    bd.querySelector('.rw-orig .rw-text').textContent = passage;
    const list = bd.querySelector('.rw-variants');
    for (const v of data.variants || []) {
      const b = document.createElement('button');
      b.className = 'fr-choice rw-variant';
      b.innerHTML = `<strong class="rw-text"></strong><span></span>`;
      b.querySelector('strong').textContent = v.text;
      b.querySelector('span').textContent = v.why;
      b.onclick = () => { done(); applyRewrite(range, p, v.text); };
      list.appendChild(b);
    }
    bd.querySelectorAll('.rw-modes button').forEach((b) => {
      b.onclick = async () => {
        bd.style.display = 'none';
        const next = await ask(b.dataset.m);
        bd.style.display = '';
        if (next) { data = next; draw(); }
      };
    });
    bd.querySelector('.m-cancel').onclick = done;
  };
  const done = () => bd.remove();
  bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(); } });
  document.body.appendChild(bd);
  draw();
}

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
    bar.innerHTML = `${m.stopped ? `<span class="soft">${t('chat.stopped')}</span>` : ''}${cost}<button class="c-note">${t('side.toNotes')}</button><button class="c-copy">${t('chat.copy')}</button>`;
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
  let res;
  try {
    res = await window.neo.aiChat(id, { ctx, history, web }, aiSettings());
  } catch (err) {
    res = { ok: false, error: 'failed', detail: String(err) };
  } finally {
    aiJob = null;
    aiChip(null);
    chatLive = null;
  }
  if (res.ok) {
    msg.text = res.text;
    if (res.costUsd != null) msg.costUsd = res.costUsd;
    if (res.plan) msg.plan = true;
  } else if (res.error === 'cancelled') {
    msg.text = res.text || msg.text;
    msg.stopped = true;
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
  if (cmd && e.shiftKey && e.code === 'KeyM') { e.preventDefault(); rewriteSelection(); }
  if (cmd && e.shiftKey && e.code === 'KeyC') { e.preventDefault(); critique('section'); } // the section the caret is in
  if (cmd && e.shiftKey && e.code === 'KeyA') { e.preventDefault(); openChat(); }
});

window.neo.onMenu((msg) => {
  if (msg.type !== 'ai') return;
  if (msg.action === 'settings') openAiSettings();
  else if (msg.action === 'critique-section') critique('section');
  else if (msg.action === 'critique-essay') critique('essay');
  else if (msg.action === 'rewrite') rewriteSelection();
  else if (msg.action === 'chat') openChat();
});
