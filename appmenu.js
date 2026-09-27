/* ============================ MUTINY ============================ */
/* The menu bar, drawn by the page — on Omarchy, where the native bar  */
/* can't take the desktop's theme. Same menus, same shortcuts: the     */
/* model and every action come from the main process (main.js). The   */
/* bar never takes focus, so the caret and the selection stay in the   */
/* editor (Copy, Versions… act on them as with the native bar).        */
/* Alt alone: walk the bar with the arrows, Enter runs, Esc leaves.    */

'use strict';

let appMenu = null; // { el, model, open: index|-1, path: [i, j…], keys: bool }

async function setAppMenu(on) {
  if (!on) {
    if (appMenu) { appMenu.el.remove(); appMenu = null; }
    document.body.classList.remove('appmenu-on');
    window.neo.appMenuNative(true);
    return;
  }
  const model = await window.neo.appMenu();
  if (!model || !model.length) return;
  if (!appMenu) {
    const el = document.createElement('nav');
    el.id = 'appmenu';
    el.setAttribute('role', 'menubar');
    // never steal focus from the page: the selection must survive a click
    el.addEventListener('mousedown', (e) => e.preventDefault());
    document.body.appendChild(el);
    appMenu = { el, model, open: -1, path: [], keys: false };
  }
  appMenu.model = model;
  document.body.classList.add('appmenu-on');
  window.neo.appMenuNative(false);
  drawAppMenu();
}

// The bar is built once per menu model, and a dropdown once per opening.
// Moving the pointer only changes classes: a node replaced under the pointer
// between press and release would never get its click.
function drawAppMenu() {
  const m = appMenu;
  if (m.builtModel !== m.model) {
    m.builtModel = m.model;
    m.builtOpen = null;
    m.el.textContent = '';
    m.tops = m.model.map((top, i) => {
      const b = document.createElement('span');
      b.className = 'am-top';
      b.setAttribute('role', 'menuitem');
      const label = document.createElement('span');
      label.textContent = top.label; // the app's own strings, as text all the same
      b.appendChild(label);
      b.addEventListener('click', (e) => {
        if (e.target.closest('.am-drop')) return; // a row's click, not the title's
        if (m.open === i) closeAppMenu(); else openTop(i, false);
      });
      b.addEventListener('mouseenter', () => { if (m.open !== -1 && m.open !== i) openTop(i, false); });
      m.el.appendChild(b);
      return b;
    });
  }
  if (m.builtOpen !== m.open) {
    m.el.querySelectorAll('.am-drop').forEach((d) => d.remove());
    if (m.open !== -1) m.tops[m.open].appendChild(buildDropdown(m.model[m.open].items, 1));
    m.builtOpen = m.open;
  }
  markAppMenu();
}

// the whole tree of the open menu; submenus show when their row is selected
function buildDropdown(items, depth) {
  const m = appMenu;
  const box = document.createElement('div');
  box.className = 'am-drop';
  box.setAttribute('role', 'menu');
  items.forEach((it, j) => {
    if (it.sep) { const hr = document.createElement('div'); hr.className = 'am-sep'; box.appendChild(hr); return; }
    const row = document.createElement('div');
    row.className = 'am-item' + (it.items ? ' has-sub' : '');
    row.dataset.j = j;
    row.setAttribute('role', 'menuitem');
    const label = document.createElement('span');
    label.textContent = it.label;
    const right = document.createElement('span');
    right.className = 'am-accel';
    right.textContent = it.items ? '›' : (it.accel || '');
    row.append(label, right);
    // hovering a row selects it; one with a submenu opens it
    row.addEventListener('mouseenter', () => {
      m.path = [...m.path.slice(0, depth - 1), j];
      if (it.items) m.path.push(-1);
      markAppMenu();
    });
    row.addEventListener('click', (e) => {
      if (e.target.closest('.am-drop') !== box) return; // bubbled up from a submenu row
      e.stopPropagation();
      if (it.items) { m.path = [...m.path.slice(0, depth - 1), j, firstItem(it.items, -1, 1)]; markAppMenu(); return; }
      runAppMenu(it.id);
    });
    if (it.items) row.appendChild(buildDropdown(it.items, depth + 1));
    box.appendChild(row);
  });
  return box;
}

