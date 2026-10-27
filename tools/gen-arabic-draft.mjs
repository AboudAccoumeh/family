/**
 * gen-arabic-draft.mjs — build the Arabic review page + markdown from
 * data.json + tools/arabic-map.json. Pure-ASCII script; all Arabic lives in
 * the map JSON (clean UTF-8), so console/pipe encoding can never mangle it.
 *   node tools/gen-arabic-draft.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = JSON.parse(fs.readFileSync(path.join(PROJ, 'data.json'), 'utf8'));
const MAP = JSON.parse(fs.readFileSync(path.join(PROJ, 'tools', 'arabic-map.json'), 'utf8'));

/* ---------- build rows ---------- */
const rows = [];
for (const [id, p] of Object.entries(DATA.people)) {
  const parts = String(p.name).trim().split(/\s+/);
  const first = parts[0];
  const fam = parts.slice(1).join(' ');
  const f = MAP.first[first];
  if (!f) { console.error('UNMAPPED first name:', first, '::', p.name); process.exit(1); }
  let famAr = '', famConf = '';
  if (fam) {
    const f2 = MAP.family[fam];
    if (f2) { famAr = ' ' + f2.ar; famConf = f2.conf.includes('LOW') ? `FAM "${fam}" = ${f2.conf}` : ''; }
    else { famAr = ` (${fam}?)`; famConf = `FAMILY NAME UNMAPPED: ${fam}`; }
  }
  rows.push({ id, first, en: p.name.replace(/&/g, '&amp;').replace(/</g, '&lt;'), ar: f.ar + famAr, conf: f.conf, note: f.note || '', famConf });
}

/* usage counts for surnames */
const famUsage = {};
for (const [, p] of Object.entries(DATA.people)) {
  const fam = String(p.name).trim().split(/\s+/).slice(1).join(' ');
  if (!fam) continue;
  famUsage[fam] = (famUsage[fam] || 0) + 1;
  for (const key of Object.keys(MAP.family)) {
    if (key !== fam && fam.includes(key)) famUsage[key] = (famUsage[key] || 0) + 1;
  }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* chips renderer — Arabic candidates with ASCII codes */
const chips = entry => {
  if (!entry.alts) return '';
  return `<div class="chips-rv">${entry.alts.map(c =>
    `<button class="cand" data-code="${c.code}"><span class="c-ar">${c.ar}</span><span class="c-code">${c.code}</span>${c.hint ? `<span class="c-hint">${esc(c.hint)}</span>` : ''}</button>`
  ).join('')}</div>`;
};

/* free-typing row — user types/pastes the real spelling themselves */
const customInput = en =>
  `<div class="customrow"><label class="cust-hint">type it yourself</label><input class="cust" dir="rtl" data-en="${esc(en)}" placeholder="أكتب الاسم الصحيح هنا…" spellcheck="false" autocapitalize="off" autocomplete="off" /></div>`;

/* ---------- surname cards (every non-HIGH entry that matters) ---------- */
const famEntries = Object.entries(MAP.family).filter(([en, f]) => f.conf !== 'HIGH');
const famCards = famEntries.map(([en, f]) => {
  const n = famUsage[en] || 0;
  return `<div class="rv-card${f.conf.startsWith('LOW') ? ' low' : ''}">
    <span class="en">${esc(en)} <em class="n">×${n} people</em></span>
    <span class="ar cur">${f.ar}</span>
    <span class="note">${esc(f.conf + (f.note ? ' — ' + f.note : ''))}</span>
    ${chips(f)}
    ${customInput(en)}
  </div>`;
}).join('\n');

/* ---------- first-name must-review cards (LOW conf) ---------- */
const seenFirst = new Set();
const lowCards = [];
for (const r of rows) {
  if (r.conf !== 'LOW' || seenFirst.has(r.first)) continue;
  seenFirst.add(r.first);
  const f = MAP.first[r.first];
  lowCards.push(`<div class="rv-card low">
    <span class="en">${r.en}</span>
    <span class="ar cur">${f.ar}</span>
    <span class="note">${esc(f.note || '')}</span>
    ${chips(f)}
    ${customInput(r.en)}
  </div>`);
}

/* ---------- medium cards that have alts ---------- */
const medCards = [];
const seenMed = new Set();
for (const r of rows) {
  if (r.conf !== 'MEDIUM' || seenMed.has(r.first)) continue;
  seenMed.add(r.first);
  const f = MAP.first[r.first];
  if (f.alts) {
    medCards.push(`<div class="rv-card">
      <span class="en">${r.en}</span>
      <span class="ar cur">${f.ar}</span>
      <span class="note">${esc(f.note || 'medium confidence — click if wrong')}</span>
      ${chips(f)}
      ${customInput(r.en)}
    </div>`);
  }
}
const medFamCards = Object.entries(MAP.family).filter(([, f]) => f.conf === 'MEDIUM' && f.alts)
  .map(([en, f]) => `<div class="rv-card">
      <span class="en">${esc(en)} <em class="n">×${famUsage[en] || 0} people</em></span>
      <span class="ar cur">${f.ar}</span>
      <span class="note">${esc(f.note || 'medium confidence — click if wrong')}</span>
      ${chips(f)}
      ${customInput(en)}
    </div>`).join('\n');

/* ---------- markdown ---------- */
let md = `# Arabic name draft — for family review

> **REVIEW DRAFT, not final data.** You are the source of truth — civil-records spelling wins over my draft.

## The 10 tricky things (rules driving this draft)

1. **No "correct" spelling without the official record.** Whatever the review says wins.
2. **ة vs ه** endings on female names — draft assumes ة; a global flip is one command.
3. **عبد الرحمن** split into two words in the draft; records often write one word.
4. **Hamza** on names like أحمد.
5. **Duplicate English spellings** (Belal/Bilal, Sara/Sarah, Mohamad/Mohamed) unify in Arabic.
6. **Tahani vs Tahine are two different people** — they must get different Arabic.
7. **"El Ayoubi" must render as one word** (no leftover "el-").
8. **RTL flips the whole layout** — that is part of the build, not the review.
9. **Arabic font bundled locally** (Noto Kufi / IBM Plex Sans Arabic).
10. **Western digits kept** (1994, not ١٩٩٤).

## Review priorities — LOW-confidence first names (start here)

${rows.filter(r => r.conf === 'LOW').map(r => {
  const f = MAP.first[r.first];
  const codes = f.alts ? ` (options: ${f.alts.map(a => a.code).join(' ')})` : '';
  return `- **${r.en} (id: ${r.id})** → draft \`${f.ar}\`${codes}${r.note ? ' — ' + r.note.replace(/&lt;/g, '<') : ''}`;
}).join('\n')}

