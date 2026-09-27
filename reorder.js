/* ============================ MUTINY ============================ */
/* Reorder: the draft as cards. Paragraphs move within and across     */
/* sections, sentences move within a paragraph, and the skeleton view */
/* reads the first sentence of every paragraph. Every move edits the   */
/* real draft (formatting, citations and marks travel along) and is    */
/* undoable. Loaded after app.js and shares its globals.               */

'use strict';

// ---------------------------------------------------------------- draft operations

const ATOMIC = '.ph-mark, .cite-mark'; // inline flags that count as one character
const OBJ = '￼';

// the paragraphs of a section that hold prose (breaks and outline ghosts aside)
function proseParagraphs(chId) {
  const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
  if (!body) return [];
  return [...body.children].filter((p) => p.tagName === 'P' && !p.classList.contains('ghost') &&
    !p.classList.contains('scene-break') && p.textContent.replace(/[⚑✦]|\[\d+\]|\[·\]|\[\?\]/g, '').trim());
}

// A paragraph as plain text, each inline flag one character, plus a map from
// text offsets back to DOM points.
function paragraphText(p) {
  let text = '';
  const points = []; // points[i] = DOM point just before character i
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        for (let i = 0; i < child.data.length; i++) points.push([child, i]);
        text += child.data;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.matches(ATOMIC)) {
          points.push([child.parentNode, [...child.parentNode.childNodes].indexOf(child)]);
          text += OBJ;
        } else {
          walk(child);
        }
      }
    }
  };
  walk(p);
  return { text, points };
}

const segmenters = {};

// The browser's sentence breaker stops after every abbreviation ("El Dr. |
// Pérez vive en EE. | UU."). A second pass rejoins those false breaks.
const ABBREV = new Set(('dr dra drs sr sra sres srta lic ing arq mtro mtra prof profa gral lcdo ud uds ' +
  'aprox núm num pág págs art cap caps vol ed eds p pp fig tel av c cía dpto depto mr mrs ms st vs ' +
  'dept est no nos approx e.g i.e cf a.m p.m a.c d.c s.a').split(' '));
// etc., Inc., et al. and the like can close a sentence too ("…casas, etc.
// Pero…"), so they're left out: rejoined only when what follows plainly
// continues (lowercase, a digit)

function falseBreak(before, after) {
  const tail = before.trimEnd();
  if (!tail.endsWith('.')) return false;
  const word = (tail.slice(0, -1).match(/([\p{L}.]+)$/u) || [])[1] || '';
  const next = after.trimStart();
  if (ABBREV.has(word.toLowerCase())) return true;
  if (/^\p{Lu}{1,3}$/u.test(word) || /^(\p{L}\.)+\p{L}$/u.test(word)) return true; // EE., UU., J., a.m
  if (/^[\p{Ll}\d,;:)]/u.test(next)) return true; // what follows can't start a sentence
  return false;
}

function sentenceStarts(text, lang) {
  const key = lang || 'en';
  if (!segmenters[key]) segmenters[key] = new Intl.Segmenter(key, { granularity: 'sentence' });
  const raw = [...segmenters[key].segment(text)].map((s) => s.index);
  const starts = [raw[0] || 0];
  for (let k = 1; k < raw.length; k++) {
    const prevStart = starts[starts.length - 1];
    const nextEnd = k + 1 < raw.length ? raw[k + 1] : text.length;
    if (falseBreak(text.slice(prevStart, raw[k]), text.slice(raw[k], nextEnd))) continue;
    starts.push(raw[k]);
  }
  return starts;
}

function firstSentence(text, lang) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const starts = sentenceStarts(clean, lang);
  return (starts.length > 1 ? clean.slice(0, starts[1]) : clean).trim();
}

// the words of a paragraph, without its flags
function paragraphPlain(p) {
  const c = p.cloneNode(true);
  c.querySelectorAll(ATOMIC).forEach((n) => n.remove());
  return c.textContent.replace(/\s+/g, ' ').trim();
}

// A paragraph cut into sentences: [{ fragment, text }], formatting kept.
// A cut never falls inside cited words — it moves to the end of the citation.
function splitSentences(p, lang) {
  const { text, points } = paragraphText(p);
  const cuts = sentenceStarts(text, lang).filter((i) => i > 0 && i < text.length);
  const pointAt = (i) => {
    let [node, off] = points[i];
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const cite = el && el.closest && el.closest('.cite');
    if (cite && p.contains(cite)) return [cite.parentNode, [...cite.parentNode.childNodes].indexOf(cite) + 1];
    return [node, off];
  };
  const edges = [[p, 0], ...cuts.map(pointAt), [p, p.childNodes.length]];
  const out = [];
  for (let k = 0; k < edges.length - 1; k++) {
    const r = document.createRange();
    try {
      r.setStart(edges[k][0], edges[k][1]);
      r.setEnd(edges[k + 1][0], edges[k + 1][1]);
    } catch { continue; }
    if (r.collapsed) continue;
    const fragment = r.cloneContents();
    const holder = document.createElement('div');
    holder.appendChild(fragment.cloneNode(true));
    holder.querySelectorAll(ATOMIC).forEach((n) => n.remove());
    const t = holder.textContent.replace(/\s+/g, ' ').trim();
    if (!t && !fragment.querySelector?.(ATOMIC)) continue;
    out.push({ fragment, text: t });
  }
  return out;
}

