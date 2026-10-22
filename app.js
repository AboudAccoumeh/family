'use strict';

/* ============================================================
   Family Tree — everything is generated from data.json
   people (with father / mother) + marriages (any number per person)
   ============================================================ */

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const near = (a, b, k) => (Math.abs(b - a) < 0.05 ? b : lerp(a, b, k));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const NOW_YEAR = new Date().getFullYear();
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const isMobile = () => matchMedia('(max-width: 760px)').matches;

/* card geometry (world units) */
const W = 200, H = 76, MG = 36, SG = 30, VGAP = 116;
const VSTEP = H + VGAP;

const ICON = {
  chev: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  right: '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  heart: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>',
  broken: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2"/><path d="M12 21s7.5-4.6 9.6-9.3c1.5-3.5-.6-7.2-4.2-7.2-1.4 0-2.5.5-3.6 1.5L11 10l3 2.5-2 3"/></svg>',
  img: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 15.5l-4.8-4-7.4 6.5"/></svg>',
  job: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11h5M19.5 8.5v5"/></svg>',
  tree: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="5" rx="1.5"/><rect x="3" y="16" width="6" height="5" rx="1.5"/><rect x="15" y="16" width="6" height="5" rx="1.5"/><path d="M12 8v4M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/></svg>',
  share: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4L12 18.4"/></svg>',
  birth: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.6L18.5 8l-3.6 3.1L16 16l-4-2.6L8 16l1.1-4.9L5.5 8l4.7-.4z"/></svg>',
  death: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3 2.5 4.5 5 4.5 8a4.5 4.5 0 0 1-9 0c0-3 1.5-5.5 4.5-8z"/><path d="M12 15.5V21"/></svg>',
  ring: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="6"/><path d="M9 4h6l-3 4z"/></svg>',
  dot: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/></svg>',
};

/* ---------- state ---------- */
const S = {
  meta: {}, people: {}, ids: [],
  marriages: [],            // normalized {a, b, status, year, ended, note}
  units: new Map(),          // tree units (one per blood descendant placed in the tree)
  unitOf: new Map(),         // pid -> unit (blood or spouse appearance)
  root: null, gen: new Map(), branch: new Map(),
  expanded: new Map(),
  live: new Map(),           // unit id -> { el, x, y, tx, ty }
  dying: [], bbox: null, dirty: true,
  selected: null, view: 'tree', query: '',
  filter: 'all', groupBy: 'gen', hl: new Set(),
};
const cam = { x: 0, y: 0, s: 0.8 };
const tgt = { x: 0, y: 0, s: 0.8 };

/* ============================================================
   data → model
   ============================================================ */

