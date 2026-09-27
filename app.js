/* ============================= MUTINY ============================= */

'use strict';

// ---------- state ----------
let library = null;          // library.json
let book = null;             // current book.json
let chapterHTML = {};        // chapterId -> html (loaded at open)
let stickies = [];           // [{id, chapterId, text, resolved}]
let darlings = [];           // [{id, html, text, chapterId, chapterNum, date}]
let sources = [];            // sources.json — see SOURCES below
let currentTab = 'manuscript';
let currentChapterId = null; // chapter the caret/scroll is in
let wordMode = 'book';       // 'book' | 'chapter'
let saveTimers = {};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Platform-aware key labels: Macs read ⌘⇧X, everyone else reads Ctrl+Shift+X
const IS_MAC = navigator.platform.toLowerCase().includes('mac');
const K = (mac, pc) => (IS_MAC ? mac : pc);
const KZ = K('⌘Z', 'Ctrl+Z');
const KPH = K('⌘⇧X', 'Ctrl+Shift+X');
const KDA = K('⌘⇧D', 'Ctrl+Shift+D');
const KHELP = K('⌘/', 'Ctrl+/');
const KCITE = K('⌘⇧K', 'Ctrl+Shift+K');

// Scrollbars stay invisible until you scroll, then fade away again —
// chrome only when needed.
document.addEventListener('scroll', (e) => {
  const el = e.target;
  if (!el || !el.classList) return;
  el.classList.add('show-scrollbar');
  clearTimeout(el._neoSbHide);
  el._neoSbHide = setTimeout(() => el.classList.remove('show-scrollbar'), 750);
}, true);

function askInput(title, placeholder, value = '') {
  return new Promise((resolve) => {
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `
      <div class="modal" style="width:380px">
        <h2 style="font-size:16px">${title}</h2>
        <input type="text" spellcheck="false" placeholder="${placeholder}" />
        <div style="text-align:right;margin-top:14px">
          <button class="m-cancel btn-quiet" style="margin-right:10px">${t('common.cancel')}</button>
          <button class="m-ok btn-gold">${t('common.ok')}</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    const input = bd.querySelector('input');
    input.value = value;
    input.focus();
    input.select();
    const done = (val) => { bd.remove(); resolve(val); };
    bd.querySelector('.m-ok').onclick = () => done(input.value.trim());
    bd.querySelector('.m-cancel').onclick = () => done(null);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') done(input.value.trim());
      if (e.key === 'Escape') done(null);
    };
  });
}

// A list of choices, null on cancel.
function optionModal(title, message, options) {
  return new Promise((resolve) => {
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    const buttons = options.map((o, i) =>
      `<button class="fr-choice" data-i="${i}" style="width:100%;margin-bottom:8px;${o.danger ? 'border-color:color-mix(in srgb, var(--danger-soft) 40%, var(--bg))' : ''}">
        <strong${o.danger ? ' style="color:var(--danger-soft)"' : ''}>${o.label}</strong>
        ${o.desc ? `<span>${o.desc}</span>` : ''}
      </button>`).join('');
    bd.innerHTML = `
      <div class="modal" style="width:420px">
        <h2 style="font-size:16px">${title}</h2>
        ${message ? `<p>${message}</p>` : ''}
        ${buttons}
        <div style="text-align:right;margin-top:6px">
          <button class="m-cancel btn-quiet">${t('common.cancel')}</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    const done = (val) => { bd.remove(); resolve(val); };
    bd.querySelectorAll('.fr-choice').forEach((b) => {
      b.onclick = () => done(options[+b.dataset.i].value);
    });
    bd.querySelector('.m-cancel').onclick = () => done(null);
    bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
  });
}

function toast(msg, ms = 4000) {
  const h = $('#hint');
  h.textContent = msg;
  h.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { h.hidden = true; }, ms);
}

const countWords = (text) => (text.trim().match(/\S+/g) || []).length;

function cleanChapterEl(id) {
  const el = document.querySelector(`.chapter[data-id="${id}"] .chapter-body`);
  const holder = document.createElement('div');
  holder.innerHTML = el ? el.innerHTML : (chapterHTML[id] || '');
  holder.querySelectorAll('.darling-anchor, .ph-mark, .ghost, .cite-mark').forEach((n) => n.remove());
  return holder;
}
const chapterText = (id) => cleanChapterEl(id).innerText;

// Word counts are cached per chapter and only recomputed for the chapter being edited.
let wordCache = {};
function chapterWords(chId) {
  if (wordCache[chId] == null) wordCache[chId] = countWords(chapterText(chId));
  return wordCache[chId];
}

/* ================================================================== */
/*  BOOKSHELF                                                          */
/* ================================================================== */

let libraryDirPath = '';

function coverUrl(meta) {
  // Pocket serves the library through a URL; desktop hands a plain path
  if (/^[a-z]+:\/\//.test(libraryDirPath)) {
    return libraryDirPath + '/' + encodeURIComponent(meta.id) + '/' + encodeURIComponent(meta.coverImage);
  }
  const p = (libraryDirPath + '/' + meta.id + '/' + meta.coverImage).replace(/\\/g, '/');
  return encodeURI('file://' + (p.startsWith('/') ? '' : '/') + p);
}

// Values stored on disk as English sentinels ("Untitled", "Anonymous",
// untouched tab and shelf names) are shown in the interface language, so an
// essay made in one language reads right after switching to the other.
const displayTitle = (meta) => (!meta.title || meta.title === 'Untitled' ? t('tp.title') : meta.title);
const displayName = (name) => (!name || name === 'Anonymous' ? t('author.anonymous') : name);
const shelfName = (shelf) => shelf.name || t(shelf.nameKey || 'shelf.new');
const tabName = (kind) => {
  const custom = book && book.tabNames && book.tabNames[kind];
  // books from NEO carry the English defaults as if they were custom names
  return custom && custom !== { notes: 'Notes', outline: 'Outline' }[kind] ? custom : t('tab.' + kind);
};

async function loadLibrary() {
  libraryDirPath = await window.neo.libraryPath();
  library = await window.neo.readLibrary();
  // the language is asked first thing on a fresh install; until then the
  // main process guesses from the OS
  await loadI18n(library.language);
  await applyAppearance(); // theme.js: Omarchy's theme, when Mutiny runs there
  if (ensureVoiceShelf()) await window.neo.writeLibrary(library);
  if (!library.firstRunDone) {
    showFirstRun();
  }
  renderShelves();
}

// switch the whole interface (and the menus) to another language
async function setLanguage(lang) {
  library.language = await loadI18n(lang);
  await window.neo.writeLibrary(library);
  if (!$('#bookshelf-view').hidden) renderShelves();
}

function showFirstRun() {
  const fr = $('#firstrun');
  fr.hidden = false;
  let picked = { body: DEFAULT_BODY_FONT };

  // Step 0: the language, offered in both — the answer drives everything after
  $$('.fr-lang').forEach((btn) => {
    btn.onclick = async () => {
      await setLanguage(btn.dataset.lang);
      $('#fr-step0').hidden = true;
      $('#fr-step1').hidden = false;
      $('#fr-name').focus();
    };
  });

  // Step 1: who are you, and how do you write?
  $$('.fr-style-pick').forEach((btn) => {
    btn.onclick = () => {
      library.authorName = $('#fr-name').value.trim();
      const pen = $('#fr-pen').value.trim();
      library.penNames = pen ? [pen] : [];
      library.writingStyle = btn.dataset.style;
      $('#fr-step1').hidden = true;
      $('#fr-step2').hidden = false;
      buildFontStep();
    };
  });

  // Step 2: fonts, with a WYSIWYG sample
  function preview() {
    document.documentElement.style.setProperty('--body-font', fontStack(picked.body));
  }
  function buildFontStep() {
    const bodyRow = $('#fr-bodyfonts');
    bodyRow.innerHTML = '';
    for (const name of Object.keys(BODY_FONTS)) {
      const b = document.createElement('button');
      b.className = 'fr-font' + (picked.body === name ? ' sel' : '');
      b.textContent = name;
      b.style.fontFamily = BODY_FONTS[name];
      b.onmouseenter = () => { document.documentElement.style.setProperty('--body-font', BODY_FONTS[name]); };
      b.onmouseleave = preview;
      b.onclick = () => {
        picked.body = name;
        buildFontStep();
        preview();
      };
      bodyRow.appendChild(b);
    }
    const sys = document.createElement('button');
    const isSys = picked.body.startsWith(SYSTEM_FONT);
    sys.className = 'fr-font' + (isSys ? ' sel' : '');
    sys.textContent = isSys ? fontLabel(picked.body) : t('font.fromSystem');
    if (isSys) sys.style.fontFamily = fontStack(picked.body);
    sys.onclick = async () => {
      const chosen = await pickSystemFont(picked.body);
      if (chosen) picked.body = chosen;
      buildFontStep();
    };
    bodyRow.appendChild(sys);
    preview();
  }

  // Step 2 → 3: the optional assistant, with what was found on this computer
  $('#fr-next').onclick = async () => {
    $('#fr-step2').hidden = true;
    $('#fr-step3').hidden = false;
    const state = $('.fr-ai-state');
    state.textContent = t('ai.checking');
    const st = await window.neo.aiStatus({});
    const ready = st.installed && st.loggedIn;
    state.textContent = !st.installed ? t('ai.state.missing')
      : !st.loggedIn ? t('ai.state.loggedOut', { v: st.version })
      : t('ai.state.ready', { v: st.version, plan: st.plan || '—' });
    $('#fr-ai-on').disabled = !st.installed;
    $('#fr-ai-on').style.opacity = st.installed ? '' : '0.5';
    if (!ready && st.installed) state.textContent += ' ' + t('fr.aiLater');
  };
  // Step 3 → 4: Mi voz — the writer's own texts, optional
  const toVoice = () => {
    $('#fr-step3').hidden = true;
    $('#fr-step4').hidden = false;
  };
  $('#fr-ai-on').onclick = () => {
    library.ai = { ...(library.ai || {}), enabled: true };
    toVoice();
  };
  $('#fr-ai-off').onclick = toVoice;
  $('#fr-voice-import').onclick = async () => {
    await importToVoice();
    const docs = await voiceCorpus();
    const words = docs.reduce((a, d) => a + d.words, 0);
    if (docs.length) {
      $('.fr-voice-state').textContent = tn('voice.texts', docs.length) + ' · ' + tn('count.words', words) + ' · ' +
        t('voice.level.' + voiceLevel(words)) + '. ' + t('voice.expect.' + voiceLevel(words));
      $('#fr-done strong').textContent = t('fr.voiceNext');
    }
  };

  $('#fr-done').onclick = async () => {
    library.fonts = { body: picked.body };
    library.firstRunDone = true;
    // the shelf was drawn (and the author record seeded as Anonymous) before
    // the name was typed — carry the name across
    currentAuthor().name = library.authorName || (library.penNames || [])[0] || 'Anonymous';
    // the essays default to the interface language
    library.language = library.language || I18N.lang;
    await window.neo.writeLibrary(library);
    applyFonts();
    fr.hidden = true;
    renderShelves();
  };
}

// Pen names: each author owns a set of shelves. Books all live in the one
// NEO Library folder on disk regardless of name — switching or deleting a
// pen name never touches files.
function currentAuthor() {
  if (!library.authors || !library.authors.length) {
    library.authors = [{
      id: 'a1',
      name: library.authorName || (library.penNames && library.penNames[0]) || 'Anonymous'
    }];
  }
  return library.authors.find((a) => a.id === library.currentAuthorId) || library.authors[0];
}

function shelvesFor(authorId) {
  const homeId = library.authors[0].id;
  return library.shelves.filter((s) => s.kind === 'voice' || (s.authorId || homeId) === authorId);
}

function displayAuthor() {
  return displayName(currentAuthor().name);
}

async function renderShelves() {
  await NeoCovers.ready; // display faces, so titles measure true
  const view = $('#bookshelf-view');
  const keepScroll = view.scrollTop; // re-rendering must not move the page
  $('#author-chip').textContent = displayAuthor();
  const wrap = $('#shelves');
  // the new shelves are built off-screen and swapped in whole, so the page
  // never goes blank while books are read from disk — no flash on a drop
  const built = document.createDocumentFragment();
  // shelves drag by their grip to reorder, with a gold bar showing the drop spot
  if (!wrap.dataset.dndWired) {
    wrap.dataset.dndWired = '1';
    wrap.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/x-neo-shelf')) return;
    e.preventDefault();
    let ind = wrap.querySelector('.shelf-drop-ind');
    if (!ind) {
      ind = document.createElement('div');
      ind.className = 'shelf-drop-ind';
    }
    let placed = false;
    for (const s of wrap.querySelectorAll('.shelf:not(.dragging)')) {
      const r = s.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        wrap.insertBefore(ind, s);
        placed = true;
        break;
      }
    }
      if (!placed) wrap.appendChild(ind);
    });
    wrap.addEventListener('drop', async (e) => {
      const shelfId = e.dataTransfer.getData('application/x-neo-shelf');
      if (!shelfId) return;
      e.preventDefault();
      const ind = wrap.querySelector('.shelf-drop-ind');
      let index = library.shelves.length;
      if (ind) {
        index = 0;
        for (const c of wrap.children) {
          if (c === ind) break;
          if (c.classList.contains('shelf') && !c.classList.contains('dragging')) index++;
        }
        ind.remove();
      }
      const moving = library.shelves.find((s) => s.id === shelfId);
      if (!moving) return;
      library.shelves = library.shelves.filter((s) => s.id !== shelfId);
      library.shelves.splice(index, 0, moving);
      await window.neo.writeLibrary(library);
      // move the shelf on screen rather than redrawing everything
      const secs = [...wrap.querySelectorAll('.shelf')];
      const movingSec = secs.find((el) => el.dataset.shelfId === shelfId);
      const others = secs.filter((el) => el !== movingSec);
      if (movingSec) wrap.insertBefore(movingSec, others[index] || null);
      else renderShelves();
    });
  }

  for (const shelf of shelvesFor(currentAuthor().id)) {
    const sec = document.createElement('section');
    sec.className = 'shelf';
    sec.dataset.shelfId = shelf.id;

    const grip = document.createElement('span');
    grip.className = 'shelf-grip';
    grip.textContent = '⠿';
    grip.title = t('shelf.dragTitle');
    grip.draggable = true;
    grip.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-neo-shelf', shelf.id);
      sec.classList.add('dragging');
    });
    grip.addEventListener('dragend', () => {
      sec.classList.remove('dragging');
      const ind = document.querySelector('.shelf-drop-ind');
      if (ind) ind.remove();
    });
    sec.appendChild(grip);

    const label = document.createElement('span');
    label.className = 'shelf-label';
    label.contentEditable = 'true';
    label.spellcheck = false;
    label.textContent = shelfName(shelf);
    label.title = t('shelf.labelTitle');
    label.addEventListener('blur', async () => {
      const typed = label.textContent.trim();
      if (typed && typed !== shelfName(shelf)) shelf.name = typed; // an untouched name keeps following the language
      label.textContent = shelfName(shelf);
      await window.neo.writeLibrary(library);
    });
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); label.blur(); }
    });
    // right-click a shelf label: publish it as one book, or delete it
    label.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      const choices = [{
        label: t('shelf.exportCollection'),
        desc: tn('shelf.exportCollectionDesc', shelf.bookIds.length),
        value: 'anthology'
      }];
      if (isVoiceShelf(shelf)) choices.push({ label: t('voice.myStyle'), desc: t('voice.myStyleDesc'), value: 'style' });
      else choices.push({ label: t('shelf.delete'), desc: t('shelf.deleteDesc'), danger: true, value: 'del' });
      const choice = await optionModal(t('shelf.menuTitle', { name: escHtml(shelfName(shelf)) }), null, choices);
      if (choice === 'style') { openStyle(); return; }
      if (choice === 'anthology') {
        await exportShelfAnthology(shelf);
      } else if (choice === 'del') {
        const mine = shelvesFor(currentAuthor().id).filter((s) => !isVoiceShelf(s));
        if (mine.length === 1) {
          toast(t('shelf.onlyOne'));
          return;
        }
        const other = mine.find((s) => s.id !== shelf.id);
        for (const id of shelf.bookIds) {
          if (!other.bookIds.includes(id)) other.bookIds.push(id);
        }
        library.shelves = library.shelves.filter((s) => s.id !== shelf.id);
        await window.neo.writeLibrary(library);
        renderShelves();
      }
    });
    const row = document.createElement('div');
    row.className = 'shelf-books';
    row.dataset.shelfId = shelf.id;

    // drag targets: reorder within a shelf, move between shelves, or drop
    // manuscript files straight from Finder
    row.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        row.classList.add('drag-over');
        return;
      }
      if (!e.dataTransfer.types.includes('application/x-neo-book')) return;
      e.preventDefault();
      row.classList.add('drag-over');
      const ind = dropIndicator();
      let placed = false;
      for (const t of row.querySelectorAll('.book:not(.dragging)')) {
        const r = t.getBoundingClientRect();
        // cursor above this book's row, or on its row and left of center
        if (e.clientY < r.top || (e.clientY < r.bottom && e.clientX < r.left + r.width / 2)) {
          row.insertBefore(ind, t);
          placed = true;
          break;
        }
      }
      if (!placed) row.insertBefore(ind, row.querySelector('.new-book'));
    });
    row.addEventListener('dragleave', (e) => {
      if (row.contains(e.relatedTarget)) return;
      row.classList.remove('drag-over');
      const ind = document.querySelector('.drop-indicator');
      if (ind && ind.parentElement === row) ind.remove();
    });
    row.addEventListener('drop', async (e) => {
      row.classList.remove('drag-over');
      // files from Finder → import them right onto this shelf
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        e.preventDefault();
        const paths = [...e.dataTransfer.files]
          .map((f) => { try { return window.neo.pathForFile(f); } catch { return null; } })
          .filter(Boolean);
        if (!paths.length) return;
        toast(t('import.progress'));
        const results = await window.neo.importFiles(paths);
        if (!results.length) { toast(t('import.noneInDrop')); return; }
        await addImportedBooks(results, shelf);
        return;
      }
      const bookId = e.dataTransfer.getData('application/x-neo-book');
      if (!bookId) return;
      e.preventDefault();
      // an essay dropped on Mi voz is copied there, not moved
      if (isVoiceShelf(shelf) && !shelf.bookIds.includes(bookId)) {
        const ind = document.querySelector('.drop-indicator');
        if (ind) ind.remove();
        const tile = document.querySelector('.book.dragging');
        if (tile) tile.classList.remove('dragging');
        await copyToVoice(bookId);
        return;
      }
      // insertion index = how many (non-dragged) books sit before the indicator
      const ind = document.querySelector('.drop-indicator');
      let index = shelf.bookIds.filter((b) => b !== bookId).length;
      if (ind && ind.parentElement === row) {
        index = 0;
        for (const c of row.children) {
          if (c === ind) break;
          if (c.classList.contains('book') && !c.classList.contains('dragging')) index++;
        }
      }
      if (ind) ind.remove();
      for (const s of library.shelves) s.bookIds = s.bookIds.filter((b) => b !== bookId);
      shelf.bookIds.splice(index, 0, bookId);
      await window.neo.writeLibrary(library);
      // slide the tile into place; the shelf itself is not redrawn
      const tile = document.querySelector(`.book[data-book-id="${bookId}"]`);
      if (tile) {
        const others = [...row.querySelectorAll('.book')].filter((b) => b !== tile);
        row.insertBefore(tile, others[index] || row.querySelector('.new-book'));
        tile.classList.remove('dragging');
      } else renderShelves();
    });

    for (const bookId of shelf.bookIds) {
      const meta = await window.neo.readBookMeta(bookId);
      if (!meta) continue;
      row.appendChild(bookTile(meta));
    }

    // the blank page — click to begin (Mi voz takes texts in, it doesn't start them)
    if (!isVoiceShelf(shelf)) {
      const blank = document.createElement('div');
      blank.className = 'new-book';
      blank.textContent = '+';
      blank.title = t('shelf.newEssay');
      blank.onclick = () => createBookOnShelf(shelf);
      row.appendChild(blank);
    }

    sec.appendChild(label);
    sec.appendChild(row);
    if (isVoiceShelf(shelf)) await decorateVoiceShelf(sec, row, shelf);
    built.appendChild(sec);
  }
  wrap.replaceChildren(built);
  view.scrollTop = keepScroll;
}

// single shared drop-position indicator for shelf drags
let _dropInd = null;
function dropIndicator() {
  if (!_dropInd) {
    _dropInd = document.createElement('div');
    _dropInd.className = 'drop-indicator';
  }
  return _dropInd;
}

// Covers are an abstract seeded from the essay (see covers.js), or an
// image the writer chose. Switching never throws either away.
function coverMode(meta) {
  if (meta.coverMode === 'abstract') return 'abstract';
  return meta.coverImage ? 'image' : 'abstract';
}

function dressTile(el, meta) {
  el.classList.remove('has-cover');
  if (coverMode(meta) === 'image') {
    el.classList.add('has-cover');
    el.style.background = `#1d1d1d url("${coverUrl(meta)}") center / cover no-repeat`;
    return;
  }
  // the cover sets the title as the interface shows it
  NeoCovers.dress(el, NeoCovers.plan({ ...meta, title: displayTitle(meta), author: displayName(meta.author) }));
}

function bookTile(meta) {
  const el = document.createElement('div');
  el.className = 'book';
  el.dataset.bookId = meta.id;
  el.draggable = true;
  el.innerHTML = `
    <div class="b-text"><div class="b-title"></div><div class="b-author"></div></div>
    <span class="b-refresh" title="${t('tile.newCover')}">&#8635;</span>
    <div class="b-progress" hidden><div></div></div>`;
  el.querySelector('.b-author').textContent = displayName(meta.author);
  dressTile(el, meta);
  el.querySelector('.b-refresh').onclick = async (e) => {
    e.stopPropagation();
    await refreshCover(meta, el);
  };
  if (meta.wordGoal > 0) {
    const bar = el.querySelector('.b-progress');
    bar.hidden = false;
    const pct = Math.min(100, Math.round(((meta.wordCount || 0) / meta.wordGoal) * 100));
    bar.firstElementChild.style.width = pct + '%';
  }
  el.title = meta.wordGoal
    ? t('tile.progress', { title: displayTitle(meta), count: (meta.wordCount || 0).toLocaleString(), goal: meta.wordGoal.toLocaleString() })
    : displayTitle(meta);
  el.onclick = () => openBook(meta.id);
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('application/x-neo-book', meta.id);
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  // images dragged from Finder onto a book become its cover;
  // manuscripts dropped here import onto this book's shelf
  el.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
  el.addEventListener('drop', async (e) => {
    if (!e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    e.stopPropagation();
    let p = null;
    try { p = window.neo.pathForFile(e.dataTransfer.files[0]); } catch { /* no path */ }
    if (!p) return;
    if (/\.(png|jpe?g|webp)$/i.test(p)) {
      const fname = await window.neo.setCover(meta.id, p);
      if (fname) {
        meta.coverImage = fname;
        meta.coverMode = 'image';
        await window.neo.writeBookMeta(meta.id, meta);
        renderShelves();
      }
    } else if (/\.(docx|txt|md)$/i.test(p)) {
      const homeShelf = library.shelves.find((s) => s.bookIds.includes(meta.id)) || firstEssayShelf();
      const results = await window.neo.importFiles([p]);
      if (results.length) await addImportedBooks(results, homeShelf);
    }
  });

  el.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const options = [
      { label: t(meta.coverImage ? 'tile.replaceCover' : 'tile.setCover'), desc: t('tile.coverDesc'), value: 'cover' }
    ];
    if (meta.coverImage) {
      options.push({ label: t('tile.removeCover'), desc: t('tile.removeCoverDesc'), danger: true, value: 'uncover' });
    }
    const vs = voiceShelf();
    if (vs && !vs.bookIds.includes(meta.id)) options.push({ label: t('voice.copyTo'), desc: t('voice.copyToDesc'), value: 'voice' });
    options.push(
      { label: t('tile.setGoal'), desc: t('tile.setGoalDesc'), value: 'goal' },
      { label: t('tile.remove'), desc: t('tile.removeDesc'), value: 'remove' },
      {
        label: t(navigator.platform.toLowerCase().includes('win') ? 'dialog.recycle' : 'dialog.trash'),
        desc: t('tile.trashDesc'),
        danger: true, value: 'trash'
      }
    );
    const choice = await optionModal(`“${escHtml(displayTitle(meta))}”`, null, options);
    if (choice === 'voice') {
      await copyToVoice(meta.id);
    } else if (choice === 'cover') {
      const src = await window.neo.pickCover();
      if (!src) return;
      const fname = await window.neo.setCover(meta.id, src);
      if (fname) {
        meta.coverImage = fname;
        meta.coverMode = 'image';
        await window.neo.writeBookMeta(meta.id, meta);
        renderShelves();
      }
    } else if (choice === 'uncover') {
      await window.neo.removeCover(meta.id);
      meta.coverImage = null;
      await window.neo.writeBookMeta(meta.id, meta);
      renderShelves();
    } else if (choice === 'goal') {
      const goal = await askInput(t('tile.goalQ', { title: escHtml(displayTitle(meta)) }), t('tile.goalHint'),
        meta.wordGoal ? String(meta.wordGoal) : '');
      if (goal === null) return;
      meta.wordGoal = parseInt(goal, 10) || 0;
      await window.neo.writeBookMeta(meta.id, meta);
      renderShelves();
    } else if (choice === 'remove') {
      for (const s of library.shelves) s.bookIds = s.bookIds.filter((b) => b !== meta.id);
      await window.neo.writeLibrary(library);
      renderShelves();
      toast(t('tile.removed', { title: displayTitle(meta) }));
    } else if (choice === 'trash') {
      const ok = await window.neo.deleteBook(meta.id, meta.title);
      if (ok) {
        for (const s of library.shelves) s.bookIds = s.bookIds.filter((b) => b !== meta.id);
        await window.neo.writeLibrary(library);
        renderShelves();
      }
    }
  });
  return el;
}