// trim the outer whitespace of a fragment's first and last text
function trimFragment(frag) {
  const walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
  const texts = [];
  let n;
  while ((n = walker.nextNode())) texts.push(n);
  if (texts.length) {
    texts[0].data = texts[0].data.replace(/^\s+/, '');
    texts[texts.length - 1].data = texts[texts.length - 1].data.replace(/\s+$/, '');
  }
  return frag;
}

function chapterOfBody(body) { return body.closest('.chapter').dataset.id; }

function syncBodies(...bodies) {
  for (const b of new Set(bodies.filter(Boolean))) {
    if (!b.querySelector('p')) b.innerHTML = '<p><br></p>';
    syncChapter(b, chapterOfBody(b));
  }
  reconcileMarks(); // marks that changed sections follow along
}

// put the sentences of p in a new order (indexes into splitSentences)
function setSentenceOrder(p, order, lang) {
  const parts = splitSentences(p, lang);
  if (order.length !== parts.length) return false;
  snapshotStructure('reorder sentences');
  const rebuilt = document.createDocumentFragment();
  order.forEach((i, k) => {
    if (k > 0) rebuilt.appendChild(document.createTextNode(' '));
    rebuilt.appendChild(trimFragment(parts[i].fragment));
  });
  p.replaceChildren(rebuilt);
  try { p.normalize(); } catch { /* fine */ }
  syncBodies(p.closest('.chapter-body'));
  return true;
}

// move paragraph p before `before` (a paragraph) or to the end of chId's prose
function moveParagraph(p, chId, before) {
  const from = p.closest('.chapter-body');
  const to = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
  if (!from || !to || p === before) return false;
  snapshotStructure('reorder paragraph');
  if (before) before.before(p);
  else {
    // at the end of the prose: ahead of any outline ghosts still waiting there
    const ghost = to.querySelector(':scope > p.ghost');
    if (ghost) ghost.before(p); else to.appendChild(p);
  }
  syncBodies(from, to);
  return true;
}

// ---------------------------------------------------------------- the view

let reorderOn = false;
let reorderView = 'cards'; // 'cards' | 'skeleton' | 'sentences'
let reorderPara = null;    // the paragraph open in sentence view
let reorderFocus = null;   // [chId, index] to refocus after a redraw

function toggleReorder(on = !reorderOn) {
  if (!book) { toast(t('toast.openEssay')); return; }
  if (on) switchTab('manuscript');
  reorderOn = on;
  reorderView = 'cards';
  reorderPara = null;
  $('#paper').hidden = on;
  $('#reorder-paper').hidden = !on;
  $('#reorder-btn').classList.toggle('on', on);
  document.body.classList.toggle('reordering', on);
  if (on) { $('#paper-scroll').scrollTop = 0; renderReorder(); }
}

function reorderRefresh() { if (reorderOn) renderReorder(); }

const sectionLabel = (chId, i) => ((book.chapterTitles || {})[chId] || '').trim() || t('nav.section', { n: i + 1 });

function flagsOf(p) {
  const f = [];
  const marks = p.querySelectorAll('.ph-mark:not(.ai)').length;
  const ai = p.querySelectorAll('.ph-mark.ai').length;
  const cites = p.querySelectorAll('.cite, .cite-mark').length;
  if (marks) f.push('⚑' + (marks > 1 ? marks : ''));
  if (ai) f.push('✦' + (ai > 1 ? ai : ''));
  if (cites) f.push('[' + cites + ']');
  return f.join('  ');
}

function renderReorder() {
  const wrap = $('#reorder-paper');
  wrap.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'ro-head';
  if (reorderView === 'sentences') {
    head.innerHTML = `<button class="ro-back btn-quiet">← ${t('ro.back')}</button><span class="soft">${t('ro.sentencesHint')}</span>`;
    head.querySelector('.ro-back').onclick = () => { reorderView = 'cards'; reorderPara = null; renderReorder(); };
  } else {
    head.innerHTML = `
      <span class="ro-switch">
        <button data-v="cards" class="${reorderView === 'cards' ? 'on' : ''}">${t('ro.cards')}</button>
        <button data-v="skeleton" class="${reorderView === 'skeleton' ? 'on' : ''}">${t('ro.skeleton')}</button>
      </span>
      <span class="soft">${t(reorderView === 'cards' ? 'ro.cardsHint' : 'ro.skeletonHint')}</span>
      <button class="ro-done btn-gold">${t('ro.done')}</button>`;
    head.querySelectorAll('.ro-switch button').forEach((b) => { b.onclick = () => { reorderView = b.dataset.v; renderReorder(); }; });
    head.querySelector('.ro-done').onclick = () => toggleReorder(false);
  }
  wrap.appendChild(head);
  if (reorderView === 'sentences') renderSentenceCards(wrap);
  else if (reorderView === 'skeleton') renderSkeleton(wrap);
  else renderParagraphCards(wrap);
}