## Surname spellings — confirm once, applies to whole branches

${famEntries.map(([en, f]) => {
  const codes = f.alts ? ` (options: ${f.alts.map(a => a.code).join(' ')})` : '';
  return `- **${en}** ×${famUsage[en] || 0} → \`${f.ar}\` (${f.conf})${codes}${f.note ? ' — ' + f.note.replace(/&lt;/g, '<') : ''}`;
}).join('\n')}

## Full draft table — ${rows.length} people

| id | English | draft Arabic | confidence | notes |
|---|---|---|---|---|
${rows.map(r => `| ${r.id} | ${r.en} | ${r.ar} | ${r.conf} | ${r.famConf || r.note} |`).join('\n')}
`;
fs.writeFileSync(path.join(PROJ, 'ARABIC-DRAFT.md'), md);

/* ---------- HTML ---------- */
const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Arabic review — family tree draft</title>
<link rel="stylesheet" href="styles.css" />
<style>
  html, body { height: auto !important; overflow: auto !important; position: static !important; overscroll-behavior: auto; }
  body { padding: 0; }
  .wrap { max-width: 980px; margin: 74px auto 80px; padding: 0 22px; }
  .rv-notice { background: rgba(255,214,160,.07); border: 1px solid rgba(255,214,160,.25); color: #e8d5b0;
               padding: 14px 18px; border-radius: 14px; font-size: 13.5px; line-height: 1.7; margin-bottom: 26px; }
  .rv-notice b { color: #ffdf9e; } .rv-notice code { color: #9ec0ff; }
  .rv-h { font-size: 15px; font-weight: 700; margin: 34px 0 10px; color: var(--text); display:flex; align-items:center; gap:10px; }
  .rv-h::after { content:""; flex:1; height:1px; background: var(--line); }
  .rv-cards { display: grid; gap: 8px; }
  .rv-card { display:flex; align-items:center; justify-content:flex-start; gap:14px; padding: 12px 16px;
             border:1px solid var(--line); border-radius: 12px; background: var(--surface); flex-wrap:wrap; }
  .rv-card .en { font-weight: 600; font-size: 13.5px; min-width: 170px; }
  .rv-card .en em.n { font-style: normal; font-weight: 400; font-size: 11px; color: var(--muted); }
  .rv-card .ar { font-family: 'Noto Naskh Arabic', 'Segoe UI', serif; font-size: 21px; color: #cee1ff; direction: rtl; unicode-bidi: isolate; }
  .rv-card .note { width: 100%; font-size: 11.5px; color: var(--muted); }
  .rv-card.low { border-color: rgba(244,114,182,.35); background: rgba(244,114,182,.06); }
  .chips-rv { display:flex; flex-wrap:wrap; gap:8px; width:100%; padding:4px 0 2px; }
  .cand { border:1px solid var(--line); background: rgba(255,255,255,.03); color: var(--text);
          border-radius:10px; padding:7px 12px 8px; cursor:pointer; display:flex; flex-direction:column;
          gap:2px; min-width:84px; text-align:left; font-family:inherit; }
  .cand .c-ar { font-family: 'Noto Naskh Arabic', 'Segoe UI', serif; font-size:19px; color:#cee1ff; direction:rtl; }
  .cand .c-code { font: 600 10.5px/1 monospace; letter-spacing:.08em; color:var(--muted); }
  .cand .c-hint { font-size:10.5px; color:var(--muted); max-width:170px; line-height:1.4; }
  .cand:hover { border-color:#5b8cff; }
  .cand.on { border-color:#7ee2a8; background:rgba(126,226,168,.1); }
  .cand.on .c-code { color:#7ee2a8; }
  .customrow { display:flex; align-items:center; gap:10px; width:100%; padding:2px 0 6px; }
  input.cust { flex:1; direction:rtl; text-align:right; font-family:'Noto Naskh Arabic','Segoe UI',serif; font-size:17px;
               color:var(--text); background:rgba(255,255,255,.04); border:1px solid var(--line); border-radius:10px;
               padding:8px 12px; outline:none; min-width:200px; }
  input.cust:focus { border-color:#5b8cff; box-shadow:0 0 0 3px rgba(91,140,255,.18); }
  .cust-hint { font:600 10px/1 sans-serif; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); white-space:nowrap; }
  .ar.cur { font-size:21px; color:#8fa8c8; }
  .ar.cur small { font:400 10px/1 sans-serif; letter-spacing:.1em; color:var(--muted); }
  table.rv { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.rv th { text-align:left; font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color: var(--muted);
                padding: 8px 10px; border-bottom: 1px solid var(--line); position: sticky; top: 60px; background: var(--bg); }
  table.rv td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
  td.ar { font-family: 'Noto Naskh Arabic', 'Segoe UI', serif; font-size: 18px; color: #dbe7ff; direction: rtl; unicode-bidi: isolate; text-align: left; }
  td.conf { font-size: 11px; color: var(--muted); white-space: nowrap; }
  td.conf.LOW { color: #ff9db1; font-weight: 700; }
  td.note { font-size: 11.5px; color: var(--muted); max-width: 280px; }
  td.id { color: var(--muted); font-size: 11.5px; }
  .copybar { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 50;
             display:flex; gap:14px; align-items:center; justify-content:center;
             background: rgba(30,32,40,.92); border:1px solid var(--line);
             padding: 10px 16px; border-radius: 999px; backdrop-filter: blur(6px); max-width: calc(100vw - 32px); }
  #copy-sel, #dl-sel { background: #5b8cff; border:0; color:#fff; padding:10px 20px; border-radius:999px; font-size:13px; cursor:pointer; font-weight:600; }
  #copy-sel:hover { filter:brightness(1.1); }
  #selcount { font-size:12.5px; color:var(--muted); }
  .count { color: var(--muted); font-size: 12px; font-weight: 400; }
</style>
</head>
<body>
<div class="wrap">
  <div class="rv-notice">
    <b>Review draft — not final.</b> You are the source of truth (civil-records spelling wins over the proposal).
    Three ways to fix a card: <b>1.</b> click one of the option chips (each has a letter code like ACC1) —
    <b>2.</b> <b>type / paste</b> the correct spelling into the "type it yourself" box on the card —
    <b>3.</b> describe it in plain English in the chat. When done, click <b>Copy selections</b> below and paste
    into the chat — chips copy as letter codes and anything you typed copies as <code>\u0645…</code> escape text
    (pure ASCII, chat-safe; I decode it exactly). Scroll works — Ctrl+F5 if you had the page open before.
  </div>

  <div class="rv-h">Surnames — click once, applies to whole branches (${famEntries.length})</div>
  <div class="rv-cards">
${famCards}
  </div>

  <div class="rv-h">First names — genuinely ambiguous (${lowCards.length})</div>
  <div class="rv-cards">
${lowCards.join('\n')}
  </div>

  <div class="rv-h">Worth a quick glance — medium confidence, clickable (${medCards.length + (medFamCards ? medFamCards.split('rv-card').length - 1 : 0)})</div>
  <div class="rv-cards">
${medCards.join('\n')}
${medFamCards}
  </div>

  <div class="rv-h">Full draft table <span class="count">— ${rows.length} people</span></div>
  <table class="rv">
    <tr><th>id</th><th>English</th><th>draft</th><th>confidence</th><th>notes</th></tr>
    ${rows.map(r => `<tr><td class="id">${r.id}</td><td>${r.en}</td><td class="ar">${r.ar}</td><td class="conf ${/LOW/.test(r.conf) ? 'LOW' : ''}">${r.conf}</td><td class="note">${esc(r.famConf || r.note)}</td></tr>`).join('')}
  </table>
</div>

<div class="copybar">
  <button id="copy-sel">Copy selections</button>
  <button id="dl-sel">Download fixes file</button>
  <span id="selcount">0 selected</span>
</div>

<script>
(function () {
  var KEY = 'arabic-sel', KEYC = 'arabic-custom';
  var sel = {}, custom = {};
  try { sel = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { sel = {}; }
  try { custom = JSON.parse(localStorage.getItem(KEYC) || '{}'); } catch (e) { custom = {}; }

  var count = document.getElementById('selcount');
  function refresh() {
    count.textContent = Object.keys(sel).length + ' selected + '
      + Object.keys(custom).filter(function (k) { return (custom[k] || '').trim(); }).length + ' typed';
  }

  document.querySelectorAll('.cand').forEach(function (b) {
    if (sel[b.dataset.code]) b.classList.add('on');
    b.addEventListener('click', function () {
      var c = b.dataset.code;
      if (sel[c]) { delete sel[c]; b.classList.remove('on'); }
      else { sel[c] = 1; b.classList.add('on'); }
      try { localStorage.setItem(KEY, JSON.stringify(sel)); } catch (e) {}
      refresh();
    });
  });

  /* unicode escape — Arabic becomes pure-ASCII backslash-u codes that survive the chat */
  function toEsc(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var cp = str.codePointAt(i);
      if (cp > 127) { out += '\\u' + cp.toString(16).padStart(4, '0'); if (cp > 0xffff) i++; }
      else out += str[i];
    }
    return out;
  }

  document.querySelectorAll('input.cust').forEach(function (inp) {
    var en = inp.dataset.en;
    if (custom[en]) inp.value = custom[en];
    inp.addEventListener('input', function () {
      var v = inp.value.trim();
      if (v) custom[en] = v; else delete custom[en];
      try { localStorage.setItem(KEYC, JSON.stringify(custom)); } catch (e) {}
      refresh();
    });
  });

  function buildText() {
    var lines = [];
    var codes = Object.keys(sel);
    if (codes.length) lines.push('arabic fixes: ' + codes.join(' '));
    var typed = Object.keys(custom).filter(function (k) { return (custom[k] || '').trim(); });
    if (typed.length) {
      lines.push('arabic typed:');
      typed.forEach(function (k) { lines.push(k + ' = ' + toEsc(custom[k])); });
    }
    return lines.length ? lines.join('\n') : 'arabic fixes: none';
  }

  document.getElementById('copy-sel').addEventListener('click', function () {
    var text = buildText();
    var done = function () { var b = document.getElementById('copy-sel'); b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy selections'; }, 1500); };
    function fallback() {
      var t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) { window.prompt('Copy manually:', text); }
      document.body.removeChild(t);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  });

  /* download the same content as a file — lands in the Downloads folder */
  document.getElementById('dl-sel').addEventListener('click', function () {
    var text = buildText();
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'arabic-fixes.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    var b = document.getElementById('dl-sel'); b.textContent = 'Downloaded ✓';
    setTimeout(function () { b.textContent = 'Download fixes file'; }, 1800);
  });

  refresh();
})();
</script>
</body></html>`;

fs.writeFileSync(path.join(PROJ, 'arabic-review.html'), html);
console.log('generated:', rows.length, 'rows |', famEntries.length, 'surname cards |', lowCards.length, 'ambiguous first names |', medCards.length + (medFamCards ? medFamCards.split('rv-card').length - 1 : 0), 'medium cards');
