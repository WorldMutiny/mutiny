/* ============================ MUTINY ============================ */
/* Versions: select words, write alternatives beside the original,    */
/* compare, choose one. The assistant's suggestions (when it's on)    */
/* join the same list. The original and the versions not chosen go to */
/* Later, so nothing written is lost. Loaded after ai-ui.js.           */

'use strict';

// A version with the words that aren't in the original marked: a word-level
// longest-common-subsequence, as escaped HTML.
function diffWords(original, text) {
  const a = String(original).split(/(\s+)/).filter((x) => x !== '');
  const b = String(text).split(/(\s+)/).filter((x) => x !== '');
  const norm = (w) => w.toLowerCase().replace(/[.,;:¡!¿?«»“”"()]/g, '');
  const n = a.length, m = b.length;
  if (n * m > 40000) return escHtml(text); // very long passages: no marking
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    L[i][j] = norm(a[i]) === norm(b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const keep = new Array(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (norm(a[i]) === norm(b[j])) { keep[j] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return b.map((w, j) => (keep[j] || /^\s+$/.test(w) ? escHtml(w) : `<mark class="vs-diff">${escHtml(w)}</mark>`)).join('');
}

async function openVersions() {
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
  const original = sel.toString().trim();
  if (!original) return;
  const chIdx = book.chapterOrder.indexOf(p.closest('.chapter').dataset.id);

  // [{ text, why?, by: 'me' | 'ai' }]
  const versions = [];
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal vs-modal" style="width:640px">
      <h2 style="font-size:16px">${t('vs.title')}</h2>
      <div class="rw-orig"><div class="soft">${t('ai.original')}</div><div class="rw-text"></div></div>
      <div class="vs-list"></div>
      <div class="vs-new">
        <textarea class="vs-input" rows="2" spellcheck="false" placeholder="${t('vs.placeholder')}"></textarea>
        <button class="vs-add btn-quiet">${t('vs.add')}</button>
      </div>
      <div class="vs-ai" hidden>
        <button class="vs-ask btn-quiet">✦ ${t('vs.ask')}</button>
        <span class="rw-modes">${Object.keys(RW_MODES).map((m) => `<button data-m="${m}" class="btn-quiet">${t('ai.mode.' + m)}</button>`).join('')}</span>
      </div>
      <div class="vs-foot">
        <label class="st-check"><input type="checkbox" class="vs-keep" checked/> ${t('vs.keep')}</label>
        <button class="m-cancel btn-quiet">${t('common.cancel')}</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  const $v = (s) => bd.querySelector(s);
  $v('.rw-orig .rw-text').textContent = original;
  $v('.vs-ai').hidden = !aiEnabled();

  const draw = () => {
    const list = $v('.vs-list');
    list.innerHTML = '';
    versions.forEach((v, i) => {
      const row = document.createElement('div');
      row.className = 'vs-row' + (v.by === 'ai' ? ' ai' : '');
      row.innerHTML = `<div class="vs-body"><div class="vs-text" contenteditable="true" spellcheck="false"></div><div class="vs-why soft"></div></div>
        <div class="vs-actions"><button class="vs-use">${t('vs.use')}</button><button class="vs-del btn-quiet" title="${t('vs.remove')}">✕</button></div>`;
      const tx = row.querySelector('.vs-text');
      // at rest, the words that differ from the original are marked; editing shows it plain
      const showDiff = () => { tx.innerHTML = diffWords(original, v.text); };
      showDiff();
      tx.addEventListener('focus', () => { tx.textContent = v.text; });
      tx.addEventListener('blur', showDiff);
      tx.addEventListener('input', () => { v.text = tx.textContent; });
      tx.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); e.stopPropagation(); });
      const why = row.querySelector('.vs-why');
      if (v.why) why.textContent = (v.by === 'ai' ? '✦ ' : '') + v.why; else why.remove();
      row.querySelector('.vs-use').onclick = () => choose(i);
      row.querySelector('.vs-del').onclick = () => { versions.splice(i, 1); draw(); };
      list.appendChild(row);
    });
  };

  const add = () => {
    const text = $v('.vs-input').value.replace(/\s+/g, ' ').trim();
    if (!text) return;
    versions.push({ text, by: 'me' });
    $v('.vs-input').value = '';
    draw();
    $v('.vs-input').focus();
  };
  $v('.vs-add').onclick = add;
  $v('.vs-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); }
    e.stopPropagation();
  });
  // start from the original: the first version is often a small edit of it
  $v('.vs-input').value = original;

  const ask = async (mode) => {
    bd.style.display = 'none';
    const data = await aiRun('rewrite', { passage: original, paragraph: p.innerText, lang: spellLang(), mode, template: bookTemplate() }, t('ai.rewriting'), {
      title: t('ai.t.rewrite'),
      detail: t('ai.d.rewrite', { text: clipText(original, 120), n: tn('count.words', countWords(original)) }) +
        (mode ? ' · ' + t('ai.mode.' + mode) : ''),
      wait: t('ai.wait.rewrite')
    });
    bd.style.display = '';
    if (!data) return;
    for (const v of data.variants || []) if (v && v.text) { const tx = String(v.text).trim(); versions.push({ text: tx, orig: tx, why: String(v.why || ''), by: 'ai' }); }
    draw();
  };
  $v('.vs-ask').onclick = () => ask();
  bd.querySelectorAll('.rw-modes button').forEach((b) => { b.onclick = () => ask(b.dataset.m); });

  const close = () => bd.remove();
  $v('.m-cancel').onclick = close;
  bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });

  const choose = async (i) => {
    const chosen = versions[i];
    const text = String(chosen.text || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const keep = $v('.vs-keep').checked;
    close();
    await applyRewrite(range, p, text); // the original goes to Later from here
    // the assistant's words, kept as chosen: Mi voz can leave them out later
    // (edited in the list first, it's the writer's own wording)
    if (chosen.by === 'ai' && text === String(chosen.orig || '').replace(/\s+/g, ' ').trim()) noteAiText(text);
    if (keep) {
      const seen = new Set([text, original]);
      const rest = versions.filter((v, k) => k !== i && v.text.trim() && !seen.has(v.text.trim()) && seen.add(v.text.trim()));
      for (const v of rest.reverse()) {
        darlings.unshift({
          id: 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          html: null, text: v.text.trim(),
          chapterId: p.isConnected ? p.closest('.chapter').dataset.id : null,
          chapterNum: chIdx >= 0 ? chIdx + 1 : null,
          variant: true, date: new Date().toISOString()
        });
      }
      if (rest.length) await window.neo.writeJSON(book.id, 'darlings', darlings);
    }
  };

  $v('.vs-input').focus();
  $v('.vs-input').select();
}