// the ↻ on a tile: switch between the writer's image and the abstract,
// or re-roll the abstract
async function refreshCover(meta, el) {
  const mode = coverMode(meta);
  const options = [];
  if (meta.coverImage && mode !== 'image') options.push({ label: t('cover.showImage'), desc: t('cover.showImageDesc'), value: 'image' });
  if (mode !== 'abstract') options.push({ label: t('cover.showAbstract'), desc: t('cover.showAbstractDesc'), value: 'abstract' });
  options.push({ label: t('cover.reroll'), desc: t(mode === 'abstract' ? 'cover.rerollAbstract' : 'cover.rerollImage'), value: 'reroll' });
  // a plain abstract with nothing else to offer just re-rolls
  const choice = options.length === 1 ? 'reroll' : await optionModal(t('cover.menuTitle', { title: escHtml(displayTitle(meta)) }), null, options);
  if (!choice) return;
  const live = (book && book.id === meta.id) ? book : meta;
  if (choice === 'reroll') {
    live.coverSeed = meta.id + ':' + (meta.wordCount || 0) + ':' + Date.now().toString(36);
    if (mode === 'image') live.coverMode = 'abstract';
  } else {
    live.coverMode = choice;
  }
  if (live === book) scheduleMetaSave(); else await window.neo.writeBookMeta(meta.id, live);
  dressTile(el, live);
}

async function createBookOnShelf(shelf) {
  const meta = await window.neo.createBook({ author: displayAuthor() });
  meta.language = library.language || 'en';
  meta.tabNames = { ...(library.tabDefaults || {}) };
  await window.neo.writeBookMeta(meta.id, meta);
  shelf.bookIds.push(meta.id);
  await window.neo.writeLibrary(library);
  openBook(meta.id);
}

// While dragging a book or shelf, nearing the window's top or bottom edge
// scrolls the bookshelf — faster the deeper into the edge zone you push.
let shelfScrollDir = 0;
let shelfScrollRAF = null;
function shelfAutoScrollStep() {
  if (!shelfScrollDir) { shelfScrollRAF = null; return; }
  $('#bookshelf-view').scrollTop += shelfScrollDir;
  shelfScrollRAF = requestAnimationFrame(shelfAutoScrollStep);
}
{
  const view = $('#bookshelf-view');
  const EDGE = 90;
  view.addEventListener('dragover', (e) => {
    const h = window.innerHeight;
    if (e.clientY < EDGE) shelfScrollDir = -Math.ceil((EDGE - e.clientY) / 5);
    else if (e.clientY > h - EDGE) shelfScrollDir = Math.ceil((e.clientY - (h - EDGE)) / 5);
    else shelfScrollDir = 0;
    if (shelfScrollDir && !shelfScrollRAF) shelfScrollRAF = requestAnimationFrame(shelfAutoScrollStep);
  });
  view.addEventListener('drop', () => { shelfScrollDir = 0; });
  view.addEventListener('dragend', () => { shelfScrollDir = 0; });
  view.addEventListener('dragleave', (e) => { if (!e.relatedTarget) shelfScrollDir = 0; });
}

$('#add-shelf-btn').onclick = async () => {
  library.shelves.push({
    id: 'shelf-' + Date.now().toString(36),
    name: '',
    nameKey: 'shelf.new',
    bookIds: [],
    authorId: currentAuthor().id
  });
  await window.neo.writeLibrary(library);
  renderShelves();
};

$('#author-chip').onclick = async () => {
  const cur = currentAuthor();
  const opts = [];
  for (const a of library.authors) {
    if (a.id !== cur.id) {
      opts.push({ label: t('author.writeAs', { name: escHtml(displayName(a.name)) }), desc: t('author.writeAsDesc'), value: 'sw:' + a.id });
    }
  }
  opts.push({ label: t('author.rename', { name: escHtml(displayName(cur.name)) }), value: 'rename' });
  opts.push({ label: t('author.addPen'), desc: t('author.addPenDesc'), value: 'add' });
  if (library.authors.length > 1) {
    opts.push({
      label: t('author.remove', { name: escHtml(displayName(cur.name)) }),
      desc: t('author.removeDesc'),
      danger: true, value: 'del'
    });
  }
  const pick = await optionModal(t('author.menuTitle', { name: escHtml(displayName(cur.name)) }), null, opts);
  if (!pick) return;
  if (pick.startsWith('sw:')) {
    library.currentAuthorId = pick.slice(3);
  } else if (pick === 'rename') {
    const name = await askInput(t('author.nameQ'), t('author.nameHint'), cur.name);
    if (name === null) return;
    cur.name = name || cur.name;
    library.authorName = library.authors[0].name; // legacy field follows the first name
  } else if (pick === 'add') {
    const name = await askInput(t('author.newPenQ'), t('author.newPenHint'), '');
    if (!name) return;
    const a = { id: 'a-' + Date.now().toString(36), name };
    library.authors.push(a);
    library.currentAuthorId = a.id;
    library.shelves.push({
      id: 'shelf-' + Date.now().toString(36),
      name: '', nameKey: 'shelf.inProgress', bookIds: [], authorId: a.id
    });
  } else if (pick === 'del') {
    const homeId = library.authors[0].id;
    const rest = library.authors.filter((a) => a.id !== cur.id);
    const target = rest[0];
    for (const s of library.shelves) {
      if ((s.authorId || homeId) === cur.id) s.authorId = target.id;
    }
    library.authors = rest;
    library.currentAuthorId = target.id;
    library.authorName = library.authors[0].name;
  }
  await window.neo.writeLibrary(library);
  renderShelves();
};

/* ================================================================== */
/*  EDITOR — open / render                                             */
/* ================================================================== */

async function openBook(bookId) {
  tabPlaces = {}; // a fresh book starts with fresh places
  book = await window.neo.readBookMeta(bookId);
  if (!book) return;
  currentChapterId = null; // never carry a chapter reference across books
  undoStack = [];
  chapterHTML = {};
  for (const chId of book.chapterOrder) {
    chapterHTML[chId] = await window.neo.readChapter(bookId, chId);
  }
  stickies = await window.neo.readJSON(bookId, 'stickies', []);
  sources = await window.neo.readJSON(bookId, 'sources', []);
  if (typeof loadChat === 'function') await loadChat(bookId);
  darlings = await window.neo.readJSON(bookId, 'darlings', []);

  $('#bookshelf-view').hidden = true;
  $('#editor-view').hidden = false;
  document.execCommand('defaultParagraphSeparator', false, 'p');

  $('#tp-title').textContent = book.title === 'Untitled' ? '' : book.title;
  $('#tp-subtitle').textContent = book.subtitle || '';
  $('#tp-author').textContent = displayName(book.author);
  $$('.tab[data-tab="notes"]')[0].textContent = tabName('notes');
  $$('.tab[data-tab="outline"]')[0].textContent = tabName('outline');

  renderChapters();
  renderStickies();
  migrateDarlingAnchors(); // sweep legacy invisible markers out of the prose
  reconcileMarks();        // re-adopt any note marks orphaned by cut/paste
  updateCounters();

  // Outline-first writers land on a skeleton for a brand-new essay
  const isNew = book.chapterOrder.length === 0;
  if (isNew && library.writingStyle === 'plotter') {
    applyEssayTemplate();
    switchTab('outline');
  } else {
    switchTab('manuscript');
    if (isNew) {
      $('#tp-title').focus();
    } else if (book.lastPosition && book.chapterOrder.includes(book.lastPosition.chapterId)) {
      // pick up right where you left off
      currentChapterId = book.lastPosition.chapterId;
      const scroll = book.lastPosition.scroll || 0;
      requestAnimationFrame(() => {
        $('#paper-scroll').scrollTop = scroll;
        highlightNav();
        updateCounters();
      });
    }
  }

  // the Enter hint shows once per library, ever
  if (!library.hintShown) {
    library.hintShown = true;
    window.neo.writeLibrary(library);
    setTimeout(() => toast(t('hint.enter', { help: KHELP }), 7000), 800);
  }
}

function renderChapters() {
  const wrap = $('#chapters');
  wrap.innerHTML = '';
  wordCache = {};
  book.chapterTitles = book.chapterTitles || {};
  // a lone chapter is just "the story" — no heading until a second one exists,
  // at which point both appear, numbered in retrospect
  const solo = book.chapterOrder.length === 1;
  book.chapterOrder.forEach((chId, i) => {
    const sec = document.createElement('section');
    sec.className = 'chapter sheet' + (solo ? ' solo' : '');
    sec.dataset.id = chId;
    const head = document.createElement('div');
    head.className = 'chapter-head';
    head.title = t('section.headTitle');
    const num = document.createElement('span');
    num.className = 'ch-num';
    num.textContent = '§';
    const sep = document.createElement('span');
    sep.className = 'ch-sep';
    sep.textContent = '—';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'ch-title';
    titleSpan.dataset.ph = t('section.titlePh');
    titleSpan.contentEditable = 'true';
    titleSpan.spellcheck = false;
    titleSpan.textContent = book.chapterTitles[chId] || '';
    if (titleSpan.textContent) head.classList.add('has-title');
    titleSpan.addEventListener('input', () => {
      head.classList.toggle('has-title', titleSpan.textContent.trim() !== '');
    });
    titleSpan.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); titleSpan.blur(); }
      e.stopPropagation();
    });
    titleSpan.addEventListener('blur', () => {
      book.chapterTitles[chId] = titleSpan.textContent.trim();
      scheduleMetaSave();
      renderNav();
    });
    head.appendChild(num);
    head.appendChild(sep);
    head.appendChild(titleSpan);
    head.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      chapterMenu(chId, i);
    });
    const body = document.createElement('div');
    body.className = 'chapter-body';
    body.contentEditable = 'true';
    body.spellcheck = false; // NEO runs its own spellcheck pass
    body.innerHTML = chapterHTML[chId] || '<p><br></p>';
    // older marks used a "?" that read as a broken image — normalize to the flag
    body.querySelectorAll('.ph-mark:not(.ai)').forEach((m) => { m.textContent = '⚑'; });
    // heal the engine's style-junk spans left by past merges and splits
    stripJunkSpans(body);
    // heal prose that got merged into a scene-break's styled paragraph:
    // real breaks contain only ***, anything else is a stained paragraph
    body.querySelectorAll('p.scene-break').forEach((p) => {
      if (p.textContent.trim() !== '***') {
        p.classList.remove('scene-break');
        p.removeAttribute('style');
      }
    });
    // heal no-break spaces planted in prose by the old engine repair pass
    const tw = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let tn;
    while ((tn = tw.nextNode())) {
      if (tn.data.includes('\u00a0')) tn.data = tn.data.replace(/\u00a0/g, ' ');
    }
    wireChapterBody(body, chId);
    sec.appendChild(head);
    sec.appendChild(body);
    wrap.appendChild(sec);
  });
  renderNav();
  renumberCites();
}

async function deleteChapterToDarlings(chId) {
  snapshotStructure('chapter delete');
  const index = book.chapterOrder.indexOf(chId);
  const text = chapterText(chId).trim();
  if (text) {
    const bodyEl = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
    darlings.push({
      id: 'd-' + Date.now().toString(36),
      html: bodyEl ? bodyEl.innerHTML : chapterHTML[chId],
      text: text.slice(0, 2000),
      chapterId: null,
      chapterNum: index + 1,
      deleted: true,
      date: new Date().toISOString()
    });
    await window.neo.writeJSON(book.id, 'darlings', darlings);
  }
  if (currentChapterId === chId) currentChapterId = null;
  await deleteChapterQuiet(chId);
  if (text) toast(t('section.removed', { undo: KZ }));
}

async function chapterMenu(chId, index) {
  const words = countWords(chapterText(chId));
  const opts = [];
  if (words && aiEnabled()) opts.push({ label: t('ai.critiqueThis'), desc: t('ai.critiqueThisDesc'), value: 'critique' });
  opts.push({ label: t('section.delete'), desc: t(words ? 'section.deleteDesc' : 'section.deleteEmptyDesc'), danger: true, value: 'delete' });
  const choice = await optionModal(
    t('section.menuTitle', { n: index + 1 }),
    words ? tn('count.wordsSentence', words) : t('section.empty'),
    opts
  );
  if (choice === 'delete') await deleteChapterToDarlings(chId);
  if (choice === 'critique') { currentChapterId = chId; critique('section'); }
}

/* ================================================================== */
/*  EDITOR — typing                                                    */
/* ================================================================== */

function wireChapterBody(body, chId) {
  body.addEventListener('focus', () => { currentChapterId = chId; updateCounters(); highlightNav(); });

  body.addEventListener('input', () => {
    breakRun = 0; // fresh typing: ⌘Z belongs to the engine again
    chapterHTML[chId] = captureBody(body);
    wordCache[chId] = null;
    scheduleChapterSave(chId);
    if (spellOn) scheduleSpellRescan(chId, body);
    updateCounters();
    scheduleNavRefresh();
  });
  // paste without formatting
  body.addEventListener('paste', (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) {
      document.execCommand('insertHTML', false, cleanPasteHtml(html));
      reconcileMarks();
    } else if (text) {
      const parts = text.replace(/\r/g, '').split(/\n+/).filter((p) => p.trim());
      parts.forEach((p, i) => {
        if (i > 0) document.execCommand('insertParagraph');
        document.execCommand('insertText', false, p.trim());
      });
    }
  });
  // While macOS composes input, shortcuts stand down completely.
  let composing = false;
  body.addEventListener('compositionstart', () => { composing = true; });
  body.addEventListener('compositionend', () => { composing = false; });
  body.addEventListener('keydown', (e) => {
    if (composing || e.isComposing || e.keyCode === 229) return;
    // count consecutive Enters — the double/triple rhythm works mid-sentence
    if (e.key === 'Enter' && !e.shiftKey) enterRun++;
    else enterRun = 0;
    // ⌘Z right after a break operation undoes the break via the structural
    // stack — the engine's own undo never saw it and would corrupt the page
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === 'KeyZ' && breakRun > 0 && undoStack.length) {
      e.preventDefault();
      breakRun--;
      structuralUndo();
      return;
    }
    // Chromium's selection-delete can duplicate a neighboring character when
    // the selection spans fragmented text nodes. Merging the fragments right
    // before any destructive keystroke.
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      const s = window.getSelection();
      const destructive = e.key === 'Backspace' || e.key === 'Delete' ||
        (s && !s.isCollapsed && (e.key.length === 1 || e.key === 'Enter'));
      if (destructive) healSelectionSeams(body);
    }
    if (styleKeepScroll(e)) return;
    if (sceneBreakDelete(e, body, chId)) return;
    if (spaceSafeDelete(e, body, chId)) return;
    if (emptyChapterBackspace(e, body, chId)) return;
    if (chapterStartBackspace(e, body, chId)) return;
    if (guardMarkerDelete(e, body, chId)) return;
    if (handleEnter(e, body, chId)) return;
    if (handleTabSpacing(e)) return;
    smartKeys(e, body);
  });
  // when the whole chapter loses focus, merge every fragmented text node
  body.addEventListener('blur', () => {
    try { body.normalize(); } catch { /* nothing to merge */ }
  });
  body.addEventListener('mousedown', () => { enterRun = 0; });
  body.addEventListener('click', (e) => {
    const mark = e.target.closest('.ph-mark');
    if (mark) focusSticky(mark.dataset.sid);
    // clicking a ghost outline note selects it, ready to be replaced with prose
    const ghost = e.target.closest('p.ghost');
    if (ghost) {
      const r = document.createRange();
      r.selectNodeContents(ghost);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
    // a [n] opens its menu on a click; cited words need the caret, so theirs is on right-click
    const citeMark = e.target.closest('.cite-mark');
    if (citeMark) citeMenu(citeMark);
  });
  body.addEventListener('contextmenu', (e) => {
    const cite = e.target.closest('.cite, .cite-mark');
    if (!cite) return;
    e.preventDefault(); // the spellcheck menu stands aside (it checks defaultPrevented)
    citeMenu(cite);
  });
  // the moment writing hits a ghost, it becomes prose
  // (it keeps its data-sec-id so the outline knows it's been written)
  body.addEventListener('beforeinput', () => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let el = sel.anchorNode;
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    const ghost = el && el.closest ? el.closest('p.ghost') : null;
    if (ghost && body.contains(ghost)) {
      ghost.classList.remove('ghost');
    }
  });
}

function focusChapterStart(chId) {
  const nb = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
  if (!nb) return;
  nb.focus({ preventScroll: true });
  const nr = document.createRange();
  const first = nb.querySelector('p');
  if (first) nr.setStart(first, 0); // inside the first paragraph, not the container
  else nr.selectNodeContents(nb);
  nr.collapse(true);
  const s = window.getSelection();
  s.removeAllRanges();
  s.addRange(nr);
  currentChapterId = chId;
  highlightNav();
}

// Backspace in an empty chapter deletes it:
function emptyChapterBackspace(e, body, chId) {
  if (e.key !== 'Backspace' || e.metaKey || e.ctrlKey || e.altKey) return false;
  if (body.innerText.trim() !== '') return false; // ghosts count as content
  const idx = book.chapterOrder.indexOf(chId);
  if (idx < 0 || book.chapterOrder.length < 2) return false;
  e.preventDefault();
  snapshotStructure('empty chapter removed');
  breakRun++;
  if (idx > 0) {
    const prev = book.chapterOrder[idx - 1];
    deleteChapterQuiet(chId).then(() => { focusChapter(prev); resetNativeUndo(); });
  } else {
    // an empty chapter 1 dissolves too — the caret lands at the top of
    // what just became the new chapter 1
    const next = book.chapterOrder[1];
    deleteChapterQuiet(chId).then(() => { focusChapterStart(next); resetNativeUndo(); });
  }
  return true;
}

// ⌘B / ⌘I applied by hand: the engine's native handling scrolls the
// selection "into view" and mis-measures NEO's transformed page column,
// throwing the reader to the top of the screen. Style, don't scroll.
function styleKeepScroll(e) {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return false;
  if (e.code !== 'KeyB' && e.code !== 'KeyI') return false;
  e.preventDefault();
  const sc = $('#paper-scroll');
  const keep = sc.scrollTop;
  document.execCommand(e.code === 'KeyB' ? 'bold' : 'italic');
  sc.scrollTop = keep;
  requestAnimationFrame(() => { sc.scrollTop = keep; });
  return true;
}

// Backspace at the very start of a chapter swallows an empty chapter above it
function chapterStartBackspace(e, body, chId) {
  if (e.key !== 'Backspace' || e.metaKey || e.ctrlKey || e.altKey) return false;
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(body);
  try { pre.setEnd(r.startContainer, r.startOffset); } catch { return false; }
  if (pre.toString().length !== 0) return false; // caret isn't at the chapter's first character
  const idx = book.chapterOrder.indexOf(chId);
  if (idx <= 0) return false;
  const prevId = book.chapterOrder[idx - 1];
  const prevBody = document.querySelector(`.chapter[data-id="${prevId}"] .chapter-body`);
  if (!prevBody) return false;
  e.preventDefault();
  if (prevBody.innerText.trim() === '') {
    // empty chapter above: swallow it
    snapshotStructure('empty chapter removed');
    breakRun++;
    deleteChapterQuiet(prevId).then(() => { focusChapterStart(chId); resetNativeUndo(); });
    return true;
  }
  // chapter with words above: merge this chapter up into it — the inverse
  // of a triple-Enter split, and ⌘Z restores the split
  snapshotStructure('chapters merged');
  const prevCount = prevBody.querySelectorAll('p').length;
  const keepScroll = $('#paper-scroll').scrollTop;
  chapterHTML[prevId] = captureBody(prevBody) + captureBody(body);
  window.neo.writeChapter(book.id, prevId, chapterHTML[prevId]);
  for (const s of stickies) if (s.chapterId === chId) s.chapterId = prevId;
  window.neo.writeJSON(book.id, 'stickies', stickies);
  for (const d of darlings) if (d.chapterId === chId) d.chapterId = prevId;
  window.neo.writeJSON(book.id, 'darlings', darlings);
  if (book.sectionNotes && book.sectionNotes[chId]) {
    book.sectionNotes[prevId] = [...(book.sectionNotes[prevId] || []), ...book.sectionNotes[chId]];
    delete book.sectionNotes[chId];
  }
  if (book.chapterTitles) delete book.chapterTitles[chId];
  if (book.chapterNotes) delete book.chapterNotes[chId];
  book.chapterOrder = book.chapterOrder.filter((c) => c !== chId);
  delete chapterHTML[chId];
  window.neo.deleteChapter(book.id, chId);
  saveMeta();
  renderChapters();
  renderStickies();
  restoreCaret({ chId: prevId, pIdx: prevCount, off: 0, scroll: keepScroll });
  resetNativeUndo();
  breakRun++;
  return true;
}

// Tab for spacing:
function handleTabSpacing(e) {
  if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return false;
  e.preventDefault();
  if (!e.shiftKey) {
    document.execCommand('insertText', false, '  ');
    return true;
  }
  // Shift+Tab: remove up to two preceding em spaces
  const sel = window.getSelection();
  if (sel.rangeCount && sel.isCollapsed) {
    const r = sel.getRangeAt(0);
    const node = r.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      let n = 0;
      while (n < 2 && r.startOffset - n > 0 &&
             node.textContent[r.startOffset - n - 1] === ' ') n++;
      if (n > 0) {
        const del = document.createRange();
        del.setStart(node, r.startOffset - n);
        del.setEnd(node, r.startOffset);
        del.deleteContents();
      }
    }
  }
  return true;
}

function flatOffset(p, container, offset) {
  // flatten any (container, offset) pair to a character offset in p.textContent
  let n;
  if (container.nodeType !== Node.TEXT_NODE) {
    if (!p.contains(container) && container !== p) return -99;
    let acc = 0;
    for (let i = 0; i < offset && i < container.childNodes.length; i++) {
      acc += container.childNodes[i].textContent.length;
    }
    let before = 0;
    const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    while ((n = w.nextNode())) {
      if (container === p || container.contains(n)) break;
      before += n.textContent.length;
    }
    return (container === p ? 0 : before) + acc;
  }
  let pos = 0;
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  while ((n = walker.nextNode())) {
    if (n === container) return pos + offset;
    pos += n.textContent.length;
  }
  return -1;
}

function flatPoint(p, off) {
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let pos = 0, n;
  while ((n = w.nextNode())) {
    const len = n.textContent.length;
    if (off <= pos + len) return [n, off - pos];
    pos += len;
  }
  return null;
}