// go back to the draft with the caret at the start of paragraph p
function gotoParagraph(p) {
  if (reorderOn) toggleReorder(false);
  switchTab('manuscript');
  const body = p.closest('.chapter-body');
  body.focus({ preventScroll: true });
  const r = document.createRange();
  r.setStart(p, 0);
  r.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  currentChapterId = chapterOfBody(body);
  highlightNav();
  p.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---- paragraph cards

function renderParagraphCards(wrap) {
  const lang = spellLang();
  const all = []; // flat order of cards, for keyboard moves
  book.chapterOrder.forEach((chId, i) => {
    const sec = document.createElement('section');
    sec.className = 'ro-section';
    sec.dataset.ch = chId;
    const h = document.createElement('div');
    h.className = 'ro-sec-title';
    h.textContent = sectionLabel(chId, i);
    sec.appendChild(h);
    const paras = proseParagraphs(chId);
    paras.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'ro-card';
      card.tabIndex = 0;
      card.draggable = true;
      card.dataset.ch = chId;
      card.dataset.idx = idx;
      const plain = paragraphPlain(p);
      const words = countWords(plain);
      card.innerHTML = `<div class="ro-text"></div><div class="ro-meta"><span class="ro-words"></span><span class="ro-flags"></span></div>`;
      card.querySelector('.ro-text').textContent = firstSentence(plain, lang) + (plain.length > firstSentence(plain, lang).length ? ' …' : '');
      card.querySelector('.ro-words').textContent = tn('count.words', words);
      card.querySelector('.ro-flags').textContent = flagsOf(p);
      card.title = plain.slice(0, 600);
      card._p = p;
      wireCard(card);
      sec.appendChild(card);
      all.push(card);
    });
    if (!paras.length) {
      const empty = document.createElement('div');
      empty.className = 'ro-empty soft';
      empty.textContent = t('ro.emptySection');
      sec.appendChild(empty);
    }
    wireSectionDrop(sec, chId);
    wrap.appendChild(sec);
  });
  wrap._cards = all;
  if (reorderFocus) {
    const [ch, idx] = reorderFocus;
    const c = all.find((x) => x.dataset.ch === ch && +x.dataset.idx === idx);
    if (c) c.focus({ preventScroll: false });
    reorderFocus = null;
  }
}

let dragCard = null;
function dropMarker() {
  let m = document.querySelector('.ro-drop');
  if (!m) { m = document.createElement('div'); m.className = 'ro-drop'; }
  return m;
}

function wireCard(card) {
  card.addEventListener('dragstart', (e) => {
    dragCard = card;
    e.dataTransfer.setData('application/x-mutiny-card', '1');
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    dragCard = null;
    document.querySelector('.ro-drop')?.remove();
  });
  card.addEventListener('dblclick', () => openSentences(card._p));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); gotoParagraph(card._p); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      keyboardMove(card, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (!e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const all = $('#reorder-paper')._cards || [];
      const next = all[all.indexOf(card) + (e.key === 'ArrowUp' ? -1 : 1)];
      if (next) next.focus();
    }
  });
}

