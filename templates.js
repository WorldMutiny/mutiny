/* ============================ MUTINY ============================ */
/* Templates: what kind of text this is (its type) and how it's built */
/* (its form). A template gives the Outline its skeleton — each line a */
/* guiding question, empty until the writer answers it — and tells the */
/* rest of the app what it's looking at. It never touches the prose.   */
/* book.kind / book.form; a book without them is an essay, Peterson.   */

'use strict';

// type → its forms, in the order the New text dialog offers them
const TEMPLATE_TYPES = [
  { id: 'essay', forms: ['peterson', 'dialectic', 'toulmin', 'theysay', 'scqa', 'exploratory', 'five'] },
  { id: 'free', forms: ['free', 'morning'] },
  { id: 'blog', forms: ['opinion', 'howto', 'list'] },
  { id: 'newsletter', forms: ['letter', 'digest'] },
  { id: 'script', forms: ['video', 'short', 'podcast'] },
  { id: 'speech', forms: ['talk', 'toast'] }
];
// the types that can be picked yet (the rest arrive with their own pieces)
const TEMPLATE_READY = new Set(['essay']);

// The skeletons: each section's guiding question, and the paragraph lines
// under it (keys into the locales). Peterson's is the one Mutiny began with.
const EV = ['tpl.evidence', 'tpl.example'];
const OUTLINES = {
  'essay/peterson': [
    { point: 'tpl.thesis', paras: ['tpl.thesis.why', 'tpl.thesis.reader'] },
    { point: 'tpl.reason1', paras: EV },
    { point: 'tpl.reason2', paras: EV },
    { point: 'tpl.objection', paras: ['tpl.objection.fair', 'tpl.objection.answer'] },
    { point: 'tpl.conclusion', paras: ['tpl.conclusion.next'] }
  ],
  'essay/dialectic': [
    { point: 'tpl.dia.thesis', paras: ['tpl.dia.best', 'tpl.example'] },
    { point: 'tpl.dia.anti', paras: ['tpl.dia.best', 'tpl.example'] },
    { point: 'tpl.dia.synth', paras: ['tpl.dia.keeps', 'tpl.dia.better'] },
    { point: 'tpl.dia.end', paras: ['tpl.conclusion.next'] }
  ],
  'essay/toulmin': [
    { point: 'tpl.tou.claim', paras: ['tpl.tou.qualifier'] },
    { point: 'tpl.tou.grounds', paras: ['tpl.tou.strongest', 'tpl.tou.another'] },
    { point: 'tpl.tou.warrant', paras: ['tpl.tou.principle', 'tpl.tou.backing'] },
    { point: 'tpl.tou.limits', paras: ['tpl.tou.exceptions'] },
    { point: 'tpl.tou.rebuttal', paras: ['tpl.objection.fair', 'tpl.tou.answer'] },
    { point: 'tpl.tou.end', paras: ['tpl.tou.follows'] }
  ],
  'essay/theysay': [
    { point: 'tpl.tsis.they', paras: ['tpl.tsis.who', 'tpl.tsis.fair'] },
    { point: 'tpl.tsis.i', paras: ['tpl.tsis.stance', 'tpl.tsis.why'] },
    { point: 'tpl.tsis.reasons', paras: EV },
    { point: 'tpl.tsis.object', paras: ['tpl.tsis.imagined', 'tpl.tou.answer'] },
    { point: 'tpl.tsis.sowhat', paras: ['tpl.tsis.whom'] }
  ],
  'essay/scqa': [
    { point: 'tpl.scqa.s', paras: ['tpl.scqa.context'] },
    { point: 'tpl.scqa.c', paras: ['tpl.scqa.fact'] },
    { point: 'tpl.scqa.q', paras: [] },
    { point: 'tpl.scqa.a', paras: ['tpl.scqa.arg1', 'tpl.scqa.arg2', 'tpl.scqa.arg3'] },
    { point: 'tpl.scqa.next', paras: ['tpl.scqa.tomorrow'] }
  ],
  'essay/exploratory': [
    { point: 'tpl.exp.question', paras: ['tpl.exp.why'] },
    { point: 'tpl.exp.before', paras: [] },
    { point: 'tpl.exp.found', paras: ['tpl.exp.case', 'tpl.exp.misfit'] },
    { point: 'tpl.exp.now', paras: ['tpl.exp.unknown'] }
  ],
  'essay/five': [
    { point: 'tpl.five.intro', paras: ['tpl.five.hook', 'tpl.five.thesis'] },
    { point: 'tpl.five.arg1', paras: EV },
    { point: 'tpl.five.arg2', paras: EV },
    { point: 'tpl.five.arg3', paras: EV },
    { point: 'tpl.five.end', paras: ['tpl.five.takeaway'] }
  ]
};