// A delete that leaves two plain spaces touching triggers the engine's broken
// whitespace repair, which duplicates a neighboring character. When that exact
// hazard is about to happen, take the right-hand space along with the deletion,
// leaving one clean space. All other deletes stay native.
function spaceSafeDelete(e, body, chId) {
  if (e.key !== 'Backspace' && e.key !== 'Delete') return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  const sel = window.getSelection();
  if (!sel.rangeCount) return false;
  const r = sel.getRangeAt(0);
  const elOf = (n) => (n.nodeType === Node.TEXT_NODE ? n.parentElement : n);
  const pA = elOf(r.startContainer)?.closest?.('p');
  const pB = elOf(r.endContainer)?.closest?.('p');
  if (!pA || pA !== pB || !body.contains(pA)) return false;
  const t = pA.textContent;
  let from, to;
  if (sel.isCollapsed) {
    const at = flatOffset(pA, r.startContainer, r.startOffset);
    if (at < 0) return false;
    if (e.key === 'Backspace') { from = at - 1; to = at; } else { from = at; to = at + 1; }
    if (from < 0 || to > t.length) return false;
  } else {
    from = flatOffset(pA, r.startContainer, r.startOffset);
    to = flatOffset(pA, r.endContainer, r.endOffset);
    if (from < 0 || to <= from) return false;
  }
  if (t[from - 1] !== ' ' || t[to] !== ' ') return false;
  let end = to;
  while (t[end] === ' ') end++;
  const a = flatPoint(pA, from), b = flatPoint(pA, end);
  if (!a || !b) return false;
  e.preventDefault();
  const nr = document.createRange();
  nr.setStart(a[0], a[1]); nr.setEnd(b[0], b[1]);
  sel.removeAllRanges(); sel.addRange(nr);
  document.execCommand('insertText', false, '');
  return true;
}

// Merge fragmented text nodes in the paragraph(s) the selection touches,
// so native editing operates on whole text instead of seams.
function healSelectionSeams(body) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  const paraOf = (n) => {
    if (n && n.nodeType === Node.TEXT_NODE) n = n.parentElement;
    return n && n.closest ? n.closest('p') : null;
  };
  const a = paraOf(r.startContainer);
  const b = paraOf(r.endContainer);
  try { if (a && body.contains(a)) a.normalize(); } catch { /* fine */ }
  try { if (b && b !== a && body.contains(b)) b.normalize(); } catch { /* fine */ }
}

// Chromium mangles Backspace/Delete beside non-editable inline elements:
function guardMarkerDelete(e, body, chId) {
  if (e.key !== 'Backspace' && e.key !== 'Delete') return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const r = sel.getRangeAt(0);
  const node = r.startContainer;
  const back = e.key === 'Backspace';
  const isMark = (n) => n && n.nodeType === Node.ELEMENT_NODE &&
    (n.classList.contains('ph-mark') || n.classList.contains('darling-anchor') || n.classList.contains('cite-mark'));

  // Case 1: the deletion would cross INTO a marker (caret at a node boundary,
  // marker on the far side) — delete the marker itself, cleanly.
  let adjacent = null;
  if (node.nodeType === Node.TEXT_NODE) {
    if (back && r.startOffset === 0) adjacent = node.previousSibling;
    else if (!back && r.startOffset === node.textContent.length) adjacent = node.nextSibling;
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    adjacent = back ? node.childNodes[r.startOffset - 1] : node.childNodes[r.startOffset];
  }
  if (isMark(adjacent)) {
    e.preventDefault();
    if (adjacent.classList.contains('ph-mark') && adjacent.dataset.sid) {
      resolveSticky(adjacent.dataset.sid); // removes mark + its note, syncs
    } else {
      adjacent.remove();
      syncChapter(body, chId);
    }
    return true;
  }

  // Case 2: deleting a character inside a text node that TOUCHES a marker:
  if (node.nodeType !== Node.TEXT_NODE) return false;
  if (back ? r.startOffset === 0 : r.startOffset >= node.textContent.length) return false;
  if (!isMark(node.previousSibling) && !isMark(node.nextSibling)) return false;

  e.preventDefault();
  const targetOffset = back ? r.startOffset - 1 : r.startOffset;
  const del = document.createRange();
  del.setStart(node, targetOffset);
  del.setEnd(node, targetOffset + 1);
  del.deleteContents();
  const caret = document.createRange();
  caret.setStart(node, targetOffset);
  caret.collapse(true);
  sel.removeAllRanges();
  sel.addRange(caret);
  syncChapter(body, chId);
  return true;
}

// The engine wraps text in style-carrying spans during merges and splits
// ("<span style='text-indent...'>"). They corrupt later edits — unwrap them,
// keeping only NEO's own marks.
const JUNK_SPANS = 'span:not(.ph-mark):not(.cite):not(.cite-mark)';
function stripJunkSpans(el) {
  for (const s of [...el.querySelectorAll(JUNK_SPANS)]) {
    while (s.firstChild) s.before(s.firstChild);
    s.remove();
  }
}

// Enter once: new paragraph. Enter twice: *** section break — wherever the
// caret is, even mid-sentence. Enter three times: the chapter splits here.
let enterRun = 0;
// break operations live outside the engine's undo history; while the most
// recent edits are breaks, ⌘Z routes to NEO's structural undo, one per press
let breakRun = 0;

function splitChapterAt(body, chId, block, sel) {
  const parts = [];
  let n = block;
  while (n) {
    const next = n.nextElementSibling;
    parts.push(n.outerHTML);
    n.remove();
    n = next;
  }
  if (!body.querySelector('p')) body.innerHTML = '<p><br></p>';
  syncChapter(body, chId);
  const idx = book.chapterOrder.indexOf(chId);
  const newId = createChapterAt(idx + 1);
  chapterHTML[newId] = parts.join('') || '<p><br></p>';
  window.neo.writeChapter(book.id, newId, chapterHTML[newId]);
  const keepScroll = $('#paper-scroll').scrollTop;
  renderChapters();
  focusChapterStart(newId);
  $('#paper-scroll').scrollTop = keepScroll; // the split point stays in view
  resetNativeUndo();
  breakRun++;
}

function handleEnter(e, body, chId) {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  let el = sel.anchorNode;
  if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
  const block = el && el.closest ? el.closest('p') : null;
  if (!block || !body.contains(block)) return false;
  if (block.classList.contains('scene-break')) { e.preventDefault(); return true; } // Enter on a *** line: nothing
  const prev = block.previousElementSibling;

  if (block.textContent.trim() !== '') {
    // caret inside a real paragraph — where is it?
    const r = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(block);
    try { pre.setEnd(r.startContainer, r.startOffset); } catch { return false; }
    const atStart = pre.toString().length === 0;

    // second/third Enter mid-flow: the caret sits at the start of the text
    // that the previous press pushed down
    if (atStart && enterRun >= 2 && prev) {
      if (prev.classList.contains('scene-break')) {
        // third Enter: everything from here becomes the next chapter
        e.preventDefault();
        snapshotStructure('chapter split');
        prev.remove();
        splitChapterAt(body, chId, block, sel);
        return true;
      }
      e.preventDefault();
      // a break made by the full double-Enter gesture un-splits on undo too
      snapshotStructure('section break', { rejoin: enterRun >= 2 });
      if (prev.textContent.trim() === '') {
        prev.classList.add('scene-break');
        prev.textContent = '***';
      } else {
        const brk = document.createElement('p');
        brk.className = 'scene-break';
        brk.textContent = '***';
        block.before(brk);
      }
      const keep = document.createRange();
      keep.setStart(block, 0);
      keep.collapse(true);
      sel.removeAllRanges();
      sel.addRange(keep);
      syncChapter(body, chId);
      resetNativeUndo();
      breakRun++;
      return true;
    }

    // normal Enter — native split so ⌘Z keeps working; junk spans (which
    // make the engine clone whole paragraphs) are stripped first if present
    e.preventDefault();
    if (block.querySelector(JUNK_SPANS)) stripJunkSpans(block);
    document.execCommand('insertParagraph');
    syncChapter(body, chId);
    return true;
  }

  // Third Enter at end of flow: empty paragraph under a *** — chapter splits here
  if (prev && prev.classList.contains('scene-break')) {
    e.preventDefault();
    snapshotStructure('chapter split');
    prev.remove();
    splitChapterAt(body, chId, block, sel);
    return true;
  }

  // Second Enter at end of flow: the empty paragraph becomes a *** break
  if (prev) {
    e.preventDefault();
    snapshotStructure('section break', { rejoin: enterRun >= 2 });
    block.classList.add('scene-break');
    block.textContent = '***';
    const np = document.createElement('p');
    np.innerHTML = '<br>';
    block.after(np);
    const range = document.createRange();
    range.setStart(np, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    syncChapter(body, chId);
    resetNativeUndo();
    breakRun++;
    return true;
  }
  return false;
}

// Backspace just below a *** (or Delete just above one) removes the break
// itself — prose never merges into the break's styled paragraph
function sceneBreakDelete(e, body, chId) {
  if (e.key !== 'Backspace' && e.key !== 'Delete') return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const r = sel.getRangeAt(0);
  let el = r.startContainer;
  if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
  const block = el && el.closest ? el.closest('p') : null;
  if (!block || !body.contains(block)) return false;
  const back = e.key === 'Backspace';
  const edge = document.createRange();
  edge.selectNodeContents(block);
  try {
    if (back) edge.setEnd(r.startContainer, r.startOffset);
    else edge.setStart(r.startContainer, r.startOffset);
  } catch { return false; }
  if (edge.toString().length !== 0) return false; // caret isn't at the block's edge
  const target = back ? block.previousElementSibling : block.nextElementSibling;
  if (!target || !target.classList.contains('scene-break')) return false;
  e.preventDefault();
  snapshotStructure('section break removed');
  target.remove();
  syncChapter(body, chId);
  resetNativeUndo();
  breakRun++;
  return true;
}

// Read a body's HTML for saving:
function captureBody(body) {
  return body.innerHTML;
}

function syncChapter(body, chId) {
  chapterHTML[chId] = captureBody(body);
  wordCache[chId] = null;
  scheduleChapterSave(chId);
  updateCounters();
  renumberCites(); // structural edits can move, add or drop citations
  scheduleNavRefresh();
}

// Heal text-node fragmentation in each paragraph as the caret leaves it:
let lastCaretPara = null;
document.addEventListener('selectionchange', () => {
  if (!book || currentTab !== 'manuscript') return;
  const sel = window.getSelection();
  let caretP = null;
  if (sel && sel.rangeCount) {
    let el = sel.anchorNode;
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    const p = el && el.closest ? el.closest('p') : null;
    if (p && p.parentElement && p.parentElement.classList.contains('chapter-body')) caretP = p;
  }
  if (caretP !== lastCaretPara) {
    if (lastCaretPara && lastCaretPara.isConnected) {
      try { lastCaretPara.normalize(); } catch { /* fine */ }
    }
    lastCaretPara = caretP;
  }
  // during a spellcheck pass, each chapter scans as the caret arrives
  if (spellOn && caretP) {
    const ch = caretP.closest('.chapter');
    if (ch) scanSpellingIn(ch.querySelector('.chapter-body'), ch.dataset.id);
  }
});

// Parse HTML we didn't write (the clipboard, a drag, stored text on its way
// out) inside a <template>: its document is inert, so nothing in it runs or
// loads — an <img onerror> in a paste stays text on a page.
function inertDiv(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = '<div>' + (html || '') + '</div>';
  return tpl.content.firstElementChild;
}

// Reduce pasted HTML to what a manuscript is made of: paragraphs, bold, italic.
function cleanPasteHtml(html) {
  const holder = inertDiv(html);
  holder.querySelectorAll('script,style,meta,link,img,table').forEach((n) => n.remove());
  let blocks = [...holder.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6')];
  if (!blocks.length) blocks = [holder]; // inline-only clipboard
  const out = blocks.map((b) => {
    let inner = '';
    let openSrc;
    const closeCite = () => { if (openSrc) { inner += '</span>'; openSrc = undefined; } };
    for (const r of paraRuns(b.innerHTML)) {
      if (r.mark !== undefined) {
        // placeholder marks travel with their text; reconcileMarks pairs
        // each one back up with a note after the paste lands
        closeCite();
        if (r.mark) inner += `<span class="ph-mark${r.ai ? ' ai' : ''}" data-sid="${escHtml(r.mark)}" contenteditable="false">${r.ai ? '✦' : '⚑'}</span>`;
        continue;
      }
      if (r.citeMark) {
        closeCite();
        inner += `<span class="cite-mark" data-src="${escHtml(r.citeMark)}" contenteditable="false">[·]</span>`;
        continue;
      }
      if (r.src !== openSrc) {
        closeCite();
        if (r.src) { inner += `<span class="cite" data-src="${escHtml(r.src)}">`; openSrc = r.src; }
      }
      let t = escHtml(r.text);
      if (r.i) t = '<i>' + t + '</i>';
      if (r.b) t = '<b>' + t + '</b>';
      inner += t;
    }
    closeCite();
    return inner.trim() ? '<p>' + inner + '</p>' : '';
  }).filter(Boolean);
  // single block pastes inline (no forced new paragraph)
  if (out.length === 1) return out[0].slice(3, -4);
  return out.join('');
}

// Em dash, ellipsis, smart quotes:
function smartKeys(e, body) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.isComposing || e.keyCode === 229) return;

  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  const prevChars = (n) => {
    if (!range.collapsed) return '';
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return '';
    return node.textContent.slice(Math.max(0, range.startOffset - n), range.startOffset);
  };

  if (e.key === '-' && prevChars(1) === '-') {
    e.preventDefault();
    document.execCommand('delete');
    document.execCommand('insertText', false, '—'); // —
    return;
  }
  if (e.key === '.' && prevChars(2) === '..') {
    e.preventDefault();
    document.execCommand('delete');
    document.execCommand('delete');
    document.execCommand('insertText', false, '…'); // …
    return;
  }
  if (e.key === '"' || e.key === "'") {
    e.preventDefault();
    const before = prevChars(1);
    const opening = before === '' || /[\s\(\[\{—‘“>]/.test(before);
    const ch = e.key === '"'
      ? (opening ? '“' : '”')
      : (opening ? '‘' : '’');
    document.execCommand('insertText', false, ch);
  }
}

// Title block: Enter drops you into the first section.
$('#tp-title').addEventListener('keydown', titleEnter);
$('#tp-subtitle').addEventListener('keydown', titleEnter);
function titleEnter(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  if (book.chapterOrder.length === 0) {
    newChapter();
  } else {
    focusChapter(book.chapterOrder[0]);
  }
}
$('#tp-title').addEventListener('input', () => {
  book.title = $('#tp-title').textContent.trim() || 'Untitled';
  scheduleMetaSave();
});
$('#tp-subtitle').addEventListener('input', () => {
  book.subtitle = $('#tp-subtitle').textContent.trim();
  scheduleMetaSave();
});
// each book can carry its own pen name
$('#tp-author').addEventListener('input', () => {
  book.author = $('#tp-author').textContent.trim();
  scheduleMetaSave();
});

// Global editor shortcuts
document.addEventListener('keydown', (e) => {
  if ($('#editor-view').hidden) return;
  if (document.querySelector('.modal-backdrop:not([hidden])')) return; // visible modals own the keyboard
  const cmd = e.metaKey || e.ctrlKey;
  if (cmd && e.shiftKey && e.code === 'KeyX') {
    e.preventDefault();
    if (currentTab === 'manuscript') insertPlaceholder();
  }
  if (cmd && e.shiftKey && e.code === 'KeyK') {
    e.preventDefault();
    if (currentTab === 'manuscript') insertCitation();
  }
  if (cmd && e.shiftKey && e.code === 'KeyD') {
    e.preventDefault();
    if (currentTab === 'manuscript') darlingFromKeyboard();
  }
  if (e.key === 'Escape') {
    if (typeof aiCancel === 'function' && aiCancel()) return; // stop the assistant first
    if (typeof reorderOn !== 'undefined' && reorderOn) { // sentences → cards → the draft
      if (reorderView === 'sentences') { reorderView = 'cards'; reorderPara = null; renderReorder(); } else toggleReorder(false);
      return;
    }
    if (closeSidePane()) return;
    if (!$('#searchbar').hidden) closeSearch();
    else window.neo.fullscreenEscape().then((exited) => { if (!exited) backToShelf(); });
  }
});

// Escape also exits regular fullscreen from the bookshelf
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !$('#editor-view').hidden) return;
  if (document.querySelector('.modal-backdrop:not([hidden])')) return;
  window.neo.fullscreenEscape();
});

// ⌘Enter (Ctrl+Enter): toggle fullscreen from anywhere
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
  if (document.querySelector('.modal-backdrop:not([hidden])')) return;
  e.preventDefault();
  window.neo.fullscreenToggle();
});

function createChapterAt(idx) {
  const chId = 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  book.chapterOrder.splice(idx, 0, chId);
  chapterHTML[chId] = '<p><br></p>';
  window.neo.writeChapter(book.id, chId, chapterHTML[chId]);
  saveMeta();
  renderChapters();
  return chId;
}

function newChapter() {
  // insert after the chapter you're in; at the end if you're not in one
  const idx = currentChapterId ? book.chapterOrder.indexOf(currentChapterId) + 1 : book.chapterOrder.length;
  const chId = createChapterAt(idx);
  focusChapter(chId);
}

async function deleteChapterQuiet(chId) {
  book.chapterOrder = book.chapterOrder.filter((c) => c !== chId);
  delete chapterHTML[chId];
  delete wordCache[chId];
  if (book.sectionNotes) delete book.sectionNotes[chId];
  if (book.chapterNotes) delete book.chapterNotes[chId];
  stickies = stickies.filter((s) => s.chapterId !== chId);
  window.neo.writeJSON(book.id, 'stickies', stickies);
  window.neo.deleteChapter(book.id, chId);
  await saveMeta();
  renderChapters();
  renderStickies();
}

function focusChapter(chId) {
  const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
  if (!body) return;
  body.focus();
  // caret at the very end
  const range = document.createRange();
  range.selectNodeContents(body);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  body.closest('.chapter').scrollIntoView({ behavior: 'smooth', block: 'start' });
  currentChapterId = chId;
  highlightNav();
}

/* ================================================================== */
/*  PLACEHOLDERS + STICKIES                                            */
/* ================================================================== */

function insertPlaceholder() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  // derive the chapter from where the caret actually is:
  let el = sel.anchorNode;
  if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
  const bodyEl = el && el.closest ? el.closest('.chapter-body') : null;
  if (!bodyEl) {
    toast(t('mark.needSection', { key: KPH }));
    return;
  }
  currentChapterId = bodyEl.closest('.chapter').dataset.id;
  const sid = 's-' + Date.now().toString(36);
  const span = document.createElement('span');
  span.className = 'ph-mark';
  span.dataset.sid = sid;
  span.contentEditable = 'false';
  span.textContent = '⚑';
  const range = sel.getRangeAt(0);
  range.collapse(false);
  range.insertNode(span);
  // park the caret just past the mark and keep writing
  const after = document.createTextNode(' ');
  span.after(after);
  range.setStartAfter(after);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);

  stickies.push({ id: sid, chapterId: currentChapterId, text: '', resolved: false });
  window.neo.writeJSON(book.id, 'stickies', stickies);
  chapterHTML[currentChapterId] = captureBody(document.querySelector(
    `.chapter[data-id="${currentChapterId}"] .chapter-body`
  ));
  scheduleChapterSave(currentChapterId);
  renderStickies();
  scheduleNavRefresh();
}

// Notes in the text: the writer's ⚑ marks and the assistant's ✦ comments,
// in the order they sit in the essay. Each sticky:
// { id, chapterId, text, resolved, kind: 'mark'|'critique', author: 'me'|'ai',
//   category?, severity?, research?: { answer, sourceIds, at } }
let sideFilter = 'all';

function renderStickies() {
  const wrap = $('#sticky-list');
  wrap.innerHTML = '';
  const where = new Map();
  $$('.chapter-body .ph-mark').forEach((m, i) => where.set(m.dataset.sid, i));
  const open = stickies.filter((s) => !s.resolved)
    .sort((a, b) => (where.has(a.id) ? where.get(a.id) : 1e9) - (where.has(b.id) ? where.get(b.id) : 1e9));
  const fromAi = (s) => s.author === 'ai';
  if (open.some(fromAi)) {
    const bar = document.createElement('div');
    bar.className = 'side-filter';
    for (const f of ['all', 'me', 'ai']) {
      const b = document.createElement('button');
      b.textContent = t('side.filter.' + f);
      b.classList.toggle('on', sideFilter === f);
      b.onclick = () => { sideFilter = f; renderStickies(); };
      bar.appendChild(b);
    }
    wrap.appendChild(bar);
  } else {
    sideFilter = 'all';
  }
  const shown = open.filter((s) => sideFilter === 'all' || (sideFilter === 'ai') === fromAi(s));
  if (open.length === 0) {
    wrap.innerHTML = `<div class="stickies-empty">${t('side.empty', { key: KPH })}</div>`;
    return;
  }
  for (const s of shown) {
    const chIdx = book.chapterOrder.indexOf(s.chapterId);
    const el = document.createElement('div');
    el.className = 'sticky unresolved' + (fromAi(s) ? ' ai' : '');
    el.dataset.sid = s.id;
    const place = chIdx >= 0 ? t('side.section', { n: chIdx + 1 }) : t('side.unplaced');
    if (s.kind === 'critique') {
      el.innerHTML = `
        <div class="s-ch"><span class="s-kind sev-${['high', 'medium', 'low'].includes(s.severity) ? s.severity : 'medium'}">✦ ${escHtml(t('crit.cat.' + (s.category || 'clarity')))}</span> · ${place}</div>
        <div class="s-text"></div>
        <div class="s-actions"><button class="s-go">${t('side.goTo')}</button> <button class="s-note">${t('side.toNotes')}</button> <button class="s-done">${t('side.done')}</button></div>`;
      el.querySelector('.s-text').textContent = s.text;
      el.querySelector('.s-note').onclick = () => stickyToNotes(s);
    } else {
      el.innerHTML = `
        <div class="s-ch">${place}</div>
        <textarea placeholder="${t('side.notePh')}" spellcheck="false"></textarea>
        <div class="s-research"></div>
        <div class="s-actions"><button class="s-go">${t('side.goTo')}</button> <button class="s-ask" hidden>${t('ai.research')}</button> <button class="s-done">${t('side.resolve')}</button></div>`;
      const ta = el.querySelector('textarea');
      ta.value = s.text;
      ta.addEventListener('input', () => {
        s.text = ta.value;
        clearTimeout(saveTimers.stickies);
        saveTimers.stickies = setTimeout(() => { if (book) window.neo.writeJSON(book.id, 'stickies', stickies); }, 600);
      });
      if (typeof renderResearch === 'function') renderResearch(s, el);
    }
    el.querySelector('.s-go').onclick = () => {
      switchTab('manuscript');
      const mark = document.querySelector(`.ph-mark[data-sid="${s.id}"]`);
      if (mark) mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    el.querySelector('.s-done').onclick = () => resolveSticky(s.id);
    wrap.appendChild(el);
  }
}

// keep an assistant's comment by moving it into the Notes tab
async function stickyToNotes(s) {
  const chIdx = book.chapterOrder.indexOf(s.chapterId);
  const head = `✦ ${t('crit.cat.' + (s.category || 'clarity'))}${chIdx >= 0 ? ' · ' + t('side.section', { n: chIdx + 1 }) : ''}`;
  flushAux();
  const html = await window.neo.readAux(book.id, 'notes');
  await window.neo.writeAux(book.id, 'notes', (html || '') + `<p><b>${escHtml(head)}</b></p><p>${escHtml(s.text)}</p>`);
  resolveSticky(s.id);
  toast(t('side.movedToNotes'));
}

// Pair every mark in the manuscript with a note: pasted duplicates get their
// own copy of the note, marks that moved chapters update their red dot, and
// marks orphaned by older versions get a fresh (empty) note instead of dying.
function reconcileMarks() {
  if (!book) return;
  const seen = new Set();
  let changed = false;
  for (const m of document.querySelectorAll('.chapter-body .ph-mark')) {
    let sid = m.dataset.sid;
    if (!sid) continue;
    const chEl = m.closest('.chapter');
    const chId = chEl ? chEl.dataset.id : null;
    const existing = stickies.find((s) => s.id === sid);
    if (seen.has(sid)) {
      const nid = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 5);
      m.dataset.sid = nid;
      stickies.push({ ...(existing || { text: '' }), id: nid, chapterId: chId, resolved: false });
      seen.add(nid);
      changed = true;
      continue;
    }
    if (!existing) {
      stickies.push({ id: sid, chapterId: chId, text: '', resolved: false });
      changed = true;
    } else if (existing.chapterId !== chId) {
      existing.chapterId = chId;
      changed = true;
    }
    seen.add(sid);
  }
  if (changed) {
    window.neo.writeJSON(book.id, 'stickies', stickies);
    renderStickies();
    renderNav();
  }
}

