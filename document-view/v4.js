/* v4 document view mock - Sai 2026-09-30. Mock behaviour only, not app code. */
const q = new URLSearchParams(location.search);
const body = document.body;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;   // OS setting: only used for page UI and the hint; the orb follows the Motion switch
if (RM) body.classList.add('rmos');
document.documentElement.dataset.rm = RM;
const STILL = q.has('still');
if (STILL) body.classList.add('still');
if (q.has('clean')) body.classList.add('clean');
history.scrollRestoration = 'manual';

/* ============ 1. FRAME: Glass / Solid, transparency notice, tree toggle ============ */
const bG = $('#bGlass'), bS = $('#bSolid');
function setSolid(s){ body.classList.toggle('solid', s); bG.setAttribute('aria-pressed', !s); bS.setAttribute('aria-pressed', s); }
bG.onclick = () => setSolid(false); bS.onclick = () => setSolid(true);
const RT = matchMedia('(prefers-reduced-transparency: reduce)').matches;   // true on this PC (EnableTransparency=0)
if (RT && !q.has('clean')) body.classList.add('rt');
if (q.has('solid') || (RT && q.has('respect'))) setSolid(true);
document.documentElement.dataset.rt = RT;

/* Motion: Full / Calm. Full is the default even when the OS asks for less motion (user decision, round 6). ?calm=1 starts Calm. */
const bF = $('#bFull'), bC = $('#bCalm');
let CALM = q.has('calm') && q.get('calm') !== '0';
function setCalm(c){ CALM = c; body.classList.toggle('calm', c); bF.setAttribute('aria-pressed', !c); bC.setAttribute('aria-pressed', c); document.documentElement.dataset.motion = c ? 'calm' : 'full'; }
bF.onclick = () => setCalm(false); bC.onclick = () => setCalm(true);
setCalm(CALM);

const bTree = $('#bTree');
function setTree(on){
  body.classList.toggle('tree-off', !on);
  bTree.setAttribute('aria-expanded', on); bTree.setAttribute('aria-label', on ? 'Hide classes' : 'Show classes');
}
bTree.onclick = () => setTree(body.classList.contains('tree-off'));
if (q.get('tree') === 'off') setTree(false);

/* ============ 2. TREE: disclosure ============ */
$$('.row.cls').forEach(b => b.onclick = () => {
  const o = b.getAttribute('aria-expanded') === 'true';
  b.setAttribute('aria-expanded', !o); b.parentElement.setAttribute('aria-expanded', !o);
  const ul = b.nextElementSibling; if (ul) ul.hidden = o;
});

/* ============ 3. PAGE: fit to width + page-end lines ============ */
const MM = 96 / 25.4;
const PAD_T = 14, PAD_B = 16, RUN_H = 10;                 // mm; RUN_H = running header on printed pages 2+
const AVAIL_1 = (297 - PAD_T - PAD_B) * MM;
const AVAIL_N = (297 - PAD_T - PAD_B - RUN_H) * MM;
const stage = $('#stage'), fitEl = $('#fit'), page = $('#page'), flow = $('#flow'), selZoom = $('#selZoom');

/* pagination units: top-level blocks, but numbered lists split per question */
function units(fl){ const out = []; for (const el of fl.children) { if (el.matches('ol.q')) out.push(...el.children); else out.push(el); } return out; }
/* returns the units that start a new printed page; headings and the source line stay with what follows.
   offsetTop/offsetHeight ignore the scale transform, so this measures true A4 layout. */