async function loadData() {
  try {
    const r = await fetch('data.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (err) {
    if (window.FAMILY_DATA_FALLBACK) return window.FAMILY_DATA_FALLBACK;
    throw err;
  }
}

const year = v => {
  if (v == null || v === '') return null;
  const m = String(v).match(/-?\d{3,4}/);
  return m ? parseInt(m[0], 10) : null;
};
function fmtDate(v) {
  if (v == null || v === '') return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    if (!isNaN(d)) return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (/^\d{4}-\d{2}$/.test(s)) {
    const d = new Date(s + '-01T00:00:00');
    if (!isNaN(d)) return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  return s;
}
const isDead = p => p.death != null || p.deceased === true;
function ageOf(p) {
  const b = year(p.birth);
  if (b == null) return null;
  const end = isDead(p) ? year(p.death) : NOW_YEAR;
  return end == null ? null : end - b;
}
/* living = not dead and a plausible birth year (no dates → unknown) */
const isLiving = p => !isDead(p) && (p.living === true || (year(p.birth) != null && NOW_YEAR - year(p.birth) < 105));
const yb = p => (year(p.birth) == null ? null : (p.birthApprox ? 'c. ' : '') + year(p.birth));
const yd = p => (year(p.death) == null ? null : (p.deathApprox ? 'c. ' : '') + year(p.death));
function yearsText(p) {
  const b = yb(p), d = yd(p);
  if (b && d) return `${b} – ${d}`;
  if (b && isDead(p)) return `${b} – ?`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  return isDead(p) ? 'Deceased' : '';
}
const approxDate = (v, approx) => (approx ? 'c. ' + year(v) : fmtDate(v));
function statusTag(p) {
  if (isDead(p)) return '<span class="tag">Deceased</span>';
  return isLiving(p) ? '<span class="tag living">Living</span>' : '';
}

function ensurePerson(id) {
  if (!S.people[id]) {
    S.people[id] = { id, name: id, gender: null, missing: true };
    console.warn(`[family] "${id}" is referenced but not defined in people{}`);
  }
  return S.people[id];
}

function buildModel(data) {
  S.meta = data.meta || {};
  S.people = {};
  for (const [id, p] of Object.entries(data.people || {})) S.people[id] = Object.assign({ id }, p);
  for (const p of Object.values(S.people)) {
    if (p.father) ensurePerson(p.father);
    if (p.mother) ensurePerson(p.mother);
  }

  /* marriages: explicit list + spouses declared on a person + implicit co-parents */
  const seen = new Map();
  const addM = (a, b, info = {}) => {
    if (!a || !b || a === b) return;
    ensurePerson(a); ensurePerson(b);
    const k = [a, b].sort().join('|') + '|' + (info.year || '');
    const loose = [a, b].sort().join('|');
    if (seen.has(k) || (!info.year && seen.has(loose))) return;
    const m = {
      a, b,
      status: (info.status || 'married').toLowerCase(),
      year: info.year != null ? info.year : info.married,
      ended: info.ended != null ? info.ended : info.divorced,
      note: info.note || '',
      implicit: !!info.implicit,
      order: S.marriages.length,
    };
    S.marriages.push(m);
    seen.set(k, m); seen.set(loose, m);
  };
  for (const m of data.marriages || []) {
    const ps = m.partners || [m.a, m.b];
    addM(ps[0], ps[1], m);
  }
  for (const p of Object.values(S.people)) {
    for (const sp of [].concat(p.spouses || [])) {
      if (typeof sp === 'string') addM(p.id, sp);
      else if (sp && sp.id) addM(p.id, sp.id, sp);
    }
  }
  for (const p of Object.values(S.people)) {
    if (p.father && p.mother) addM(p.father, p.mother, { status: 'partner', implicit: true });
  }
  S.ids = Object.keys(S.people);
  buildTree();
}

const childrenOf = pid => S.ids.filter(id => S.people[id].father === pid || S.people[id].mother === pid).sort(byBirth);
function byBirth(a, b) {
  const ya = year(S.people[a].birth), yb = year(S.people[b].birth);
  if (ya == null && yb == null) return 0;
  if (ya == null) return 1;
  if (yb == null) return -1;
  return ya - yb || String(S.people[a].birth).localeCompare(String(S.people[b].birth));
}
function parentsOf(pid) {
  const p = S.people[pid];
  return [p.father, p.mother].filter(Boolean);
}
function marriagesOf(pid) {
  return S.marriages
    .filter(m => m.a === pid || m.b === pid)
    .sort((x, y) => (year(x.year) ?? 9999) - (year(y.year) ?? 9999) || x.order - y.order);
}
const otherOf = (m, pid) => (m.a === pid ? m.b : m.a);
function coChildren(pid, other) {
  return childrenOf(pid).filter(c => {
    const p = S.people[c];
    return other ? (p.father === other || p.mother === other) : !(p.father && p.mother);
  });
}
function siblingsOf(pid) {
  const p = S.people[pid];
  const full = [], half = [];
  if (!p.father && !p.mother) return { full, half };
  for (const id of S.ids) {
    if (id === pid) continue;
    const q = S.people[id];
    const sf = p.father && q.father === p.father, sm = p.mother && q.mother === p.mother;
    if ((sf || !p.father) && (sm || !p.mother) && (sf || sm)) full.push(id);
    else if (sf || sm) half.push(id);
  }
  return { full: full.sort(byBirth), half: half.sort(byBirth) };
}
function countDesc(pid, seen = new Set()) {
  for (const c of childrenOf(pid)) if (!seen.has(c)) { seen.add(c); countDesc(c, seen); }
  return seen.size;
}

function pickRoot() {
  if (S.meta.root && S.people[S.meta.root]) return S.meta.root;
  let best = null, bestN = -1;
  for (const id of S.ids) {
    const p = S.people[id];
    if (p.father || p.mother) continue;
    const n = countDesc(id);
    if (n > bestN || (n === bestN && p.gender === 'male')) { best = id; bestN = n; }
  }
  return best || S.ids[0];
}

/* a unit = one blood descendant + all their spouses, with children grouped per union */
let uidSeq = 0;
function buildTree() {
  S.units.clear(); S.unitOf.clear(); S.gen.clear(); S.branch.clear(); S.expanded.clear();
  uidSeq = 0;
  const placed = new Set();

  const mk = (pid, depth, parent, branchId) => {
    placed.add(pid);
    const u = { id: 'u' + (++uidSeq), pid, depth, parent, row: [pid], groups: [] };
    S.units.set(u.id, u);
    S.unitOf.set(pid, u);
    S.gen.set(pid, depth);
    if (branchId) S.branch.set(pid, branchId);

    /* children without a known second parent hang from the person directly */
    const solo = coChildren(pid, null).filter(c => !placed.has(c));
    if (solo.length) u.groups.push({ spouse: null, idx: 0, m: null, kidsPids: solo });
    for (const m of marriagesOf(pid)) {
      const sp = otherOf(m, pid);
      if (u.row.includes(sp)) continue;
      u.row.push(sp);
      if (!S.unitOf.has(sp)) S.unitOf.set(sp, u);
      if (!S.gen.has(sp)) S.gen.set(sp, depth);
      if (branchId && !S.branch.has(sp)) S.branch.set(sp, branchId);
      u.groups.push({ spouse: sp, idx: u.row.length - 1, m, kidsPids: coChildren(pid, sp).filter(c => !placed.has(c)) });
    }
    for (const g of u.groups) {
      g.kids = [];
      for (const c of g.kidsPids) {
        if (placed.has(c)) continue;
        g.kids.push(mk(c, depth + 1, u, branchId || c));
      }
    }
    u.groups = u.groups.filter(g => g.spouse || g.kids.length);
    u.kids = u.groups.flatMap(g => g.kids);
    if (u.kids.length) S.expanded.set(u.id, depth < 1);
    return u;
  };

  const root = pickRoot();
  S.root = root ? mk(root, 0, null, null) : null;
  if (S.root) {
    for (const sp of S.root.row) S.branch.delete(sp);
  }
  /* people not connected to the root's descendants still get a generation guess */
  for (const id of S.ids) if (!S.gen.has(id)) {
    const kid = childrenOf(id).find(c => S.gen.has(c));
    if (kid) S.gen.set(id, S.gen.get(kid) - 1);
  }
}

function hiddenCount(u) {
  let n = 0;
  for (const k of u.kids) n += k.row.length + hiddenCount(k);
  return n;
}
function unitChain(u) {
  const out = [];
  for (let x = u; x; x = x.parent) out.unshift(x);
  return out;
}

/* ============================================================
   avatars + small renderers
   ============================================================ */

function initialsOf(p) {
  const parts = String(p.name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const a = parts[0][0] || '', b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || '');
  return (a + b).toUpperCase();
}
function gradClass(pid) {
  const g = S.people[pid] && S.people[pid].gender;
  if (g === 'male') return 'g-m' + (hash(pid) % 4);
  if (g === 'female') return 'g-f' + (hash(pid) % 4);
  return '';
}
function avatar(pid, cls = '') {
  const p = S.people[pid];
  const inner = p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy">` : esc(initialsOf(p));
  return `<span class="av ${gradClass(pid)} ${cls}">${inner}</span>`;
}
const genderCls = p => (p.gender === 'male' ? 'male' : p.gender === 'female' ? 'female' : 'x');
function displayName(p) { return p.name + (p.nickname ? ` “${p.nickname}”` : '') + (p.maidenName ? ` (née ${p.maidenName})` : ''); }

function spouseWord(pid) {
  const g = S.people[pid].gender;
  return g === 'male' ? 'Husband' : g === 'female' ? 'Wife' : 'Spouse';
}
function childWord(pid) {
  const g = S.people[pid].gender;
  return g === 'male' ? 'Son' : g === 'female' ? 'Daughter' : 'Child';
}
function marriageText(m) {
  const y = m.year != null ? year(m.year) : null, e = m.ended != null ? year(m.ended) : null;
  switch (m.status) {
    case 'divorced': return 'Divorced' + (e ? ' ' + e : '') + (y ? ` · married ${y}` : '');
    case 'separated': return 'Separated' + (e ? ' ' + e : '');
    case 'widowed': return 'Widowed' + (e ? ' ' + e : '') + (y ? ` · married ${y}` : '');
    case 'engaged': return 'Engaged' + (y ? ' ' + y : '');
    case 'partner': return 'Partner';
    default: return 'Married' + (y ? ' ' + y : '');
  }
}
const isEnded = m => m.status === 'divorced' || m.status === 'separated';

/* who is this person, in one phrase ("Son of Ibrahim & Fatima", "Wife of Omar") */
function relationPhrase(pid) {
  const p = S.people[pid];
  const pars = parentsOf(pid).map(id => firstName(id));
  if (pars.length) return `${childWord(pid)} of ${pars.join(' & ')}`;
  const ms = marriagesOf(pid);
  if (ms.length) return `${spouseWord(pid)} of ${firstName(otherOf(ms[0], pid))}`;
  return p.missing ? 'Not yet in data.json' : 'Family founder';
}
const firstName = pid => String(S.people[pid].name).split(/\s+/)[0];
const shortName = pid => {
  /* "Ahmed & Sania" style labels; spell out the full name when first names repeat */
  const f = firstName(pid);
  return S.ids.filter(id => firstName(id) === f).length > 1 ? S.people[pid].name : f;
};

/* ============================================================
   tree layout
   ============================================================ */

function computeLayout() {
  const L = new Map();
  if (!S.root) return L;
  const measure = u => {
    const rowW = u.row.length * W + (u.row.length - 1) * MG;
    const open = S.expanded.get(u.id) === true && u.kids.length;
    let kidsW = 0;
    if (open) {
      u.kids.forEach((k, i) => { kidsW += measure(k) + (i ? SG : 0); });
    }
    const rec = { rowW, kidsW, sw: Math.max(rowW, kidsW), open };
    L.set(u.id, rec);
    return rec.sw;
  };
  measure(S.root);

  const place = (u, left) => {
    const r = L.get(u.id);
    r.x = left + (r.sw - r.rowW) / 2;
    r.y = u.depth * VSTEP;
    if (r.open) {
      let k = left + (r.sw - r.kidsW) / 2;
      for (const c of u.kids) { place(c, k); k += L.get(c.id).sw + SG; }
    }
  };
  place(S.root, 0);

  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const genMin = new Map();
  for (const [id, r] of L) {
    x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.rowW); y2 = Math.max(y2, r.y + H);
    const d = S.units.get(id).depth;
    genMin.set(d, Math.min(genMin.has(d) ? genMin.get(d) : Infinity, r.x));
  }
  S.bbox = { x: x1 - 140, y: y1 - 70, w: x2 - x1 + 200, h: y2 - y1 + 140 };
  S.genMin = genMin;
  return L;
}

function personCard(pid) {
  const p = S.people[pid];
  const sub = p.occupation || p.location || '';
  return `<div class="pcard ${genderCls(p)}${isDead(p) ? ' dead' : ''}${S.selected === pid ? ' sel' : ''}" data-pid="${esc(pid)}" role="button" tabindex="0" aria-label="${esc(p.name)}">` +
    avatar(pid) +
    `<span class="pc-txt"><b>${esc(p.name)}</b>` +
    `<small class="pc-yrs">${esc(yearsText(p))}${isDead(p) ? '<span class="dagger"> †</span>' : ''}</small>` +
    (sub ? `<small>${esc(sub)}</small>` : '') + `</span></div>`;
}

function unitHTML(u) {
  let html = '';
  u.row.forEach((pid, i) => {
    if (i > 0) {
      const g = u.groups.find(x => x.idx === i);
      const m = g && g.m;
      const ended = m && isEnded(m);
      html += `<div class="wed${ended ? ' ended' : ''}${m && m.status === 'partner' ? ' partner' : ''}" title="${esc(m ? marriageText(m) : '')}"><i>${ended ? ICON.broken : ICON.heart}</i></div>`;
    }
    html += personCard(pid);
  });
  if (u.kids.length) {
    const g = u.groups.find(x => x.kids.length);
    const tx = dropX(u, g, 0);
    const n = hiddenCount(u);
    html += `<button class="tog" style="left:${tx}px" aria-label="Show or hide ${n} descendants" title="${n} descendant${n === 1 ? '' : 's'}">${ICON.chev}<span>${n}</span></button>`;
  }
  return html;
}

/* x of where a union's children branch starts (relative to row x) */
function dropX(u, g, rowX) {
  if (!g || !g.spouse) return rowX + W / 2;
  return rowX + g.idx * (W + MG) - MG / 2;
}

function relayout(animate = true) {
  const L = computeLayout();
  S.layout = L;

  for (const [id, r] of L) {
    let n = S.live.get(id);
    const u = S.units.get(id);
    if (!n) {
      const el = document.createElement('div');
      el.className = 'union enter';
      el.dataset.uid = id;
      el.innerHTML = unitHTML(u);
      $('#cards').appendChild(el);
      /* new units grow out of their parent's branch point */
      let sx = r.x, sy = r.y;
      const pl = u.parent && S.live.get(u.parent.id);
      if (animate && pl) { sx = pl.x + (r.x - pl.tx) * 0.3; sy = pl.y + H * 0.6; }
      n = { el, x: sx, y: sy, tx: r.x, ty: r.y };
      S.live.set(id, n);
      el.style.transform = `translate3d(${sx}px,${sy}px,0)`;
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('enter')));
    }
    n.tx = r.x; n.ty = r.y;
    if (!animate) { n.x = r.x; n.y = r.y; }
    n.el.classList.toggle('collapsed', u.kids.length > 0 && !r.open);
  }
  for (const [id, n] of [...S.live]) {
    if (L.has(id)) continue;
    S.live.delete(id);
    const u = S.units.get(id);
    let p = u.parent;
    while (p && !L.has(p.id)) p = p.parent;
    const pr = p && L.get(p.id);
    if (pr) { n.tx = pr.x; n.ty = pr.y + H * 0.4; }
    n.el.classList.add('dying');
    S.dying.push(n);
    setTimeout(() => { n.el.remove(); S.dying = S.dying.filter(x => x !== n); }, 450);
  }

  $('#genlabels').innerHTML = [...S.genMin]
    .sort((a, b) => a[0] - b[0])
    .map(([d, mx]) => `<div class="gen-label" style="left:${mx - 26}px;top:${d * VSTEP + H / 2}px">Gen ${ROMAN[d] || d + 1}</div>`)
    .join('');
  S.dirty = true;
  applySearchDim();
}