function resolveSticky(sid) {
  const mark = document.querySelector(`.ph-mark[data-sid="${sid}"]`);
  if (mark) {
    const chId = mark.closest('.chapter').dataset.id;
    const prev = mark.previousSibling;
    const next = mark.nextSibling;
    mark.remove();
    // tidy the seam: old flags parked a no-break space after themselves,
    // and removing a flag between two spaces shouldn't leave both
    if (next && next.nodeType === Node.TEXT_NODE) next.data = next.data.replace(/^\u00a0/, ' ');
    if (prev && prev.nodeType === Node.TEXT_NODE) prev.data = prev.data.replace(/\u00a0$/, ' ');
    if (prev && next && prev.nodeType === Node.TEXT_NODE && next.nodeType === Node.TEXT_NODE &&
        / $/.test(prev.data) && /^ /.test(next.data)) {
      next.data = next.data.slice(1);
    }
    const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
    try { body.normalize(); } catch { /* fine */ }
    chapterHTML[chId] = captureBody(body);
    scheduleChapterSave(chId);
  }
  stickies = stickies.filter((s) => s.id !== sid);
  window.neo.writeJSON(book.id, 'stickies', stickies);
  renderStickies();
  scheduleNavRefresh();
}

function focusSticky(sid) {
  $('#side-pane').classList.add('open');
  const el = document.querySelector(`.sticky[data-sid="${sid}"] textarea`);
  if (el) el.focus();
}

/* ================================================================== */
/*  NAV PANE                                                           */
/* ================================================================== */

const navOpen = new Set(); // sections unfolded in the left pane

function renderNav() {
  if (!book) return; // a refresh timer can outlive the book it was set for
  const list = $('#nav-list');
  list.innerHTML = '';
  book.chapterNotes = book.chapterNotes || {};
  book.chapterOrder.forEach((chId, i) => {
    const words = chapterWords(chId);
    const flagged = !!document.querySelector(`.chapter[data-id="${chId}"] .ph-mark`);
    const chTitle = (book.chapterTitles || {})[chId];
    const item = document.createElement('div');
    item.className = 'nav-item' + (chId === currentChapterId ? ' current' : '');
    item.dataset.id = chId;
    item.innerHTML = `<div class="n-row" title="${t('nav.dragTitle')}"><span class="n-caret" title="${t('nav.parasTitle')}">${navOpen.has(chId) ? '▾' : '▸'}</span><span class="n-label"></span>
      <span style="display:flex;align-items:center"><span class="n-words">${words.toLocaleString()}</span>${flagged ? `<span class="n-flag" title="${t('nav.flagTitle')}"></span>` : ''}</span></div>`;
    item.querySelector('.n-label').textContent = book.chapterOrder.length === 1
      ? displayTitle(book)
      : (chTitle ? `${i + 1} · ${chTitle}` : t('nav.section', { n: i + 1 }));

    // the row is the drag handle, so the note below stays freely editable
    const rowEl = item.querySelector('.n-row');
    rowEl.draggable = true;
    rowEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-neo-chapter', chId);
      item.classList.add('dragging');
    });
    rowEl.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      const ind = document.querySelector('.nav-drop-ind');
      if (ind) ind.remove();
    });

    // outline your whole book from this panel:
    const note = document.createElement('div');
    note.className = 'nav-note';
    note.contentEditable = 'true';
    note.spellcheck = false;
    note.textContent = book.chapterNotes[chId] || '';
    note.dataset.ph = (book.outlinePrompts || {})[chId] || t('nav.notePh');
    note.addEventListener('click', (e) => e.stopPropagation());
    note.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); note.blur(); }
      e.stopPropagation();
    });
    note.addEventListener('blur', () => {
      book.chapterNotes[chId] = note.textContent.trim();
      scheduleMetaSave();
    });
    item.appendChild(note);

    // the first sentence of each paragraph, folded per section: the skeleton
    // of the argument, one click from any paragraph
    item.querySelector('.n-caret').onclick = (e) => {
      e.stopPropagation();
      if (navOpen.has(chId)) navOpen.delete(chId); else navOpen.add(chId);
      renderNav();
    };
    if (navOpen.has(chId) && typeof proseParagraphs === 'function') {
      const paras = document.createElement('div');
      paras.className = 'nav-paras';
      for (const para of proseParagraphs(chId)) {
        const line = document.createElement('div');
        line.className = 'nav-para';
        line.textContent = firstSentence(paragraphPlain(para), spellLang());
        line.onclick = (e) => { e.stopPropagation(); gotoParagraph(para); };
        paras.appendChild(line);
      }
      if (!paras.children.length) paras.innerHTML = `<div class="nav-para soft">${t('ro.emptySection')}</div>`;
      item.appendChild(paras);
    }

    item.onclick = () => {
      switchTab('manuscript');
      focusChapter(chId);
    };
    list.appendChild(item);
  });
}

$('#nav-add').onclick = () => {
  switchTab('manuscript');
  currentChapterId = book.chapterOrder[book.chapterOrder.length - 1] || null;
  newChapter();
};

// drop target for chapter reordering, with a gold line showing the landing spot
const navList = $('#nav-list');
function navDropInd() {
  let ind = document.querySelector('.nav-drop-ind');
  if (!ind) {
    ind = document.createElement('div');
    ind.className = 'nav-drop-ind';
  }
  return ind;
}
navList.addEventListener('dragover', (e) => {
  if (!e.dataTransfer.types.includes('application/x-neo-chapter')) return;
  e.preventDefault();
  const ind = navDropInd();
  const items = [...navList.querySelectorAll('.nav-item:not(.dragging)')];
  let placed = false;
  for (const it of items) {
    const r = it.getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) {
      navList.insertBefore(ind, it);
      placed = true;
      break;
    }
  }
  if (!placed) navList.appendChild(ind);
});
navList.addEventListener('dragleave', (e) => {
  if (navList.contains(e.relatedTarget)) return;
  const ind = document.querySelector('.nav-drop-ind');
  if (ind) ind.remove();
});
navList.addEventListener('drop', async (e) => {
  const chId = e.dataTransfer.getData('application/x-neo-chapter');
  if (!chId) return;
  e.preventDefault();
  const ind = document.querySelector('.nav-drop-ind');
  let index = book.chapterOrder.filter((c) => c !== chId).length;
  if (ind) {
    index = 0;
    for (const c of navList.children) {
      if (c === ind) break;
      if (c.classList.contains('nav-item') && !c.classList.contains('dragging')) index++;
    }
    ind.remove();
  }
  const from = book.chapterOrder.indexOf(chId);
  if (from === -1) return;
  snapshotStructure('chapter reorder');
  book.chapterOrder = book.chapterOrder.filter((c) => c !== chId);
  book.chapterOrder.splice(index, 0, chId);
  await saveMeta();
  renderChapters(); // renumbers heads and rebuilds the nav
  if (currentTab === 'outline') renderOutline();
});

function highlightNav() {
  $$('.nav-item').forEach((el) => el.classList.toggle('current', el.dataset.id === currentChapterId));
}

function scheduleNavRefresh() {
  clearTimeout(saveTimers.nav);
  saveTimers.nav = setTimeout(() => { renderNav(); renumberCites(); }, 1200);
}

// Hover behavior for both side panes:
function wireHoverPane(hotzone, pane, isPinnable) {
  const pinned = () => isPinnable && pane.dataset.pinned === '1';
  hotzone.addEventListener('mouseenter', (e) => {
    if (e.buttons) return; // dragging something — stand down
    pane.classList.add('open');
  });
  hotzone.addEventListener('mouseleave', (e) => {
    if (pinned()) return;
    if (e.relatedTarget && pane.contains(e.relatedTarget)) return;
    pane.classList.remove('open');
  });
  pane.addEventListener('mouseleave', () => {
    if (pinned()) return;
    // mid-note, drifting the mouse away mustn't hide what's being typed —
    // a click outside (below) closes it instead
    if (pane.contains(document.activeElement)) return;
    pane.classList.remove('open');
  });
}
wireHoverPane($('#nav-hotzone'), $('#nav-pane'), false);
wireHoverPane($('#side-hotzone'), $('#side-pane'), true);

// leaving the window closes unpinned panes (they used to stick open)
function closeUnpinnedPanes() {
  $('#nav-pane').classList.remove('open');
  if ($('#side-pane').dataset.pinned !== '1') $('#side-pane').classList.remove('open');
}
document.documentElement.addEventListener('mouseleave', closeUnpinnedPanes);
window.addEventListener('blur', closeUnpinnedPanes);

// A click on a ⚑ opens the notes pane without the mouse ever entering it,
// so hover alone could never close it again. A click anywhere outside the
// pane closes it, and so does Esc (see the editor shortcuts).
function closeSidePane() {
  const pane = $('#side-pane');
  if (pane.dataset.pinned === '1' || !pane.classList.contains('open')) return false;
  if (pane.contains(document.activeElement)) document.activeElement.blur();
  pane.classList.remove('open');
  return true;
}
document.addEventListener('mousedown', (e) => {
  const t = e.target;
  if ($('#side-pane').contains(t) || $('#side-hotzone').contains(t)) return;
  if (t.closest && t.closest('.ph-mark, .modal-backdrop')) return; // the ⚑ reopens it; dialogs aren't "outside"
  closeSidePane();
}, true);

// the wheel scrolls the manuscript even when the pointer floats over the
// dark margins beside the (narrower) page column
$('#editor-view').addEventListener('wheel', (e) => {
  const scroller = $('#paper-scroll');
  if (e.ctrlKey) return; // pinch-zoom gesture, not a scroll
  if (scroller.contains(e.target)) return; // native scrolling handles it
  if ($('#nav-pane').contains(e.target) || $('#side-pane').contains(e.target)) return;
  scroller.scrollTop += e.deltaY;
}, { passive: true });

$('#side-pin').onclick = () => {
  const pane = $('#side-pane');
  const pinned = pane.dataset.pinned === '1';
  pane.dataset.pinned = pinned ? '0' : '1';
  $('#side-pin').classList.toggle('pinned', !pinned);
  $('#editor-view').classList.toggle('side-pinned', !pinned);
  if (!pinned) pane.classList.add('open');
};

/* ================================================================== */
/*  TABS — Manuscript / Notes / Outline / Darlings                     */
/* ================================================================== */

$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    if (typeof reorderOn !== 'undefined' && reorderOn) toggleReorder(false);
    switchTab(tab.dataset.tab);
  });
  tab.addEventListener('dblclick', async () => {
    const kind = tab.dataset.tab;
    if (kind !== 'notes' && kind !== 'outline') return;
    const name = await askInput(t('tab.renameQ'), t('tab.renameHint'), tabName(kind));
    if (!name) return;
    book.tabNames = book.tabNames || {};
    book.tabNames[kind] = name;
    tab.textContent = name;
    saveMeta();
    // Renamed tabs become the default for future books
    library.tabDefaults = library.tabDefaults || {};
    library.tabDefaults[kind] = name;
    window.neo.writeLibrary(library);
  });
});

// Darlings tab is a drop target for selected text
const darlingsTab = $('.tab.darlings');
// The selection usually collapses by the time a drag lands on the Darlings
// tab, so the range is remembered at dragstart and the cut is made by NEO
// itself (dropEffect 'copy' keeps Chromium from moving the text on its own).
let draggedRange = null;
document.addEventListener('dragstart', (e) => {
  // any text drag inside the manuscript lights up the bottom bar
  if (currentTab === 'manuscript' && e.target.closest && e.target.closest('.chapter-body')) {
    $('#bottombar').classList.add('attn');
    const sel = window.getSelection();
    draggedRange = sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0).cloneRange() : null;
  }
});
document.addEventListener('dragend', () => { $('#bottombar').classList.remove('attn'); draggedRange = null; });

darlingsTab.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  darlingsTab.classList.add('drag-over');
});
darlingsTab.addEventListener('dragleave', () => darlingsTab.classList.remove('drag-over'));
darlingsTab.addEventListener('drop', async (e) => {
  e.preventDefault();
  darlingsTab.classList.remove('drag-over');
  const html = e.dataTransfer.getData('text/html');
  const text = e.dataTransfer.getData('text/plain');
  await moveSelectionToDarlings(html, text);
});

// ---- text-position helpers: darlings remember home by their surrounding
// text, so nothing foreign is left inside the manuscript ----

function bodyPlainText(body) {
  let t = '';
  const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) t += n.textContent;
  return t;
}

function textPosToRange(body, pos) {
  const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let n, acc = 0;
  while ((n = w.nextNode())) {
    const len = n.textContent.length;
    if (acc + len >= pos) {
      const r = document.createRange();
      r.setStart(n, pos - acc);
      r.collapse(true);
      return r;
    }
    acc += len;
  }
  return null;
}

// Where in the chapter does this darling belong?
function findDarlingPosition(body, d) {
  if (d.anchorPrefix == null && d.anchorSuffix == null) return -1;
  const text = bodyPlainText(body);
  const pre = d.anchorPrefix || '';
  const suf = d.anchorSuffix || '';
  let idx = (pre + suf) ? text.indexOf(pre + suf) : -1;
  if (idx !== -1) return idx + pre.length;
  if (pre) {
    idx = text.indexOf(pre);
    if (idx !== -1) return idx + pre.length;
  }
  if (suf) {
    idx = text.indexOf(suf);
    if (idx !== -1) return idx;
  }
  return -1;
}

// The one move shared by drag-to-tab and ⌘⇧D: the cut point is remembered by its surroundings —
// no markers in the WIP itself.
async function moveSelectionToDarlings(html, text) {
  if (!text || !text.trim() || !book) return;
  const sel = window.getSelection();
  // the live selection if it survived the drag, else the one saved at dragstart
  const live = sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0) : null;
  const range = live || draggedRange;
  draggedRange = null;
  const srcChapter = range
    ? range.startContainer.parentElement?.closest?.('.chapter')
    : null;
  const chId = srcChapter ? srcChapter.dataset.id : currentChapterId;
  const chIdx = book.chapterOrder.indexOf(chId);
  const did = 'd-' + Date.now().toString(36);

  snapshotStructure('darling');

  let anchorPrefix = null;
  let anchorSuffix = null;
  if (range) {
    const startNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
    const startBlock = startNode && startNode.closest ? startNode.closest('p') : null;
    range.deleteContents();
    // a whole paragraph dragged away leaves its empty shell behind: remove it
    // and park the caret at the end of the paragraph before (or start of after)
    if (startBlock && !startBlock.textContent.trim() && !startBlock.querySelector('span')
        && startBlock.parentElement && startBlock.parentElement.children.length > 1) {
      const prev = startBlock.previousElementSibling;
      const next = startBlock.nextElementSibling;
      startBlock.remove();
      if (prev) { range.selectNodeContents(prev); range.collapse(false); }
      else if (next) { range.selectNodeContents(next); range.collapse(true); }
    }
    sel.removeAllRanges(); sel.addRange(range);
    const r = range;
    const body = r.startContainer.parentElement?.closest?.('.chapter-body');
    if (body) {
      const pre = document.createRange();
      pre.selectNodeContents(body);
      pre.setEnd(r.startContainer, r.startOffset);
      anchorPrefix = pre.toString().slice(-60);
      const post = document.createRange();
      post.selectNodeContents(body);
      post.setStart(r.startContainer, r.startOffset);
      anchorSuffix = post.toString().slice(0, 60);
    }
  }
  if (chId) {
    const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
    if (body) {
      chapterHTML[chId] = captureBody(body);
      wordCache[chId] = null;
      scheduleChapterSave(chId);
    }
  }

  // Chromium's drag html carries inline font/colour/background styles;
  // keep only the prose (paragraphs when the drag spanned more than one)
  let cleanHtml = null;
  if (html) {
    const cleaned = cleanPasteHtml(html);
    cleanHtml = /\n/.test(text.trim()) && !/<p[\s>]/i.test(cleaned) ? '<p>' + cleaned + '</p>' : cleaned;
  }
  darlings.unshift({
    id: did,
    html: cleanHtml,
    text: text,
    chapterId: chId || null,
    chapterNum: chIdx >= 0 ? chIdx + 1 : null,
    anchorPrefix,
    anchorSuffix,
    date: new Date().toISOString()
  });
  await window.neo.writeJSON(book.id, 'darlings', darlings);
  updateCounters();
  toast(t('later.saved', { undo: KZ }));
}

// Older versions of NEO planted invisible marker spans at darling cut points,
// which interfered with Chromium's delete handling. On open, convert each one
// into a remembered-context position and remove it:
async function migrateDarlingAnchors() {
  const spans = [...document.querySelectorAll('.darling-anchor')];
  if (!spans.length) return;
  let changed = false;
  for (const span of spans) {
    const body = span.closest('.chapter-body');
    const d = darlings.find((x) => x.id === span.dataset.did);
    if (body && d && d.anchorPrefix == null) {
      const pre = document.createRange();
      pre.selectNodeContents(body);
      pre.setEndBefore(span);
      d.anchorPrefix = pre.toString().slice(-60);
      const post = document.createRange();
      post.selectNodeContents(body);
      post.setStartAfter(span);
      d.anchorSuffix = post.toString().slice(0, 60);
      changed = true;
    }
    const chapter = span.closest('.chapter');
    span.remove();
    if (body && chapter) {
      chapterHTML[chapter.dataset.id] = captureBody(body);
      wordCache[chapter.dataset.id] = null;
      scheduleChapterSave(chapter.dataset.id);
    }
  }
  if (changed) await window.neo.writeJSON(book.id, 'darlings', darlings);
}

// keyboard route: select a passage, ⌘⇧D to move to Darlings
function darlingFromKeyboard() {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) {
    toast(t('later.needSelection', { key: KDA }));
    return;
  }
  let el = sel.anchorNode;
  if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
  if (!el || !el.closest || !el.closest('.chapter-body')) return;
  const holder = document.createElement('div');
  holder.appendChild(sel.getRangeAt(0).cloneContents());
  moveSelectionToDarlings(holder.innerHTML, sel.toString());
}

// Every tab shares one scroller, so leaving a tab used to lose its place.
// Each tab now remembers where it was — the manuscript keeps its caret as
// well — for as long as the book is open.
let tabPlaces = {};

function switchTab(name) {
  const scroller = $('#paper-scroll');
  if (book && currentTab && currentTab !== name) {
    tabPlaces[currentTab] = currentTab === 'manuscript'
      ? { caret: captureCaret(), scroll: scroller.scrollTop }
      : { scroll: scroller.scrollTop };
  }
  currentTab = name;
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  if (spellOn) setTimeout(scanSpellingHere, 0);
  const paper = $('#paper');
  const aux = $('#aux-paper');
  const auxEditor = $('#aux-editor');
  const dList = $('#darlings-list');
  const sList = $('#sources-list');
  const oList = $('#outline-list');
  const back = tabPlaces[name];
  const returnTo = () => { if (back && typeof back.scroll === 'number') scroller.scrollTop = back.scroll; };

  // stash whatever aux content was open
  flushAux();

  if (name === 'manuscript') {
    paper.hidden = false;
    aux.hidden = true;
    if (back && back.caret) restoreCaret(back.caret); // brings the scroll along
    else returnTo();
    return;
  }
  paper.hidden = true;
  aux.hidden = false;
  aux.dataset.kind = name; // Sources and Later aren't writing pages: a system theme may dress them
  auxEditor.hidden = true;
  dList.hidden = true;
  sList.hidden = true;
  oList.hidden = true;

  if (name === 'sources') {
    $('#aux-title').textContent = t('tab.sources');
    sList.hidden = false;
    renderSources();
    returnTo();
  } else if (name === 'darlings') {
    $('#aux-title').textContent = t('tab.darlings');
    dList.hidden = false;
    renderDarlings();
    returnTo();
  } else if (name === 'outline') {
    $('#aux-title').textContent = tabName('outline');
    oList.hidden = false;
    if (book.chapterOrder.length === 0) createChapterAt(0);
    renderOutline();
    returnTo();
  } else {
    $('#aux-title').textContent = tabName(name);
    auxEditor.hidden = false;
    auxEditor.dataset.kind = name;
    window.neo.readAux(book.id, name).then((html) => {
      auxEditor.innerHTML = html || '';
      auxEditor.focus({ preventScroll: true });
      returnTo();
    });
  }
}

/* ================================================================== */
/*  STRUCTURED OUTLINE                                                 */
/*  Top lines are the essay's real sections. Lines under them become   */
/*  grayed "ghost" paragraphs in the manuscript                       */
/* ================================================================== */

const secLetter = (i) => String.fromCharCode(65 + (i % 26));

// The structured-writing skeleton (after Jordan Peterson's essay method):
// an essay is outlined as ten-odd sentences before it is written. Each
// line starts empty with a guiding question as its placeholder, so nothing
// reaches the manuscript until the writer puts a sentence of their own there.
const ESSAY_TEMPLATE = [
  { point: 'tpl.thesis', paras: ['tpl.thesis.why', 'tpl.thesis.reader'] },
  { point: 'tpl.reason1', paras: ['tpl.evidence', 'tpl.example'] },
  { point: 'tpl.reason2', paras: ['tpl.evidence', 'tpl.example'] },
  { point: 'tpl.objection', paras: ['tpl.objection.fair', 'tpl.objection.answer'] },
  { point: 'tpl.conclusion', paras: ['tpl.conclusion.next'] }
];

function applyEssayTemplate() {
  book.chapterNotes = book.chapterNotes || {};
  book.sectionNotes = book.sectionNotes || {};
  book.outlinePrompts = {};
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  ESSAY_TEMPLATE.forEach((sec, i) => {
    const chId = createChapterAt(i);
    book.outlinePrompts[chId] = t(sec.point);
    book.sectionNotes[chId] = sec.paras.map((ph) => ({ id: 'sec-' + uid(), text: '', ph: t(ph) }));
  });
  saveMeta();
}

function renderOutline(focusTarget) {
  book.sectionNotes = book.sectionNotes || {};
  book.chapterNotes = book.chapterNotes || {};
  const wrap = $('#outline-list');
  wrap.innerHTML = '';

  book.chapterOrder.forEach((chId, i) => {
    wrap.appendChild(outlineLine('chapter', chId, null, i, String(i + 1),
      book.chapterNotes[chId] || '', (book.outlinePrompts || {})[chId]));
    (book.sectionNotes[chId] || []).forEach((sec, j) => {
      wrap.appendChild(outlineLine('section', chId, sec.id, j, secLetter(j), sec.text, sec.ph));
    });
  });

  const hint = document.createElement('div');
  hint.className = 'ol-hint';
  hint.textContent = t('outline.hint');
  wrap.appendChild(hint);

  if (focusTarget) {
    const el = wrap.querySelector(
      focusTarget.secId
        ? `.ol-line[data-sec-id="${focusTarget.secId}"] .ol-text`
        : `.ol-line.ol-chapter[data-ch-id="${focusTarget.chId}"] .ol-text`
    );
    if (el) {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
  }
}

function outlineLine(kind, chId, secId, index, label, text, prompt) {
  const line = document.createElement('div');
  line.className = 'ol-line ol-' + kind;
  line.dataset.chId = chId;
  if (secId) line.dataset.secId = secId;
  const num = document.createElement('span');
  num.className = 'ol-num';
  num.textContent = label;
  const txt = document.createElement('div');
  txt.className = 'ol-text';
  txt.contentEditable = 'true';
  txt.spellcheck = false;
  txt.textContent = text;
  txt.dataset.ph = prompt || t(kind === 'chapter' ? 'outline.sectionPh' : 'outline.paraPh');

  const save = () => {
    const val = txt.textContent.trim();
    if (kind === 'chapter') {
      book.chapterNotes[chId] = val;
    } else {
      const sec = (book.sectionNotes[chId] || []).find((s) => s.id === secId);
      if (sec) sec.text = val;
    }
    scheduleMetaSave();
  };

  txt.addEventListener('blur', () => {
    save();
    if (kind === 'section') syncGhosts(chId);
    renderNav();
  });

  txt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
      if (kind === 'chapter') {
        const at = book.chapterOrder.indexOf(chId) + 1;
        const newId = createChapterAt(at);
        renderOutline({ chId: newId });
      } else {
        const list = book.sectionNotes[chId];
        const newSec = { id: 'sec-' + Date.now().toString(36), text: '' };
        list.splice(index + 1, 0, newSec);
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline({ secId: newSec.id });
      }
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const lines = [...document.querySelectorAll('.ol-line .ol-text')];
      const next = lines[lines.indexOf(txt) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) {
        next.focus();
        const r = document.createRange();
        r.selectNodeContents(next);
        r.collapse(false);
        const s = window.getSelection();
        s.removeAllRanges(); s.addRange(r);
      }
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (kind !== 'chapter') return;
      const pos = book.chapterOrder.indexOf(chId);
      if (pos === 0) { toast(t('outline.firstIsSection')); return; }
      if (countWords(chapterText(chId)) > 0) {
        toast(t('outline.hasWords'));
        return;
      }
      save();
      const prevCh = book.chapterOrder[pos - 1];
      book.sectionNotes[prevCh] = book.sectionNotes[prevCh] || [];
      const newSec = { id: 'sec-' + Date.now().toString(36), text: txt.textContent.trim() };
      book.sectionNotes[prevCh].push(newSec);
      deleteChapterQuiet(chId).then(() => {
        syncGhosts(prevCh);
        renderOutline({ secId: newSec.id });
      });
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      if (kind !== 'section') return;
      save();
      const list = book.sectionNotes[chId];
      const sec = list.find((s) => s.id === secId);
      list.splice(list.indexOf(sec), 1);
      const at = book.chapterOrder.indexOf(chId) + 1;
      const newId = createChapterAt(at);
      book.chapterNotes[newId] = sec.text;
      scheduleMetaSave();
      syncGhosts(chId);
      renderOutline({ chId: newId });
    }
    if (e.key === 'Backspace' && txt.textContent.trim() === '') {
      e.preventDefault();
      if (kind === 'section') {
        const list = book.sectionNotes[chId];
        book.sectionNotes[chId] = list.filter((s) => s.id !== secId);
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline({ chId });
      } else if (book.chapterOrder.length > 1 && countWords(chapterText(chId)) === 0) {
        const pos = book.chapterOrder.indexOf(chId);
        const prevCh = book.chapterOrder[Math.max(0, pos - 1)];
        deleteChapterQuiet(chId).then(() => renderOutline({ chId: prevCh }));
      }
    }
    e.stopPropagation();
  });

  // right-click any outline line to delete it
  line.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    if (kind === 'chapter') {
      const i = book.chapterOrder.indexOf(chId);
      const words = countWords(chapterText(chId));
      const choice = await optionModal(
        t('section.menuTitle', { n: i + 1 }),
        words ? tn('count.wordsSentence', words) : t('section.empty'),
        [{ label: t('section.delete'), desc: t(words ? 'section.deleteDesc' : 'section.deleteEmptyDesc'), danger: true, value: 'delete' }]
      );
      if (choice === 'delete') {
        await deleteChapterToDarlings(chId);
        renderOutline();
      }
    } else {
      const choice = await optionModal(t('outline.deleteQ'), null,
        [{ label: t('outline.delete'), desc: t('outline.deleteDesc'), danger: true, value: 'delete' }]);
      if (choice === 'delete') {
        book.sectionNotes[chId] = (book.sectionNotes[chId] || []).filter((s) => s.id !== secId);
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline({ chId });
      }
    }
  });

  line.appendChild(num);
  line.appendChild(txt);
  return line;
}