// selection and open submenus follow m.path; the bar's cursor follows m.cursor
function markAppMenu() {
  const m = appMenu;
  m.tops.forEach((b, i) => {
    b.classList.toggle('open', m.open === i);
    b.classList.toggle('cursor', m.keys && m.open === -1 && m.cursor === i);
  });
  const mark = (box, d) => {
    for (const row of box.querySelectorAll(':scope > .am-item')) {
      const sel = Number(row.dataset.j) === m.path[d];
      row.classList.toggle('sel', sel);
      const sub = row.querySelector(':scope > .am-drop');
      if (sub) { sub.hidden = !sel || m.path.length <= d + 1; if (!sub.hidden) mark(sub, d + 1); }
    }
  };
  const drop = m.open !== -1 && m.tops[m.open].querySelector(':scope > .am-drop');
  if (drop) mark(drop, 0);
}

function openTop(i, keys) {
  appMenu.open = i;
  appMenu.cursor = i;
  appMenu.keys = keys;
  appMenu.path = keys ? [firstItem(appMenu.model[i].items, -1, 1)] : [];
  drawAppMenu();
}

function closeAppMenu() {
  if (!appMenu) return;
  appMenu.open = -1;
  appMenu.path = [];
  appMenu.keys = false;
  appMenu.cursor = -1;
  drawAppMenu();
}

function runAppMenu(id) {
  closeAppMenu();
  window.neo.appMenuRun(id);
}

// next selectable row from `from` in direction `dir` (separators skipped)
function firstItem(items, from, dir) {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const j = (from + dir * k + n * 2) % n;
    if (!items[j].sep) return j;
  }
  return 0;
}

// the list the keyboard is in, and the one above it
function currentLists() {
  const m = appMenu;
  const lists = [m.model[m.open].items];
  for (let d = 0; d < m.path.length - 1; d++) lists.push(lists[d][m.path[d]].items);
  return lists;
}

document.addEventListener('click', (e) => {
  if (appMenu && appMenu.open !== -1 && !appMenu.el.contains(e.target)) closeAppMenu();
}, true);
window.addEventListener('blur', () => closeAppMenu());

// Alt pressed and released alone: the bar takes the keyboard
let altAlone = false;
document.addEventListener('keydown', (e) => {
  if (!appMenu) return;
  if (e.key === 'Alt') { altAlone = !e.repeat; return; }
  altAlone = false;
  const m = appMenu;
  if (!m.keys && m.open === -1) return;
  const top = m.model.length;
  const handled = () => { e.preventDefault(); e.stopPropagation(); };
  if (e.key === 'Escape') {
    handled();
    if (m.path.length > 1) { m.path.pop(); drawAppMenu(); } else closeAppMenu();
    return;
  }
  if (m.open === -1) {
    // on the bar, nothing open yet
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { handled(); m.cursor = (m.cursor + (e.key === 'ArrowRight' ? 1 : top - 1)) % top; drawAppMenu(); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { handled(); openTop(m.cursor, true); }
    else { closeAppMenu(); }
    return;
  }
  m.keys = true;
  if (!m.path.length) m.path = [-1]; // opened with the mouse, continued with the keys
  const lists = currentLists();
  const d = m.path.length - 1;
  const list = lists[d];
  const cur = m.path[d] >= 0 ? list[m.path[d]] : null;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    handled();
    m.path[d] = firstItem(list, m.path[d] == null ? -1 : m.path[d], e.key === 'ArrowDown' ? 1 : -1);
    drawAppMenu();
  } else if (e.key === 'ArrowRight') {
    handled();
    if (cur && cur.items) { m.path.push(firstItem(cur.items, -1, 1)); drawAppMenu(); }
    else openTop((m.open + 1) % top, true);
  } else if (e.key === 'ArrowLeft') {
    handled();
    if (m.path.length > 1) { m.path.pop(); drawAppMenu(); } else openTop((m.open + top - 1) % top, true);
  } else if (e.key === 'Enter' || e.key === ' ') {
    handled();
    if (cur && cur.items) { m.path.push(firstItem(cur.items, -1, 1)); drawAppMenu(); }
    else if (cur) runAppMenu(cur.id);
  } else if (!e.ctrlKey && !e.metaKey) {
    handled(); // typing doesn't reach the page while the menu is open
  }
}, true);
document.addEventListener('keyup', (e) => {
  if (!appMenu || e.key !== 'Alt' || !altAlone) return;
  altAlone = false;
  e.preventDefault();
  const m = appMenu;
  if (m.keys || m.open !== -1) { closeAppMenu(); return; }
  m.keys = true;
  m.cursor = 0;
  drawAppMenu();
}, true);

window.neo.onAppMenuChanged(() => { if (appMenu) setAppMenu(true); });