// cards reorder by drop position: above or below the card under the pointer
function wireSectionDrop(sec, chId) {
  sec.addEventListener('dragover', (e) => {
    if (!dragCard) return;
    e.preventDefault();
    const cards = [...sec.querySelectorAll('.ro-card:not(.dragging)')];
    const marker = dropMarker();
    const after = cards.find((c) => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
    if (after) after.before(marker); else sec.appendChild(marker);
  });
  sec.addEventListener('drop', (e) => {
    if (!dragCard) return;
    e.preventDefault();
    const marker = sec.querySelector('.ro-drop');
    let before = null;
    if (marker) {
      let n = marker.nextElementSibling;
      while (n && !n.classList.contains('ro-card')) n = n.nextElementSibling;
      before = n && n !== dragCard ? n._p : null;
      marker.remove();
    }
    const p = dragCard._p;
    const at = before ? [chId, proseParagraphs(chId).indexOf(before)] : null;
    if (moveParagraph(p, chId, before)) {
      reorderFocus = [chId, proseParagraphs(chId).indexOf(p)];
      renderReorder();
    } else if (at) renderReorder();
  });
}

function keyboardMove(card, dir) {
  const p = card._p;
  const chId = card.dataset.ch;
  const paras = proseParagraphs(chId);
  const idx = paras.indexOf(p);
  const pos = book.chapterOrder.indexOf(chId);
  let target = chId;
  let before = null;
  if (dir < 0) {
    if (idx > 0) before = paras[idx - 1];
    else if (pos > 0) target = book.chapterOrder[pos - 1]; // up and out: end of the section above
    else return;
  } else if (idx < paras.length - 1) {
    before = paras[idx + 2] || null;
  } else if (pos < book.chapterOrder.length - 1) {
    target = book.chapterOrder[pos + 1]; // down and out: start of the section below
    before = proseParagraphs(target)[0] || null;
  } else return;
  if (moveParagraph(p, target, before)) {
    reorderFocus = [target, proseParagraphs(target).indexOf(p)];
    renderReorder();
  }
}

// ---- sentence cards

function openSentences(p) {
  const parts = splitSentences(p, spellLang());
  if (parts.length < 2) { toast(t('ro.oneSentence')); return; }
  reorderPara = p;
  reorderView = 'sentences';
  renderReorder();
}

function renderSentenceCards(wrap) {
  const p = reorderPara;
  if (!p || !p.isConnected) { reorderView = 'cards'; renderReorder(); return; }
  const parts = splitSentences(p, spellLang());
  const list = document.createElement('section');
  list.className = 'ro-section ro-sentences';
  parts.forEach((part, i) => {
    const card = document.createElement('div');
    card.className = 'ro-card ro-sentence';
    card.tabIndex = 0;
    card.draggable = true;
    card.dataset.i = i;
    card.textContent = part.text || '·';
    list.appendChild(card);
  });
  let dragged = null;
  const order = () => [...list.querySelectorAll('.ro-sentence')].map((c) => +c.dataset.i);
  const commit = (focusIndex) => {
    const o = order();
    if (o.every((v, k) => v === k)) return;
    setSentenceOrder(p, o, spellLang());
    renderReorder();
    const cards = $('#reorder-paper').querySelectorAll('.ro-sentence');
    if (cards[focusIndex]) cards[focusIndex].focus();
  };
  list.querySelectorAll('.ro-sentence').forEach((card) => {
    card.addEventListener('dragstart', (e) => { dragged = card; e.dataTransfer.setData('application/x-mutiny-sentence', '1'); card.classList.add('dragging'); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragged = null; });
    card.addEventListener('keydown', (e) => {
      const cards = [...list.querySelectorAll('.ro-sentence')];
      const k = cards.indexOf(card);
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const j = k + (e.key === 'ArrowUp' ? -1 : 1);
        if (j < 0 || j >= cards.length) return;
        if (j < k) cards[j].before(card); else cards[j].after(card);
        commit(j);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        cards[k + (e.key === 'ArrowUp' ? -1 : 1)]?.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        gotoParagraph(p);
      }
    });
  });
  list.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const others = [...list.querySelectorAll('.ro-sentence:not(.dragging)')];
    const after = others.find((c) => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
    if (after) after.before(dragged); else list.appendChild(dragged);
  });
  list.addEventListener('drop', (e) => {
    if (!dragged) return;
    e.preventDefault();
    commit([...list.querySelectorAll('.ro-sentence')].indexOf(dragged));
  });
  wrap.appendChild(list);
}

// ---- skeleton

function renderSkeleton(wrap) {
  const lang = spellLang();
  book.chapterOrder.forEach((chId, i) => {
    const sec = document.createElement('section');
    sec.className = 'ro-section ro-skeleton';
    const h = document.createElement('div');
    h.className = 'ro-sec-title';
    h.textContent = sectionLabel(chId, i);
    sec.appendChild(h);
    const paras = proseParagraphs(chId);
    if (!paras.length) {
      const empty = document.createElement('div');
      empty.className = 'ro-empty soft';
      empty.textContent = t('ro.emptySection');
      sec.appendChild(empty);
    }
    for (const p of paras) {
      const line = document.createElement('p');
      line.className = 'ro-first';
      line.textContent = firstSentence(paragraphPlain(p), lang);
      line.title = t('ro.gotoTitle');
      line.onclick = () => gotoParagraph(p);
      sec.appendChild(line);
    }
    wrap.appendChild(sec);
  });
}

// ---------------------------------------------------------------- entry points

$('#reorder-btn').onclick = () => toggleReorder();

document.addEventListener('keydown', (e) => {
  if ($('#editor-view').hidden) return;
  if (document.querySelector('.modal-backdrop:not([hidden])')) return;
  const cmd = e.metaKey || e.ctrlKey;
  if (cmd && e.shiftKey && e.code === 'KeyO') { e.preventDefault(); toggleReorder(); }
});
