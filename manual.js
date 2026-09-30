/* ============================ MUTINY ============================ */
/* The manual window: TUTORIAL.md / TUTORIAL_ES.md, split at every "##" */
/* into chapters and shown one at a time. The text is Mutiny's own     */
/* file, but it's still escaped before it becomes HTML.                */

'use strict';

const $ = (s) => document.querySelector(s);
const LABELS = {
  es: { welcome: 'Bienvenida', prev: 'Anterior', next: 'Siguiente', title: 'Manual de Mutiny' },
  en: { welcome: 'Welcome', prev: 'Previous', next: 'Next', title: 'Mutiny manual' }
};
const REPO = 'https://github.com/worldmutiny/mutiny/blob/main/';

let lang = 'es';
let chapters = []; // [{ title, slug, md }]
let anchors = {};  // slug → chapter index, for links between chapters
let current = 0;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// GitHub's heading anchors: "10. El asistente (opcional)" → "10-el-asistente-opcional"
const slug = (s) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');

// ---------------------------------------------------------------- markdown

// **bold**, *italic*, `code`, [text](url) — on escaped text
function inline(text) {
  const codes = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/&lt;br&gt;/g, '<br>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
}

// the block level: headings, paragraphs, lists (nested by indent), tables, quotes, rules
function render(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  let html = '';
  let i = 0;
  const indentOf = (l) => l.match(/^ */)[0].length;
  const isItem = (l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l);

  function list(start) {
    const base = indentOf(lines[start]);
    const ordered = /^\s*\d+\./.test(lines[start]);
    let out = ordered ? '<ol>' : '<ul>';
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) {
        // a blank line ends the list unless more of it follows, indented
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && (indentOf(lines[j]) > base || (isItem(lines[j]) && indentOf(lines[j]) === base))) { i = j; continue; }
        break;
      }
      const ind = indentOf(l);
      if (ind < base) break;
      if (ind === base && isItem(l)) {
        if (out.endsWith('</li>') === false && out.length > 4) out += '</li>';
        out += '<li>' + inline(l.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
        i++;
        continue;
      }
      if (ind > base && isItem(l)) { out += list(i); continue; }
      if (ind > base) { out += '<p>' + inline(l.trim()) + '</p>'; i++; continue; }
      break;
    }
    return out + '</li>' + (ordered ? '</ol>' : '</ul>');
  }

  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)$/))) {
      const level = m[1].length;
      html += `<h${level} id="${esc(slug(m[2]))}">${inline(m[2])}</h${level}>`;
      i++;
    } else if (/^---+\s*$/.test(l)) { html += '<hr>'; i++; }
    else if (l.startsWith('>')) {
      let q = '';
      while (i < lines.length && lines[i].startsWith('>')) q += lines[i++].replace(/^>\s?/, '') + ' ';
      html += '<blockquote><p>' + inline(q.trim()) + '</p></blockquote>';
    } else if (l.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r, k) => !(k === 1 && /^\|?\s*:?-+/.test(r.trim())));
      html += '<table><thead><tr>' + cells(body[0]).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        body.slice(1).map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    } else if (isItem(l)) {
      html += list(i);
    } else {
      let p = '';
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|\||---)/.test(lines[i]) && !isItem(lines[i])) p += lines[i++].trim() + ' ';
      html += '<p>' + inline(p.trim()) + '</p>';
    }
  }
  return html;
}

// ---------------------------------------------------------------- chapters

function split(md) {
  const out = [];
  let cur = null;
  let title = '';
  for (const line of md.replace(/\r/g, '').split('\n')) {
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    if (h1 && !cur) { title = h1[1]; cur = { title, slug: slug(title), md: '' }; out.push(cur); continue; }
    if (h2) {
      cur = { title: h2[1].replace(/^\d+\.\s*/, ''), slug: slug(h2[1]), md: '' };
      out.push(cur);
      continue;
    }
    if (!cur) { cur = { title: LABELS[lang].welcome, slug: 'welcome', md: '' }; out.push(cur); }
    // the language switch at the top of the file is the window's own
    if (/^\*\[(Leer en español|Read in English)\]/.test(line)) continue;
    cur.md += line + '\n';
  }
  return out;
}

// ---------------------------------------------------------------- showing

function show(n, anchor) {
  current = Math.max(0, Math.min(chapters.length - 1, n));
  const ch = chapters[current];
  $('#chapter').innerHTML = `<h1>${inline(ch.title)}</h1>` + render(ch.md);
  document.querySelectorAll('#chapters a').forEach((a, k) => a.classList.toggle('on', k === current));
  const L = LABELS[lang];
  const prev = chapters[current - 1];
  const next = chapters[current + 1];
  $('#pager').innerHTML = (prev ? `<a href="#" class="prev" data-n="${current - 1}">← ${inline(prev.title)}</a>` : '') +
    (next ? `<a href="#" class="next" data-n="${current + 1}">${inline(next.title)} →</a>` : '');
  document.title = `${ch.title} — ${L.title}`;
  const page = $('#page');
  if (anchor) {
    const target = document.getElementById(anchor);
    if (target) { target.scrollIntoView(); target.classList.add('flash'); return; }
  }
  page.scrollTop = 0;
}

function drawChapters() {
  const nav = $('#chapters');
  nav.innerHTML = chapters.map((c, k) => `<a href="#" data-n="${k}" title="${esc(c.title)}">${inline(c.title)}</a>`).join('');
}

function drawLangs() {
  $('#langs').innerHTML = ['es', 'en'].map((l) => `<button type="button" data-lang="${l}" class="${l === lang ? 'on' : ''}">${l.toUpperCase()}</button>`).join('');
}

async function load(wanted) {
  const data = await window.manual.get(wanted);
  lang = data.lang;
  document.documentElement.lang = lang;
  for (const [k, v] of Object.entries(data.tokens || {})) document.documentElement.style.setProperty(k, v);
  if (data.mono && data.tokens && data.tokens['--ui-font']) document.documentElement.style.setProperty('--manual-font', data.tokens['--ui-font']);
  const keep = chapters[current] ? current : 0;
  chapters = split(data.md);
  anchors = {};
  chapters.forEach((c, k) => {
    anchors[c.slug] = k;
    for (const h of c.md.matchAll(/^#{3}\s+(.*)$/gm)) anchors[slug(h[1])] = k;
  });
  drawLangs();
  drawChapters();
  show(Math.min(keep, chapters.length - 1));
}

// ---------------------------------------------------------------- clicks and keys

document.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  const langBtn = e.target.closest('#langs button');
  if (langBtn) { load(langBtn.dataset.lang); return; }
  if (!a) return;
  e.preventDefault();
  if (a.dataset.n != null) { show(+a.dataset.n); return; }
  const href = a.getAttribute('href') || '';
  if (href.startsWith('#')) {
    const id = decodeURIComponent(href.slice(1));
    if (id in anchors) show(anchors[id], anchors[id] === current || chapters[anchors[id]].slug !== id ? id : null);
    return;
  }
  if (/^TUTORIAL(_ES)?\.md$/.test(href)) { load(href.includes('_ES') ? 'es' : 'en'); return; }
  if (/^https?:\/\//.test(href)) { window.manual.openLink(href); return; }
  // the repo's other files (README, SECURITY…) are read on GitHub
  if (/^[\w.-]+\.md(#[\w-]+)?$/.test(href)) window.manual.openLink(REPO + href);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' && !e.altKey) show(current + 1);
  if (e.key === 'ArrowLeft' && !e.altKey) show(current - 1);
  if (e.key === 'Escape') window.close();
});

window.manual.onRefresh(() => load());
load();