function paginate(fl){
  const us = units(fl), used1 = fl.offsetTop - PAD_T * MM;   // school header space on page 1
  const breaks = []; let top0 = 0, limit = AVAIL_1 - used1;
  for (let i = 0; i < us.length; i++) {
    const u = us[i], t = u.offsetTop, b = t + u.offsetHeight;
    if (b - top0 > limit && t > top0) {
      let j = i; while (j > 0 && us[j - 1].matches('h2, .src, .sub') && us[j - 1].offsetTop > top0) j--;
      breaks.push(us[j]); top0 = us[j].offsetTop; limit = AVAIL_N;
    }
  }
  return breaks;
}
function drawBreaks(){
  const host = $('#breaks'); host.innerHTML = '';
  paginate(flow).forEach((u, k) => {
    const d = document.createElement('div'); d.className = 'pb';
    d.style.top = (flow.offsetTop + u.offsetTop - 7) + 'px';
    d.innerHTML = `<span>Page ${k + 2}</span>`; host.appendChild(d);
  });
}
function layout(){
  const z = selZoom.value, avail = stage.clientWidth - 40;
  const s = z === 'fit' ? Math.max(0.3, Math.min(1, avail / (210 * MM))) : +z;   // part 2: clamp, a very narrow column gave a negative scale
  fitEl.style.setProperty('--s', s.toFixed(4));
  fitEl.style.setProperty('--h', page.offsetHeight + 'px');
  drawBreaks(); drawBars(s);
  document.documentElement.dataset.pageW = Math.round(210 * MM * s);   // part-2 check: page width on screen
}
selZoom.onchange = layout;
new ResizeObserver(layout).observe(stage);
new ResizeObserver(layout).observe(page);
document.fonts.ready.then(layout);

/* ============ 4. SUGGESTIONS: per change + all, Undo, prev/next ============ */
function drawBars(s){
  const host = $('#breaks'), pr = page.getBoundingClientRect();
  $$('#flow .sg').forEach(sg => {
    const r = sg.getBoundingClientRect(), b = document.createElement('div');
    b.className = 'cbar' + (sg.querySelector('.sg-del') ? ' mix' : '');
    b.style.top = ((r.top - pr.top) / s) + 'px'; b.style.height = (r.height / s) + 'px';
    host.appendChild(b);
  });
}
const TOTAL = $$('#flow .sg').length;              // 4 in the mock
const bar = $('#suggBar'), sbN = $('#sbN'), sbAcc = $('#sbAcc'), sbRej = $('#sbRej'), sbUndo = $('#sbUndo'), live = $('#live');
const undoStack = []; let undoTimer = 0, cur = -1;
const pending = () => $$('#flow .sg');
const say = t => { live.textContent = ''; requestAnimationFrame(() => live.textContent = t); };

