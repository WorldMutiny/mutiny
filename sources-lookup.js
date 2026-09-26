// Mutiny — source lookup (main process).
// Turns what the writer pastes — a URL, a DOI or an ISBN — into a draft
// source record: { url, title, author, site, published, kind }.
// Web pages are read for their metadata only (OpenGraph, <meta>, JSON-LD);
// no page script ever runs. DOIs go to Crossref, ISBNs to Open Library.
// Everything is best-effort: the writer reviews and fixes the result.

'use strict';

const TIMEOUT_MS = 12000;
const MAX_BYTES = 3 * 1024 * 1024;
const UA = 'Mutiny/0.1 (essay writer; +https://github.com/worldmutiny/mutiny)';

// ---------------------------------------------------------------- detection

function detect(input) {
  const s = String(input || '').trim();
  const doi = s.match(/^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i);
  if (doi) return { kind: 'doi', value: doi[1].replace(/[.,;]+$/, '') };
  const digits = s.replace(/^isbn(?:-1[03])?:?\s*/i, '').replace(/[\s-]/g, '');
  if (/^(?:\d{9}[\dXx]|\d{13})$/.test(digits) && isbnValid(digits)) return { kind: 'isbn', value: digits.toUpperCase() };
  let url = s;
  if (/^www\./i.test(url)) url = 'https://' + url;
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return { kind: 'url', value: u.href };
  } catch { /* not a URL */ }
  return null;
}

function isbnValid(d) {
  if (d.length === 10) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (d[i] === 'X' || d[i] === 'x' ? 10 : +d[i]) * (10 - i);
    return sum % 11 === 0;
  }
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += +d[i] * (i % 2 ? 3 : 1);
  return sum % 10 === 0;
}

// ---------------------------------------------------------------- fetching

const { isPrivateUrl } = require('./ai/guard.js');

// Follows redirects by hand so every hop is checked: a pasted link (or one
// it redirects to) may not reach this computer or the local network.
async function fetchLimited(fetchFn, url, accept) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res;
    let current = url;
    for (let hop = 0; ; hop++) {
      if (hop > 5) throw new Error('too many redirects');
      if (await isPrivateUrl(current)) throw new Error('blocked: local or private address');
      res = await fetchFn(current, {
        signal: ctrl.signal,
        redirect: 'manual',
        headers: { 'User-Agent': UA, Accept: accept }
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location'), current).href;
        try { await res.body?.cancel(); } catch { /* nothing to drain */ }
        continue;
      }
      break;
    }
    Object.defineProperty(res, 'finalUrl', { value: current });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { ctrl.abort(); break; } // the <head> is long since read
      chunks.push(value);
    }
    return { buf: Buffer.concat(chunks.map((c) => Buffer.from(c))), res };
  } finally {
    clearTimeout(timer);
  }
}

function decode(buf, contentType) {
  let charset = (/charset=([\w-]+)/i.exec(contentType || '') || [])[1];
  if (!charset) {
    const head = buf.subarray(0, 4096).toString('latin1');
    charset = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(head) || [])[1];
  }
  try { return new TextDecoder(charset || 'utf-8').decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
}

// ---------------------------------------------------------------- HTML metadata

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function unescapeHtml(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function metaTags(html) {
  const out = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (name) => {
      const r = new RegExp(name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag);
      return r ? (r[1] ?? r[2] ?? r[3]) : null;
    };
    const key = (attr('property') || attr('name') || attr('itemprop') || '').toLowerCase();
    const content = attr('content');
    if (key && content != null && !(key in out)) out[key] = unescapeHtml(content);
  }
  return out;
}

// schema.org JSON-LD blocks: the most reliable home of author and date
function jsonLd(html) {
  const found = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      const walk = (x) => {
        if (!x || typeof x !== 'object') return;
        if (Array.isArray(x)) { x.forEach(walk); return; }
        if (x['@graph']) walk(x['@graph']);
        if (x.headline || x.datePublished || x.author) found.push(x);
      };
      walk(data);
    } catch { /* malformed blocks are common */ }
  }
  return found[0] || null;
}

function personNames(a) {
  if (!a) return '';
  const list = Array.isArray(a) ? a : [a];
  return list.map((p) => (typeof p === 'string' ? p : p && p.name)).filter(Boolean).join(', ');
}