// the book's template, with the defaults every older essay falls back to
function bookTemplate(b = book) {
  const kind = (b && b.kind) || 'essay';
  const type = TEMPLATE_TYPES.find((x) => x.id === kind) || TEMPLATE_TYPES[0];
  const form = b && type.forms.includes(b.form) ? b.form : type.forms[0];
  return { kind: type.id, form };
}
const templateName = (kind, form) => `${t('type.' + kind)} · ${t('form.' + kind + '.' + form)}`;
const outlineFor = (kind, form) => OUTLINES[kind + '/' + form] || null;

// The New text dialog: a type, then its form. Resolves to { kind, form }, or
// null if the writer backs out. `preset` is what gets selected first.
function pickTemplate(preset) {
  return new Promise((resolve) => {
    let kind = preset && TEMPLATE_READY.has(preset.kind) ? preset.kind : 'essay';
    let form = preset && preset.kind === kind ? preset.form : null;
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `
      <div class="modal new-text-modal" role="dialog" aria-label="${escHtml(t('new.title'))}">
        <h2>${t('new.title')}</h2>
        <div class="nt-types"></div>
        <p class="nt-forms-title">${t('new.form')}</p>
        <div class="nt-forms"></div>
        <div style="text-align:right;margin-top:16px">
          <button class="m-cancel btn-quiet" style="margin-right:10px">${t('common.cancel')}</button>
          <button class="m-ok btn-gold">${t('new.create')}</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    const done = (v) => { bd.remove(); resolve(v); };
    const types = bd.querySelector('.nt-types');
    const forms = bd.querySelector('.nt-forms');

    function draw() {
      const type = TEMPLATE_TYPES.find((x) => x.id === kind);
      if (!type.forms.includes(form)) form = type.forms[0];
      types.innerHTML = '';
      for (const ty of TEMPLATE_TYPES) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'nt-type' + (ty.id === kind ? ' sel' : '');
        const ready = TEMPLATE_READY.has(ty.id);
        b.disabled = !ready;
        b.innerHTML = `<strong>${escHtml(t('type.' + ty.id))}</strong><span>${escHtml(ready ? t('type.' + ty.id + '.desc') : t('new.soon'))}</span>`;
        b.onclick = () => { kind = ty.id; draw(); };
        types.appendChild(b);
      }
      forms.innerHTML = '';
      for (const f of type.forms) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'nt-form' + (f === form ? ' sel' : '');
        b.innerHTML = `<strong>${escHtml(t('form.' + kind + '.' + f))}</strong><span>${escHtml(t('form.' + kind + '.' + f + '.desc'))}</span>`;
        b.onclick = () => { form = f; draw(); };
        b.ondblclick = () => done({ kind, form: f });
        forms.appendChild(b);
      }
    }
    draw();
    bd.querySelector('.m-cancel').onclick = () => done(null);
    bd.querySelector('.m-ok').onclick = () => done({ kind, form });
    bd.addEventListener('mousedown', (e) => { if (e.target === bd) done(null); });
    bd.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      if (e.key === 'Enter' && !e.target.closest('.m-cancel')) { e.preventDefault(); done({ kind, form }); }
    });
    bd.querySelector('.m-ok').focus();
  });
}