/* ---------- edges (drawn from the animated positions every frame they move) ---------- */
function elbow(dx, dy, by, cx, cy) {
  if (Math.abs(cx - dx) < 1) return `M${dx} ${dy}V${cy}`;
  const s = Math.sign(cx - dx);
  const r = Math.max(0, Math.min(12, Math.abs(cx - dx) / 2, by - dy, cy - by));
  return `M${dx} ${dy}V${by - r}Q${dx} ${by} ${dx + s * r} ${by}H${cx - s * r}Q${cx} ${by} ${cx} ${by + r}V${cy}`;
}

function drawEdges() {
  let out = '';
  for (const [id, n] of S.live) {
    const u = S.units.get(id);
    const r = S.layout.get(id);
    if (!r || !r.open) continue;
    const withKids = u.groups.filter(g => g.kids.length);
    withKids.forEach((g, gi) => {
      const dx = dropX(u, g, n.x);
      const dy = g.spouse ? n.y + H / 2 + 11 : n.y + H;
      const by = n.y + H + VGAP / 2 + (gi - (withKids.length - 1) / 2) * 14;
      for (const k of g.kids) {
        const kn = S.live.get(k.id);
        if (!kn) continue;
        const cx = kn.x + W / 2;
        const cls = S.hl.has(k.id) ? ' class="hl"' : '';
        out += `<path${cls} d="${elbow(dx, dy, Math.min(by, kn.y - 14), cx, kn.y)}"/>`;
      }
    });
  }
  $('#edges').innerHTML = out;
}