function refresh(){
  const n = pending().length;
  sbN.textContent = n === 1 ? '1 suggestion' : n + ' suggestions';
  const done = n === 0;
  bar.classList.toggle('all-done', done);
  sbAcc.hidden = sbRej.hidden = done; $('#sbPrev').hidden = $('#sbNext').hidden = done;
  $('#sbAccL').textContent = n > 1 ? `Accept all ${n}` : 'Accept';
  if (done) { sbN.textContent = `All ${TOTAL} suggestions done`; stepping = false; }
  const cu = $('#flow .sg.cur'), pos = $('#sbPos');
  pos.hidden = !cu; if (cu) pos.textContent = `${pending().indexOf(cu) + 1} of ${n}`;
  const pend = $('.row.active .pend'); if (pend) { pend.textContent = n; pend.hidden = !n; }
  document.dispatchEvent(new CustomEvent('sugg', { detail: { n } }));   // the chat status card listens
  layout();
}
function snapshot(){ undoStack.push(flow.innerHTML); if (undoStack.length > 20) undoStack.shift(); }
function offerUndo(){
  sbUndo.hidden = false; clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { sbUndo.hidden = true; if (!pending().length) bar.hidden = true; }, 8000);   // Undo lasts 8 s
}
/* resolve one change. how = 'ok' | 'no' */
function resolve(sg, how, quiet){
  const li = sg.closest('li.sg-li');
  sg.classList.add(how === 'ok' ? 'accepting' : 'rejecting');
  const finish = () => {
    if (how === 'ok') { sg.querySelector('.sg-del')?.remove(); const ins = sg.querySelector('.sg-ins'); sg.replaceWith(...ins.childNodes); if (li) li.classList.remove('has-sg', 'sg-li'); }
    else if (li) { li.remove(); }
    else { sg.querySelector('.sg-ins')?.remove(); const del = sg.querySelector('.sg-del'); sg.replaceWith(...del.childNodes); }
    const dd = flow.querySelector('dd.has-sg'); if (dd && !dd.querySelector('.sg')) dd.classList.remove('has-sg');
    if (!quiet) refresh();
  };
  if (how === 'no' && li) li.classList.add('leaving');
  if (RM || quiet) finish(); else setTimeout(finish, 320);
}
flow.addEventListener('click', e => {
  const btn = e.target.closest('.sg-ok, .sg-no'); if (!btn) return;
  const sg = btn.closest('.sg'), how = btn.classList.contains('sg-ok') ? 'ok' : 'no';
  snapshot(); resolve(sg, how); offerUndo();
  const left = pending().filter(x => x !== sg).length;
  say(`${sg.dataset.label[0].toUpperCase() + sg.dataset.label.slice(1)} ${how === 'ok' ? 'accepted' : 'rejected'}. ${left ? left + ' left.' : 'All done.'} Undo is in the suggestion bar.`);
  if (stepping) setTimeout(() => { if (pending().length) { cur = -1; go(1); } else { stepping = false; sbUndo.focus(); } }, RM ? 0 : 360);   // step-through: next change
});
function all(how){
  const list = pending(); if (!list.length) return;
  snapshot(); list.forEach(sg => resolve(sg, how, true)); refresh(); offerUndo();
  say(`All ${list.length} suggestions ${how === 'ok' ? 'accepted' : 'rejected'}. Undo is in the suggestion bar.`);
}
sbRej.onclick = () => all('no');   // rejecting changes nothing on the page, and Undo stays for 8 s

/* part 2 [Kurenai v3 #1]: "Accept all" never accepts a change the teacher has not seen.
   It opens a review panel: every change with its text, how many are off-screen now, Show per change,
   "Step through them" (one by one, auto-advance) or a confirmed "Accept all N". */
