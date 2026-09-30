/* ============================ MUTINY ============================ */
/* Appearance: on an Omarchy desktop the interface takes the system    */
/* theme — its palette, font and square corners — and follows it live  */
/* when the theme changes. The page never does: it keeps --paper,      */
/* --ink, --page-accent and its own typefaces (see styles.css).        */
/* Or one of Mutiny's own themes, drawn from Omarchy palettes but with  */
/* Mutiny's typefaces and rounded corners.                             */
/* library.appearance: 'auto' (Omarchy when present, else Mutiny) |    */
/* 'mutiny' | an id in THEMES.                                         */

'use strict';

const THEME_TOKENS = [
  '--bg', '--bg-soft', '--pane', '--fg', '--fg-strong', '--fg-2', '--muted', '--faint', '--fainter',
  '--surface', '--surface-2', '--line', '--line-soft', '--line-strong', '--shelf-line', '--scrim',
  '--accent', '--accent-ink', '--accent-bg', '--accent-line', '--accent-fg', '--note-bg',
  '--ai', '--ai-dim', '--ai-line', '--ai-bg', '--red', '--danger-soft', '--warn',
  '--ok', '--ok-bg', '--ok-line', '--ok-fg', '--link', '--ui-font', '--round', '--page-title'
];

// The built-in themes: each one's palette as its Omarchy theme has it, with
// a few roles picked by hand (a muted accent traded for the theme's signature
// colour, a dark red for one that reads as text). `blue` is the assistant's
// colour, `bright_foreground` the headings on the Night page.
const THEMES = {
  blackgold: {
    name: 'BlackGold',
    colors: { background: '#0D0D0D', foreground: '#ebdbb2', bright_foreground: '#F6F1DD', accent: '#BFA75D',
      red: '#D35F5F', green: '#a3850e', yellow: '#BFA75D', blue: '#a3850e', bright_blue: '#BFA75D' }
  },
  'black-arch': {
    name: 'Black Arch',
    colors: { background: '#000000', foreground: '#D4D4D4', bright_foreground: '#FFFFFF', accent: '#989898',
      red: '#B9B9B9', green: '#8E8E8E', yellow: '#B9B9B9', blue: '#B9B9B9', bright_blue: '#D4D4D4' }
  },
  matrix: {
    name: 'Matrix',
    colors: { background: '#080C09', foreground: '#8BC98C', bright_foreground: '#C5E6C6', accent: '#3CBF5C',
      red: '#D05050', green: '#5ED87A', yellow: '#B8BA48', blue: '#6ECB88', bright_blue: '#5AA080' }
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    colors: { background: '#1a1b26', foreground: '#a9b1d6', bright_foreground: '#c0caf5', accent: '#7aa2f7',
      red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#bb9af7', bright_blue: '#7dcfff' }
  },
  'city-783': {
    name: 'City 783',
    colors: { background: '#181a1f', foreground: '#b9bec6', bright_foreground: '#eceff2', accent: '#ad2222',
      red: '#ff5c5c', green: '#dce0e6', yellow: '#f04a4a', blue: '#ff5c5c', bright_blue: '#dce0e6' }
  }
};
// Mutiny's own look lives in styles.css (:root); this is its swatch
const MUTINY_SWATCH = { background: '#0e091d', foreground: '#14B9B5', accent: '#BE3F50' };

function builtinTokens(th) {
  const tokens = omarchyTokens({ colors: th.colors, controls: {} });
  delete tokens['--ui-font']; // Mutiny's typefaces
  tokens['--round'] = '1';
  tokens['--page-title'] = th.colors.bright_foreground;
  return tokens;
}

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
    '--accent-ink': [bg, fg, '#ffffff'].sort((a, b) => contrast(accent, b) - contrast(accent, a))[0],
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
    '--link': pick('bright_blue', 'color12', 'blue', 'color4') || accent,
    '--ui-font': font,
    '--round': '0'
  };
}

let appearanceNow = { mode: 'mutiny', name: '' };

