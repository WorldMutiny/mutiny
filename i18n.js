/* Mutiny — interface strings.
 * The main process hands over the dictionary for the chosen language plus
 * English as the fallback (locales/*.json). Strings are flat keys with
 * {name} placeholders; plurals are key.one / key.other.
 *
 *   t('toast.saved')                       → "Saved"
 *   t('shelf.removed', { title })          → "“Foo” removed from the shelves…"
 *   tn('count.words', 3)                   → "3 words"   ({n} is filled in)
 *
 * Static markup is tagged instead:
 *   data-i18n="key"             → textContent
 *   data-i18n-html="key"        → innerHTML (for strings that carry <br>, <b>)
 *   data-i18n-title="key"       → title attribute
 *   data-i18n-placeholder="key" → placeholder attribute
 *   data-i18n-ph="key"          → data-ph (contenteditable placeholders)
 */
'use strict';

const I18N = { lang: 'en', strings: {}, fallback: {}, all: {} };

function t(key, vars) {
  let s = I18N.strings[key];
  if (s == null) s = I18N.fallback[key];
  if (s == null) return key; // a missing key shows itself, loudly, in dev
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}

// text that belongs to a document rather than to the interface — an
// export's "by" line, say — follows the document's own language
function te(lang, key, vars) {
  const saved = I18N.strings;
  I18N.strings = I18N.all[lang] || I18N.fallback;
  try { return t(key, vars); } finally { I18N.strings = saved; }
}

// numbers as the writer reads them: Spanish uses Mexico's 1,517 (Spain's
// "1517" / "22.034" would clash with the strings' own "2,000")
const numLocale = () => (I18N.lang === 'es' ? 'es-MX' : I18N.lang);
const fmtN = (n) => Number(n || 0).toLocaleString(numLocale());

function tn(key, n, vars) {
  const count = typeof n === 'number' ? fmtN(n) : n;
  return t(key + (n === 1 ? '.one' : '.other'), { n: count, ...(vars || {}) });
}

function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.dataset.ph = t(el.dataset.i18nPh); });
  document.documentElement.lang = I18N.lang;
}

async function loadI18n(lang) {
  const res = await window.neo.i18n(lang);
  I18N.lang = res.lang;
  I18N.strings = res.strings;
  I18N.fallback = res.fallback;
  I18N.all = res.all || {};
  applyI18n();
  return res.lang;
}