const accPanel = $('#accPanel'), accList = $('#accList'), accOff = $('#accOff'), accT = $('#accT');
let stepping = false;
const offscreen = sg => { const r = sg.getBoundingClientRect(), s = stage.getBoundingClientRect(); return r.top < s.top || r.bottom > s.bottom; };
const kind = sg => sg.querySelector('.sg-del') ? 'Rewritten' : 'Added';
function openAcc(){
  const list = pending(); if (!list.length) return;
  const n = list.length, off = list.filter(offscreen).length;
  accT.textContent = `Accept all ${n} suggestion${n > 1 ? 's' : ''}?`;
  accOff.textContent = off ? `${off} of ${n} ${off > 1 ? 'are' : 'is'} not on screen right now. Check them below or step through them first.` : `All ${n} are on screen now.`;
  accOff.classList.toggle('warn', !!off);
  accList.innerHTML = '';
  list.forEach((sg, i) => {
    const li = document.createElement('li'), txt = sg.querySelector('.sg-ins').textContent.trim();
    li.innerHTML = `<span class="al-k">${kind(sg)}</span><span class="al-b"><b></b><span class="al-x"></span></span><span class="al-where">${offscreen(sg) ? 'Not on screen' : 'On screen'}</span><button class="btn al-go">Show</button>`;
    li.querySelector('b').textContent = sg.dataset.label[0].toUpperCase() + sg.dataset.label.slice(1);
    li.querySelector('.al-x').textContent = txt;
    const del = sg.querySelector('.sg-del');   // a rewrite shows what it replaces, too
    if (del) { const o = document.createElement('del'); o.className = 'al-old'; o.textContent = del.textContent.trim(); li.querySelector('.al-x').before(o); }
    li.querySelector('.al-go').setAttribute('aria-label', 'Show ' + sg.dataset.label + ' on the page');
    li.querySelector('.al-go').onclick = () => { closeAcc(false); cur = i - 1; go(1); };
    accList.appendChild(li);
  });
  $('#accYesL').textContent = `Accept all ${n}`;
  accPanel.hidden = false; sbAcc.setAttribute('aria-expanded', 'true'); placeAcc();
  $('#accStep').focus();          // the safe choice gets focus, not the confirm
}
function closeAcc(refocus = true){ if (accPanel.hidden) return; accPanel.hidden = true; sbAcc.setAttribute('aria-expanded', 'false'); if (refocus) sbAcc.focus(); }
function placeAcc(){ const tp = $('.tools-pane'); accPanel.style.top = (tp.offsetTop + tp.offsetHeight + 6) + 'px'; }
sbAcc.onclick = () => accPanel.hidden ? openAcc() : closeAcc();
$('#accCancel').onclick = () => closeAcc();
$('#accYes').onclick = () => { closeAcc(false); all('ok'); sbAcc.hidden ? sbUndo.focus() : sbAcc.focus(); };
$('#accStep').onclick = () => { closeAcc(false); stepping = true; cur = -1; go(1); };
addEventListener('keydown', e => { if (e.key === 'Escape' && !accPanel.hidden) { e.stopPropagation(); closeAcc(); } }, true);
document.addEventListener('pointerdown', e => { if (!accPanel.hidden && !accPanel.contains(e.target) && !sbAcc.contains(e.target)) closeAcc(false); });
addEventListener('resize', () => { if (!accPanel.hidden) placeAcc(); });
window.__openAcc = openAcc;
sbUndo.onclick = () => {
  const prev = undoStack.pop(); if (prev == null) return;
  flow.innerHTML = prev; bar.hidden = false; sbUndo.hidden = !undoStack.length; refresh(); say('Change undone.');
};
function go(dir){
  const list = pending(); if (!list.length) return;
  list.forEach(s => s.classList.remove('cur'));
  cur = (cur + dir + list.length) % list.length;
  const sg = list[cur]; sg.classList.add('cur');
  const pos = $('#sbPos'); pos.hidden = false; pos.textContent = `${cur + 1} of ${list.length}`;
  sg.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
  sg.querySelector('.sg-ok')?.focus({ preventScroll: true });
}
$('#sbNext').onclick = () => go(1); $('#sbPrev').onclick = () => go(-1);
window.__showFirstSuggestion = () => { cur = -1; go(1); };
/* ============ 5. CHAT: status card mirrors the page (status only, no second Accept) ============ */
const stCard = $('#stCard'), stN = $('#stN'), stSub = $('#stSub'), stGo = $('#stGo');
document.addEventListener('sugg', e => {
  const n = e.detail.n;
  stCard.classList.toggle('done', !n);
  stN.textContent = n ? (n === 1 ? '1 suggestion waits on the page' : `${n} suggestions wait on the page`) : 'All suggestions done';
  stSub.textContent = n ? 'Accept or reject them there' : 'Print or share when you are ready';
  stGo.hidden = !n;
});
stGo.onclick = () => window.__showFirstSuggestion();

/* ============ 6. VOICE MODE: mic -> orb fills the agent pane, live captions, Stop ============ */
const chat = $('#chat'), voice = $('#voice'), vState = $('#vState'), vWho = $('#vWho'), vText = $('#vText');
const CAPS = {
  normal:    { label: 'Ready', who: 'Assistant', html: 'Tap the mic to talk again' },
  listening: { label: 'Listening', who: 'You', html: 'Read me the new questions, and make question 5 a bit easier<span class="interim"> for my slower</span>' },
  thinking:  { label: 'Thinking', who: 'Assistant', html: 'Reading your 4 suggestions and pages 49 to 54' },
  speaking:  { label: 'Speaking', who: 'Assistant', words: 'Here are the new ones. Question 4. Saliva contains an enzyme called blank. It breaks down starch into sugar. Question 5 is next.' },
};
let orbApi = null, vs = 'listening', wordTimer = 0;
const T0 = parseFloat(q.get('t') || '0'), LOOK = q.has('look') ? q.get('look').split(',').map(Number) : null;
async function getOrb(){ if (!orbApi) { const m = await import('./orb.js'); orbApi = m.createOrb({ isCalm: () => CALM, STILL, T0, look: LOOK }); orbApi.setState(vs); } return orbApi; }