// Push section notes into the manuscript as gray ghost paragraphs,
// with real *** scene breaks between sections.
// Once a ghost has been written over, it goes away.
function syncGhosts(chId) {
  const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
  if (!body) return;
  const list = (book.sectionNotes && book.sectionNotes[chId]) || [];
  const keep = new Set(list.map((s) => s.id));

  const breakFor = (secId) => body.querySelector(`p.scene-break[data-sec-brk="${secId}"]`);

  // 1. Sections deleted from the outline: remove their ghost + its break
  //    (but never touch paragraphs that have been written over)
  body.querySelectorAll('p.ghost[data-sec-id]').forEach((p) => {
    if (!keep.has(p.dataset.secId)) {
      const brk = breakFor(p.dataset.secId);
      if (brk) brk.remove();
      p.remove();
    }
  });

  // 2. Pull all still-ghost paragraphs out, then re-append in outline order
  //    so the ghosts always mirror the outline's sequence
  for (const p of [...body.querySelectorAll('p.ghost[data-sec-id]')]) {
    const brk = breakFor(p.dataset.secId);
    if (brk) brk.remove();
    p.remove();
  }
  for (const sec of list) {
    // written over already? Leave it alone
    const written = body.querySelector(`p[data-sec-id="${sec.id}"]:not(.ghost)`);
    if (written) continue;
    if (!sec.text) continue;
    // *** between this ghost and whatever comes before it
    const hasContent = body.innerText.trim() !== '';
    if (hasContent && !(body.lastElementChild && body.lastElementChild.classList.contains('scene-break'))) {
      const brk = document.createElement('p');
      brk.className = 'scene-break';
      brk.dataset.secBrk = sec.id;
      brk.textContent = '***';
      body.appendChild(brk);
    }
    const p = document.createElement('p');
    p.className = 'ghost';
    p.dataset.secId = sec.id;
    p.textContent = sec.text;
    body.appendChild(p);
  }
  syncChapter(body, chId);
}

let auxDirty = false;
$('#aux-editor').addEventListener('keydown', (e) => { styleKeepScroll(e); });
$('#aux-editor').addEventListener('input', () => {
  auxDirty = true;
  scheduleAuxSave();
  if (spellOn) {
    const key = 'aux-' + ($('#aux-editor').dataset.kind || 'notes');
    scheduleSpellRescan(key, $('#aux-editor'));
  }
});
// notes paste arrives clean, same as the manuscript
$('#aux-editor').addEventListener('paste', (e) => {
  e.preventDefault();
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  if (html) document.execCommand('insertHTML', false, cleanPasteHtml(html));
  else if (text) document.execCommand('insertText', false, text.replace(/\r/g, ''));
});
function scheduleAuxSave() {
  clearTimeout(saveTimers.aux);
  saveTimers.aux = setTimeout(flushAux, 800);
}
function flushAux() {
  if (!auxDirty || !book) return;
  const kind = $('#aux-editor').dataset.kind;
  if (kind) window.neo.writeAux(book.id, kind, $('#aux-editor').innerHTML);
  auxDirty = false;
}

// where a kept passage came from — older ones carry a ready-made label
function laterFrom(d) {
  if (d.chapterNum) return t(d.variant ? 'later.fromVariant' : d.deleted ? 'later.fromDeleted' : 'later.fromSection', { n: d.chapterNum });
  return d.chapterLabel || t('later.fromDraft');
}

function renderDarlings() {
  const wrap = $('#darlings-list');
  wrap.innerHTML = '';
  if (darlings.length === 0) {
    wrap.innerHTML = `<div class="darlings-empty">${t('later.empty')}</div>`;
    return;
  }
  for (const d of darlings) {
    const el = document.createElement('div');
    el.className = 'darling';
    const content = document.createElement('div');
    if (d.html) content.innerHTML = d.html;
    else content.textContent = d.text;
    const meta = document.createElement('div');
    meta.className = 'd-meta';
    const when = new Date(d.date).toLocaleDateString(I18N.lang);
    meta.innerHTML = `<span>${escHtml(t('later.meta', { from: laterFrom(d), date: when, words: tn('count.words', countWords(d.text)) }))}</span>
      <span><button class="d-restore">${t('later.restore')}</button> <button class="d-del">${t('later.deleteForever')}</button></span>`;
    meta.querySelector('.d-restore').onclick = () => restoreDarling(d.id);
    meta.querySelector('.d-del').onclick = async () => {
      snapshotStructure('darling delete');
      // tidy up the invisible anchor the darling left behind
      const anchor = document.querySelector(`.darling-anchor[data-did="${d.id}"]`);
      if (anchor) {
        const body = anchor.closest('.chapter-body');
        const chId = anchor.closest('.chapter').dataset.id;
        anchor.remove();
        syncChapter(body, chId);
      }
      darlings = darlings.filter((x) => x.id !== d.id);
      await window.neo.writeJSON(book.id, 'darlings', darlings);
      renderDarlings();
    };
    el.appendChild(content);
    el.appendChild(meta);
    wrap.appendChild(el);
  }
}

async function restoreDarling(id) {
  const d = darlings.find((x) => x.id === id);
  if (!d) return;
  snapshotStructure('darling restore');
  switchTab('manuscript');

  // Preferred: put it back in the exact spot it was cut from, located by
  // the remembered text surrounding the cut point
  if (d.chapterId && book.chapterOrder.includes(d.chapterId)) {
    const body = document.querySelector(`.chapter[data-id="${d.chapterId}"] .chapter-body`);
    const pos = body ? findDarlingPosition(body, d) : -1;
    if (body && pos !== -1) {
      const at = textPosToRange(body, pos);
      if (at) {
        let scrollTo = at.startContainer.parentElement?.closest?.('p') || body;
        if (d.html && /<p[\s>]/i.test(d.html)) {
          // block content: paragraphs go back in after the host paragraph
          const holder = document.createElement('div');
          holder.innerHTML = d.html;
          let ref = scrollTo === body ? body.lastElementChild : scrollTo;
          scrollTo = holder.firstElementChild || scrollTo;
          for (const n of [...holder.childNodes]) { ref.after(n); ref = n; }
        } else {
          // inline content: slot it right where the caret was
          at.insertNode(document.createRange().createContextualFragment(d.html || d.text));
        }
        syncChapter(body, d.chapterId);
        darlings = darlings.filter((x) => x.id !== id);
        await window.neo.writeJSON(book.id, 'darlings', darlings);
        scrollTo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast(t('later.restored'));
        return;
      }
    }
  }

  // Fallback: the spot no longer exists — end of its chapter (or the last one)
  let chId = d.chapterId && book.chapterOrder.includes(d.chapterId)
    ? d.chapterId
    : book.chapterOrder[book.chapterOrder.length - 1];
  if (!chId) { newChapter(); chId = book.chapterOrder[0]; }
  const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
  const frag = d.html ? d.html : '<p>' + d.text.replace(/\n+/g, '</p><p>') + '</p>';
  body.insertAdjacentHTML('beforeend', frag);
  chapterHTML[chId] = captureBody(body);
  scheduleChapterSave(chId);
  darlings = darlings.filter((x) => x.id !== id);
  await window.neo.writeJSON(book.id, 'darlings', darlings);
  focusChapter(chId);
  toast(t('later.restoredEnd', { from: laterFrom(d) }));
}

/* ================================================================== */
/*  SOURCES                                                            */
/*  sources.json: [{ id, kind: web|article|book|other, url, title,     */
/*  author, site, published, accessed, quote, doi?, isbn?,             */
/*  status: accepted|candidate, addedBy: me|ai, added }]               */
/*  Citations live in the text as .cite spans (cited words) and        */
/*  .cite-mark flags ([n]); both carry data-src.                       */
/* ================================================================== */

function saveSources() {
  if (book) window.neo.writeJSON(book.id, 'sources', sources);
}

// every citation in the essay, in reading order
function citeElements() {
  const out = [];
  for (const chId of book.chapterOrder) {
    const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
    if (body) out.push(...body.querySelectorAll('.cite[data-src], .cite-mark[data-src]'));
  }
  return out;
}

// source id → its number, by first appearance in the text
function citationNumbers() {
  const nums = new Map();
  for (const el of citeElements()) {
    const id = el.dataset.src;
    // candidates (unreviewed AI finds) never get a number — exports leave them out too
    if (!nums.has(id) && sources.some((s) => s.id === id && s.status !== 'candidate')) nums.set(id, nums.size + 1);
  }
  return nums;
}

const sourceLine = (s) => [s.author, s.site, readableDate(s.published, I18N.lang)].filter(Boolean).join(' · ');

function renderSources() {
  const wrap = $('#sources-list');
  wrap.innerHTML = `
    <form class="src-add">
      <input type="text" class="src-input" spellcheck="false" placeholder="${t('src.addPh')}" />
      <button type="submit" class="btn-gold">${t('src.add')}</button>
    </form>
    <div class="src-manual"><button class="btn-quiet src-manual-btn">${t('src.addManual')}</button></div>
    <div class="src-items"></div>`;
  const form = wrap.querySelector('.src-add');
  const input = wrap.querySelector('.src-input');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.disabled = true;
    const found = await addSourceFrom(q);
    input.disabled = false;
    if (found) input.value = '';
    input.focus();
  };
  wrap.querySelector('.src-manual-btn').onclick = () => editSource(null);

  const items = wrap.querySelector('.src-items');
  const nums = citationNumbers();
  const uses = {};
  for (const el of citeElements()) uses[el.dataset.src] = (uses[el.dataset.src] || 0) + 1;
  // cited sources in citation order, then the rest newest first
  const list = [...sources].sort((a, b) => (nums.get(a.id) || 1e9) - (nums.get(b.id) || 1e9) ||
    String(b.added || '').localeCompare(String(a.added || '')));
  if (!list.length) {
    items.innerHTML = `<div class="darlings-empty">${t('src.empty', { key: KCITE })}</div>`;
    return;
  }
  for (const s of list) {
    const el = document.createElement('div');
    el.className = 'src-item' + (s.status === 'candidate' ? ' candidate' : '');
    const n = nums.get(s.id);
    el.innerHTML = `
      <div class="src-num">${n ? n : '·'}</div>
      <div class="src-body">
        <div class="src-title"></div>
        <div class="src-meta"></div>
        <a class="src-url" href="#"></a>
        <div class="src-quote"></div>
        <div class="src-actions">
          <span class="soft src-uses"></span>
          <button class="src-accept">${t('src.accept')}</button>
          <button class="src-go">${t('src.goTo')}</button>
          <button class="src-edit">${t('src.edit')}</button>
          <button class="src-del">${t('src.delete')}</button>
        </div>
      </div>`;
    el.querySelector('.src-title').textContent = s.title || s.url || t('src.untitled');
    el.querySelector('.src-meta').textContent = sourceLine(s);
    const a = el.querySelector('.src-url');
    if (s.url) { a.textContent = s.url; a.onclick = (e) => { e.preventDefault(); window.neo.openLink(s.url); }; } else a.remove();
    const qEl = el.querySelector('.src-quote');
    if (s.quote) qEl.textContent = '“' + s.quote + '”'; else qEl.remove();
    const u = uses[s.id] || 0;
    el.querySelector('.src-uses').textContent = (s.status === 'candidate' ? t('src.candidate') + ' · ' : '') +
      (u ? tn('src.uses', u) : t('src.unused'));
    const accept = el.querySelector('.src-accept');
    if (s.status === 'candidate') {
      accept.onclick = () => { s.status = 'accepted'; saveSources(); renderSources(); renumberCites(); };
    } else accept.remove();
    const go = el.querySelector('.src-go');
    if (u) go.onclick = () => goToCitation(s.id); else go.remove();
    el.querySelector('.src-edit').onclick = () => editSource(s);
    el.querySelector('.src-del').onclick = () => deleteSource(s, u);
    items.appendChild(el);
  }
}

// paste → lookup → review → saved. Resolves to the source (null if dropped).
async function addSourceFrom(q) {
  toast(t('src.looking'), 15000);
  const res = await window.neo.lookupSource(q);
  if (res.error === 'unrecognised') { toast(t('src.unrecognised'), 6000); return false; }
  if (res.error === 'blocked') { toast(t('src.blocked'), 7000); return false; }
  const draft = res.source || res.partial || {};
  const dup = sources.find((s) => (draft.url && s.url === draft.url) || (draft.doi && s.doi === draft.doi) || (draft.isbn && s.isbn === draft.isbn));
  if (dup) { toast(t('src.duplicate')); return (await editSource(dup)) || dup; }
  toast(res.error ? t(res.error === 'notFound' ? 'src.notFound' : 'src.lookupFailed') : t('src.found'), res.error ? 7000 : 2500);
  return editSource(null, draft);
}

// the review form; a null source means a new one. Resolves to the saved
// source, or null on cancel.
function editSource(src, draft) {
  return new Promise((resolve) => {
    const d = src || { kind: 'web', ...(draft || {}) };
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    const field = (name, label, value, type = 'text') => `
      <label>${label}<input class="sf-${name}" type="${type}" spellcheck="false" value="${escHtml(value || '').replace(/"/g, '&quot;')}"/></label>`;
    bd.innerHTML = `
      <div class="modal src-form" style="width:520px">
        <h2 style="font-size:16px">${t(src ? 'src.editTitle' : 'src.newTitle')}</h2>
        ${field('title', t('src.fTitle'), d.title)}
        ${field('author', t('src.fAuthor'), d.author)}
        <div class="stats-row">
          ${field('site', t(d.kind === 'book' ? 'src.fPublisher' : 'src.fSite'), d.site)}
          ${field('published', t('src.fDate'), d.published)}
        </div>
        ${field('url', t('src.fUrl'), d.url, 'url')}
        <label>${t('src.fQuote')}<textarea class="sf-quote" rows="3" spellcheck="false"></textarea></label>
        <div style="text-align:right;margin-top:10px">
          <button class="m-cancel btn-quiet" style="margin-right:10px">${t('common.cancel')}</button>
          <button class="m-ok btn-gold">${t('src.save')}</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    bd.querySelector('.sf-quote').value = d.quote || '';
    const val = (n) => bd.querySelector('.sf-' + n).value.trim();
    const done = (v) => { bd.remove(); resolve(v); };
    bd.querySelector('.m-cancel').onclick = () => done(null);
    bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
    bd.querySelector('.m-ok').onclick = () => {
      if (!val('title') && !val('url')) { toast(t('src.needTitle')); return; }
      const rec = src || {
        id: 'src-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        kind: d.kind || 'web', doi: d.doi, isbn: d.isbn,
        status: 'accepted', addedBy: 'me', added: new Date().toISOString(),
        accessed: new Date().toISOString().slice(0, 10)
      };
      Object.assign(rec, {
        title: val('title'), author: val('author'), site: val('site'),
        published: val('published'), url: val('url'), quote: val('quote')
      });
      if (!src) sources.push(rec);
      saveSources();
      if (currentTab === 'sources') renderSources();
      done(rec);
    };
    bd.querySelector('.sf-title').focus();
  });
}

async function deleteSource(s, uses) {
  const choice = await optionModal(t('src.deleteQ'), uses ? escHtml(tn('src.deleteCited', uses)) : null,
    [{ label: t('src.delete'), desc: t(uses ? 'src.deleteCitedDesc' : 'src.deleteDesc'), danger: true, value: 'del' }]);
  if (choice !== 'del') return;
  if (uses) {
    snapshotStructure('source delete');
    for (const el of citeElements().filter((e) => e.dataset.src === s.id)) uncite(el);
  }
  sources = sources.filter((x) => x.id !== s.id);
  saveSources();
  renderSources();
}

// scroll the draft to a source's first citation
function goToCitation(id) {
  switchTab('manuscript');
  const el = citeElements().find((e) => e.dataset.src === id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


// ---- citations in the text ----

// the [n] beside each citation, renumbered by first appearance
function renumberCites() {
  if (!book) return;
  const nums = citationNumbers();
  for (const el of citeElements()) {
    const n = nums.get(el.dataset.src);
    const label = n ? String(n) : '?'; // a citation whose source was deleted
    const known = sources.find((x) => x.id === el.dataset.src);
    const s = n && known;
    const tip = s ? [s.title || s.url, sourceLine(s)].filter(Boolean).join(' — ')
      : t(known ? 'cite.candidate' : 'cite.orphan');
    if (el.title !== tip) el.title = tip;
    if (el.classList.contains('cite-mark')) {
      if (el.textContent !== '[' + label + ']') el.textContent = '[' + label + ']';
    } else if (el.dataset.n !== label) {
      el.dataset.n = label;
    }
    el.classList.toggle('orphan', !n);
  }
}

// Ctrl/⌘⇧K: cite the selected words, or drop a [n] at the caret
async function insertCitation() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0).cloneRange();
  let el = range.startContainer;
  if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
  const body = el && el.closest ? el.closest('.chapter-body') : null;
  if (!body) { toast(t('cite.needSection', { key: KCITE })); return; }
  const blockOf = (n) => { if (n.nodeType === Node.TEXT_NODE) n = n.parentElement; return n && n.closest && n.closest('p'); };
  if (!range.collapsed && blockOf(range.startContainer) !== blockOf(range.endContainer)) {
    toast(t('cite.oneParagraph'));
    return;
  }
  const chId = body.closest('.chapter').dataset.id;
  const src = await pickSource();
  if (!src) { body.focus(); sel.removeAllRanges(); sel.addRange(range); return; }
  snapshotStructure('cite');
  body.focus();
  if (range.collapsed) {
    const mark = document.createElement('span');
    mark.className = 'cite-mark';
    mark.dataset.src = src.id;
    mark.contentEditable = 'false';
    mark.textContent = '[·]';
    range.insertNode(mark);
    const after = document.createRange();
    after.setStartAfter(mark);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
  } else {
    const inside = blockOf(range.startContainer) && (range.startContainer.parentElement || {}).closest &&
      range.startContainer.parentElement.closest('.cite');
    if (inside && inside.contains(range.endContainer)) {
      inside.dataset.src = src.id; // re-citing cited words: point them elsewhere
    } else {
      const span = document.createElement('span');
      span.className = 'cite';
      span.dataset.src = src.id;
      span.appendChild(range.extractContents());
      // citations don't nest — flatten any caught inside the selection
      span.querySelectorAll('.cite').forEach((c) => { while (c.firstChild) c.before(c.firstChild); c.remove(); });
      range.insertNode(span);
      const after = document.createRange();
      after.setStartAfter(span);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    }
  }
  syncChapter(body, chId);
  renumberCites();
  resetNativeUndo();
}

// remove a citation: cited words stay, [n] flags go
function uncite(el) {
  const body = el.closest('.chapter-body');
  if (el.classList.contains('cite-mark')) el.remove();
  else { while (el.firstChild) el.before(el.firstChild); el.remove(); }
  if (body) {
    try { body.normalize(); } catch { /* fine */ }
    syncChapter(body, body.closest('.chapter').dataset.id);
  }
  renumberCites();
}

async function citeMenu(el) {
  const s = sources.find((x) => x.id === el.dataset.src);
  const opts = [];
  if (s && s.url) opts.push({ label: t('cite.open'), desc: escHtml(s.url), value: 'open' });
  opts.push({ label: t('cite.showSources'), value: 'show' });
  opts.push({ label: t('cite.change'), value: 'change' });
  opts.push({ label: t('cite.remove'), desc: t(el.classList.contains('cite') ? 'cite.removeWordsDesc' : 'cite.removeMarkDesc'), danger: true, value: 'remove' });
  const title = s ? escHtml(s.title || s.url || t('src.untitled')) : t('cite.orphan');
  const choice = await optionModal(title, s ? escHtml(sourceLine(s)) : null, opts);
  if (choice === 'open') window.neo.openLink(s.url);
  else if (choice === 'show') switchTab('sources');
  else if (choice === 'change') {
    const next = await pickSource();
    if (next) {
      snapshotStructure('cite');
      el.dataset.src = next.id;
      const body = el.closest('.chapter-body');
      if (body) syncChapter(body, body.closest('.chapter').dataset.id);
      renumberCites();
    }
  } else if (choice === 'remove') {
    snapshotStructure('uncite');
    uncite(el);
  }
}

// choose a source to cite: search the list, or add a new one on the spot
function pickSource() {
  return new Promise((resolve) => {
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `
      <div class="modal" style="width:500px">
        <h2 style="font-size:16px">${t('cite.pickTitle')}</h2>
        <input type="text" class="sf-search" spellcheck="false" placeholder="${t('cite.pickPh')}" />
        <div class="sf-list"></div>
        <div style="text-align:right;margin-top:14px">
          <button class="m-cancel btn-quiet">${t('common.cancel')}</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    const list = bd.querySelector('.sf-list');
    const search = bd.querySelector('.sf-search');
    const done = (v) => { bd.remove(); resolve(v); };
    let active = 0;
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const shown = sources.filter((s) => s.status !== 'candidate' &&
        [s.title, s.author, s.site, s.url].join(' ').toLowerCase().includes(q));
      list.innerHTML = '';
      active = Math.min(active, Math.max(0, shown.length - 1));
      shown.forEach((s, i) => {
        const b = document.createElement('button');
        b.className = 'sf-item src-pick' + (i === active ? ' sel' : '');
        b.innerHTML = `<div class="src-title"></div><div class="src-meta"></div>`;
        b.querySelector('.src-title').textContent = s.title || s.url || t('src.untitled');
        b.querySelector('.src-meta').textContent = sourceLine(s);
        b.onclick = () => done(s);
        list.appendChild(b);
      });
      // what's typed looks like a link, DOI or ISBN: offer to add it right here
      if (q && /^(https?:\/\/|www\.|doi:|10\.\d{4,}\/|[\d -]{10,17}x?$)/i.test(search.value.trim())) {
        const add = document.createElement('button');
        add.className = 'sf-item src-pick';
        add.textContent = t('cite.addNew', { q: search.value.trim() });
        add.onclick = async () => {
          bd.style.display = 'none';
          done(await addSourceFrom(search.value.trim()));
        };
        list.appendChild(add);
      } else if (!shown.length) {
        list.innerHTML = `<div class="soft">${t(sources.length ? 'cite.noMatch' : 'cite.noSources')}</div>`;
      }
    };
    search.oninput = () => { active = 0; draw(); };
    search.onkeydown = (e) => {
      const items = [...list.querySelectorAll('.sf-item')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = Math.max(0, Math.min(items.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
        items.forEach((b, i) => b.classList.toggle('sel', i === active));
        if (items[active]) items[active].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[active]) items[active].click();
      }
    };
    bd.querySelector('.m-cancel').onclick = () => done(null);
    bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
    draw();
    search.focus();
  });
}

