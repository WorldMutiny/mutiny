/* ============================ MUTINY ============================ */
/* The assistant, in the interface: settings, the progress chip, and   */
/* the three tasks — research a ⚑ note, critique, rewrite. The main    */
/* process runs them (ai/); nothing reaches the page until the writer  */
/* accepts it. Loaded after app.js and shares its globals.             */

'use strict';

let aiJob = null; // { id, label }
const aiConf = () => (library && library.ai) || {};
const aiEnabled = () => !!aiConf().enabled;

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
    res = await window.neo.aiRun(id, task, input, { model: c.model || '', effort: c.effort || '', claudePath: c.claudePath || '' });
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
  toast(t(login ? 'ai.err.login' : 'ai.err.' + (['notInstalled', 'busy', 'tooLong'].includes(res.error) ? res.error : 'failed')), 8000);
  if (res.detail) window.neo.logError('ai: ' + res.error + ' — ' + res.detail);
  return null;
}

// ---------------------------------------------------------------- settings

async function openAiSettings() {
  const c = { ...aiConf() };
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal" style="width:540px">
      <h2 style="font-size:17px">${t('ai.settings')}</h2>
      <p>${t('ai.intro')}</p>
      <div class="ai-state soft">${t('ai.checking')}</div>
      <label class="st-check" style="margin:14px 0"><input id="ai-on" type="checkbox"${c.enabled ? ' checked' : ''}/> ${t('ai.enable')}</label>
      <div class="stats-row">
        <label>${t('ai.model')}
          <select id="ai-model">
            ${[['', t('ai.model.default')], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']]
              .map(([v, l]) => `<option value="${v}"${(c.model || '') === v ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
        <label>${t('ai.effort')}
          <select id="ai-effort">
            ${[['', t('ai.model.default')], ['low', t('ai.effort.low')], ['medium', t('ai.effort.medium')], ['high', t('ai.effort.high')]]
              .map(([v, l]) => `<option value="${v}"${(c.effort || '') === v ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
      </div>
      <details class="st-advanced">
        <summary class="soft">${t('ai.advanced')}</summary>
        <label>${t('ai.path')} <input id="ai-path" type="text" spellcheck="false" style="width:100%" value="${escHtml(c.claudePath || '').replace(/"/g, '&quot;')}"/></label>
      </details>
      <p class="soft" style="font-size:12px;margin-top:10px">${t('ai.usageNote')}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
        <button class="ai-test btn-quiet">${t('ai.test')}</button>
        <span>
          <button class="m-cancel btn-quiet" style="margin-right:10px">${t('common.cancel')}</button>
          <button class="m-ok btn-gold">${t('src.save')}</button>
        </span>
      </div>
    </div>`;
  document.body.appendChild(bd);
  const state = bd.querySelector('.ai-state');
  const settingsNow = () => ({
    enabled: bd.querySelector('#ai-on').checked,
    model: bd.querySelector('#ai-model').value,
    effort: bd.querySelector('#ai-effort').value,
    claudePath: bd.querySelector('#ai-path').value.trim()
  });
  const refresh = async () => {
    state.textContent = t('ai.checking');
    const st = await window.neo.aiStatus({ claudePath: bd.querySelector('#ai-path').value.trim() });
    if (!bd.isConnected) return;
    if (!st.installed) state.textContent = t('ai.state.missing');
    else if (!st.loggedIn) state.textContent = t('ai.state.loggedOut', { v: st.version });
    else state.textContent = t('ai.state.ready', { v: st.version, plan: st.plan || '—' });
    if (st.path && !bd.querySelector('#ai-path').value) bd.querySelector('#ai-path').placeholder = st.path;
  };
  refresh();
  bd.querySelector('#ai-path').addEventListener('change', refresh);
  const close = () => bd.remove();
  bd.querySelector('.m-cancel').onclick = close;
  bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  bd.querySelector('.m-ok').onclick = async () => {
    library.ai = { ...aiConf(), ...settingsNow() };
    await window.neo.writeLibrary(library);
    close();
    if (book) renderStickies();
  };
  bd.querySelector('.ai-test').onclick = async () => {
    const saved = library.ai;
    library.ai = { ...aiConf(), ...settingsNow(), enabled: true }; // test what's on screen
    const data = await aiRun('ping', { lang: I18N.lang }, t('ai.testing'));
    library.ai = saved;
    if (data && bd.isConnected) state.textContent = t('ai.testOk', { reply: data.greeting });
  };
}

// ---------------------------------------------------------------- research a ⚑ note

// the answer and sources under a note, or the button that asks for them
function renderResearch(s, el) {
  const ask = el.querySelector('.s-ask');
  if (ask && aiEnabled()) {
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

// ---------------------------------------------------------------- entry points

document.addEventListener('keydown', (e) => {
  if ($('#editor-view').hidden) return;
  if (document.querySelector('.modal-backdrop:not([hidden])')) return;
  const cmd = e.metaKey || e.ctrlKey;
  if (cmd && e.shiftKey && e.code === 'KeyM') { e.preventDefault(); rewriteSelection(); }
});

window.neo.onMenu((msg) => {
  if (msg.type !== 'ai') return;
  if (msg.action === 'settings') openAiSettings();
  else if (msg.action === 'critique-section') critique('section');
  else if (msg.action === 'critique-essay') critique('essay');
  else if (msg.action === 'rewrite') rewriteSelection();
});