/* ============================================================
   camera
   ============================================================ */

function vpSize() {
  const vp = $('#viewport');
  return { w: vp.clientWidth || innerWidth, h: vp.clientHeight || innerHeight };
}
function applyCam() {
  $('#world').style.transform = `translate3d(${cam.x}px,${cam.y}px,0) scale(${cam.s})`;
  const vp = $('#viewport');
  const g = 26 * cam.s;
  vp.style.backgroundSize = `${g}px ${g}px`;
  vp.style.backgroundPosition = `${cam.x}px ${cam.y}px`;
  $('#zoompill').textContent = Math.round(cam.s * 100) + '%';
  $('#world').classList.toggle('lod', cam.s < 0.82);
}
function zoomAt(px, py, f) {
  const ns = clamp(tgt.s * f, 0.15, 2.4);
  tgt.x = px - (px - tgt.x) * (ns / tgt.s);
  tgt.y = py - (py - tgt.y) * (ns / tgt.s);
  tgt.s = ns;
  clampPan();
}
function clampPan() {
  const b = S.bbox;
  if (!b) return;
  const { w, h } = vpSize();
  const m = Math.min(w, h) * 0.4, s = tgt.s;
  const lox = w - (b.x + b.w) * s - m, hix = -b.x * s + m;
  const loy = h - (b.y + b.h) * s - m, hiy = -b.y * s + m;
  tgt.x = lox > hix ? (lox + hix) / 2 : clamp(tgt.x, lox, hix);
  tgt.y = loy > hiy ? (loy + hiy) / 2 : clamp(tgt.y, loy, hiy);
}
function fitView(minS = 0.2) {
  const b = S.bbox;
  if (!b) return;
  const { w, h } = vpSize();
  const pad = isMobile() ? 16 : 60;
  const s = clamp(Math.min((w - pad * 2) / b.w, (h - pad * 2 - 70) / b.h), minS, 1.1);
  tgt.s = s;
  tgt.x = w / 2 - (b.x + b.w / 2) * s;
  /* when the tree is taller/wider than the screen at min zoom, start at the top */
  const fitsV = b.h * s <= h - 40;
  tgt.y = fitsV ? h / 2 - (b.y + b.h / 2) * s : 30 - b.y * s;
  clampPan();
}
function centerOn(wx, wy, s) {
  const { w, h } = vpSize();
  /* on wide screens the profile panel covers the right side — centre in what's left */
  const panel = !isMobile() && w > 900 ? Math.min(472, w * 0.4) : 0;
  tgt.s = s;
  tgt.x = (w - panel) / 2 - wx * s;
  tgt.y = h * (isMobile() ? 0.3 : 0.45) - wy * s;
  clampPan();
}

function frame() {
  cam.x = near(cam.x, tgt.x, 0.2);
  cam.y = near(cam.y, tgt.y, 0.2);
  cam.s = Math.abs(tgt.s - cam.s) < 0.0005 ? tgt.s : lerp(cam.s, tgt.s, 0.2);
  applyCam();

  let moved = false;
  for (const n of [...S.live.values(), ...S.dying]) {
    if (n.x !== n.tx || n.y !== n.ty) {
      n.x = near(n.x, n.tx, 0.18);
      n.y = near(n.y, n.ty, 0.18);
      n.el.style.transform = `translate3d(${n.x}px,${n.y}px,0)`;
      moved = true;
    }
  }
  if (moved || S.dirty) { drawEdges(); S.dirty = false; }
  requestAnimationFrame(frame);
}

/* ============================================================
   gestures
   ============================================================ */

function initGestures() {
  const vp = $('#viewport');
  const pts = new Map();
  let drag = null, moved = 0, downEl = null, pinch = null;

  vp.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dismissHint();
    if (pts.size === 1) {
      drag = { x: tgt.x, y: tgt.y, px: e.clientX, py: e.clientY };
      moved = 0; downEl = e.target;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      drag = null;
    }
  });
  vp.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = vp.getBoundingClientRect();
    if (pts.size === 1 && drag) {
      const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
      moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > 4 && !vp.hasPointerCapture(e.pointerId)) { vp.setPointerCapture(e.pointerId); vp.classList.add('dragging'); }
      tgt.x = drag.x + dx; tgt.y = drag.y + dy;
      clampPan();
      cam.x = tgt.x; cam.y = tgt.y;
    } else if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch.d > 0) zoomAt(mx - rect.left, my - rect.top, d / pinch.d);
      tgt.x += mx - pinch.mx; tgt.y += my - pinch.my;
      Object.assign(cam, tgt);
      pinch = { d, mx, my };
    }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0) {
      vp.classList.remove('dragging');
      if (drag && moved < 6 && downEl) onTap(downEl);
      drag = null; downEl = null;
    }
  };
  vp.addEventListener('pointerup', end);
  vp.addEventListener('pointercancel', end);

  vp.addEventListener('wheel', e => {
    e.preventDefault();
    dismissHint();
    const rect = vp.getBoundingClientRect();
    /* pinch (ctrl+wheel) or a mouse wheel zooms; two-finger trackpad scroll pans */
    const mouseWheel = e.deltaMode !== 0 || (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40);
    if (e.ctrlKey || mouseWheel) {
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, f);
    } else {
      tgt.x -= e.deltaX; tgt.y -= e.deltaY;
      clampPan();
    }
  }, { passive: false });

  vp.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const c = e.target.closest && e.target.closest('.pcard');
      if (c) { e.preventDefault(); openDrawer(c.dataset.pid); }
    }
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('#lightbox').classList.contains('show')) return closeLightbox();
      if ($('#drawer').classList.contains('open')) return closeDrawer();
      return clearSearch();
    }
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === '/') { e.preventDefault(); openSearch(); return; }
    if (S.view !== 'tree') return;
    const { w, h } = vpSize();
    const step = 120;
    if (e.key === '+' || e.key === '=') zoomAt(w / 2, h / 2, 1.25);
    else if (e.key === '-' || e.key === '_') zoomAt(w / 2, h / 2, 0.8);
    else if (e.key === '0') fitView();
    else if (e.key === 'ArrowLeft') tgt.x += step;
    else if (e.key === 'ArrowRight') tgt.x -= step;
    else if (e.key === 'ArrowUp') tgt.y += step;
    else if (e.key === 'ArrowDown') tgt.y -= step;
    else return;
    clampPan();
  });
  window.addEventListener('resize', () => clampPan());
}

function onTap(el) {
  const tog = el.closest('.tog');
  if (tog) { toggleUnit(tog.closest('.union').dataset.uid); return; }
  const card = el.closest('.pcard');
  if (card) { openDrawer(card.dataset.pid); return; }
}

function toggleUnit(uid) {
  const u = S.units.get(uid);
  if (!u || !u.kids.length) return;
  const open = S.expanded.get(uid) !== true;
  S.expanded.set(uid, open);
  relayout();
  /* keep the toggled family in view */
  const r = S.layout.get(uid);
  if (open && r) {
    const { h } = vpSize();
    const bottom = (r.y + VSTEP + H) * tgt.s + tgt.y;
    if (bottom > h - 90) { tgt.y -= bottom - (h - 90); clampPan(); }
  }
}