/* ================================================================== */
/*  COUNTERS                                                           */
/* ================================================================== */

function bookWordCount() {
  return book.chapterOrder.reduce((sum, chId) => sum + chapterWords(chId), 0);
}

function updateCounters() {
  if (!book) return;
  const total = bookWordCount();
  const wc = $('#word-counter');
  if (wordMode === 'book') {
    wc.textContent = tn('count.words', total);
  } else {
    const n = currentChapterId ? chapterWords(currentChapterId) : 0;
    const idx = book.chapterOrder.indexOf(currentChapterId);
    wc.textContent = t('count.section', { i: idx + 1, words: tn('count.words', n) });
  }
  const pos = $('#pos-counter');
  const idx = book.chapterOrder.indexOf(currentChapterId);
  pos.textContent = book.chapterOrder.length <= 1
    ? '' // a single-section essay needs no locator
    : (idx >= 0
      ? t('count.sectionOf', { i: idx + 1, n: book.chapterOrder.length })
      : tn('count.sections', book.chapterOrder.length));
  // cache for the bookshelf progress bar
  if (book.wordCount !== total) {
    book.wordCount = total;
    scheduleMetaSave();
  }
  trackDailyWords(total);
}

// ---- daily word tracking + goal display ----
// The writing day follows the writer's own clock, and rolls over at
// library.dayEndsAt (0 = midnight) so a session that runs past midnight
// still counts toward the night it began.
function writingDay(d = new Date()) {
  d = new Date(d);
  if (d.getHours() < (library.dayEndsAt || 0)) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayStr = () => writingDay();

function trackDailyWords(total) {
  book.dailyCounts = book.dailyCounts || {};
  const today = todayStr();
  if (!book.dailyCounts[today]) {
    book.dailyCounts[today] = { start: total, end: total };
    scheduleMetaSave();
  } else if (book.dailyCounts[today].end !== total) {
    book.dailyCounts[today].end = total;
  }
  const wordsToday = book.dailyCounts[today].end - book.dailyCounts[today].start;
  const gc = $('#goal-counter');
  if (sprint && !sprint.done) {
    const sprintWords = total - sprint.startCount;
    gc.textContent = `⚡ ${sprintWords.toLocaleString()} / ${sprint.target.toLocaleString()}`;
    if (sprintWords >= sprint.target) {
      sprint.done = true;
      toast(t('sprint.complete', { words: tn('count.words', sprintWords) }), 6000);
    }
  } else {
    const goal = library.dailyGoal || 0;
    gc.textContent = goal
      ? t('count.todayGoal', { n: wordsToday.toLocaleString(), goal: goal.toLocaleString() })
      : t('count.today', { n: wordsToday.toLocaleString() });
    gc.classList.toggle('goal-met', goal > 0 && wordsToday >= goal);
  }
}

$('#word-counter').onclick = () => {
  wordMode = wordMode === 'book' ? 'chapter' : 'book';
  updateCounters();
};

// select a passage → the counter reports its size
document.addEventListener('selectionchange', () => {
  if (!book || currentTab !== 'manuscript') return;
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    let el = sel.anchorNode;
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    if (el && el.closest && el.closest('.chapter-body')) {
      const n = countWords(sel.toString());
      if (n > 0) {
        $('#word-counter').textContent = t('count.selected', { n: n.toLocaleString() });
        return;
      }
    }
  }
  clearTimeout(saveTimers.selcount);
  saveTimers.selcount = setTimeout(() => { if (book) updateCounters(); }, 150);
});

// track which chapter you're scrolled to
$('#paper-scroll').addEventListener('scroll', () => {
  clearTimeout(saveTimers.scroll);
  saveTimers.scroll = setTimeout(() => {
    const mid = window.innerHeight * 0.4;
    let best = null;
    for (const sec of $$('.chapter')) {
      if (sec.getBoundingClientRect().top < mid) best = sec.dataset.id;
    }
    if (best && best !== currentChapterId) {
      currentChapterId = best;
      highlightNav();
      updateCounters();
    }
  }, 120);
});

/* ================================================================== */
/*  SAVING                                                             */
/* ================================================================== */

function scheduleChapterSave(chId) {
  const bookId = book.id;
  clearTimeout(saveTimers[chId]);
  saveTimers[chId] = setTimeout(() => {
    // leaving a book flushes every chapter; a timer that fires after that
    // must not write into whichever book is open now
    if (!book || book.id !== bookId) return;
    window.neo.writeChapter(book.id, chId, chapterHTML[chId] || '');
  }, 800);
}

function scheduleMetaSave() {
  clearTimeout(saveTimers.meta);
  saveTimers.meta = setTimeout(saveMeta, 800);
}
async function saveMeta() {
  if (book) await window.neo.writeBookMeta(book.id, book);
}

function flushAllSaves() {
  if (!book) return;
  // remember where you were for next session
  book.lastPosition = {
    chapterId: currentChapterId,
    scroll: $('#paper-scroll').scrollTop
  };
  for (const chId of book.chapterOrder) {
    if (chapterHTML[chId] !== undefined) {
      window.neo.writeChapter(book.id, chId, chapterHTML[chId]);
    }
  }
  flushAux();
  saveMeta();
}

window.addEventListener('beforeunload', flushAllSaves);
// flush whenever focus leaves NEO, and every 20 seconds
window.addEventListener('blur', () => { if (book) flushAllSaves(); });
setInterval(() => { if (book) flushAllSaves(); }, 20000);

async function backToShelf() {
  if (typeof reorderOn !== 'undefined' && reorderOn) toggleReorder(false);
  flushAllSaves();
  tabPlaces = {};
  book = null;
  currentChapterId = null;
  undoStack = [];
  $('#editor-view').hidden = true;
  $('#bookshelf-view').hidden = false;
  renderShelves();
}
$('#back-to-shelf').onclick = backToShelf;

/* ================================================================== */
/*  STRUCTURAL UNDO                                                    */
/*  Typing has the native ⌘Z. This covers the big moves — chapter      */
/*  deletes, replace-all, darlings — with snapshots of the whole       */
/*  structure.                                                         */
/* ================================================================== */

let undoStack = [];

// remember where the caret is — paragraph number plus offset within that
// paragraph, so even a caret in an EMPTY paragraph has an exact address
function captureCaret() {
  try {
    const sel = window.getSelection();
    if (!sel.rangeCount || currentTab !== 'manuscript') return null;
    const r = sel.getRangeAt(0);
    let el = r.startContainer;
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    const bodyEl = el && el.closest ? el.closest('.chapter-body') : null;
    if (!bodyEl) return null;
    const blk = el.closest('p');
    const ps = [...bodyEl.querySelectorAll('p')];
    let off = 0;
    if (blk) {
      const pre = document.createRange();
      pre.selectNodeContents(blk);
      pre.setEnd(r.startContainer, r.startOffset);
      off = pre.toString().length;
    }
    return {
      chId: bodyEl.closest('.chapter').dataset.id,
      pIdx: blk ? ps.indexOf(blk) : 0, // container-level caret: treat as chapter start
      off,
      scroll: $('#paper-scroll').scrollTop
    };
  } catch { return null; }
}

function restoreCaret(caret) {
  if (!caret) return;
  const bodyEl = document.querySelector(`.chapter[data-id="${caret.chId}"] .chapter-body`);
  if (!bodyEl) return;
  bodyEl.focus({ preventScroll: true });
  const sel = window.getSelection();
  const finish = () => {
    currentChapterId = caret.chId;
    if (typeof caret.scroll === 'number') $('#paper-scroll').scrollTop = caret.scroll;
  };
  const ps = [...bodyEl.querySelectorAll('p')];
  const blk = ps[caret.pIdx] || ps[ps.length - 1];
  if (!blk) { finish(); return; }
  const w = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT);
  let pos = 0, n;
  while ((n = w.nextNode())) {
    if (caret.off <= pos + n.data.length) {
      const r = document.createRange();
      r.setStart(n, caret.off - pos);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      finish();
      return;
    }
    pos += n.data.length;
  }
  // empty paragraph, or offset past its end
  const r = document.createRange();
  r.selectNodeContents(blk);
  r.collapse(caret.off === 0);
  sel.removeAllRanges();
  sel.addRange(r);
  finish();
}

// The engine's undo history must never replay against a document NEO has
// rearranged by hand — clear it whenever such a rearrangement happens.
function resetNativeUndo() {
  const caret = captureCaret();
  if (!caret) return;
  const bodyEl = document.querySelector(`.chapter[data-id="${caret.chId}"] .chapter-body`);
  if (!bodyEl) return;
  bodyEl.contentEditable = 'false';
  bodyEl.contentEditable = 'true';
  restoreCaret(caret);
}

function snapshotStructure(label, opts) {
  if (!book) return;
  undoStack.push({
    label,
    rejoin: !!(opts && opts.rejoin),
    caret: captureCaret(),
    chapterOrder: [...book.chapterOrder],
    chapterHTML: { ...chapterHTML },
    chapterTitles: { ...(book.chapterTitles || {}) },
    chapterNotes: { ...(book.chapterNotes || {}) },
    sectionNotes: JSON.parse(JSON.stringify(book.sectionNotes || {})),
    darlings: JSON.parse(JSON.stringify(darlings)),
    stickies: JSON.parse(JSON.stringify(stickies)),
    sources: JSON.parse(JSON.stringify(sources))
  });
  if (undoStack.length > 10) undoStack.shift();
}

async function structuralUndo() {
  const snap = undoStack.pop();
  if (!snap || !book) return;
  book.chapterOrder = snap.chapterOrder;
  chapterHTML = snap.chapterHTML;
  book.chapterTitles = snap.chapterTitles;
  book.chapterNotes = snap.chapterNotes;
  book.sectionNotes = snap.sectionNotes;
  darlings = snap.darlings;
  stickies = snap.stickies;
  sources = snap.sources || sources;
  // resurrect any chapter files the action may have deleted
  for (const chId of book.chapterOrder) {
    await window.neo.writeChapter(book.id, chId, chapterHTML[chId] || '<p><br></p>');
  }
  await window.neo.writeJSON(book.id, 'darlings', darlings);
  await window.neo.writeJSON(book.id, 'stickies', stickies);
  saveSources();
  await saveMeta();
  currentChapterId = book.chapterOrder.includes(currentChapterId) ? currentChapterId : null;
  renderChapters();
  renderStickies();
  if (currentTab === 'darlings') renderDarlings();
  if (currentTab === 'outline') renderOutline();
  if (currentTab === 'sources') renderSources();
  updateCounters();
  if (typeof reorderRefresh === 'function') reorderRefresh();
  restoreCaret(snap.caret); // back to work, no announcement
  if (snap.rejoin) rejoinAtCaret();
  resetNativeUndo();
}

// after undoing a double-Enter break, close the split the gesture made:
// the caret's paragraph flows back into the one above it
function rejoinAtCaret() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  let el = sel.anchorNode;
  if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
  const blk = el && el.closest ? el.closest('p') : null;
  const body = blk && blk.closest('.chapter-body');
  if (!blk || !body) return;
  const prev = blk.previousElementSibling;
  if (!prev || prev.tagName !== 'P') return;
  if (prev.classList.contains('scene-break') || blk.classList.contains('scene-break')) return;
  const chId = body.closest('.chapter').dataset.id;
  const at = prev.textContent.length;
  if (blk.textContent.trim() === '') {
    blk.remove();
  } else {
    for (const junk of blk.querySelectorAll('br')) junk.remove();
    for (const junk of prev.querySelectorAll('br')) junk.remove(); // an empty line's placeholder must not survive the merge
    while (blk.firstChild) prev.appendChild(blk.firstChild);
    blk.remove();
    try { prev.normalize(); } catch { /* fine */ }
  }
  // caret lands at the healed seam
  const w = document.createTreeWalker(prev, NodeFilter.SHOW_TEXT);
  let pos = 0, n, placed = false;
  while ((n = w.nextNode())) {
    if (at <= pos + n.data.length) {
      const r = document.createRange();
      r.setStart(n, at - pos);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      placed = true;
      break;
    }
    pos += n.data.length;
  }
  if (!placed) {
    const r = document.createRange();
    r.selectNodeContents(prev);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  syncChapter(body, chId);
}

document.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
  if ($('#editor-view').hidden || !book || !undoStack.length) return;
  const ae = document.activeElement;
  // inside text, ⌘Z belongs to typing; outside it, it belongs to structure
  if (ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
  e.preventDefault();
  structuralUndo();
});

/* ================================================================== */
/*  FIND & REPLACE                                                     */
/* ================================================================== */

let searchState = { matches: [], idx: -1, query: '' };

function openSearch() {
  if ($('#editor-view').hidden || !book) { toast(t('toast.openEssay')); return; }
  switchTab('manuscript');
  const sel = window.getSelection();
  const preset = sel && !sel.isCollapsed ? sel.toString().slice(0, 80).trim() : '';
  $('#searchbar').hidden = false;
  const inp = $('#search-input');
  if (preset) inp.value = preset;
  inp.focus();
  inp.select();
  runSearch();
}

function closeSearch() {
  $('#searchbar').hidden = true;
  searchState = { matches: [], idx: -1, query: '' };
  if (window.CSS && CSS.highlights) {
    CSS.highlights.delete('neo-search');
    CSS.highlights.delete('neo-search-current');
  }
}

function paintHighlights() {
  if (!window.Highlight || !window.CSS || !CSS.highlights) return;
  const all = new Highlight();
  const cur = new Highlight();
  searchState.matches.forEach((m, i) => {
    (i === searchState.idx ? cur : all).add(m.range);
  });
  CSS.highlights.set('neo-search', all);
  CSS.highlights.set('neo-search-current', cur);
}

// Scan the WHOLE book, first chapter to last, every time.
// Matches are highlighted, not selected.
function runSearch() {
  const q = $('#search-input').value;
  searchState = { matches: [], idx: -1, query: q };
  if (!q) {
    $('#search-count').textContent = '';
    paintHighlights();
    return;
  }
  const ql = q.toLowerCase();
  for (const chId of book.chapterOrder) {
    const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
    if (!body) continue;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const tl = node.textContent.toLowerCase();
      let pos = 0;
      while ((pos = tl.indexOf(ql, pos)) !== -1) {
        const range = document.createRange();
        range.setStart(node, pos);
        range.setEnd(node, pos + q.length);
        searchState.matches.push({ range });
        pos += q.length;
      }
    }
  }
  const n = searchState.matches.length;
  $('#search-count').textContent = n ? t('search.found', { n }) : t('search.none');
  paintHighlights();
}

// only runs when the user asks (Enter / arrows)
function gotoMatch(i) {
  const m = searchState.matches;
  if (!m.length) return;
  searchState.idx = ((i % m.length) + m.length) % m.length;
  paintHighlights();
  try {
    const rect = m[searchState.idx].range.getBoundingClientRect();
    $('#paper-scroll').scrollTop += rect.top - window.innerHeight * 0.45;
  } catch { /* range collapsed by an edit; next search rebuilds */ }
  $('#search-count').textContent = t('search.pos', { i: searchState.idx + 1, n: m.length });
}

function freshSearchIfStale() {
  if (searchState.query !== $('#search-input').value) runSearch();
}

function replaceCurrent() {
  freshSearchIfStale();
  if (!searchState.matches.length) { toast(t('search.noMatches')); return; }
  if (searchState.idx < 0) searchState.idx = 0; // start from the very first match
  const m = searchState.matches[searchState.idx];
  const rep = $('#replace-input').value;
  let chapter = null;
  try {
    chapter = m.range.startContainer.parentElement.closest('.chapter');
    m.range.deleteContents();
    if (rep) m.range.insertNode(document.createTextNode(rep));
  } catch {
    runSearch();
    return;
  }
  if (chapter) syncChapter(chapter.querySelector('.chapter-body'), chapter.dataset.id);
  const oldIdx = searchState.idx;
  runSearch();
  if (searchState.matches.length) gotoMatch(Math.min(oldIdx, searchState.matches.length - 1));
}

// Every chapter, front to back
function replaceAllMatches() {
  const q = $('#search-input').value;
  if (!q) return;
  snapshotStructure('replace all');
  const rep = $('#replace-input').value;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let n = 0;
  for (const chId of book.chapterOrder) {
    const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
    if (!body) continue;
    const nodes = [];
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    let touched = false;
    for (const nd of nodes) {
      if (nd.textContent.toLowerCase().includes(q.toLowerCase())) {
        nd.textContent = nd.textContent.replace(re, () => { n++; return rep; });
        touched = true;
      }
    }
    if (touched) syncChapter(body, chId);
  }
  if (n === 0) undoStack.pop(); // nothing changed, nothing to undo
  toast(n ? t('search.replaced', { n, undo: KZ }) : t('search.replacedNone'));
  runSearch();
}

$('#search-input').addEventListener('input', () => {
  clearTimeout(saveTimers.search);
  saveTimers.search = setTimeout(runSearch, 250);
});
$('#search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); freshSearchIfStale(); gotoMatch(searchState.idx + (e.shiftKey ? -1 : 1)); }
  if (e.key === 'Escape') { e.stopPropagation(); closeSearch(); }
  if (e.key === 'Tab' && !e.shiftKey) {
    const m = searchState.matches[Math.max(0, searchState.idx)];
    if (m) {
      e.preventDefault();
      const sel = window.getSelection();
      const r = m.range.cloneRange();
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
      const body = m.range.startContainer.parentElement.closest('.chapter-body');
      if (body) body.focus();
    }
  }
});
$('#replace-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); replaceCurrent(); }
  if (e.key === 'Escape') { e.stopPropagation(); closeSearch(); }
});
$('#search-next').onclick = () => { freshSearchIfStale(); gotoMatch(searchState.idx + 1); };
$('#search-prev').onclick = () => { freshSearchIfStale(); gotoMatch(searchState.idx - 1); };
$('#replace-one').onclick = replaceCurrent;
$('#replace-all').onclick = replaceAllMatches;
$('#search-close').onclick = closeSearch;

/* ================================================================== */
/*  IMPORT                                                             */
/* ================================================================== */

// safe in text and in quoted attributes alike
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Turn parsed manuscripts into books on a shelf — used by the file picker
// and by dropping files from Finder straight onto a shelf.
async function addImportedBooks(results, shelf) {
  shelf = shelf || firstEssayShelf();
  let ok = 0;
  for (const r of results) {
    if (r.error) { toast(t('import.failed', { name: r.name, error: r.error }), 6000); continue; }
    // title/byline harvested from the document beat the filename;
    // passing the title in gives the book folder a readable name too
    const meta = await window.neo.createBook({
      author: r.author || displayAuthor(),
      title: r.title || r.name
    });
    meta.title = r.title || r.name;
    meta.language = library.language || 'en';
    meta.tabNames = { ...(library.tabDefaults || {}) };
    let words = 0;
    meta.chapterTitles = {};
    for (const [n, ch] of r.chapters.entries()) {
      const chId = 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      if (r.titles && r.titles[n]) meta.chapterTitles[chId] = r.titles[n];
      const html = ch.map((p) =>
        p.scene ? '<p class="scene-break">***</p>' : `<p>${escHtml(p.text || '')}</p>`
      ).join('') || '<p><br></p>';
      await window.neo.writeChapter(meta.id, chId, html);
      meta.chapterOrder.push(chId);
      for (const p of ch) words += countWords(p.text || '');
    }
    meta.wordCount = words;
    await window.neo.writeBookMeta(meta.id, meta);
    shelf.bookIds.push(meta.id);
    ok++;
  }
  await window.neo.writeLibrary(library);
  if (!$('#bookshelf-view').hidden) renderShelves();
  if (ok) toast(tn('import.done', ok, { shelf: shelfName(shelf) }), 6000);
}

async function importBooks() {
  const results = await window.neo.importPick();
  if (results.length) await addImportedBooks(results, firstEssayShelf());
}

// where new essays land by default — never Mi voz
function firstEssayShelf() {
  return shelvesFor(currentAuthor().id).find((s) => !isVoiceShelf(s)) || library.shelves.find((s) => !isVoiceShelf(s)) || library.shelves[0];
}

$('#import-btn').onclick = importBooks;

/* ================================================================== */
/*  SPELLCHECK PASS + TYPEWRITER SCROLLING                             */
/* ================================================================== */

/* NEO's own spellcheck pass: a bundled dictionary (via the main process),
   squiggles painted with the CSS Highlight API — the same machinery as
   search — and a right-click menu for suggestions. Chapters scan lazily
   as the caret reaches them. */
let spellOn = false;
let spellScanned = new Set();
let spellRanges = new Map();     // key → [Range]
const spellCache = new Map();    // word → correct?

const spellNorm = (w) => w.replace(/’/g, "'").replace(/^'+|'+$/g, '');
// any letter in any script — Spanish words carry accents and ñ
const SPELL_WORD = /[\p{L}'’]+/gu;
const isSpellChar = (c) => /[\p{L}'’]/u.test(c);
// each essay is checked in its own language
const spellLang = () => (book && book.language) || library.language || 'en';
const spellKey = (w) => spellLang() + ':' + w;

function spellElFor(key) {
  return key.startsWith('aux-')
    ? $('#aux-editor')
    : document.querySelector(`.chapter[data-id="${key}"] .chapter-body`);
}

async function spellScanEl(el, key) {
  if (!el || !spellOn) return;
  spellScanned.add(key);
  const occurrences = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const re = SPELL_WORD;
  let n;
  while ((n = walker.nextNode())) {
    const p = n.parentElement;
    if (p && p.closest('.scene-break, .ghost, .ph-mark, .cite-mark')) continue;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(n.data))) {
      const word = spellNorm(m[0]);
      if (word.length < 2) continue;
      if (/^[\p{Lu}'’]+$/u.test(m[0])) continue; // acronyms and shouting are legal
      occurrences.push({ node: n, start: m.index, end: m.index + m[0].length, word });
    }
  }
  const unknown = [...new Set(occurrences.map((o) => o.word))].filter((w) => !spellCache.has(spellKey(w)));
  if (unknown.length) {
    const res = await window.neo.spellCheckWords(unknown, spellLang());
    for (const w of unknown) spellCache.set(spellKey(w), res[w] !== false);
  }
  if (!spellOn) return; // toggled off while we were checking
  const ranges = [];
  for (const o of occurrences) {
    if (spellCache.get(spellKey(o.word)) || !o.node.isConnected) continue;
    try {
      const r = new Range();
      r.setStart(o.node, o.start);
      r.setEnd(o.node, o.end);
      ranges.push(r);
    } catch { /* node changed underneath us */ }
  }
  spellRanges.set(key, ranges);
  rebuildSpellHighlight();
}

function rebuildSpellHighlight() {
  if (!spellOn) return;
  const hl = new Highlight();
  for (const list of spellRanges.values()) for (const r of list) hl.add(r);
  CSS.highlights.set('neo-spell', hl);
}

function scanSpellingIn(el, key) {
  if (!el || spellScanned.has(key)) return;
  spellScanEl(el, key);
}

// scan wherever the writer currently is
function scanSpellingHere() {
  if (currentTab === 'manuscript') {
    const body = currentChapterId && spellElFor(currentChapterId);
    if (body) scanSpellingIn(body, currentChapterId);
  } else {
    scanSpellingIn($('#aux-editor'), 'aux-' + ($('#aux-editor').dataset.kind || 'notes'));
  }
}

function scheduleSpellRescan(key, el) {
  clearTimeout(saveTimers['sp-' + key]);
  saveTimers['sp-' + key] = setTimeout(() => { if (spellOn) spellScanEl(el, key); }, 600);
}

function toggleSpellcheck() {
  spellOn = !spellOn;
  if (spellOn) {
    spellScanned = new Set();
    spellRanges = new Map();
    scanSpellingHere();
  } else {
    CSS.highlights.delete('neo-spell');
    spellRanges = new Map();
    document.querySelector('.spell-menu')?.remove();
  }
  toast(t(spellOn ? 'spell.on' : 'spell.off'));
}

// right-click a flagged word for suggestions
document.addEventListener('contextmenu', async (e) => {
  if (!spellOn || e.defaultPrevented) return;
  const editor = e.target.closest && e.target.closest('.chapter-body, #aux-editor');
  if (!editor) return;
  const pos = document.caretRangeFromPoint(e.clientX, e.clientY);
  if (!pos || pos.startContainer.nodeType !== Node.TEXT_NODE) return;
  const node = pos.startContainer;
  const text = node.data;
  let a = pos.startOffset, b = pos.startOffset;
  while (a > 0 && isSpellChar(text[a - 1])) a--;
  while (b < text.length && isSpellChar(text[b])) b++;
  if (a === b) return;
  const word = spellNorm(text.slice(a, b));
  if (spellCache.get(spellKey(word)) !== false) return; // only flagged words get our menu
  e.preventDefault();
  const chEl = editor.closest ? editor.closest('.chapter') : null;
  const key = editor.id === 'aux-editor'
    ? 'aux-' + (editor.dataset.kind || 'notes')
    : (chEl ? chEl.dataset.id : null);
  const sugg = await window.neo.spellSuggest(word, spellLang());
  showSpellMenu(e.clientX, e.clientY, word, sugg, {
    replace: (s) => {
      const sel = window.getSelection();
      const r = document.createRange();
      r.setStart(node, a); r.setEnd(node, b);
      sel.removeAllRanges(); sel.addRange(r);
      document.execCommand('insertText', false, s);
      if (key) spellScanEl(spellElFor(key), key);
    },
    learn: async () => {
      library.customWords = library.customWords || [];
      if (!library.customWords.includes(word)) library.customWords.push(word);
      await window.neo.writeLibrary(library);
      await window.neo.spellLearn(word);
      for (const lang of ['en', 'es']) spellCache.set(lang + ':' + word, true);
      for (const k of [...spellScanned]) spellScanEl(spellElFor(k), k);
    }
  });
});

function showSpellMenu(x, y, word, suggestions, actions) {
  document.querySelector('.spell-menu')?.remove();
  const menu = document.createElement('div');
  menu.className = 'spell-menu';
  if (suggestions.length) {
    for (const s of suggestions) {
      const btn = document.createElement('button');
      btn.textContent = s;
      btn.onclick = () => { menu.remove(); actions.replace(s); };
      menu.appendChild(btn);
    }
  } else {
    const none = document.createElement('button');
    none.textContent = t('spell.none');
    none.disabled = true;
    menu.appendChild(none);
  }
  const sep = document.createElement('div');
  sep.className = 'sm-sep';
  menu.appendChild(sep);
  const learn = document.createElement('button');
  learn.textContent = t('spell.learn', { word });
  learn.onclick = () => { menu.remove(); actions.learn(); };
  menu.appendChild(learn);
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - r.width - 10) + 'px';
  menu.style.top = Math.min(y + 4, window.innerHeight - r.height - 10) + 'px';
  const close = (ev) => {
    if (menu.contains(ev.target)) return;
    menu.remove();
    document.removeEventListener('mousedown', close, true);
  };
  document.addEventListener('mousedown', close, true);
}

let typewriterEnabled = false;
// The page needs empty room beneath its last line, or the caret can't be held
// at the centre once the end of the draft scrolls into view (body.typewriter
// deepens #paper's bottom margin; see styles.css).
function applyTypewriter() {
  document.body.classList.toggle('typewriter', typewriterEnabled);
}
function toggleTypewriter() {
  typewriterEnabled = !typewriterEnabled;
  library.typewriter = typewriterEnabled;
  window.neo.writeLibrary(library);
  applyTypewriter();
  toast(t(typewriterEnabled ? 'typewriter.on' : 'typewriter.off'));
}

document.addEventListener('selectionchange', () => {
  if (!typewriterEnabled || !book || currentTab !== 'manuscript') return;
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return;
  let el = sel.anchorNode;
  if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
  if (!el || !el.closest || !el.closest('.chapter-body')) return;
  requestAnimationFrame(() => {
    try {
      let rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.top === 0 && rect.height === 0)) rect = el.getBoundingClientRect();
      const diff = rect.top - window.innerHeight * 0.45;
      if (Math.abs(diff) > 6) $('#paper-scroll').scrollTop += diff;
    } catch { /* selection mid-mutation; skip this frame */ }
  });
});