function isoDate(s) {
  if (!s) return '';
  const m = String(s).match(/(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  return m ? [m[1], m[2], m[3]].filter(Boolean).join('-') : '';
}

function fromHtml(html, url) {
  const meta = metaTags(html);
  const ld = jsonLd(html);
  const titleTag = unescapeHtml((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1]);
  let author = personNames(ld && ld.author) || meta.author || meta['article:author'] || meta['parsely-author'] || meta['dc.creator'] || '';
  if (/^https?:\/\//.test(author)) author = ''; // some sites put a profile URL here
  const host = new URL(url).hostname.replace(/^www\./, '');
  return {
    kind: 'web',
    url: meta['og:url'] && /^https?:\/\//.test(meta['og:url']) ? meta['og:url'] : url,
    title: meta['og:title'] || meta['twitter:title'] || (ld && ld.headline) || titleTag || '',
    author: unescapeHtml(author),
    site: meta['og:site_name'] || meta['application-name'] || host,
    published: isoDate((ld && ld.datePublished) || meta['article:published_time'] || meta['date'] ||
      meta['dc.date'] || meta['citation_publication_date'] || meta['pubdate'] ||
      (/<time[^>]+datetime=["']([^"']+)/i.exec(html) || [])[1])
  };
}

// ---------------------------------------------------------------- DOI / ISBN

function fromCrossref(json, doi) {
  const w = json.message || {};
  const authors = (w.author || []).map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.name).filter(Boolean);
  const parts = ((w.issued || w.published || {})['date-parts'] || [[]])[0] || [];
  return {
    kind: 'article',
    url: w.URL || 'https://doi.org/' + doi,
    doi,
    title: unescapeHtml((w.title || [])[0] || ''),
    author: authors.length > 3 ? authors.slice(0, 3).join(', ') + ' et al.' : authors.join(', '),
    site: (w['container-title'] || [])[0] || w.publisher || '',
    published: parts.filter(Boolean).map((n, i) => (i ? String(n).padStart(2, '0') : String(n))).join('-')
  };
}

// Open Library edition record (/isbn/<isbn>.json); author names live on
// their own records, so they are passed in already resolved
function fromOpenLibrary(ed, isbn, authorNames) {
  if (!ed || !ed.title) return null;
  return {
    kind: 'book',
    url: 'https://openlibrary.org/isbn/' + isbn,
    isbn,
    title: [ed.title, ed.subtitle].filter(Boolean).join(': '),
    author: (authorNames || []).join(', '),
    site: (ed.publishers || []).join(', '),
    published: isoDate(ed.publish_date) || (String(ed.publish_date || '').match(/\d{4}/) || [''])[0]
  };
}

// Google Books: the fallback when Open Library doesn't know the ISBN
function fromGoogleBooks(json, isbn) {
  const v = json.items && json.items[0] && json.items[0].volumeInfo;
  if (!v || !v.title) return null;
  return {
    kind: 'book',
    url: v.canonicalVolumeLink || v.infoLink || 'https://books.google.com/books?vid=ISBN' + isbn,
    isbn,
    title: [v.title, v.subtitle].filter(Boolean).join(': '),
    author: (v.authors || []).join(', '),
    site: v.publisher || '',
    published: isoDate(v.publishedDate)
  };
}

async function lookupIsbn(fetchFn, isbn) {
  const getJson = async (url) => JSON.parse((await fetchLimited(fetchFn, url, 'application/json')).buf.toString('utf8'));
  try {
    const ed = await getJson(`https://openlibrary.org/isbn/${isbn}.json`);
    const names = [];
    for (const a of (ed.authors || []).slice(0, 4)) {
      try { names.push((await getJson(`https://openlibrary.org${a.key}.json`)).name); } catch { /* skip */ }
    }
    const src = fromOpenLibrary(ed, isbn, names.filter(Boolean));
    if (src) return src;
  } catch { /* not in Open Library — try Google */ }
  try {
    return fromGoogleBooks(await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`), isbn);
  } catch { return null; }
}

// ---------------------------------------------------------------- entry point

async function lookup(input, fetchFn) {
  const d = detect(input);
  if (!d) return { error: 'unrecognised' };
  try {
    if (d.kind === 'doi') {
      const { buf } = await fetchLimited(fetchFn, 'https://api.crossref.org/works/' + encodeURIComponent(d.value), 'application/json');
      return { source: fromCrossref(JSON.parse(buf.toString('utf8')), d.value) };
    }
    if (d.kind === 'isbn') {
      const src = await lookupIsbn(fetchFn, d.value);
      return src ? { source: src } : { error: 'notFound', partial: { kind: 'book', isbn: d.value } };
    }
    const { buf, res } = await fetchLimited(fetchFn, d.value, 'text/html,application/xhtml+xml');
    const type = res.headers.get('content-type') || '';
    const finalUrl = res.finalUrl || res.url || d.value;
    if (!/html|xml/i.test(type)) {
      // a PDF or other file: all we know is where it lives
      return { source: { kind: 'web', url: finalUrl, title: '', author: '', site: new URL(finalUrl).hostname.replace(/^www\./, ''), published: '' } };
    }
    return { source: fromHtml(decode(buf, type), finalUrl) };
  } catch (err) {
    // an unreachable page still leaves a usable draft: its address
    if (/blocked/.test(String(err.message))) return { error: 'blocked' };
    const partial = d.kind === 'url' ? { kind: 'web', url: d.value, site: new URL(d.value).hostname.replace(/^www\./, '') } : null;
    return { error: err.name === 'AbortError' ? 'timeout' : 'network', detail: String(err.message || err), partial };
  }
}

module.exports = { lookup, detect, fromHtml, fromCrossref, fromOpenLibrary, fromGoogleBooks };