function setAll(open) {
  for (const [id, u] of S.units) if (u.kids.length) S.expanded.set(id, open);
  relayout();
  setTimeout(() => fitView(), 120);
}

function initHud() {
  const c = () => { const { w, h } = vpSize(); return [w / 2, h / 2]; };
  $('#btn-zin').addEventListener('click', () => zoomAt(...c(), 1.3));
  $('#btn-zout').addEventListener('click', () => zoomAt(...c(), 1 / 1.3));
  $('#btn-fit').addEventListener('click', () => fitView());
  $('#btn-xall').addEventListener('click', () => setAll(true));
  $('#btn-call').addEventListener('click', () => setAll(false));
}
function dismissHint() { $('#hint').classList.add('off'); }

/* reveal a person in the tree and fly to them */
function revealInTree(pid, pulse = true) {
  const u = S.unitOf.get(pid);
  if (!u) { toast(`${S.people[pid].name} isn't connected to the main tree yet.`); return false; }
  for (const x of unitChain(u).slice(0, -1)) S.expanded.set(x.id, true);
  relayout();
  const r = S.layout.get(u.id);
  const i = u.row.indexOf(pid);
  const cx = r.x + i * (W + MG) + W / 2, cy = r.y + H / 2;
  centerOn(cx, cy, clamp(Math.max(tgt.s, isMobile() ? 0.75 : 0.85), 0.75, 1.2));
  if (pulse) setTimeout(() => {
    const el = $(`.union[data-uid="${u.id}"] .pcard[data-pid="${CSS.escape(pid)}"]`);
    if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }, 350);
  return true;
}

function setHighlight(pid) {
  S.hl.clear();
  const u = pid && S.unitOf.get(pid);
  if (u) unitChain(u).forEach(x => S.hl.add(x.id));
  $$('.pcard.sel').forEach(x => x.classList.remove('sel'));
  if (pid) $$(`.pcard[data-pid="${CSS.escape(pid)}"]`).forEach(x => x.classList.add('sel'));
  S.dirty = true;
}

/* ============================================================
   search
   ============================================================ */

let hits = [], hitIdx = -1;
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function matches(pid, q) {
  const p = S.people[pid];
  return [p.name, p.nickname, p.maidenName, p.occupation, p.location, p.birthPlace, year(p.birth)].some(v => v != null && norm(v).includes(q));
}
function mark(text, q) {
  const t = String(text || ''), i = norm(t).indexOf(q);
  if (!q || i < 0) return esc(t);
  return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
}

function initSearch() {
  const input = $('#search');
  input.addEventListener('input', () => {
    S.query = norm(input.value.trim());
    hitIdx = -1;
    hits = S.query ? S.ids.filter(id => matches(id, S.query)).sort((a, b) => {
      const sa = norm(S.people[a].name).startsWith(S.query) ? 0 : 1, sb = norm(S.people[b].name).startsWith(S.query) ? 0 : 1;
      return sa - sb || S.people[a].name.localeCompare(S.people[b].name);
    }).slice(0, 12) : [];
    renderResults();
    applySearchDim();
    if (S.view === 'people') renderPeople();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); hitIdx = Math.min(hitIdx + 1, hits.length - 1); hiRes(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hitIdx = Math.max(hitIdx - 1, 0); hiRes(); }
    else if (e.key === 'Enter' && hits.length) { e.preventDefault(); choose(hits[Math.max(0, hitIdx)]); }
  });
  input.addEventListener('focus', () => { if (S.query) renderResults(); });
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('#search-wrap') && !e.target.closest('#btn-search-m')) {
      $('#results').classList.remove('show');
      if (!S.query) document.body.classList.remove('msearch');
    }
  });
  $('#btn-search-m').addEventListener('click', openSearch);
}
function openSearch() {
  document.body.classList.add('msearch');
  setTimeout(() => $('#search').focus(), 30);
}
function renderResults() {
  const box = $('#results');
  if (!S.query) { box.classList.remove('show'); return; }
  box.innerHTML = hits.length ? hits.map((pid, i) => {
    const p = S.people[pid];
    const sub = [yearsText(p), p.occupation, p.location].filter(Boolean).join(' · ');
    return `<button class="result${i === hitIdx ? ' sel' : ''}" data-pid="${esc(pid)}" role="option">${avatar(pid)}<span class="r-txt"><b>${mark(p.name, S.query)}</b><small>${mark(sub, S.query)}</small></span></button>`;
  }).join('') : `<div class="empty">No one matches “${esc($('#search').value)}”</div>`;
  $$('.result', box).forEach(b => b.addEventListener('click', () => choose(b.dataset.pid)));
  box.classList.add('show');
}
function hiRes() { $$('#results .result').forEach((el, i) => el.classList.toggle('sel', i === hitIdx)); }
function clearSearch() {
  S.query = ''; hits = [];
  $('#search').value = '';
  $('#results').classList.remove('show');
  document.body.classList.remove('msearch');
  applySearchDim();
  if (S.view === 'people') renderPeople();
}
function choose(pid) {
  clearSearch();
  $('#search').blur();
  if (S.view === 'tree') revealInTree(pid);
  openDrawer(pid);
}
function applySearchDim() {
  const q = S.query;
  document.body.classList.toggle('searching', !!q && S.view === 'tree');
  $$('#cards .pcard').forEach(el => el.classList.toggle('hit', !!q && matches(el.dataset.pid, q)));
}

/* ============================================================
   profile drawer
   ============================================================ */

function relRow(pid, role) {
  const p = S.people[pid];
  return `<button class="rel" data-go="${esc(pid)}">${avatar(pid)}<span class="r-txt"><b>${esc(p.name)}</b><small>${esc([role, yearsText(p)].filter(Boolean).join(' · '))}</small></span>${ICON.right}</button>`;
}
function relGroup(title, rows) {
  if (!rows.length) return '';
  return `<div class="rel-group"><small>${esc(title)}</small><div class="rels">${rows.join('')}</div></div>`;
}

