/* ============================ MUTINY ============================ */
/* Appearance: on an Omarchy desktop the interface takes the system    */
/* theme — its palette, font and square corners — and follows it live  */
/* when the theme changes. The page never does: it keeps --paper,      */
/* --ink, --page-accent and its own typefaces (see styles.css).        */
/* library.appearance: 'auto' (Omarchy when present) | 'mutiny'.       */

'use strict';

const THEME_TOKENS = [
  '--bg', '--bg-soft', '--pane', '--fg', '--fg-strong', '--fg-2', '--muted', '--faint', '--fainter',
  '--surface', '--surface-2', '--line', '--line-soft', '--line-strong', '--shelf-line', '--scrim',
  '--accent', '--accent-ink', '--accent-bg', '--accent-line', '--accent-fg', '--note-bg',
  '--ai', '--ai-dim', '--ai-line', '--ai-bg', '--red', '--danger-soft', '--warn',
  '--ok', '--ok-bg', '--ok-line', '--ok-fg', '--ui-font', '--round'
];

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
// a → b by t (0 = a, 1 = b)
const mix = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return hexOf(x.map((v, i) => v + (y[i] - v) * t)); };
const luminance = (h) => {
  const [r, g, b] = rgbOf(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Omarchy's palette → the interface's tokens
function omarchyTokens(th) {
  const c = th.colors;
  const pick = (...keys) => { for (const k of keys) if (HEX6.test(c[k] || '')) return c[k]; return null; };
  const bg = c.background;
  const fg = c.foreground;
  const accent = pick('accent', 'blue', 'color4') || fg;
  const red = pick('red', 'color1') || '#c0392b';
  const green = pick('green', 'color2') || fg;
  const yellow = pick('yellow', 'color3') || accent;
  const blue = pick('blue', 'color4') || accent;
  const ctl = th.controls || {};
  // the shell's own control border: its colour at its opacity, over the background
  const border = HEX6.test(ctl['normal-border'] || '') ? ctl['normal-border'] : fg;
  const borderAlpha = typeof ctl['normal-border-alpha'] === 'number' ? ctl['normal-border-alpha'] : 0.3;
  const font = th.font ? `"${th.font}", ui-monospace, monospace` : 'ui-monospace, monospace';
  return {
    '--bg': bg,
    '--bg-soft': mix(bg, fg, 0.05),
    '--pane': mix(bg, fg, 0.03),
    '--fg': fg,
    '--fg-strong': pick('bright_foreground') && contrast(pick('bright_foreground'), bg) >= contrast(fg, bg) ? pick('bright_foreground') : fg,
    '--fg-2': mix(fg, bg, 0.18),
    '--muted': mix(fg, bg, 0.38),
    '--faint': mix(fg, bg, 0.52),
    '--fainter': mix(fg, bg, 0.66),
    '--surface': mix(bg, fg, 0.07),
    '--surface-2': mix(bg, fg, 0.12),
    '--line': mix(bg, border, Math.max(0.2, Math.min(0.7, borderAlpha))),
    '--line-soft': mix(bg, fg, 0.14),
    '--line-strong': mix(bg, border, Math.max(0.35, Math.min(0.85, borderAlpha + 0.2))),
    '--shelf-line': mix(bg, fg, 0.18),
    '--scrim': `color-mix(in srgb, ${bg} 72%, transparent)`,
    '--accent': accent,
    // text on the accent: whichever of the two reads better
    '--accent-ink': contrast(accent, bg) >= contrast(accent, fg) ? bg : fg,
    '--accent-bg': mix(bg, accent, 0.14),
    '--accent-line': mix(bg, accent, 0.4),
    '--accent-fg': fg,
    '--note-bg': mix(bg, fg, 0.06),
    '--ai': blue,
    '--ai-dim': mix(blue, bg, 0.35),
    '--ai-line': mix(bg, blue, 0.5),
    '--ai-bg': mix(bg, blue, 0.1),
    '--red': red,
    '--danger-soft': red,
    '--warn': yellow,
    '--ok': green,
    '--ok-bg': mix(bg, green, 0.15),
    '--ok-line': mix(bg, green, 0.5),
    '--ok-fg': green,
    '--ui-font': font,
    '--round': '0'
  };
}

let appearanceNow = { mode: 'mutiny', name: '' };

async function applyAppearance() {
  const want = (library && library.appearance) || 'auto';
  let th = { available: false };
  if (want === 'auto') { try { th = await window.neo.omarchyTheme(); } catch { /* not there */ } }
  const style = document.body.style;
  if (!th.available || !HEX6.test(th.colors.background || '') || !HEX6.test(th.colors.foreground || '')) {
    for (const k of THEME_TOKENS) style.removeProperty(k);
    style.removeProperty('color-scheme');
    document.body.classList.remove('omarchy', 'ui-light');
    if (appearanceNow.mode === 'omarchy') setAppMenu(false); // the native bar comes back
    appearanceNow = { mode: 'mutiny', name: '' };
    return appearanceNow;
  }
  // on <body>, so they win over the "brighter interface" defaults
  const tokens = omarchyTokens(th);
  for (const [k, v] of Object.entries(tokens)) style.setProperty(k, v);
  const light = th.colors.mode ? th.colors.mode === 'light' : luminance(th.colors.background) > 0.4;
  style.setProperty('color-scheme', light ? 'light' : 'dark');
  document.body.classList.add('omarchy');
  document.body.classList.toggle('ui-light', light);
  // the native menu bar can't take a theme: the page draws its own (appmenu.js)
  if (appearanceNow.mode !== 'omarchy' && /Linux/.test(navigator.userAgent)) setAppMenu(true);
  appearanceNow = { mode: 'omarchy', name: th.name || '' };
  return appearanceNow;
}

// live: a theme switch in Omarchy repaints Mutiny at once; the font (changed
// from Omarchy's menu, with no file to watch) is re-read when Mutiny regains focus
window.neo.onOmarchyChanged(() => applyAppearance());
window.addEventListener('focus', () => { if (appearanceNow.mode === 'omarchy') applyAppearance(); });
