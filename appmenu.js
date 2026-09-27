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

// labels come from the app's own strings; set as text all the same
function drawAppMenu() {
  const m = appMenu;
  m.el.textContent = '';
  m.model.forEach((top, i) => {
    const b = document.createElement('span');
    b.className = 'am-top' + (m.open === i ? ' open' : '') + (m.keys && m.path.length === 0 && m.cursor === i ? ' cursor' : '');
    b.textContent = top.label;
    b.setAttribute('role', 'menuitem');
    b.onclick = () => (m.open === i ? closeAppMenu() : openTop(i, false));
    b.onmouseenter = () => { if (m.open !== -1 && m.open !== i) openTop(i, false); };
    m.el.appendChild(b);
    if (m.open === i) b.appendChild(drawDropdown(top.items, [i]));
  });
}

function drawDropdown(items, at) {
  const m = appMenu;
  const box = document.createElement('div');
  box.className = 'am-drop';
  box.setAttribute('role', 'menu');
  const depth = at.length; // 1 = the top menu's list
  const sel = m.path[depth - 1];
  items.forEach((it, j) => {
    if (it.sep) { const hr = document.createElement('div'); hr.className = 'am-sep'; box.appendChild(hr); return; }
    const row = document.createElement('div');
    row.className = 'am-item' + (sel === j ? ' sel' : '') + (it.items ? ' has-sub' : '');
    row.setAttribute('role', 'menuitem');
    const label = document.createElement('span');
    label.textContent = it.label;
    const right = document.createElement('span');
    right.className = 'am-accel';
    right.textContent = it.items ? '›' : (it.accel || '');
    row.append(label, right);
    // hovering a row selects it; one with a submenu opens it
    row.onmouseenter = () => {
      m.path = [...m.path.slice(0, depth - 1), j];
      if (it.items) m.path.push(-1);
      drawAppMenu();
    };
    row.onclick = (e) => {
      e.stopPropagation();
      if (it.items) { m.path = [...m.path.slice(0, depth - 1), j, 0]; drawAppMenu(); return; }
      runAppMenu(it.id);
    };
    if (it.items && sel === j && m.path.length > depth) row.appendChild(drawDropdown(it.items, at.concat(j)));
    box.appendChild(row);
  });
  return box;
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