function personEvents(pid) {
  const p = S.people[pid];
  const ev = (p.timeline || []).map(e => ({ year: year(e.year), date: e.year, title: e.title, text: e.text || '', kind: 'own' }));
  const has = y => ev.some(e => e.year === y);
  const by = year(p.birth);
  if (by != null && !has(by)) ev.push({ year: by, date: p.birth, title: 'Born' + (p.birthPlace ? ' in ' + p.birthPlace : ''), text: parentsOf(pid).length ? `${childWord(pid)} of ${parentsOf(pid).map(id => S.people[id].name).join(' and ')}.` : '', kind: 'birth' });
  for (const m of marriagesOf(pid)) {
    const o = S.people[otherOf(m, pid)];
    const y = year(m.year);
    if (y != null && !has(y)) ev.push({ year: y, date: m.year, title: (m.status === 'engaged' ? 'Engaged to ' : 'Married ') + o.name, text: m.note || '', kind: 'wed' });
    const e = year(m.ended);
    if (e != null && isEnded(m) && !has(e)) ev.push({ year: e, date: m.ended, title: (m.status === 'separated' ? 'Separated from ' : 'Divorced from ') + o.name, text: '', kind: 'div' });
  }
  for (const c of childrenOf(pid)) {
    const y = year(S.people[c].birth);
    if (y != null && !has(y)) ev.push({ year: y, date: S.people[c].birth, title: `${childWord(c)} ${firstName(c)} is born`, text: '', kind: 'child' });
  }
  const dy = year(p.death);
  if (dy != null && !has(dy)) ev.push({ year: dy, date: p.death, title: 'Passed away' + (p.deathPlace ? ' in ' + p.deathPlace : ''), text: ageOf(p) != null ? `Aged ${ageOf(p)}.` : '', kind: 'death' });
  return ev.sort((a, b) => a.year - b.year);
}

