/* ============================ MUTINY ============================ */
/* Mi voz: a shelf of the writer's own texts. Mutiny measures them    */
/* itself (no AI, exact numbers), says how much the assistant can      */
/* learn from that much text, and — on request — has the assistant     */
/* write estilo.md, which Versions and the Chat then follow. Essays    */
/* reach the shelf as frozen copies; text the assistant wrote and the  */
/* writer kept untouched can be left out of the copy. Loaded after     */
/* reorder.js.                                                         */

'use strict';

const VOICE_ID = 'shelf-voice';
const isVoiceShelf = (s) => !!s && s.kind === 'voice';
const voiceShelf = () => library.shelves.find(isVoiceShelf);

// the shelf always exists (it can't be deleted); returns true if it was added
function ensureVoiceShelf() {
  if (voiceShelf()) return false;
  library.shelves.push({ id: VOICE_ID, kind: 'voice', name: '', nameKey: 'shelf.voice', bookIds: [] });
  return true;
}

// ---------------------------------------------------------------- text

const normSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// a stored essay as plain paragraphs: [{ title, paras: [string] }]
async function essaySections(meta) {
  const out = [];
  for (const chId of meta.chapterOrder || []) {
    const tpl = document.createElement('template'); // inert: nothing runs, nothing loads
    tpl.innerHTML = (await window.neo.readChapter(meta.id, chId)) || '';
    tpl.content.querySelectorAll('.darling-anchor, .ph-mark, .ghost, .cite-mark, .scene-break').forEach((n) => n.remove());
    const paras = [...tpl.content.querySelectorAll('p, li, blockquote, h1, h2, h3')]
      .filter((el) => !el.querySelector('p, li'))
      .map((el) => normSpace(el.textContent))
      .filter(Boolean);
    out.push({ title: ((meta.chapterTitles || {})[chId] || '').trim(), paras });
  }
  return out;
}

// The shelf's texts, read once per change: [{ id, title, lang, paras, words }]
const voiceCache = new Map(); // bookId → { modified, doc }
async function voiceCorpus() {
  const shelf = voiceShelf();
  const docs = [];
  for (const id of shelf ? shelf.bookIds : []) {
    const meta = await window.neo.readBookMeta(id);
    if (!meta) continue;
    const hit = voiceCache.get(id);
    if (hit && hit.modified === meta.modified) { docs.push(hit.doc); continue; }
    const paras = (await essaySections(meta)).flatMap((s) => s.paras);
    const doc = { id, title: displayTitle(meta), lang: meta.language || library.language || 'en', paras, words: countWords(paras.join(' ')) };
    voiceCache.set(id, { modified: meta.modified, doc });
    docs.push(doc);
  }
  return docs;
}

// ---------------------------------------------------------------- measuring

const STOP = {
  es: new Set(('a al algo algún alguna algunas alguno algunos ante antes aquel aquella aquello así aún bien cada casi como con contra ' +
    'cual cuales cuando de del desde donde dos e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba ' +
    'estas este esto estos está están fue fueron ha había han hasta hay la las le les lo los más me mi mis mismo mucho muy nada ' +
    'ni no nos nosotros o otra otras otro otros para pero poco por porque que qué se sea ser si sí sin sobre son su sus también ' +
    'tan tanto te tiene tienen todo todos tu tus un una uno unos unas usted y ya yo él ser hacer puede pueden sólo solo cuando ' +
    'donde menos mientras sino según tras hace va van voy vamos iba ir está estoy estamos hay había tengo tenemos').split(' ')),
  en: new Set(('a about above after again against all am an and any are as at be because been before being below between both but ' +
    'by can could did do does doing down during each few for from further had has have having he her here hers him his how i if ' +
    'in into is it its itself just me more most my no nor not of off on once only or other our ours out over own same she should ' +
    'so some such than that the their theirs them then there these they this those through to too under until up very was we were ' +
    'what when where which while who whom why will with would you your yours also even much many one two get got like').split(' '))
};

const PERSON = {
  es: {
    i: /\b(yo|me|mi|mis|mí|conmigo)\b/gi,
    we: /\b(nosotros|nosotras|nos|nuestro|nuestra|nuestros|nuestras)\b/gi,
    you: /\b(tú|te|ti|contigo|tu|tus|usted|ustedes)\b/gi
  },
  en: {
    i: /\b(i|me|my|mine|myself)\b/gi,
    we: /\b(we|us|our|ours|ourselves)\b/gi,
    you: /\b(you|your|yours|yourself)\b/gi
  }
};