function setVState(s){
  vs = s; body.dataset.vstate = s;
  const c = CAPS[s]; vState.textContent = c.label; vWho.textContent = c.who;
  clearInterval(wordTimer);
  if (c.words) {
    const ws = c.words.split(' ');
    vText.innerHTML = ws.map(w => `<span class="w later">${w}</span>`).join(' ');
    const spans = [...vText.children]; let i = 0;
    const roll = sp => { const want = Math.max(0, sp.offsetTop + sp.offsetHeight - vText.clientHeight); if (want !== vText.scrollTop) vText.scrollTop = want; vText.classList.toggle('rolled', vText.scrollTop > 0); };
    const step = () => { if (i < spans.length) { spans[i].classList.remove('later'); orbApi?.kickMouth(ws[i].length); roll(spans[i++]); } };
    vText.scrollTop = 0; vText.classList.remove('rolled');
    if (STILL) { for (let k = 0; k < 13; k++) step(); }                // fixed frame for shots: 13 words spoken
    else { step(); wordTimer = setInterval(() => { step(); if (i >= spans.length) clearInterval(wordTimer); }, 280); }
  } else { vText.innerHTML = c.html; vText.scrollTop = 0; vText.classList.remove('rolled'); }
  $$('#stateSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === s));
  /* centre button: Stop while the mic is on, Talk (mic) once stopped; Mute only makes sense while the mic is on */
  const idle = s === 'normal', sb = $('#vStop');
  $('#vStopL').textContent = idle ? 'Talk' : 'Stop'; sb.setAttribute('aria-label', idle ? 'Start talking' : 'Stop');
  sb.querySelector('svg').innerHTML = idle ? '<rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2"/>' : '<rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor"/>';
  $('#vMute').disabled = idle;
  orbApi?.setState(s);
}
async function setMode(m){
  const on = m === 'voice';
  body.classList.toggle('mode-voice', on);
  voice.inert = !on; chat.inert = on;
  $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
  if (on) { setVState(vs); const o = await getOrb(); o.setState(vs); o.start(); setTimeout(() => $('#vStop').focus({ preventScroll: true }), 60); }
  else { orbApi?.stop(); clearInterval(wordTimer); }
}
$('#bMic').onclick = () => { vs = 'listening'; setMode('voice'); };
$('#vStop').onclick = () => { if (vs === 'normal') setVState('listening'); else { setVState('normal'); $('#vStop').focus({ preventScroll: true }); } };   // Stop keeps the orb here in NORMAL; Talk starts listening again
$('#vType').onclick = () => { setMode('type'); $('#ask').focus(); };
$('#vMute').onclick = e => { const b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Unmute microphone' : 'Mute microphone'); };
addEventListener('keydown', e => { if (e.key === 'Escape' && body.classList.contains('mode-voice') && !body.classList.contains('print')) { if (vs !== 'normal') $('#vStop').click(); else $('#vType').click(); } });   // Esc: stop, then back to chat
$$('#modeSeg button').forEach(b => b.onclick = () => setMode(b.dataset.m));
$$('#stateSeg button').forEach(b => b.onclick = () => { setVState(b.dataset.s); if (!body.classList.contains('mode-voice')) setMode('voice'); });
setVState(['normal', 'listening', 'thinking', 'speaking'].includes(q.get('state')) ? q.get('state') : 'listening');
if (q.get('mode') === 'voice' || q.has('state')) setMode('voice');

/* ============ 7. PRINT PREVIEW: same paginator, exact A4 sheets ============ */
/* Prints the note as it stands: waiting suggestions are left out (nothing changes until the teacher accepts). */
const pp = $('#pp'), ppPages = $('#ppPages'), ppZoom = $('#ppZoom'), app = $('#app');
function cleanFlow(){
  const c = flow.cloneNode(true); c.removeAttribute('id');
  c.querySelectorAll('.sg-act').forEach(n => n.remove());
  c.querySelectorAll('li.sg-li').forEach(li => li.remove());
  c.querySelectorAll('.sg').forEach(sg => { sg.querySelector('.sg-ins')?.remove(); const d = sg.querySelector('.sg-del'); sg.replaceWith(...(d ? d.childNodes : [])); });
  c.querySelectorAll('.has-sg,.cur').forEach(n => n.classList.remove('has-sg', 'cur'));
  return c;
}
function buildSheets(){
  const school = page.querySelector('.school').outerHTML;
  const m = document.createElement('article'); m.className = 'a4 measure'; m.innerHTML = school;
  const c = cleanFlow(); c.className = 'flow'; m.appendChild(c); body.appendChild(m);
  const starts = new Set(paginate(c)), us = units(c);
  const groups = [[]]; us.forEach(u => { if (starts.has(u)) groups.push([]); groups[groups.length - 1].push(u); });
  const N = groups.length; ppPages.innerHTML = '';
  groups.forEach((g, k) => {
    const sheet = document.createElement('article'); sheet.className = 'sheet a4'; sheet.setAttribute('aria-label', `Page ${k + 1} of ${N}`);
    sheet.innerHTML = k === 0 ? school : `<div class="run"><span>Human Digestive System</span><span>Class 6 - Science - Block 15</span></div>`;
    const f = document.createElement('div'); f.className = 'flow'; sheet.appendChild(f);
    let ol = null;
    g.forEach(u => {
      if (u.tagName === 'LI') {   // split lists keep their numbering
        if (!ol || ol.dataset.src !== String(us.indexOf(u.parentElement))) { ol = document.createElement('ol'); ol.className = u.parentElement.className; ol.dataset.src = String(us.indexOf(u.parentElement)); ol.start = [...u.parentElement.children].indexOf(u) + 1; f.appendChild(ol); }
        ol.appendChild(u.cloneNode(true));
      } else { ol = null; f.appendChild(u.cloneNode(true)); }
    });
    const foot = document.createElement('div'); foot.className = 'pfoot'; foot.textContent = `Page ${k + 1} of ${N}`; sheet.appendChild(foot);
    const fit = document.createElement('div'); fit.className = 'pp-fit'; fit.appendChild(sheet); ppPages.appendChild(fit);
  });
  m.remove();
  const n = pending().length;
  $('#ppMeta').textContent = `A4, ${N} page${N > 1 ? 's' : ''}`;
  $('#ppNote').textContent = n ? `${n} waiting suggestion${n > 1 ? 's are' : ' is'} not included. Accept to print ${n > 1 ? 'them' : 'it'}.` : '';
  fitSheets();
}
function fitSheets(){
  const s = ppZoom.value === 'page' ? Math.min(1, (innerHeight - 58 - 56) / (297 * MM)) : 1;
  $$('.pp-fit').forEach(f => f.style.setProperty('--s', s.toFixed(4)));
}
function openPrint(){ buildSheets(); pp.hidden = false; app.inert = true; body.classList.add('print'); $('#ppClose').focus(); }
function closePrint(){ pp.hidden = true; app.inert = false; body.classList.remove('print'); $('#bPrint').focus(); }
$('#bPrint').onclick = openPrint; $('#ppClose').onclick = closePrint; $('#ppPrint').onclick = () => print();
ppZoom.onchange = fitSheets; addEventListener('resize', () => { if (!pp.hidden) fitSheets(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !pp.hidden) closePrint(); });
if (q.has('print')) document.fonts.ready.then(() => setTimeout(openPrint, 50));

if (q.get('go') === 'sugg') document.fonts.ready.then(() => setTimeout(() => { const f = pending()[0]; if (f) { stage.scrollTop = 0; f.scrollIntoView({ block: 'center' }); } }, 60));