function openDrawer(pid, push = true) {
  if (!pid || !S.people[pid]) return;
  S.selected = pid;
  setHighlight(pid);
  const p = S.people[pid];
  const age = ageOf(p);
  const gen = S.gen.get(pid);
  const dead = isDead(p);

  /* --- hero --- */
  const tags = [];
  tags.push(statusTag(p));
  if (p.gender) tags.push(`<span class="tag ${genderCls(p)}">${p.gender === 'male' ? 'Male' : p.gender === 'female' ? 'Female' : esc(p.gender)}</span>`);
  if (gen != null) tags.push(`<span class="tag">Generation ${ROMAN[gen] || gen + 1}</span>`);
  if (S.branch.get(pid) && S.branch.get(pid) !== pid) tags.push(`<span class="tag">${esc(firstName(S.branch.get(pid)))}'s branch</span>`);

  let html = `<div class="d-cover ${genderCls(p)}"></div><div class="d-hero">${avatar(pid)}
    <h2 class="d-name">${esc(displayName(p))}</h2>
    <p class="d-sub">${esc(relationPhrase(pid))}</p>
    <div class="d-tags">${tags.join('')}</div>
    <div class="d-actions">
      <button class="btn primary" data-act="tree">${ICON.tree}Show in tree</button>
      <button class="btn" data-act="share">${ICON.share}Copy link</button>
    </div></div>`;

  /* --- key facts --- */
  const facts = [];
  if (p.birth != null) facts.push(['Born', approxDate(p.birth, p.birthApprox) + (p.birthPlace ? ' · ' + p.birthPlace : '')]);
  if (dead) facts.push(['Died', (approxDate(p.death, p.deathApprox) || 'Unknown') + (p.deathPlace ? ' · ' + p.deathPlace : '')]);
  if (age != null) facts.push([dead ? 'Lived to' : 'Age', (p.birthApprox || p.deathApprox ? 'about ' : '') + (age < 1 && !dead ? 'under 1 year' : age + (age === 1 ? ' year' : ' years'))]);
  if (p.maidenName) facts.push(['Maiden name', p.maidenName]);
  if (p.occupation) facts.push(['Occupation', p.occupation]);
  if (p.location) facts.push([dead ? 'Lived in' : 'Lives in', p.location]);
  const nd = countDesc(pid);
  if (nd) facts.push(['Descendants', nd]);
  for (const [k, v] of Object.entries(p.details || {})) facts.push([k, v]);
  if (facts.length) html += `<section class="dsec"><h3 class="d-h">Details</h3><div class="facts">${facts.map(([k, v]) => `<div class="fact"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div></section>`;

  /* --- family --- */
  const fam = [];
  const pars = parentsOf(pid);
  fam.push(relGroup('Parents', pars.map(id => relRow(id, id === p.father ? 'Father' : 'Mother'))));
  const ms = marriagesOf(pid);
  fam.push(relGroup(ms.length > 1 ? `Spouses (${ms.length})` : 'Spouse', ms.map(m => relRow(otherOf(m, pid), marriageText(m)))));
  const kids = childrenOf(pid);
  if (kids.length) {
    const groups = new Map();
    for (const c of kids) {
      const q = S.people[c];
      const other = q.father === pid ? q.mother : q.father;
      const key = other || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    if (groups.size === 1) fam.push(relGroup(`Children (${kids.length})`, kids.map(c => relRow(c, childWord(c)))));
    else for (const [o, list] of groups) fam.push(relGroup(o ? `Children with ${S.people[o].name}` : 'Children (other parent unknown)', list.map(c => relRow(c, childWord(c)))));
  }
  const sib = siblingsOf(pid);
  const sibWord = id => (S.people[id].gender === 'male' ? 'Brother' : S.people[id].gender === 'female' ? 'Sister' : 'Sibling');
  fam.push(relGroup('Siblings', sib.full.map(id => relRow(id, sibWord(id)))));
  fam.push(relGroup('Half-siblings', sib.half.map(id => {
    const q = S.people[id];
    const via = q.father && q.father === p.father ? 'same father' : 'same mother';
    return relRow(id, `Half-${sibWord(id).toLowerCase()} · ${via}`);
  })));
  const famHTML = fam.join('');
  if (famHTML) html += `<section class="dsec"><h3 class="d-h">Family</h3>${famHTML}</section>`;

  if (p.bio) html += `<section class="dsec"><h3 class="d-h">Biography</h3><p class="d-bio">${esc(p.bio)}</p></section>`;

  const ev = personEvents(pid);
  if (ev.length) {
    html += `<section class="dsec"><h3 class="d-h">Life timeline</h3><div class="tl">${ev.map(e =>
      `<div class="tl-item"><span class="tl-year">${esc(e.date && String(e.date).length > 4 ? fmtDate(e.date) : e.year)}</span><div class="tl-title">${esc(e.title)}</div>${e.text ? `<p class="tl-text">${esc(e.text)}</p>` : ''}</div>`).join('')}</div></section>`;
  }

  const photos = (p.photos || []).map(x => (typeof x === 'string' ? { caption: x } : x));
  html += `<section class="dsec"><h3 class="d-h">Photos</h3><div class="phgrid">${photos.length
    ? photos.map((ph, i) => photoTile(ph, i)).join('')
    : `<figure class="ph ghost">${ICON.img}<figcaption>No photos yet</figcaption></figure>`}</div></section>`;

  const body = $('#drawer-body');
  body.innerHTML = html;
  body.scrollTop = 0;
  body._photos = photos;

  $$('[data-go]', body).forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.go;
    if (S.view === 'tree') revealInTree(id, true);
    openDrawer(id);
  }));
  $('[data-act="tree"]', body).addEventListener('click', () => {
    if (isMobile()) closeDrawer();
    setView('tree', false);
    requestAnimationFrame(() => revealInTree(pid));
  });
  $('[data-act="share"]', body).addEventListener('click', () => copyLink(pid));
  $$('.ph[data-i]', body).forEach(f => f.addEventListener('click', () => openLightbox(photos[+f.dataset.i], +f.dataset.i)));

  const d = $('#drawer');
  d.style.removeProperty('--drag');
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  if (isMobile()) $('#scrim').classList.add('show');
  if (push) syncHash();
}

function photoTile(item, i) {
  const m = String(item.caption || '').match(/(1[89]|20)\d{2}/);
  const y = item.year || (m && m[0]);
  const media = item.src ? `<img src="${esc(item.src)}" alt="${esc(item.caption || '')}" loading="lazy">` : `<div class="ph-art">${ICON.img}</div>`;
  return `<figure class="ph" data-i="${i}" tabindex="0">${media}${y ? `<span class="ph-year">${esc(y)}</span>` : ''}<figcaption>${esc(item.caption || '')}</figcaption></figure>`;
}
function openLightbox(item, i) {
  const lb = $('#lightbox');
  lb.innerHTML = `<figure>${photoTile(item, i)}</figure>`;
  lb.classList.add('show');
  lb.setAttribute('aria-hidden', 'false');
}
function closeLightbox() {
  $('#lightbox').classList.remove('show');
  $('#lightbox').setAttribute('aria-hidden', 'true');
}

function closeDrawer(push = true) {
  const d = $('#drawer');
  d.classList.remove('open');
  d.setAttribute('aria-hidden', 'true');
  $('#scrim').classList.remove('show');
  S.selected = null;
  setHighlight(null);
  if (push) syncHash();
}

function initDrawer() {
  $('#drawer-close').addEventListener('click', () => closeDrawer());
  $('#scrim').addEventListener('click', () => closeDrawer());
  $('#lightbox').addEventListener('click', closeLightbox);

  /* swipe the bottom sheet down to close (mobile) */
  const d = $('#drawer'), grab = $('.grab');
  let y0 = null, dy = 0;
  const start = e => { y0 = e.clientY; dy = 0; d.classList.add('dragging'); grab.setPointerCapture(e.pointerId); };
  grab.addEventListener('pointerdown', start);
  grab.addEventListener('pointermove', e => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    d.style.setProperty('--drag', dy + 'px');
  });
  const stop = () => {
    if (y0 == null) return;
    y0 = null;
    d.classList.remove('dragging');
    if (dy > 110) closeDrawer();
    else d.style.removeProperty('--drag');
  };
  grab.addEventListener('pointerup', stop);
  grab.addEventListener('pointercancel', stop);
}

async function copyLink(pid) {
  const url = location.href.split('#')[0] + '#' + S.view + '/' + encodeURIComponent(pid);
  try {
    if (navigator.share && isMobile()) await navigator.share({ title: S.people[pid].name, url });
    else { await navigator.clipboard.writeText(url); toast('Link copied to clipboard'); }
  } catch (e) {
    if (e && e.name !== 'AbortError') toast(url);
  }
}

/* ============================================================
   members view
   ============================================================ */

function renderStats() {
  const all = S.ids.filter(id => !S.people[id].missing);
  const living = all.filter(id => isLiving(S.people[id]));
  const gens = new Set([...S.gen.values()]).size;
  const kids = all.filter(id => isLiving(S.people[id]) && NOW_YEAR - year(S.people[id].birth) < 18);
  const branches = S.root ? S.root.kids.length : 0;
  const stats = [
    [all.length, 'Members'], [gens, 'Generations'], [living.length, 'Living'],
    [S.marriages.filter(m => !m.implicit).length, 'Marriages'], [branches, 'Branches'], [kids.length, 'Under 18'],
  ];
  $('#stats').innerHTML = stats.map(([v, l]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
}

function memberCard(pid, i) {
  const p = S.people[pid];
  const meta = [];
  meta.push(`<span>${ICON.link}<em>${esc(relationPhrase(pid))}</em></span>`);
  if (p.occupation) meta.push(`<span>${ICON.job}<em>${esc(p.occupation)}</em></span>`);
  if (p.location) meta.push(`<span>${ICON.pin}<em>${esc(p.location)}</em></span>`);
  const age = ageOf(p);
  const tags = [statusTag(p)].filter(Boolean);
  if (age != null) tags.push(`<span class="tag">${isDead(p) ? 'Lived ' + age : age < 1 ? 'Baby' : 'Age ' + age}</span>`);
  const ms = marriagesOf(pid);
  if (ms.length > 1) tags.push(`<span class="tag">${ms.length} marriages</span>`);
  const kc = childrenOf(pid).length;
  if (kc) tags.push(`<span class="tag">${kc} ${kc === 1 ? 'child' : 'children'}</span>`);
  return `<button class="mcard" data-pid="${esc(pid)}" style="animation-delay:${Math.min(i, 20) * 22}ms">
    <div class="mc-top">${avatar(pid)}<div class="mc-name"><b>${esc(displayName(p))}</b><small>${esc(yearsText(p))}</small></div></div>
    <div class="mc-meta">${meta.join('')}</div>
    ${p.bio ? `<p class="mc-bio">${esc(p.bio)}</p>` : ''}
    <div class="mc-foot">${tags.join('')}</div></button>`;
}

function renderPeople() {
  let list = S.ids.filter(id => !S.people[id].missing || S.query);
  const f = S.filter;
  if (f === 'living') list = list.filter(id => isLiving(S.people[id]));
  if (f === 'deceased') list = list.filter(id => isDead(S.people[id]));
  if (f === 'male' || f === 'female') list = list.filter(id => S.people[id].gender === f);
  if (S.query) list = list.filter(id => matches(id, S.query));

  const groups = new Map();
  const add = (k, id) => { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(id); };
  if (S.groupBy === 'gen') {
    list.forEach(id => add(S.gen.has(id) ? S.gen.get(id) : 99, id));
  } else if (S.groupBy === 'branch') {
    list.forEach(id => add(S.branch.get(id) || '', id));
  } else if (S.groupBy === 'place') {
    list.forEach(id => add(S.people[id].location ? S.people[id].location.split(',').pop().trim() : 'Unknown', id));
  } else {
    list.forEach(id => add(S.people[id].name[0].toUpperCase(), id));
  }

  let keys = [...groups.keys()];
  if (S.groupBy === 'gen') keys.sort((a, b) => a - b);
  else if (S.groupBy === 'branch') keys.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : byBirth(a, b)));
  else keys.sort((a, b) => (a === 'Unknown') - (b === 'Unknown') || String(a).localeCompare(String(b)));

  const title = k => {
    if (S.groupBy === 'gen') return k === 99 ? 'Not linked to the tree' : `Generation ${ROMAN[k] || k + 1}`;
    if (S.groupBy === 'branch') return k ? `${S.people[k].name}'s branch` : 'Founders';
    return k;
  };
  const sortIn = S.groupBy === 'az' ? (a, b) => S.people[a].name.localeCompare(S.people[b].name) : byBirth;

  let i = 0;
  $('#people-list').innerHTML = keys.length ? keys.map(k => {
    const ids = groups.get(k).sort(sortIn);
    return `<section class="group"><div class="group-h"><h2>${esc(title(k))}</h2><span>${ids.length} ${ids.length === 1 ? 'person' : 'people'}</span></div>
      <div class="grid">${ids.map(id => memberCard(id, i++)).join('')}</div></section>`;
  }).join('') : `<div class="no-results">No family members match these filters.</div>`;
}