// The native menu bar can't take any theme's colours, so where it lives in the
// window (Linux, Windows) the page draws its own in either look (appmenu.js);
// on a Mac the menu sits in the system's top bar and stays native.
let appMenuDrawn = false;
function drawThemedMenu() {
  if (appMenuDrawn || !/Linux|Windows/.test(navigator.userAgent)) return;
  appMenuDrawn = true;
  setAppMenu(true);
}

async function applyAppearance() {
  drawThemedMenu();
  const want = (library && library.appearance) || 'auto';
  const style = document.body.style;
  if (THEMES[want]) {
    for (const k of THEME_TOKENS) style.removeProperty(k);
    for (const [k, v] of Object.entries(builtinTokens(THEMES[want]))) style.setProperty(k, v);
    style.setProperty('color-scheme', 'dark');
    document.body.classList.remove('omarchy', 'ui-light');
    document.body.classList.add('themed');
    appearanceNow = { mode: 'builtin', id: want, name: THEMES[want].name };
    return appearanceNow;
  }
  let th = { available: false };
  if (want === 'auto') { try { th = await window.neo.omarchyTheme(); } catch { /* not there */ } }
  if (!th.available || !HEX6.test(th.colors.background || '') || !HEX6.test(th.colors.foreground || '')) {
    for (const k of THEME_TOKENS) style.removeProperty(k);
    style.removeProperty('color-scheme');
    document.body.classList.remove('omarchy', 'themed', 'ui-light');
    appearanceNow = { mode: 'mutiny', name: '' };
    return appearanceNow;
  }
  // on <body>, so they win over the "brighter interface" defaults
  const tokens = omarchyTokens(th);
  for (const [k, v] of Object.entries(tokens)) style.setProperty(k, v);
  const light = th.colors.mode ? th.colors.mode === 'light' : luminance(th.colors.background) > 0.4;
  style.setProperty('color-scheme', light ? 'light' : 'dark');
  document.body.classList.add('omarchy', 'themed');
  document.body.classList.toggle('ui-light', light);
  appearanceNow = { mode: 'omarchy', name: th.name || '' };
  return appearanceNow;
}

// A row of cards, one per look: a small swatch of its colours and its name.
// Picking one applies it at once; `onPick(id)` saves it.
function themePicker(current, onPick) {
  const row = document.createElement('div');
  row.className = 'theme-picker';
  const looks = [];
  if (/Linux/.test(navigator.userAgent)) looks.push({ id: 'auto', name: t('theme.omarchy'), sw: null });
  looks.push({ id: 'mutiny', name: 'Mutiny', sw: MUTINY_SWATCH });
  for (const [id, th] of Object.entries(THEMES)) looks.push({ id, name: th.name, sw: th.colors });
  for (const look of looks) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-card' + (look.id === current ? ' sel' : '');
    b.dataset.theme = look.id;
    const sw = document.createElement('span');
    sw.className = 'tc-swatch' + (look.sw ? '' : ' tc-system');
    if (look.sw) {
      sw.style.background = look.sw.background;
      sw.innerHTML = `<span class="tc-aa" style="color:${look.sw.foreground}">Aa</span><span class="tc-dot" style="background:${look.sw.accent}"></span>`;
    } else {
      sw.innerHTML = '<span class="tc-aa">Aa</span><span class="tc-dot"></span>';
    }
    const name = document.createElement('span');
    name.className = 'tc-name';
    name.textContent = look.name;
    b.append(sw, name);
    b.onclick = async () => {
      row.querySelectorAll('.theme-card').forEach((x) => x.classList.toggle('sel', x === b));
      await onPick(look.id);
    };
    row.appendChild(b);
  }
  return row;
}

// live: a theme switch in Omarchy repaints Mutiny at once; the font (changed
// from Omarchy's menu, with no file to watch) is re-read when Mutiny regains focus
window.neo.onOmarchyChanged(() => applyAppearance());
window.addEventListener('focus', () => { if (appearanceNow.mode === 'omarchy') applyAppearance(); });