/* ================================================================== */
/*  GOALS, SPRINTS, AND THE CHART                                      */
/* ================================================================== */

let sprint = null;

function statsChartSvg() {
  const W = 520, H = 200, PAD = 6;
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(writingDay(d));
  }
  const counts = book.dailyCounts || {};
  const daily = days.map((d) => counts[d] ? Math.max(0, counts[d].end - counts[d].start) : 0);
  // cumulative: carry the last known total forward
  let last = 0;
  const firstKnown = days.find((d) => counts[d]);
  if (firstKnown) last = counts[firstKnown].start;
  const cumulative = days.map((d) => {
    if (counts[d]) last = counts[d].end;
    return last;
  });
  const goal = book.wordGoal || 0;
  const maxC = Math.max(...cumulative, goal, 1);
  const maxD = Math.max(...daily, library.dailyGoal || 0, 1);
  const bw = (W - PAD * 2) / 30;

  const bars = daily.map((v, i) => {
    const h = Math.round((v / maxD) * (H * 0.45));
    return `<rect x="${(PAD + i * bw).toFixed(1)}" y="${H - PAD - h}" width="${(bw - 2).toFixed(1)}" height="${h}" rx="1.5" style="fill:color-mix(in srgb, var(--ok) 45%, var(--bg))"/>`;
  }).join('');
  const line = cumulative.map((v, i) => {
    const x = (PAD + i * bw + bw / 2).toFixed(1);
    const y = (H - PAD - (v / maxC) * (H - PAD * 2 - 20)).toFixed(1);
    return (i === 0 ? 'M' : 'L') + x + ',' + y;
  }).join(' ');
  const goalLine = goal
    ? `<line x1="${PAD}" x2="${W - PAD}" y1="${(H - PAD - (goal / maxC) * (H - PAD * 2 - 20)).toFixed(1)}" y2="${(H - PAD - (goal / maxC) * (H - PAD * 2 - 20)).toFixed(1)}" style="stroke:var(--accent)" stroke-dasharray="5,4" stroke-width="1" opacity="0.7"/>`
    : '';
  return `<svg id="stats-chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${bars}
    <path d="${line}" fill="none" style="stroke:var(--accent)" stroke-width="2"/>
    ${goalLine}
  </svg>
  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--faint);padding:2px 4px">
    <span>${t('chart.ago')}</span>
    <span style="color:var(--ok)">${t('chart.daily')}</span>
    <span style="color:var(--accent)">${t('chart.total')}${goal ? t('chart.goal') : ''}</span>
    <span>${t('chart.today')}</span>
  </div>`;
}

function openStats() {
  const hasBook = !!book;
  const today = hasBook ? (book.dailyCounts || {})[todayStr()] : null;
  const wordsToday = today ? today.end - today.start : 0;
  const total = hasBook ? bookWordCount() : 0;
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal" style="width:580px">
      <h2 style="font-size:17px">${hasBook ? escHtml(t('stats.progress', { title: displayTitle(book) })) : t('stats.title')}</h2>
      ${hasBook ? `
      <div class="stats-nums">
        <div><div class="big">${total.toLocaleString()}</div><div class="lbl">${t('stats.total')}</div></div>
        <div><div class="big">${wordsToday.toLocaleString()}</div><div class="lbl">${t('stats.today')}</div></div>
        <div><div class="big">${book.wordGoal ? Math.min(100, Math.round(total / book.wordGoal * 100)) + '%' : '—'}</div><div class="lbl">${t('stats.ofGoal')}</div></div>
      </div>
      ${statsChartSvg()}` : ''}
      <div class="stats-row" style="margin-top:18px">
        <label>${t('stats.daily')} <input id="st-daily" type="number" min="0" value="${library.dailyGoal || ''}" placeholder="500"/></label>
        ${hasBook ? `<label>${t('stats.essayGoal')} <input id="st-book" type="number" min="0" value="${book.wordGoal || ''}" placeholder="1500"/></label>` : ''}
      </div>
      <div class="stats-row">
        <label>${t('stats.dayEnds')}
          <select id="st-dayends">
            ${[0, 1, 2, 3, 4, 5, 6].map((h) => `<option value="${h}"${(library.dayEndsAt || 0) === h ? ' selected' : ''}>${h ? t('stats.am', { h }) : t('stats.midnight')}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="stats-row">
        ${hasBook ? `<label title="${t('stats.langNote')}">${t('stats.lang')}
          <select id="st-lang">
            <option value="es"${spellLang() === 'es' ? ' selected' : ''}>Español</option>
            <option value="en"${spellLang() === 'en' ? ' selected' : ''}>English</option>
          </select>
        </label>` : ''}
        <label>${t('stats.uiLang')}
          <select id="st-uilang">
            <option value="es"${I18N.lang === 'es' ? ' selected' : ''}>Español</option>
            <option value="en"${I18N.lang === 'en' ? ' selected' : ''}>English</option>
          </select>
        </label>
      </div>
      <div class="stats-row"${/Linux/.test(navigator.userAgent) ? '' : ' hidden'}>
        <label title="${t('stats.appearanceNote')}">${t('stats.appearance')}
          <select id="st-appearance">
            <option value="auto"${(library.appearance || 'auto') === 'auto' ? ' selected' : ''}>${t('stats.appearanceAuto')}</option>
            <option value="mutiny"${library.appearance === 'mutiny' ? ' selected' : ''}>${t('stats.appearanceMutiny')}</option>
          </select>
        </label>
        <span class="soft st-appearance-now">${appearanceNow.mode === 'omarchy' ? t('stats.appearanceUsing', { name: escHtml(appearanceNow.name || 'Omarchy') }) : ''}</span>
      </div>
      ${hasBook ? `
      <div class="stats-row">
        <label>${t('stats.sprint')} <input id="st-sprint" type="number" min="50" value="${sprint ? sprint.target : 500}"/> ${t('stats.words')}</label>
        <button id="st-sprint-btn">${t(sprint && !sprint.done ? 'stats.endSprint' : 'stats.startSprint')}</button>
        <span id="st-sprint-info" class="soft">${t(sprint && !sprint.done ? 'stats.sprintRunning' : 'stats.sprintIdle')}</span>
      </div>` : ''}
      <div class="stats-row">
        <label>${t('stats.newEssays')}
          <select id="st-style">
            <option value="pantser"${library.writingStyle !== 'plotter' ? ' selected' : ''}>${t('stats.pantser')}</option>
            <option value="plotter"${library.writingStyle === 'plotter' ? ' selected' : ''}>${t('stats.plotter')}</option>
          </select>
        </label>
      </div>

      <div style="text-align:right;margin-top:14px">
        <button class="m-ok btn-gold">${t('common.done')}</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  const close = async () => {
    const uiLang = bd.querySelector('#st-uilang').value;
    if (uiLang !== I18N.lang) {
      await setLanguage(uiLang);
      if (hasBook) refreshEditorLanguage();
    }
    library.dailyGoal = parseInt(bd.querySelector('#st-daily').value, 10) || 0;
    library.dayEndsAt = parseInt(bd.querySelector('#st-dayends').value, 10) || 0;
    library.writingStyle = bd.querySelector('#st-style').value;
    if (hasBook) {
      book.wordGoal = parseInt(bd.querySelector('#st-book').value, 10) || 0;
      const lang = bd.querySelector('#st-lang').value;
      if (lang !== spellLang()) {
        book.language = lang;
        if (spellOn) { toggleSpellcheck(); toggleSpellcheck(); } // rescan in the new language
      }
      scheduleMetaSave();
    }
    await window.neo.writeLibrary(library);
    bd.remove();
    if (hasBook) updateCounters();
  };
  bd.querySelector('.m-ok').onclick = close;
  bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  // the appearance switches at once, so the writer sees what they chose
  bd.querySelector('#st-appearance').onchange = async (e) => {
    library.appearance = e.target.value;
    await window.neo.writeLibrary(library);
    const now = await applyAppearance();
    bd.querySelector('.st-appearance-now').textContent = now.mode === 'omarchy' ? t('stats.appearanceUsing', { name: now.name || 'Omarchy' })
      : e.target.value === 'auto' ? t('stats.appearanceNone') : '';
  };
  if (hasBook) {
    bd.querySelector('#st-sprint-btn').onclick = () => {
      if (sprint && !sprint.done) {
        const got = bookWordCount() - sprint.startCount;
        toast(t('sprint.ended', { words: tn('count.words', got), min: Math.round((Date.now() - sprint.startTime) / 60000) }));
        sprint = null;
      } else {
        const target = parseInt(bd.querySelector('#st-sprint').value, 10) || 500;
        sprint = { target, startCount: bookWordCount(), startTime: Date.now(), done: false };
        toast(t('sprint.started', { words: tn('count.words', target) }));
      }
      close();
    };
  }
}

$('#goal-counter').onclick = openStats;

// after a language switch mid-essay, redraw what the editor has on screen
function refreshEditorLanguage() {
  $$('.tab[data-tab="notes"]')[0].textContent = tabName('notes');
  $$('.tab[data-tab="outline"]')[0].textContent = tabName('outline');
  $('#tp-author').textContent = displayName(book.author);
  renderChapters();
  renderStickies();
  updateCounters();
  if (currentTab !== 'manuscript') switchTab(currentTab);
}

/* ================================================================== */
/*  MENU: Help + fonts                                                 */
/* ================================================================== */

// Bundled with the app (fonts/, SIL OFL), so every OS shows the same page.
// Keep in step with the Format → Body Font menu in main.js.
const BODY_FONTS = {
  'Literata': "'Mutiny Literata', Georgia, serif",
  'Source Serif': "'Mutiny Source Serif 4', Georgia, serif",
  'Lora': "'Mutiny Lora', Georgia, serif",
  'EB Garamond': "'Mutiny EB Garamond', Garamond, Georgia, serif",
  'iA Writer Quattro': "'Mutiny iA Writer Quattro', 'iA Writer Quattro S', sans-serif",
  'iA Writer Duo': "'Mutiny iA Writer Duo', 'iA Writer Duo S', monospace"
};
const DEFAULT_BODY_FONT = 'Literata';
// a font installed on this computer is stored as "system:<family>" — it
// doesn't travel with the library, so a stack falls back to the default
const SYSTEM_FONT = 'system:';
function fontStack(name) {
  if (name && name.startsWith(SYSTEM_FONT)) {
    return `"${name.slice(SYSTEM_FONT.length).replace(/["\\]/g, '')}", ${BODY_FONTS[DEFAULT_BODY_FONT]}`;
  }
  return BODY_FONTS[name] || BODY_FONTS[DEFAULT_BODY_FONT];
}
const fontLabel = (name) => (name && name.startsWith(SYSTEM_FONT) ? name.slice(SYSTEM_FONT.length) : name);

// Families installed on this computer (Local Font Access), icon fonts left out.
let systemFamilies = null;
async function listSystemFonts() {
  if (systemFamilies) return systemFamilies;
  try {
    const fonts = await window.queryLocalFonts();
    const skip = /awesome|emoji|symbol|icon|nerd font|dingbat|^d05|omarchy|wingding|webdings/i;
    systemFamilies = [...new Set(fonts.map((f) => f.family))]
      .filter((f) => !skip.test(f))
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    window.neo.logError('local fonts: ' + err);
    systemFamilies = [];
  }
  return systemFamilies;
}

// Pick any installed font, previewed live on the page. Resolves to the
// stored name ("system:<family>") or null.
function pickSystemFont(current) {
  return new Promise(async (resolve) => {
    let families = [];
    const root = document.documentElement.style;
    const before = root.getPropertyValue('--body-font');
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `
      <div class="modal" style="width:460px">
        <h2 style="font-size:16px">${t('font.systemTitle')}</h2>
        <p class="soft" style="margin-bottom:10px">${t('font.systemNote')}</p>
        <input type="text" class="sf-search" spellcheck="false" placeholder="${t('font.search')}" />
        <div class="sf-list"></div>
        <div style="text-align:right;margin-top:14px">
          <button class="m-cancel btn-quiet">${t('common.cancel')}</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    const list = bd.querySelector('.sf-list');
    const done = (val) => { if (!val) root.setProperty('--body-font', before); bd.remove(); resolve(val); };
    const draw = (q) => {
      if (!systemFamilies) { list.innerHTML = `<div class="soft">…</div>`; return; }
      list.innerHTML = '';
      const shown = families.filter((f) => f.toLowerCase().includes(q.toLowerCase()));
      if (!shown.length) list.innerHTML = `<div class="soft">${t(families.length ? 'font.noMatch' : 'font.none')}</div>`;
      for (const fam of shown) {
        const b = document.createElement('button');
        b.className = 'sf-item' + (current === SYSTEM_FONT + fam ? ' sel' : '');
        b.textContent = fam;
        b.style.fontFamily = `"${fam.replace(/"/g, '')}"`;
        b.onmouseenter = () => root.setProperty('--body-font', fontStack(SYSTEM_FONT + fam));
        b.onclick = () => done(SYSTEM_FONT + fam);
        list.appendChild(b);
      }
    };
    const search = bd.querySelector('.sf-search');
    search.oninput = () => draw(search.value);
    list.onmouseleave = () => root.setProperty('--body-font', before);
    bd.querySelector('.m-cancel').onclick = () => done(null);
    bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
    draw('');
    search.focus();
    // the first read of the system's fonts takes a moment — the dialog is up meanwhile
    families = await listSystemFonts();
    if (bd.isConnected) draw(search.value);
  });
}

function applyFonts() {
  const f = library.fonts || {};
  document.documentElement.style.setProperty('--body-font', fontStack(f.body));
  document.body.classList.toggle('night', library.pageTheme === 'night');
  document.body.classList.toggle('bright', !!library.uiBright);
  const size = Math.min(22, Math.max(14, library.editorFontSize || 17));
  document.documentElement.style.setProperty('--editor-size', size + 'px');
  const zoom = Math.min(1.6, Math.max(0.75, library.pageZoom || 1));
  document.documentElement.style.setProperty('--page-zoom', zoom);
  updateZoomDisplay();
}

// Pinch (trackpad) or Ctrl+scroll: page and text zoom together.
// A pinch arrives as a wheel event with ctrlKey set.
let zoomSaveTimer = null;
function updateZoomDisplay() {
  const el = $('#zoom-level');
  if (el) el.textContent = Math.round((library.pageZoom || 1) * 100) + '%';
}
function setPageZoom(next) {
  next = Math.min(1.6, Math.max(0.75, next));
  if (next === (library.pageZoom || 1)) return;
  library.pageZoom = next;
  document.documentElement.style.setProperty('--page-zoom', next);
  updateZoomDisplay();
  clearTimeout(zoomSaveTimer);
  zoomSaveTimer = setTimeout(() => { window.neo.writeLibrary(library); }, 600);
}
$('#editor-view').addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  setPageZoom((library.pageZoom || 1) * Math.exp(-e.deltaY * 0.005));
}, { passive: false });

// zoom control in the bottom bar: buttons, click-to-reset, and scroll
$('#zoom-in').onclick = () => setPageZoom((library.pageZoom || 1) + 0.1);
$('#zoom-out').onclick = () => setPageZoom((library.pageZoom || 1) - 0.1);
$('#zoom-level').onclick = () => setPageZoom(1);
$('#zoom-control').addEventListener('wheel', (e) => {
  e.preventDefault();
  setPageZoom((library.pageZoom || 1) * Math.exp(-e.deltaY * 0.002));
}, { passive: false });

// Format → Align Paragraph: applies to every paragraph the selection touches
function applyAlign(value) {
  if (!book || currentTab !== 'manuscript') { toast(t('toast.clickParagraph')); return; }
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  let el = r.startContainer;
  if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
  const body = el && el.closest ? el.closest('.chapter-body') : null;
  if (!body) { toast(t('toast.clickParagraph')); return; }
  const chId = body.closest('.chapter').dataset.id;
  const ps = [...body.querySelectorAll('p')].filter(
    (p) => r.intersectsNode(p) && !p.classList.contains('scene-break')
  );
  for (const p of ps) {
    if (value === 'left') p.style.removeProperty('text-align');
    else p.style.textAlign = value;
    if (!p.getAttribute('style')) p.removeAttribute('style');
  }
  syncChapter(body, chId);
}

function showHelp() {
  const row = (k, d) => `<span class="hk">${k}</span><span>${d}</span>`;
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal" style="width:560px">
      <h2>${t('help.title')}</h2>

      <div class="help-sec">${t('help.writing')}</div>
      <div class="help-grid">
        ${row(t('help.enter2'), t('help.enter2Desc'))}
        ${row(t('help.enter3'), t('help.enter3Desc'))}
        ${row(KPH, t('help.mark'))}
        ${row(KDA, t('help.later'))}
        ${row(KCITE, t('help.cite'))}
        ${row(K('⌘⇧M', 'Ctrl+Shift+M'), t('help.rewrite'))}
        ${row(K('⌘⇧C', 'Ctrl+Shift+C'), t('help.critique'))}
        ${row(K('⌘⇧A', 'Ctrl+Shift+A'), t('help.chat'))}
        ${row(K('⌘⇧O', 'Ctrl+Shift+O'), t('help.reorder'))}
        ${row(KZ, t('help.undo'))}
        ${row(t('help.dashesKey'), t('help.dashes'))}
        ${row(K('⌘B · ⌘I', 'Ctrl+B · Ctrl+I'), t('help.bold'))}
      </div>

      <div class="help-sec">${t('help.around')}</div>
      <div class="help-grid">
        ${row(K('⌘F', 'Ctrl+F'), t('help.find'))}
        ${row(t('help.edgesKey'), t('help.edges'))}
        ${row('Esc', t('help.esc'))}
      </div>

      <div class="help-sec">${t('help.modes')}</div>
      <div class="help-grid">
        ${row(K('⌘⇧F', 'Ctrl+Shift+F'), t('help.fullscreen'))}
        ${row(K('⌘⇧T', 'Ctrl+Shift+T'), t('help.typewriter'))}
        ${row(K('⌘;', 'Ctrl+;'), t('help.spell'))}
      </div>

      <div class="help-sec">${t('help.files')}</div>
      <div class="help-grid">
        ${row(K('⌘E', 'Ctrl+E'), t('help.email'))}
        ${row(K('⌘⇧I', 'Ctrl+Shift+I'), t('help.import'))}
        ${row(t('help.exportKey'), 'txt · md · html · pdf · docx')}
      </div>

      <div class="help-sec">${t('help.mouse')}</div>
      <div class="help-grid">
        ${row(t('help.dragTextKey'), t('help.dragText'))}
        ${row(t('help.rightClickKey'), t('help.rightClick'))}
        ${row(t('help.dragSectionsKey'), t('help.dragSections'))}
        ${row(t('help.dblClickKey'), t('help.dblClick'))}
        ${row(t('help.countersKey'), t('help.counters'))}
        ${row(K('Pinch', t('help.ctrlScroll')), t('help.zoom', { reset: K('⌘0', 'Ctrl+0') }))}
        ${row(t('help.zoomControlKey'), t('help.zoomControl'))}
      </div>

      <div style="text-align:right;margin-top:18px">
        <button class="m-ok btn-gold">${t('help.gotIt')}</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  const close = () => bd.remove();
  bd.querySelector('.m-ok').onclick = close;
  bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  bd.querySelector('.m-ok').focus();
}

/* ================================================================== */
/*  EXPORT + EMAIL                                                     */
/* ================================================================== */

function safeName(s) {
  return (s || 'Untitled').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

// Every paragraph is rebuilt from its text runs, so exports carry only
// author-meaningful markup: text, bold, italic, alignment, scene breaks.
// Stray spans, inline styles, trailing <br>s, and no-break spaces all
// stop at this door.
function parasFromHtml(html) {
  const holder = inertDiv(html);
  // an unwritten outline line is a ghost paragraph plus the *** break
  // planted for it; neither belongs in an export
  holder.querySelectorAll('p.ghost[data-sec-id]').forEach((g) => {
    const brk = holder.querySelector(`p.scene-break[data-sec-brk="${g.dataset.secId}"]`);
    if (brk) brk.remove();
  });
  holder.querySelectorAll('.darling-anchor, .ph-mark, .ghost').forEach((n) => n.remove());
  return [...holder.querySelectorAll('p')].map((p) => {
    const sceneBreak = p.classList.contains('scene-break');
    const align = (p.style && p.style.textAlign) || '';
    // text runs plus [n] flags; the words alone make the paragraph's text
    const runs = paraRuns(p.innerHTML).filter((r) => r.text || r.citeMark);
    const text = runs.filter((r) => r.text).map((r) => r.text).join('').trim();
    return { sceneBreak, text, runs, align };
  }).filter((p) => p.sceneBreak || p.text);
}

// A paragraph's runs as pieces for the builders: plain text runs, cited
// groups (consecutive runs citing one source) and bare [n] flags.
function citePieces(runs) {
  const out = [];
  for (const r of runs) {
    if (r.citeMark) { out.push({ mark: r.citeMark }); continue; }
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (r.src && last && last.src === r.src) last.runs.push(r);
    else if (r.src) out.push({ src: r.src, runs: [r] });
    else out.push({ run: r });
  }
  return out;
}

// Number the sources an export actually cites, by first appearance.
function citeIndex(d) {
  const byId = new Map((d.sources || []).map((s) => [s.id, s]));
  const nums = new Map();
  const list = [];
  for (const ch of d.sections) for (const p of ch.paras) for (const r of p.runs || []) {
    const id = r.src || r.citeMark;
    if (id && byId.has(id) && !nums.has(id)) { nums.set(id, list.length + 1); list.push(byId.get(id)); }
  }
  return { nums, list, get: (id) => (nums.has(id) ? { n: nums.get(id), s: byId.get(id) } : null) };
}

// "2025", "2025-03" or "2025-03-01" as a reader writes it, in the document's
// language; anything else the writer typed is left as typed
function readableDate(v, lang) {
  const m = String(v || '').trim().match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return String(v || '').trim();
  if (!m[2]) return m[1];
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1)));
  const opts = m[3] ? { day: 'numeric', month: 'long', year: 'numeric' } : { month: 'long', year: 'numeric' };
  try { return new Intl.DateTimeFormat(lang, { ...opts, timeZone: 'UTC' }).format(d); } catch { return v; }
}