function initPeople() {
  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    S.filter = b.dataset.f;
    $$('#filters .chip').forEach(x => x.classList.toggle('on', x === b));
    renderPeople();
  });
  $('#groupby').addEventListener('change', e => { S.groupBy = e.target.value; renderPeople(); });
  $('#people-list').addEventListener('click', e => {
    const c = e.target.closest('.mcard');
    if (c) openDrawer(c.dataset.pid);
  });
}

/* ============================================================
   family timeline view
   ============================================================ */

function renderTimeline() {
  const ev = [];
  for (const id of S.ids) {
    const p = S.people[id];
    if (p.missing) continue;
    const by = year(p.birth), dy = year(p.death);
    if (by != null) ev.push({ y: by, approx: p.birthApprox, pid: id, kind: 'birth', t: `${p.name} is born`, d: [p.birthPlace, parentsOf(id).length ? `${childWord(id)} of ${parentsOf(id).map(firstName).join(' & ')}` : ''].filter(Boolean).join(' · ') });
    if (dy != null) ev.push({ y: dy, approx: p.deathApprox, pid: id, kind: 'death', t: `${p.name} passes away`, d: ageOf(p) != null ? `Aged ${ageOf(p)}` : '' });
    for (const e of p.timeline || []) {
      const y = year(e.year);
      if (y == null || y === by || y === dy || /^(marr|wed)/i.test(e.title)) continue;
      ev.push({ y, pid: id, kind: 'own', t: e.title, d: `${firstName(id)} — ${e.text || ''}`.replace(/ — $/, '') });
    }
  }
  for (const m of S.marriages) {
    if (m.implicit) continue;
    const y = year(m.year);
    const a = S.people[m.a], b = S.people[m.b];
    if (y != null) ev.push({ y, pid: m.a, kind: 'wed', t: `${a.name} & ${b.name} marry`, d: m.note || '' });
    const e = year(m.ended);
    if (e != null && isEnded(m)) ev.push({ y: e, pid: m.a, kind: 'div', t: `${a.name} & ${b.name} divorce`, d: '' });
  }
  ev.sort((a, b) => a.y - b.y || (a.kind === 'birth') - (b.kind === 'birth'));

  const icon = k => (k === 'birth' ? ICON.birth : k === 'death' ? ICON.death : k === 'wed' ? ICON.ring : k === 'div' ? ICON.broken : ICON.dot);
  let lastDec = null, html = '<div class="ftl">';
  for (const e of ev) {
    const dec = Math.floor(e.y / 10) * 10;
    if (dec !== lastDec) { html += `<div class="ftl-decade">${dec}s</div>`; lastDec = dec; }
    html += `<button class="ftl-item k-${e.kind}" data-pid="${esc(e.pid)}">${avatar(e.pid)}<div><div class="ftl-y">${e.approx ? 'c. ' : ''}${e.y}</div><div class="ftl-t">${esc(e.t)}</div>${e.d ? `<div class="ftl-d">${esc(e.d)}</div>` : ''}</div><span class="ftl-ic">${icon(e.kind)}</span></button>`;
  }
  html += '</div>';
  $('#family-timeline').innerHTML = ev.length ? html : '<div class="no-results">Add birth years and timeline entries in data.json to see them here.</div>';
}

/* ============================================================
   views, routing, theme
   ============================================================ */

let rendered = { people: false, timeline: false };
function setView(v, push = true) {
  if (!['tree', 'people', 'timeline'].includes(v)) v = 'tree';
  S.view = v;
  document.body.dataset.view = v;
  $$('.view').forEach(el => el.classList.toggle('on', el.id === 'view-' + v));
  $$('#tabs button, #bottom-nav button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  if (v === 'people') renderPeople();
  if (v === 'timeline' && !rendered.timeline) { renderTimeline(); rendered.timeline = true; }
  if (v === 'tree') { clampPan(); S.dirty = true; }
  applySearchDim();
  if (push) syncHash();
}

function syncHash() {
  const h = '#' + S.view + (S.selected ? '/' + encodeURIComponent(S.selected) : '');
  if (location.hash !== h) history.replaceState(null, '', h);
}
function readHash(first) {
  const [v, pid] = location.hash.replace(/^#/, '').split('/');
  setView(v || 'tree', false);
  const id = pid && decodeURIComponent(pid);
  if (id && S.people[id]) {
    if (S.view === 'tree') revealInTree(id, !first);
    openDrawer(id, false);
  } else if ($('#drawer').classList.contains('open')) closeDrawer(false);
}

function initNav() {
  $$('#tabs button, #bottom-nav button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  window.addEventListener('hashchange', () => readHash(false));
  $('.brand').addEventListener('click', e => { e.preventDefault(); closeDrawer(false); setView('tree'); fitView(); });
}

function initTheme() {
  $('#btn-theme').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('ft-theme', root.dataset.theme); } catch (e) {}
  });
}

let toastT = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 3200);
}

function applyMeta() {
  const name = S.meta.familyName || 'Our Family';
  const tag = S.meta.tagline || 'Family tree';
  $('#brand-name').textContent = name;
  $('#brand-sub').textContent = tag;
  $('#hero-title').textContent = name;
  $('#hero-tagline').textContent = S.meta.description || tag;
  $('#hero-eyebrow').textContent = 'Family members';
  document.title = name + ' · Family Tree';
}

/* ============================================================
   boot
   ============================================================ */

(async function main() {
  initGestures(); initHud(); initSearch(); initDrawer(); initPeople(); initNav(); initTheme();
  try {
    const data = await loadData();
    buildModel(data);
    applyMeta();
    renderStats();
    if (new URLSearchParams(location.search).has('expand')) for (const [id, u] of S.units) if (u.kids.length) S.expanded.set(id, true);
    relayout(false);
    if (isMobile() && S.root) {
      /* phones: start readable, founders at the top — pinch out for the overview */
      const r = S.layout.get(S.root.id);
      const s = 0.72, { w } = vpSize();
      tgt.s = s;
      tgt.x = w / 2 - (r.x + W / 2) * s;
      tgt.y = 70 - r.y * s;
      clampPan();
    } else fitView(0.5);
    Object.assign(cam, tgt);
    readHash(true);
    requestAnimationFrame(frame);
    setTimeout(dismissHint, 8000);
  } catch (err) {
    console.error(err);
    $('#loading p').textContent = 'Could not load data.json — ' + err.message;
    $('.spinner').style.display = 'none';
    return;
  }
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').remove(), 600);
})();