const CONNECTORS = {
  es: ['sin embargo', 'además', 'por eso', 'es decir', 'en cambio', 'así que', 'por lo tanto', 'de hecho', 'en realidad',
    'o sea', 'aunque', 'porque', 'pero', 'mientras', 'incluso', 'al final', 'por ejemplo', 'en resumen', 'por un lado',
    'por otro lado', 'no obstante', 'a pesar de', 'en otras palabras', 'claro', 'total', 'entonces', 'luego', 'pues'],
  en: ['however', 'moreover', 'therefore', 'in fact', 'actually', 'that is', 'so', 'but', 'although', 'because', 'yet',
    'still', 'instead', 'for example', 'in other words', 'after all', 'of course', 'on the other hand', 'meanwhile',
    'even', 'then', 'anyway', 'besides', 'indeed', 'thus']
};

const perK = (n, words) => (words ? Math.round((n / words) * 1000 * 10) / 10 : 0);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const tokens = (s) => (s.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || []);
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function majorityLang(docs) {
  const by = {};
  for (const d of docs) by[d.lang] = (by[d.lang] || 0) + d.words;
  return Object.keys(by).sort((a, b) => by[b] - by[a])[0] || library.language || 'en';
}

// Everything Mutiny can count on its own. Exact, free, instant.
function measureVoice(docs) {
  const lang = majorityLang(docs);
  const L = STOP[lang] ? lang : 'en';
  const words = docs.reduce((a, d) => a + d.words, 0);
  const sentLens = [];
  const paraLens = [];
  let questions = 0, exclaims = 0, sentences = 0;
  const all = [];
  for (const d of docs) {
    for (const p of d.paras) {
      all.push(p);
      paraLens.push(countWords(p));
      const starts = sentenceStarts(p, d.lang);
      for (let k = 0; k < starts.length; k++) {
        const s = p.slice(starts[k], k + 1 < starts.length ? starts[k + 1] : p.length).trim();
        const n = countWords(s);
        if (!n) continue;
        sentences++;
        sentLens.push(n);
        if (/[?？]["”»’)]*$/.test(s)) questions++;
        if (/[!！]["”»’)]*$/.test(s)) exclaims++;
      }
    }
  }
  const text = all.join('\n');
  const count = (re) => (text.match(re) || []).length;
  const person = PERSON[L];
  const connectors = CONNECTORS[L]
    .map((c) => ({ c, n: count(new RegExp('(^|[^\\p{L}])' + reEsc(c) + '(?![\\p{L}])', 'giu')) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8)
    .map((x) => ({ text: x.c, perK: perK(x.n, words) }));

  // repeated turns of phrase: 2–3 word sequences with a real word in them,
  // used 3+ times and in more than one text
  const grams = new Map();
  docs.forEach((d, di) => {
    for (const p of d.paras) {
      const tk = tokens(p);
      for (const n of [2, 3]) {
        for (let i = 0; i + n <= tk.length; i++) {
          const g = tk.slice(i, i + n);
          if (g.every((w) => STOP[L].has(w))) continue;
          if (STOP[L].has(g[0]) && STOP[L].has(g[n - 1]) && n === 2) continue;
          const key = g.join(' ');
          const e = grams.get(key) || { n: 0, docs: new Set() };
          e.n++; e.docs.add(di);
          grams.set(key, e);
        }
      }
    }
  });
  let phrases = [...grams.entries()]
    .filter(([, e]) => e.n >= 3 && (docs.length < 2 || e.docs.size >= 2))
    .sort((a, b) => b[1].n - a[1].n);
  // a 2-word phrase that only ever appears inside a listed 3-word one adds nothing
  phrases = phrases.filter(([k, e]) => !phrases.some(([k2, e2]) => k2 !== k && k2.includes(k) && e2.n === e.n));
  phrases = phrases.slice(0, 10).map(([k, e]) => ({ text: k, n: e.n }));

  // vocabulary: distinct words per 500-word window, averaged (length-independent)
  const tk = tokens(text);
  const win = [];
  for (let i = 0; i + 500 <= tk.length; i += 500) win.push(new Set(tk.slice(i, i + 500)).size / 5);
  const variety = win.length ? Math.round(mean(win)) : null;

  // same topic everywhere? compare each text's most frequent content words
  const tops = docs.map((d) => {
    const f = new Map();
    for (const w of tokens(d.paras.join(' '))) if (w.length > 4 && !STOP[L].has(w)) f.set(w, (f.get(w) || 0) + 1);
    return new Set([...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w]) => w));
  });
  const sims = [];
  for (let i = 0; i < tops.length; i++) {
    for (let j = i + 1; j < tops.length; j++) {
      const inter = [...tops[i]].filter((w) => tops[j].has(w)).length;
      const uni = new Set([...tops[i], ...tops[j]]).size;
      if (uni) sims.push(inter / uni);
    }
  }
  const topicOverlap = sims.length ? mean(sims) : null;

  const shortS = sentLens.filter((n) => n <= 10).length;
  const longS = sentLens.filter((n) => n >= 30).length;
  return {
    lang,
    texts: docs.length,
    words,
    sentences,
    sentence: { mean: Math.round(mean(sentLens) * 10) / 10, sd: Math.round(sd(sentLens) * 10) / 10,
      shortPct: sentences ? Math.round((shortS / sentences) * 100) : 0, longPct: sentences ? Math.round((longS / sentences) * 100) : 0 },
    paragraph: { mean: Math.round(mean(paraLens)), sd: Math.round(sd(paraLens)), count: paraLens.length },
    questionsPct: sentences ? Math.round((questions / sentences) * 1000) / 10 : 0,
    exclaimsPct: sentences ? Math.round((exclaims / sentences) * 1000) / 10 : 0,
    person: { i: perK(count(person.i), words), we: perK(count(person.we), words), you: perK(count(person.you), words) },
    punct: {
      dash: perK(count(/—|\s–\s/g), words),
      semicolon: perK(count(/;/g), words),
      colon: perK(count(/:/g), words),
      paren: perK(count(/\(/g), words),
      ellipsis: perK(count(/…|\.\.\./g), words)
    },
    connectors,
    phrases,
    variety,
    topicOverlap,
    sameTopic: docs.length >= 2 && topicOverlap != null && topicOverlap >= 0.3
  };
}

// how much the assistant can learn from this many words
function voiceLevel(words) {
  if (words < 2000) return 'veryLow';
  if (words < 5000) return 'low';
  if (words < 15000) return 'medium';
  return 'high';
}

// the measurements, as the model reads them (English, plain)
function measuresForModel(m) {
  const lines = [
    `Texts: ${m.texts}; words: ${m.words}; sentences: ${m.sentences}; paragraphs: ${m.paragraph.count}.`,
    `Sentence length (words): mean ${m.sentence.mean}, standard deviation ${m.sentence.sd}; ${m.sentence.shortPct}% of sentences have 10 words or fewer, ${m.sentence.longPct}% have 30 or more.`,
    `Paragraph length (words): mean ${m.paragraph.mean}, standard deviation ${m.paragraph.sd}.`,
    `Questions: ${m.questionsPct}% of sentences. Exclamations: ${m.exclaimsPct}%.`,
    `Per 1,000 words — first person singular: ${m.person.i}; first person plural: ${m.person.we}; second person: ${m.person.you}.`,
    `Punctuation per 1,000 words — dashes: ${m.punct.dash}; semicolons: ${m.punct.semicolon}; colons: ${m.punct.colon}; parentheses: ${m.punct.paren}; ellipses: ${m.punct.ellipsis}.`,
    `Most used connectors (per 1,000 words): ${m.connectors.map((c) => `"${c.text}" ${c.perK}`).join(', ') || 'none stand out'}.`,
    `Repeated 2–3 word sequences across texts (times; candidates — some are topic words, not style): ${m.phrases.map((p) => `"${p.text}" ${p.n}`).join(', ') || 'none'}.`
  ];
  if (m.variety != null) lines.push(`Vocabulary variety: ${m.variety}% distinct words per 500-word window.`);
  if (m.sameTopic) lines.push('Note: the texts share much of their vocabulary — they may be on similar topics; don\'t mistake topic for style.');
  return lines.join('\n');
}

// ---------------------------------------------------------------- the shelf header

async function decorateVoiceShelf(sec, row, shelf) {
  sec.classList.add('voice-shelf');
  const head = document.createElement('div');
  head.className = 'voice-head';
  head.innerHTML = `
    <div class="voice-meter"><strong class="vm-line"></strong><span class="vm-expect soft"></span><span class="vm-new"></span></div>
    <div class="voice-actions">
      <button class="vm-import btn-quiet">${t('voice.import')}</button>
      <button class="vm-analysis btn-quiet">${t('voice.analysis')}</button>
      <button class="vm-style btn-quiet">${t('voice.myStyle')}</button>
      <button class="vm-gen btn-gold">✦ ${t('voice.generate')}</button>
    </div>`;
  sec.insertBefore(head, row);
  head.querySelector('.vm-import').onclick = importToVoice;
  head.querySelector('.vm-analysis').onclick = openVoiceAnalysis;
  head.querySelector('.vm-style').onclick = openStyle;
  head.querySelector('.vm-gen').onclick = generateStyle;

  const docs = await voiceCorpus();
  const words = docs.reduce((a, d) => a + d.words, 0);
  const level = voiceLevel(words);
  if (!docs.length) {
    head.querySelector('.vm-line').textContent = t('voice.emptyTitle');
    head.querySelector('.vm-expect').textContent = t('voice.emptyHint');
  } else {
    head.querySelector('.vm-line').textContent = tn('voice.texts', docs.length) + ' · ' + tn('count.words', words) + ' · ' + t('voice.level.' + level);
    head.querySelector('.vm-expect').textContent = t('voice.expect.' + level);
  }
  head.dataset.level = docs.length ? level : 'empty';
  const gen = library.styleGen;
  const grown = gen ? words - (gen.words || 0) : 0;
  if (gen && grown >= 1000) head.querySelector('.vm-new').textContent = t('voice.grown', { n: fmtN(grown) });
  head.querySelector('.vm-gen').textContent = '✦ ' + t(gen ? 'voice.regenerate' : 'voice.generate');
  head.querySelector('.vm-gen').disabled = words < VOICE_MIN;
  head.querySelector('.vm-gen').title = words < VOICE_MIN ? t('voice.tooLittle', { n: fmtN(VOICE_MIN) }) : '';
  head.querySelector('.vm-analysis').disabled = !docs.length;
}

const VOICE_MIN = 1500;

async function importToVoice() {
  const results = await window.neo.importPick();
  if (results.length) await addImportedBooks(results, voiceShelf());
}

// ---------------------------------------------------------------- copying an essay in

// a quick hash, to tell whether estilo.md was edited since it was generated
function textHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36) + ':' + s.length;
}

// Copies are frozen: the essay keeps changing on its own shelf, the
// reference text doesn't. Copying again updates the same copy.
async function copyToVoice(bookId) {
  const shelf = voiceShelf();
  const meta = await window.neo.readBookMeta(bookId);
  if (!meta || !shelf) return;
  let sections = await essaySections(meta);
  const total = countWords(sections.flatMap((s) => s.paras).join(' '));
  if (!total) { toast(t('voice.emptyEssay')); return; }

  // text the assistant wrote (chosen in Versions) that is still there unchanged
  const whole = normSpace(sections.flatMap((s) => s.paras).join('\n'));
  const live = [...new Set((meta.aiAccepted || []).map((a) => normSpace(a.text)).filter((s) => s.length > 12))]
    .filter((s) => whole.includes(s));
  const aiWords = live.reduce((a, s) => a + countWords(s) * (whole.split(s).length - 1), 0);
  const pct = Math.round((aiWords / total) * 100);
  if (pct >= 10) {
    const pick = await optionModal(t('voice.aiTitle'), t('voice.aiMsg', { pct, ai: fmtN(aiWords), total: fmtN(total) }), [
      { label: t('voice.aiStrip'), desc: t('voice.aiStripDesc'), value: 'strip' },
      { label: t('voice.aiKeep'), desc: t('voice.aiKeepDesc'), value: 'keep' }
    ]);
    if (!pick) return;
    if (pick === 'strip') {
      const sorted = live.sort((a, b) => b.length - a.length);
      sections = sections.map((s) => ({
        ...s,
        paras: s.paras.map((p) => { for (const a of sorted) p = p.split(a).join(' '); return normSpace(p); }).filter((p) => countWords(p) > 0)
      }));
    }
  }

  // one copy per essay: copying again refreshes it
  let target = null;
  for (const id of shelf.bookIds) {
    const m = await window.neo.readBookMeta(id);
    if (m && m.voiceCopyOf === bookId) { target = m; break; }
  }
  if (target) {
    const again = await optionModal(t('voice.againTitle', { title: escHtml(displayTitle(meta)) }), t('voice.againMsg'), [
      { label: t('voice.againUpdate'), value: 'update' }
    ]);
    if (again !== 'update') return;
    for (const chId of target.chapterOrder || []) await window.neo.deleteChapter(target.id, chId);
  } else {
    target = await window.neo.createBook({ author: meta.author, title: meta.title });
    target.title = meta.title;
    target.subtitle = meta.subtitle || '';
    target.tabNames = { ...(library.tabDefaults || {}) };
  }
  target.language = meta.language || library.language || 'en';
  target.voiceCopyOf = bookId;
  target.copiedAt = new Date().toISOString();
  target.coverSeed = meta.coverSeed || meta.id;
  target.chapterOrder = [];
  target.chapterTitles = {};
  let words = 0;
  for (const s of sections) {
    if (!s.paras.length) continue;
    const chId = 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    if (s.title) target.chapterTitles[chId] = s.title;
    await window.neo.writeChapter(target.id, chId, s.paras.map((p) => `<p>${escHtml(p)}</p>`).join(''));
    target.chapterOrder.push(chId);
    words += countWords(s.paras.join(' '));
  }
  target.wordCount = words;
  await window.neo.writeBookMeta(target.id, target);
  if (!shelf.bookIds.includes(target.id)) shelf.bookIds.push(target.id);
  await window.neo.writeLibrary(library);
  if (!$('#bookshelf-view').hidden) renderShelves();
  toast(t('voice.copied', { title: displayTitle(meta) }), 5000);
}

// Versions calls this when the writer picks one of the assistant's
function noteAiText(text) {
  if (!book || !text) return;
  book.aiAccepted = (book.aiAccepted || []).concat({ text: normSpace(text), at: new Date().toISOString() }).slice(-400);
  scheduleMetaSave();
}

// ---------------------------------------------------------------- analysis (no AI)

async function openVoiceAnalysis() {
  const docs = await voiceCorpus();
  if (!docs.length) { toast(t('voice.emptyHint'), 6000); return; }
  const m = measureVoice(docs);
  const level = voiceLevel(m.words);
  const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  const warn = [];
  if (docs.length === 1) warn.push(t('voice.warnOne'));
  if (m.sameTopic) warn.push(t('voice.warnTopic'));
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal va-modal" style="width:620px">
      <h2 style="font-size:17px">${t('voice.analysisTitle')}</h2>
      <p class="va-level"><strong>${tn('voice.texts', m.texts)} · ${tn('count.words', m.words)} · ${t('voice.level.' + level)}</strong><br><span class="soft">${t('voice.expect.' + level)}</span></p>
      ${warn.map((w) => `<p class="va-warn">⚠ ${w}</p>`).join('')}
      <table class="va-table">
        ${row(t('voice.m.sentence'), t('voice.m.sentenceV', { mean: m.sentence.mean, short: m.sentence.shortPct, long: m.sentence.longPct }))}
        ${row(t('voice.m.variation'), t('voice.m.variationV', { sd: m.sentence.sd, how: t(m.sentence.sd >= 10 ? 'voice.m.varHigh' : m.sentence.sd >= 6 ? 'voice.m.varMid' : 'voice.m.varLow') }))}
        ${row(t('voice.m.paragraph'), t('voice.m.paragraphV', { mean: m.paragraph.mean }))}
        ${row(t('voice.m.questions'), t('voice.m.questionsV', { q: m.questionsPct, e: m.exclaimsPct }))}
        ${row(t('voice.m.person'), t('voice.m.personV', { i: m.person.i, we: m.person.we, you: m.person.you }))}
        ${row(t('voice.m.punct'), t('voice.m.punctV', m.punct))}
        ${row(t('voice.m.connectors'), m.connectors.length ? m.connectors.map((c) => `“${escHtml(c.text)}” <span class="soft">${c.perK}</span>`).join(' · ') : '—')}
        ${row(t('voice.m.phrases'), m.phrases.length ? m.phrases.map((p) => `“${escHtml(p.text)}” <span class="soft">×${p.n}</span>`).join(' · ') : '—')}
        ${m.variety != null ? row(t('voice.m.variety'), t('voice.m.varietyV', { n: m.variety })) : ''}
      </table>
      <p class="soft" style="font-size:12px">${t('voice.m.perK')}</p>
      <details class="va-texts"><summary>${tn('voice.texts', docs.length)}</summary>
        <ul>${docs.map((d) => `<li>${escHtml(d.title)} <span class="soft">· ${tn('count.words', d.words)}</span></li>`).join('')}</ul>
      </details>
      <div style="text-align:right;margin-top:14px"><button class="m-cancel btn-quiet">${t('common.close')}</button></div>
    </div>`;
  document.body.appendChild(bd);
  const close = () => bd.remove();
  bd.querySelector('.m-cancel').onclick = close;
  bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  bd.querySelector('.m-cancel').focus();
}

// ---------------------------------------------------------------- generating estilo.md

const SAMPLE_WORDS = 22000;

// All of it when it fits; otherwise a fair share of every text, taken from
// its opening, middle and close so each one's arc is represented.
function sampleVoice(docs) {
  const total = docs.reduce((a, d) => a + d.words, 0);
  if (total <= SAMPLE_WORDS) return docs.map((d) => ({ title: d.title, text: d.paras.join('\n\n') }));
  return docs.map((d) => {
    const share = Math.max(400, Math.round((SAMPLE_WORDS * d.words) / total));
    if (d.words <= share) return { title: d.title, text: d.paras.join('\n\n') };
    const per = share / 3;
    const n = d.paras.length;
    const picked = new Set();
    for (const start of [0, Math.floor(n / 2) - 1, n - 1]) {
      let w = 0;
      const dir = start === n - 1 ? -1 : 1;
      for (let i = Math.max(0, start); i >= 0 && i < n && w < per; i += dir) {
        if (picked.has(i)) break;
        picked.add(i);
        w += countWords(d.paras[i]);
      }
    }
    const idx = [...picked].sort((a, b) => a - b);
    const parts = [];
    idx.forEach((i, k) => { if (k && i !== idx[k - 1] + 1) parts.push('[…]'); parts.push(d.paras[i]); });
    return { title: d.title, text: parts.join('\n\n') };
  });
}

// The editor's progress chip isn't on the shelf, so generating shows its own
// dialog: what's happening, for how long, and a way to stop it.
let styleJob = null;
function styleProgress(words, texts) {
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal sp-modal" style="width:440px">
      <h2 style="font-size:16px">${t('voice.genTitle')}</h2>
      <p>${t('voice.genMsg', { n: fmtN(words), texts })}</p>
      <div class="sp-line"><span class="ai-spin"></span><span class="sp-stage">${t('voice.generating')}</span><span class="sp-time soft"></span></div>
      <p class="soft" style="font-size:12px">${t('voice.genWait')}</p>
      <div style="text-align:right"><button class="m-cancel btn-quiet">${t('voice.genStop')}</button></div>
    </div>`;
  document.body.appendChild(bd);
  const t0 = Date.now();
  const tick = () => { bd.querySelector('.sp-time').textContent = t('voice.genSecs', { n: Math.round((Date.now() - t0) / 1000) }); };
  tick();
  const timer = setInterval(tick, 1000);
  const stop = () => { bd.querySelector('.sp-stage').textContent = t('voice.genStopping'); aiCancel(); };
  bd.querySelector('.m-cancel').onclick = stop;
  bd.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') stop(); });
  bd.querySelector('.m-cancel').focus();
  return { close() { clearInterval(timer); bd.remove(); } };
}

async function generateStyle() {
  if (styleJob) { toast(t('voice.genRunning')); return; }
  if (typeof aiJob !== 'undefined' && aiJob) { toast(t('ai.busy')); return; }
  const docs = await voiceCorpus();
  const words = docs.reduce((a, d) => a + d.words, 0);
  if (words < VOICE_MIN) { toast(t('voice.tooLittle', { n: fmtN(VOICE_MIN) }), 6000); return; }
  if (!aiEnabled()) { toast(t('ai.off'), 6000); openAiSettings(); return; }
  if (words < 5000) {
    const go = await optionModal(t('voice.fewTitle'), t('voice.fewMsg', { n: fmtN(words) }), [
      { label: t('voice.fewGo'), value: 'go' }
    ]);
    if (go !== 'go') return;
  }
  // hand edits: keep them (the model is asked to) or start over
  const current = await window.neo.readStyle();
  let previous = null;
  const gen = library.styleGen;
  if (current.trim() && (!gen || gen.hash !== textHash(current))) {
    const how = await optionModal(t('voice.editedTitle'), t('voice.editedMsg'), [
      { label: t('voice.editedKeep'), desc: t('voice.editedKeepDesc'), value: 'keep' },
      { label: t('voice.editedReplace'), desc: t('voice.editedReplaceDesc'), danger: true, value: 'replace' }
    ]);
    if (!how) return;
    if (how === 'keep') previous = current;
  }
  const m = measureVoice(docs);
  styleJob = styleProgress(words, docs.length);
  let data = null;
  try {
    data = await aiRun('styleProfile', {
      texts: sampleVoice(docs),
      stats: measuresForModel(m),
      lang: m.lang,
      previous
    }, t('voice.generating'));
  } finally {
    styleJob.close();
    styleJob = null;
  }
  const md = data && typeof data.markdown === 'string' ? data.markdown.trim() : '';
  if (!md) return;
  openStyle({ draft: md, words, texts: docs.length, before: current });
}

// ---------------------------------------------------------------- estilo.md

// View and edit estilo.md. With `draft` (fresh from the assistant), nothing
// is written until the writer saves.
async function openStyle(opts = {}) {
  // one style window at a time: an older one left open would save stale text
  document.querySelectorAll('.st-modal').forEach((m) => m.closest('.modal-backdrop').remove());
  const current = await window.neo.readStyle();
  const draft = opts.draft;
  const gen = library.styleGen;
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal st-modal" style="width:720px">
      <h2 style="font-size:17px">${t(draft ? 'voice.draftTitle' : 'voice.styleTitle')}</h2>
      <p class="soft st-info"></p>
      <textarea class="st-md" spellcheck="false" placeholder="${escHtml(t('voice.stylePlaceholder'))}"></textarea>
      <div class="st-foot">
        <label class="st-check"><input type="checkbox" class="st-use"/> ${t('voice.useStyle')}</label>
        <span style="flex:1"></span>
        <button class="m-cancel btn-quiet">${t(draft ? 'voice.discard' : 'common.close')}</button>
        <button class="m-ok btn-gold">${t('voice.save')}</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  const ta = bd.querySelector('.st-md');
  ta.value = draft || current;
  bd.querySelector('.st-info').textContent = draft
    ? t('voice.draftInfo', { n: fmtN(opts.words || 0), texts: opts.texts || 0 })
    : gen ? t('voice.genInfo', { date: new Date(gen.at).toLocaleDateString(I18N.lang), n: fmtN(gen.words || 0) }) + (gen.hash !== textHash(current) ? ' ' + t('voice.editedNote') : '')
      : current.trim() ? t('voice.handInfo') : t('voice.noneInfo');
  const use = bd.querySelector('.st-use');
  use.checked = aiConf().useStyle !== false;
  use.onchange = async () => {
    library.ai = { ...(library.ai || {}), useStyle: use.checked };
    await window.neo.writeLibrary(library);
  };
  const close = () => bd.remove();
  bd.querySelector('.m-cancel').onclick = close;
  bd.addEventListener('keydown', (e) => {
    e.stopPropagation(); // typing here isn't editor shortcuts
    if (e.key === 'Escape') close();
  });
  bd.querySelector('.m-ok').onclick = async () => {
    const text = ta.value.replace(/\s+$/, '') + '\n';
    // never quietly replace a style that changed meanwhile, or blank one out
    if (!draft) {
      const onDisk = await window.neo.readStyle();
      const changed = onDisk !== current && onDisk.trim() !== text.trim();
      const blanking = !text.trim() && onDisk.trim();
      if (changed || blanking) {
        const ok = await optionModal(t(blanking ? 'voice.blankTitle' : 'voice.changedTitle'), t(blanking ? 'voice.blankMsg' : 'voice.changedMsg'), [
          { label: t(blanking ? 'voice.blankGo' : 'voice.changedGo'), danger: true, value: 'go' }
        ]);
        if (ok !== 'go') return;
      }
    }
    await window.neo.writeStyle(text.trim() ? text : '');
    if (draft) library.styleGen = { at: new Date().toISOString(), words: opts.words || 0, texts: opts.texts || 0, hash: textHash(text) };
    await window.neo.writeLibrary(library);
    close();
    toast(t(draft ? 'voice.savedNew' : 'voice.saved'), 5000);
    if (!$('#bookshelf-view').hidden) renderShelves();
  };
  ta.focus();
  ta.setSelectionRange(0, 0);
  ta.scrollTop = 0;
}