// One bibliography entry in plain text, in the document's language:
// Author. “Title”. Site, date. URL (accessed …).
function sourceEntry(s, lang) {
  const parts = [];
  if (s.author) parts.push(s.author);
  if (s.title) parts.push(s.kind === 'book' ? s.title : `“${s.title}”`);
  const where = [s.site, readableDate(s.published, lang)].filter(Boolean).join(', ');
  if (where) parts.push(where);
  let out = parts.join('. ');
  // no doubled stop after a title that ends in its own (“Why?”, “…end.”)
  if (out) out = (out + '.').replace(/([.?!])\.$/, '$1').replace(/([.?!])”\./g, '$1”');
  if (s.url) {
    out += (out ? ' ' : '') + s.url;
    if (s.accessed && s.kind !== 'book') out += ' (' + te(lang, 'export.accessed', { date: readableDate(s.accessed, lang) }) + ')';
  }
  return out;
}

function exportChapters() {
  // [{num, heading, paras: [{text, sceneBreak, html}]}]
  return book.chapterOrder.map((chId, i) => {
    const el = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
    const paras = parasFromHtml(el ? el.innerHTML : (chapterHTML[chId] || ''));
    // a section's heading is its title; untitled sections just flow on
    const heading = ((book.chapterTitles || {})[chId] || '').trim();
    return { num: i + 1, heading, paras };
  });
}

// The open book, packaged for the builders. Every builder takes an optional
// data object in this shape, good for anthologies.
function bookExportData() {
  const lang = spellLang(); // the essay's own language, not the interface's
  return {
    id: book.id,
    lang,
    title: book.title && book.title !== 'Untitled' ? book.title : te(lang, 'tp.title'),
    subtitle: book.subtitle,
    author: book.author && book.author !== 'Anonymous' ? book.author : te(lang, 'author.anonymous'),
    coverSeed: book.coverSeed,
    coverImage: book.coverImage || null,
    sources: sources.filter((s) => s.status !== 'candidate'),
    sections: exportChapters()
  };
}

function buildTxt(data) {
  const d = data || bookExportData();
  let out = `${d.title.toUpperCase()}\n`;
  if (d.subtitle) out += `${d.subtitle}\n`;
  out += te(d.lang, 'export.by', { author: d.author }) + '\n\n\n';
  const cx = citeIndex(d);
  const num = (id) => { const c = cx.get(id); return c ? `[${c.n}]` : ''; };
  const line = (p) => citePieces(p.runs).map((pc) =>
    pc.mark ? num(pc.mark) : pc.src ? pc.runs.map((r) => r.text).join('') + num(pc.src) : pc.run.text).join('').trim();
  for (const ch of d.sections) {
    if (ch.heading) out += `${ch.heading.toUpperCase()}\n\n`;
    for (const p of ch.paras) out += p.sceneBreak ? '\n***\n\n' : line(p) + '\n\n';
    out += '\n';
  }
  if (cx.list.length) {
    out += te(d.lang, 'export.sources').toUpperCase() + '\n\n';
    cx.list.forEach((s, i) => { out += `${i + 1}. ${sourceEntry(s, d.lang)}\n`; });
  }
  return out;
}

function buildMd(data) {
  const d = data || bookExportData();
  // wrap a run in emphasis markers, keeping boundary spaces outside them
  const mdRun = (r) => {
    let t = r.text.replace(/([\\*_`\[\]])/g, '\\$1');
    const mark = r.b && r.i ? '***' : r.b ? '**' : r.i ? '*' : '';
    if (!mark) return t;
    const lead = t.match(/^\s*/)[0];
    const trail = t.match(/\s*$/)[0];
    const core = t.slice(lead.length, t.length - trail.length);
    return core ? lead + mark + core + mark + trail : t;
  };
  let out = `# ${d.title}\n\n`;
  if (d.subtitle) out += `*${d.subtitle}*\n\n`;
  out += `**${te(d.lang, 'export.by', { author: d.author })}**\n\n`;
  // cited words become a link with a footnote; a bare [n] is the footnote alone
  const cx = citeIndex(d);
  const note = (id) => { const c = cx.get(id); return c ? `[^${c.n}]` : ''; };
  const line = (p) => citePieces(p.runs).map((pc) => {
    if (pc.mark) return note(pc.mark);
    if (!pc.src) return mdRun(pc.run);
    const words = pc.runs.map(mdRun).join('');
    const c = cx.get(pc.src);
    return (c && c.s.url ? `[${words}](${c.s.url.replace(/[()\s]/g, encodeURIComponent)})` : words) + note(pc.src);
  }).join('');
  for (const ch of d.sections) {
    if (ch.heading) out += `\n## ${ch.heading}\n\n`;
    for (const p of ch.paras) {
      out += p.sceneBreak ? '\n***\n\n' : line(p) + '\n\n';
    }
  }
  if (cx.list.length) {
    out += '\n';
    cx.list.forEach((s, i) => { out += `[^${i + 1}]: ${sourceEntry(s, d.lang).replace(/([\\*_`])/g, '\\$1')}\n`; });
  }
  return out;
}

function buildHtml(data, opts = {}) {
  const d = data || bookExportData();
  const total = d.sections.reduce((s, ch) => s + ch.paras.reduce((n, p) => n + countWords(p.text || ''), 0), 0);
  const stamp = new Date().toLocaleString(d.lang);
  const cx = citeIndex(d);
  const styled = (r) => {
    let t = escHtml(r.text);
    if (r.i) t = '<i>' + t + '</i>';
    if (r.b) t = '<b>' + t + '</b>';
    return t;
  };
  const sup = (id) => { const c = cx.get(id); return c ? `<sup class="cn"><a href="#src-${c.n}">${c.n}</a></sup>` : ''; };
  const inner = (p) => citePieces(p.runs).map((pc) => {
    if (pc.mark) return sup(pc.mark);
    if (!pc.src) return styled(pc.run);
    const words = pc.runs.map(styled).join('');
    const c = cx.get(pc.src);
    return (c && c.s.url ? `<a href="${escHtml(c.s.url).replace(/"/g, '&quot;')}">${words}</a>` : words) + sup(pc.src);
  }).join('');
  const chaptersHtml = d.sections.map((ch) => {
    // the section's opening paragraph (and the one after a break) starts flush
    let first = true;
    const paras = ch.paras.map((p) => {
      if (p.sceneBreak) return '<p class="brk">***</p>';
      const cls = first ? ' class="first"' : '';
      first = false;
      return `<p${cls}${p.align ? ` style="text-align:${p.align}"` : ''}>${inner(p)}</p>`;
    }).join('\n');
    return `
    <section class="chapter">
      ${ch.heading ? `<h2>${escHtml(ch.heading)}</h2>` : ''}
      ${paras}
    </section>`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="${d.lang || 'en'}"><head><meta charset="utf-8"><title>${escHtml(d.title)}</title>
<style>
  body { font-family: Georgia, serif; color: #1c1c1c; max-width: 620px; margin: 40px auto; line-height: 1.7; font-size: 13pt; }
  .titlepage { margin: 0 0 2.2em; }
  .titlepage h1 { font-size: 26pt; line-height: 1.2; margin: 0; }
  .titlepage .sub { font-style: italic; color: #555; margin: 0.4em 0 0; font-size: 14pt; }
  .titlepage .auth { margin-top: 1.4em; letter-spacing: 2px; text-transform: uppercase; font-size: 9.5pt; color: #555; }
  .chapter { margin-top: 1.8em; }
  .chapter h2 { font-size: 15pt; margin: 0 0 0.7em; break-after: avoid; }
  .chapter p { text-indent: 2em; margin: 0; }
  .chapter h2 + p, .brk + p, .chapter p.first { text-indent: 0; }
  .brk { text-align: center; text-indent: 0 !important; letter-spacing: 8px; color: #888; margin: 2.5em 0; }
  .prov { margin-top: 80px; text-align: center; color: #999; font-size: 9pt; }
  a { color: inherit; text-decoration-color: #999; }
  sup.cn { font-size: 0.65em; line-height: 0; }
  sup.cn a { text-decoration: none; color: #8a7a55; }
  .sources { margin-top: 3em; font-size: 10.5pt; line-height: 1.5; }
  .sources h2 { font-size: 13pt; margin: 0 0 0.8em; }
  .sources ol { padding-left: 1.6em; }
  .sources li { margin-bottom: 0.5em; overflow-wrap: anywhere; }
</style></head><body>
<div class="titlepage"><h1>${escHtml(d.title)}</h1>
${d.subtitle ? `<p class="sub">${escHtml(d.subtitle)}</p>` : ''}
<p class="auth">${escHtml(d.author)}</p></div>
${chaptersHtml}
${cx.list.length ? `<section class="sources"><h2>${escHtml(te(d.lang, 'export.sources'))}</h2><ol>
${cx.list.map((s, i) => `<li id="src-${i + 1}">${escHtml(sourceEntry(s, d.lang))}</li>`).join('\n')}
</ol></section>` : ''}
${opts.stamp ? `<p class="prov">${escHtml(te(d.lang, 'export.stamp', { words: tn('count.words', total), date: stamp }))}</p>` : ''}
</body></html>`;
}

/* ---------- runs: paragraphs broken into styled text pieces ---------- */

const escXml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Walk a paragraph's DOM and emit [{text, b, i, src}] so exports get real
// bold/italic and citations; ⚑ marks come out as {mark}, [n] flags as {citeMark}
function paraRuns(pHtml) {
  const holder = inertDiv(pHtml);
  const runs = [];
  const walk = (node, b, i, src) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent) runs.push({ text: child.textContent.replace(/\u00a0/g, ' '), b, i, src });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const cls = child.classList;
        if (cls && cls.contains('ph-mark')) {
          runs.push({ mark: child.dataset.sid || '', ai: cls.contains('ai') });
          continue;
        }
        if (cls && cls.contains('cite-mark')) {
          if (child.dataset.src) runs.push({ citeMark: child.dataset.src });
          continue;
        }
        const tag = child.tagName;
        const inner = cls && cls.contains('cite') && child.dataset.src ? child.dataset.src : src;
        walk(child, b || tag === 'B' || tag === 'STRONG', i || tag === 'I' || tag === 'EM', inner);
      }
    }
  };
  walk(holder, false, false, undefined);
  return runs;
}

/* ---------- DOCX ---------- */

function docxP(runs, opts = {}) {
  const pPr = [];
  if (opts.pageBreak) pPr.push('<w:pageBreakBefore/>');
  if (opts.align) pPr.push(`<w:jc w:val="${opts.align}"/>`);
  if (opts.indent) pPr.push('<w:ind w:firstLine="480"/>');
  if (opts.spaceBefore) pPr.push(`<w:spacing w:before="${opts.spaceBefore}" w:line="360" w:lineRule="auto"/>`);
  const rXml = runs.map((r) => {
    const rPr = (r.b ? '<w:b/>' : '') + (r.i ? '<w:i/>' : '') + (r.sup ? '<w:vertAlign w:val="superscript"/>' : '') +
      (opts.size ? `<w:sz w:val="${opts.size}"/>` : '');
    return `<w:r>${rPr ? '<w:rPr>' + rPr + '</w:rPr>' : ''}<w:t xml:space="preserve">${escXml(r.text)}</w:t></w:r>`;
  }).join('');
  return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${rXml}</w:p>`;
}

function buildDocxEntries(data) {
  const d = data || bookExportData();
  const body = [];
  const cx = citeIndex(d);
  // runs with each citation's number as a superscript run after it
  const citedRuns = (p) => citePieces(p.runs).flatMap((pc) => {
    const n = (id) => { const c = cx.get(id); return c ? [{ text: String(c.n), sup: true }] : []; };
    if (pc.mark) return n(pc.mark);
    if (pc.src) return [...pc.runs, ...n(pc.src)];
    return [pc.run];
  });
  // title page
  body.push(docxP([{ text: d.title, b: true }], { size: 48 }));
  if (d.subtitle) body.push(docxP([{ text: d.subtitle, i: true }], { size: 28 }));
  body.push(docxP([{ text: d.author }], { spaceBefore: 240, size: 20 }));
  d.sections.forEach((ch, i) => {
    if (ch.heading) {
      body.push(docxP([{ text: ch.heading, b: true }], { spaceBefore: 480, size: 30 }));
    } else if (i > 0) {
      body.push(docxP([], {})); // an untitled section still gets a breath
    }
    for (const p of ch.paras) {
      if (p.sceneBreak) body.push(docxP([{ text: '***' }], { align: 'center', spaceBefore: 240 }));
      else if (p.align === 'center' || p.align === 'right') body.push(docxP(citedRuns(p), { align: p.align }));
      else body.push(docxP(citedRuns(p), { indent: true }));
    }
  });
  if (cx.list.length) {
    body.push(docxP([{ text: te(d.lang, 'export.sources'), b: true }], { spaceBefore: 600, size: 26 }));
    cx.list.forEach((s, i) => body.push(docxP([{ text: `${i + 1}. ${sourceEntry(s, d.lang)}` }], { size: 20 })));
  }
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
</w:styles>`;
  return [
    { path: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>` },
    { path: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>` },
    { path: 'word/_rels/document.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
    { path: 'word/document.xml', content: documentXml },
    { path: 'word/styles.xml', content: stylesXml }
  ];
}

/* ---------- ANTHOLOGY: a whole shelf becomes one book ---------- */

// Read every book on a shelf from disk and merge into export sections.
// Each story's title becomes its TOC entry; multi-chapter works keep
// their chapters as continuation sections.
async function shelfExportData(shelf, anthologyTitle) {
  const sections = [];
  const allSources = [];
  let num = 0;
  for (const bookId of shelf.bookIds) {
    const meta = await window.neo.readBookMeta(bookId);
    if (!meta || !meta.chapterOrder) continue;
    const ns = (id) => bookId + '/' + id;
    for (const s of await window.neo.readJSON(bookId, 'sources', [])) {
      if (s.status !== 'candidate') allSources.push({ ...s, id: ns(s.id) });
    }
    const multi = meta.chapterOrder.length > 1;
    for (let i = 0; i < meta.chapterOrder.length; i++) {
      const html = await window.neo.readChapter(bookId, meta.chapterOrder[i]);
      const paras = parasFromHtml(html);
      if (!paras.length) continue;
      for (const p of paras) for (const r of p.runs) {
        if (r.src) r.src = ns(r.src);
        if (r.citeMark) r.citeMark = ns(r.citeMark);
      }
      num++;
      const t = ((meta.chapterTitles || {})[meta.chapterOrder[i]] || '').trim();
      const heading = !multi || i === 0 ? meta.title : (t ? `${meta.title} — ${t}` : '');
      sections.push({ num, heading, paras });
    }
  }
  return {
    id: 'shelf-' + shelf.id,
    lang: library.language || 'en',
    title: anthologyTitle,
    subtitle: '',
    author: displayAuthor(),
    coverSeed: shelf.id + ':' + anthologyTitle,
    sources: allSources,
    sections
  };
}

async function exportShelfAnthology(shelf) {
  if (!shelf.bookIds.length) { toast(t('collection.empty')); return; }
  const title = await askInput(t('collection.titleQ'), t('collection.titleHint'), shelfName(shelf));
  if (title === null) return;
  const format = await optionModal(t('collection.formatQ'), null, [
    { label: t('collection.docx'), desc: t('collection.docxDesc'), value: 'docx' },
    { label: t('collection.pdf'), desc: t('collection.pdfDesc'), value: 'pdf' }
  ]);
  if (!format) return;
  toast(t('collection.collecting'));
  const data = await shelfExportData(shelf, title || shelfName(shelf));
  if (!data.sections.length) { toast(t('collection.noWords')); return; }
  const defaultName = safeName(data.title);
  let payload;
  if (format === 'docx') payload = { format, defaultName, zipEntries: buildDocxEntries(data) };
  else payload = { format: 'pdf', defaultName, content: buildHtml(data) };
  const saved = await window.neo.exportSave(payload);
  if (saved) toast(tn('collection.done', shelf.bookIds.length, { file: saved.split(/[\\/]/).pop() }), 6000);
}

async function doExport(format) {
  if (!book) { toast(t('toast.openEssay')); return; }
  flushAllSaves();
  const defaultName = safeName(book.title);
  let payload;
  if (format === 'docx') payload = { format, defaultName, zipEntries: buildDocxEntries() };
  else if (format === 'txt') payload = { format, defaultName, content: buildTxt() };
  else if (format === 'md') payload = { format, defaultName, content: buildMd() };
  else payload = { format, defaultName, content: buildHtml() };
  const saved = await window.neo.exportSave(payload);
  if (saved) toast(t('export.done', { file: saved.split(/[\\/]/).pop() }));
}

function chooseEmailMethod() {
  // Apple Mail only exists on Macs; elsewhere Gmail
  if (!navigator.platform.toLowerCase().includes('mac')) return Promise.resolve('gmail');
  return new Promise((resolve) => {
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `
      <div class="modal" style="width:440px">
        <h2 style="font-size:16px">${t('email.methodQ')}</h2>
        <div class="fr-choices" style="margin-top:14px">
          <button class="fr-choice" data-m="gmail">
            <strong>Gmail</strong>
            <span>${t('email.gmailDesc')}</span>
          </button>
          <button class="fr-choice" data-m="mail">
            <strong>Apple Mail</strong>
            <span>${t('email.mailDesc')}</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    bd.querySelectorAll('.fr-choice').forEach((b) => {
      b.onclick = () => { bd.remove(); resolve(b.dataset.m); };
    });
  });
}

async function emailSettings() {
  const addr = await askInput(t('email.toQ'), 'you@example.com', library.emailAddress || '');
  if (addr === null) return false;
  if (addr) library.emailAddress = addr;
  library.emailMethod = await chooseEmailMethod();
  await window.neo.writeLibrary(library);
  toast(t('email.saved'));
  return true;
}

async function manuscriptHash() {
  // SHA-256 of the manuscript text: a fingerprint for your provenance trail
  const text = book.title + '\n' + book.chapterOrder.map((c) => chapterText(c)).join('\n');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function doEmailDraft() {
  if (!book) { toast(t('toast.openEssay')); return; }
  flushAllSaves();
  if (!library.emailAddress || !library.emailMethod) {
    const ok = await emailSettings();
    if (!ok) return;
  }
  const total = bookWordCount();
  const words = tn('count.words', total);
  const subject = t('email.subject', { title: displayTitle(book), words, date: new Date().toLocaleDateString(I18N.lang) });
  const hash = await manuscriptHash();
  const body = t('email.body1', { title: displayTitle(book), words }) + '\n'
    + t('email.body2', { date: new Date().toLocaleString(I18N.lang) }) + '\n\n'
    + t('email.body3') + '\n' + hash + '\n\n'
    + t(library.emailMethod === 'gmail' ? 'email.bodyGmail' : 'email.bodyMail');
  toast(t('email.preparing'));
  const res = await window.neo.emailDraft({
    to: library.emailAddress,
    subject,
    body,
    html: buildHtml(null, { stamp: true }), // the email snapshot is a provenance record
    defaultName: safeName(book.title),
    method: library.emailMethod
  });
  if (res.method === 'gmail') toast(t('email.gmailOpened'), 8000);
  else if (res.ok) toast(t('email.mailDone'));
  else toast(t('email.unavailable'));
}

// Help → Check for Update…: on-demand release lookup, only ever runs on a click
async function checkForUpdate() {
  const res = await window.neo.checkForUpdate();
  if (res.error) { toast(t('update.failed')); return; }
  if (!res.hasUpdate) { toast(t('update.latest', { v: res.currentVersion })); return; }
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal" style="width:380px">
      <h2 style="font-size:16px">${t('update.available', { v: escHtml(res.latestVersion) })}</h2>
      <p>${t('update.have', { v: escHtml(res.currentVersion) })}</p>
      <div style="text-align:right;margin-top:14px">
        <button class="m-cancel btn-quiet" style="margin-right:10px">${t('update.later')}</button>
        <button class="m-ok btn-gold">${t('update.view')}</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  const close = () => bd.remove();
  bd.querySelector('.m-cancel').onclick = close;
  bd.querySelector('.m-ok').onclick = () => { window.neo.openRelease(); close(); };
  bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
}

// Help → About Mutiny: the version, plainly — and where it came from
async function showAbout() {
  const v = await window.neo.appVersion();
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal" style="width:340px;text-align:center">
      <h2 style="font-size:22px;letter-spacing:6px">MUTINY</h2>
      <p style="color:var(--muted)">${t('about.version', { v })}</p>
      <p style="font-size:13px;color:var(--faint)">${t('about.tagline')}</p>
      <p style="font-size:12px;color:#666">${t('about.credit')}</p>
      <div style="margin-top:16px">
        <button class="m-ok btn-gold">${t('about.back')}</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  const close = () => bd.remove();
  bd.querySelector('.m-ok').onclick = close;
  bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  bd.querySelector('.m-ok').focus();
}

window.neo.onMenu(async (msg) => {
  if (msg.type === 'help') showHelp();
  if (msg.type === 'about') showAbout();
  if (msg.type === 'checkUpdate') checkForUpdate();
  if (msg.type === 'export') doExport(msg.format);
  if (msg.type === 'emailDraft') doEmailDraft();
  if (msg.type === 'emailSettings') emailSettings();
  if (msg.type === 'find') openSearch();
  if (msg.type === 'spellcheck') toggleSpellcheck();
  if (msg.type === 'typewriter') toggleTypewriter();
  if (msg.type === 'import') importBooks();
  if (msg.type === 'stats') openStats();
  if (msg.type === 'align') {
    applyAlign(msg.value);
  }
  if (msg.type === 'uiBright') {
    library.uiBright = !library.uiBright;
    await window.neo.writeLibrary(library);
    applyFonts();
  }
  if (msg.type === 'pageTheme') {
    library.pageTheme = msg.value;
    await window.neo.writeLibrary(library);
    applyFonts();
  }
  if (msg.type === 'fontSize') {
    const cur = library.editorFontSize || 17;
    library.editorFontSize = msg.value === 0 ? 17 : Math.min(22, Math.max(14, cur + msg.value));
    if (msg.value === 0) library.pageZoom = 1; // ⌘0 resets pinch zoom too
    await window.neo.writeLibrary(library);
    applyFonts();
  }
  if (msg.type === 'systemFont') {
    const chosen = await pickSystemFont((library.fonts || {}).body);
    if (chosen) {
      library.fonts = library.fonts || {};
      library.fonts.body = chosen;
      await window.neo.writeLibrary(library);
    }
    applyFonts();
  }
  if (msg.type === 'bodyFont') {
    library.fonts = library.fonts || {};
    library.fonts.body = msg.value;
    await window.neo.writeLibrary(library);
    applyFonts();
  }
});

/* ================================================================== */
/*  SAFETY NET — errors get logged, never eaten silently               */
/* ================================================================== */

let errorToastShown = false;
function reportError(msg) {
  window.neo.logError(msg);
  if (!errorToastShown) {
    errorToastShown = true;
    toast(t('toast.hiccup'));
  }
}
window.addEventListener('error', (e) => reportError(`${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => reportError('Unhandled: ' + (e.reason && e.reason.stack || e.reason)));

/* ================================================================== */

// start once every script has run: ai-ui.js, versions.js, reorder.js and
// voice.js load after this file, and the library needs some of them
function boot() {
  loadLibrary().then(() => {
    applyFonts();
    typewriterEnabled = !!library.typewriter;
    applyTypewriter();
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
