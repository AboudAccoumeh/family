'use strict';

/* ============================================================
   Family Tree — biology-style top-down infinite canvas
   ancestors on top → descendants below, axis-aligned lines
   ============================================================ */

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 4);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const near = (a, b, k) => (Math.abs(b - a) < 0.001 ? b : lerp(a, b, k));

const NS = 'http://www.w3.org/2000/svg';
/* geometry: circles + marriage gap + sibling-subtree gap + branch clearance */
const C = 86, MG = 30, CG = 52, BAR1 = 44, BAR2 = 44;
const VSTEP = C + BAR1 + BAR2;
const MALE_G = ['g-m0', 'g-m1', 'g-m2', 'g-m3'];
const FEMALE_G = ['g-f0', 'g-f1', 'g-f2', 'g-f3'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const CHEV = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const ICON_IMG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 15.5l-4.8-4-7.4 6.5"/></svg>';

/* ---------- state ---------- */
const state = {
  people: {}, meta: {}, root: null,
  unions: new Map(), expanded: new Map(),
  pos: new Map(), nodes: new Map(), edges: new Map(),
  bbox: null, depthMinX: new Map(), svgO: { x: 0, y: 0 },
  query: '', selected: null, uid: 0, boot: true,
};
const cur = { x: 0, y: 0, s: 0.7 };
const target = { x: 0, y: 0, s: 0.7 };

/* ============================================================
   data loading + model
   ============================================================ */

async function loadData() {
  try {
    const r = await fetch('data.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } catch (err) {
    if (window.FAMILY_DATA_FALLBACK) {
      showToast('Loaded the offline copy (data.js). Serve the folder over HTTP to load data.json directly.');
      return window.FAMILY_DATA_FALLBACK;
    }
    showToast('Could not load data.json — run a local server (e.g. “python -m http.server”).');
    throw err;
  }
}

function ensurePerson(id) {
  if (!state.people[id]) {
    state.people[id] = {
      name: 'Unknown (' + id + ')',
      gender: null,
      bio: 'This record is missing from data.json — add it to the "people" section.',
    };
  }
  return state.people[id];
}

function makeUnion(raw, depth, parent) {
  const partners = Array.isArray(raw)
    ? raw.filter(Boolean)
    : (raw && Array.isArray(raw.partners) ? raw.partners.filter(Boolean) : [raw].filter(Boolean));
  if (!partners.length) partners.push('unknown-' + (state.uid + 1));
  partners.forEach(ensurePerson);

  const u = { id: 'u' + (++state.uid), partners, children: [], depth, parent };
  state.unions.set(u.id, u);

  if (raw && !Array.isArray(raw) && Array.isArray(raw.children)) {
    for (const c of raw.children) u.children.push(makeUnion(c, depth + 1, u));
  }
  // default: only the founding couple is expanded (grandkids hide until first expand)
  if (u.children.length) state.expanded.set(u.id, depth < 1);
  return u;
}

function buildModel(data) {
  state.people = {};
  for (const [id, p] of Object.entries(data.people || {})) state.people[id] = p;
  state.meta = data.meta || {};
  state.root = makeUnion(data.tree, 0, null);
}

function countDescPeople(u) {
  let n = 0;
  for (const c of u.children) n += c.partners.filter(Boolean).length + countDescPeople(c);
  return n;
}

function initialsOf(p) {
  const parts = String(p.name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const second = parts.length > 1 ? (parts[parts.length - 1][0] || '') : (parts[0][1] || '');
  return (first + second).toUpperCase();
}

function gradClass(pid, gender) {
  if (gender === 'male') return MALE_G[hash(pid) % MALE_G.length];
  if (gender === 'female') return FEMALE_G[hash(pid) % FEMALE_G.length];
  return 'g-x';
}

function yearsText(p) {
  if (p.birth && p.death) return p.birth + ' – ' + p.death;
  if (p.birth) return 'b. ' + p.birth;
  if (p.death) return 'd. ' + p.death;
  return '·';
}

/* ============================================================
   layout — vertical layered tree (generations stack downward)
   ============================================================ */

function measureRow(u) {
  return u.partners.length > 1 ? C * 2 + MG : C;
}

function computeLayout() {
  state.pos.clear();
  state.depthMinX = new Map();

  /* pass 1 — bottom-up subtree widths */
  const measure = u => {
    const rowW = measureRow(u);
    const collapsed = state.expanded.get(u.id) === false;
    const rec = { rowW, collapsed, couple: u.partners.length > 1 };
    if (!collapsed && u.children.length) {
      const w = u.children.map(measure);
      let kidsW = w[0];
      for (let i = 1; i < w.length; i++) kidsW += CG + w[i];
      rec.kidsW = kidsW;
      rec.sw = Math.max(rowW, kidsW);
    } else {
      rec.kidsW = 0;
      rec.sw = rowW;
    }
    state.pos.set(u.id, rec);
    return rec.sw;
  };
  measure(state.root);

  /* pass 2 — top-down placement: parents centered above their children */
  const place = (u, left, depth) => {
    const rec = state.pos.get(u.id);
    rec.x = left + rec.sw / 2 - rec.rowW / 2;
    rec.cx = left + rec.sw / 2;
    rec.y = depth * VSTEP;
    rec.depth = depth;
    if (rec.kidsW) {
      let kursor = left + (rec.sw - rec.kidsW) / 2;
      for (const c of u.children) {
        place(c, kursor, depth + 1);
        kursor += state.pos.get(c.id).sw + CG;
      }
    }
  };
  place(state.root, 0, 0);

  /* bbox + leftmost node per generation (for the labels) */
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [, r] of state.pos) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.rowW);
    y2 = Math.max(y2, r.y + C);
    const m = state.depthMinX.get(r.depth);
    state.depthMinX.set(r.depth, m == null ? r.x : Math.min(m, r.x));
  }
  state.bbox = { x: x1 - 90, y: y1 - 110, w: x2 - x1 + 180, h: y2 - y1 + 170 };
}

/* where a branch line meets a couple (marriage line) or a single (circle top) */
function joinTopY(r) {
  return r.couple ? r.y + C / 2 : r.y;
}
function dropOriginY(r) {
  return r.couple ? r.y + C / 2 : r.y + C;
}

/* ============================================================
   DOM sync
   ============================================================ */

function nodeHTML(pid, depth) {
  const p = state.people[pid];
  const grad = gradClass(pid, p.gender);
  const frame = 'd' + Math.min(depth, 3); // frame style depends on generation
  const inner = p.photo
    ? `<img class="nimg" src="${esc(p.photo)}" alt="">`
    : `<span class="nname${p.gender === 'female' ? ' ff' : ''}">${esc(p.name)}</span>`;
  return `<div class="node ${grad} ${frame}" data-pid="${esc(pid)}" tabindex="0" title="${esc(p.name)}  ·  ${esc(yearsText(p))}">` +
    `<i class="frame" aria-hidden="true"></i>${inner}</div>`;
}

function createUnion(u) {
  const p = state.pos.get(u.id);
  const el = document.createElement('div');
  el.className = 'union';
  el.dataset.uid = u.id;

  let inner = '';
  u.partners.forEach((pid, i) => {
    inner += nodeHTML(pid, u.depth);
    if (i < u.partners.length - 1) inner += '<div class="wed" aria-hidden="true"><i></i></div>';
  });
  if (u.children.length) {
    const n = countDescPeople(u);
    inner += `<button class="chev" title="Toggle branch — ${n} descendant${n === 1 ? '' : 's'} inside" aria-expanded="true">${CHEV}</button>`;
    inner += `<span class="chip-hid">+${n} hidden</span>`;
  }
  el.innerHTML = inner;

  /* enter animation starts from the parent's marriage point */
  let ox = p.x, oy = p.y;
  if (u.parent && state.pos.get(u.parent.id)) {
    const pp = state.pos.get(u.parent.id);
    ox = pp.cx - C / 2;
    oy = dropOriginY(pp) - C / 2;
  }
  el.style.transform = `translate3d(${ox}px, ${oy}px, 0) scale(0.7)`;
  el.classList.add('enter');

  const stagger = state.boot ? u.depth * 130 + 160 : 0;
  if (stagger) el.style.transitionDelay = stagger + 'ms, ' + (stagger + 240) + 'ms';

  $('#cards').appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.remove('enter');
    el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(1)`;
    if (stagger) setTimeout(() => { el.style.transitionDelay = ''; }, stagger + 900);
  }));

  state.nodes.set(u.id, { el, chev: $('.chev', el) });
}

function destroyUnion(uid) {
  const n = state.nodes.get(uid);
  const u = state.unions.get(uid);
  if (!n || !u) return;
  state.nodes.delete(uid);

  let ax, ay;
  if (u.parent && state.pos.get(u.parent.id)) {
    const pp = state.pos.get(u.parent.id);
    ax = pp.cx - C / 2;
    ay = dropOriginY(pp) - C / 2;
  } else if (state.bbox) {
    ax = state.bbox.x + state.bbox.w / 2;
    ay = state.bbox.y + state.bbox.h / 2;
  } else { ax = 0; ay = 0; }

  n.el.classList.add('dying');
  n.el.style.transform = `translate3d(${ax}px, ${ay}px, 0) scale(0.6)`;
  setTimeout(() => n.el.remove(), 620);
}

function relayout() {
  computeLayout();

  const alive = new Set(state.pos.keys());
  for (const uid of alive) if (!state.nodes.has(uid)) createUnion(state.unions.get(uid));
  for (const uid of [...state.nodes.keys()]) if (!alive.has(uid)) destroyUnion(uid);

  for (const [uid, n] of state.nodes) {
    const p = state.pos.get(uid);
    n.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(1)`;
    const collapsed = state.expanded.get(uid) === false;
    n.el.classList.toggle('collapsed', collapsed);
    if (n.chev) n.chev.setAttribute('aria-expanded', String(!collapsed));
  }

  syncEdges();
  renderGenLabels();
  applySearchDim();
}

/* ============================================================
   edges — axis-aligned biology-tree branches
   one path per expanded parent: drop → horizontal bar → risers
   ============================================================ */

function edgeD(rec, a, o) {
  /* a = world coordinates, o = svg origin — PATH must live in svg space */
  if (rec.n === 1) {
    return `M ${a[0] - o.x} ${a[1] - o.y} L ${a[2] - o.x} ${a[3] - o.y}`;
  }
  const barY = a[2] - o.y, bx1 = a[3] - o.x, bx2 = a[4] - o.x;
  let d = `M ${a[0] - o.x} ${a[1] - o.y} V ${barY} M ${bx1} ${barY} H ${bx2}`;
  for (let i = 5; i < a.length; i += 2) d += ` M ${a[i] - o.x} ${barY} V ${a[i + 1] - o.y}`;
  return d;
}

function paintEdge(rec) {
  const o = state.svgO;
  rec.path.setAttribute('d', edgeD(rec, rec.pts, o));
  for (let j = 0; j < rec.dots.length; j++) {
    rec.dots[j].setAttribute('cx', rec.pts[5 + 2 * j] - o.x);
    rec.dots[j].setAttribute('cy', rec.pts[2] - o.y);
  }
}

function syncEdges() {
  const svg = $('#edges');
  const pad = 240;
  const ox = Math.round(state.bbox.x - pad), oy = Math.round(state.bbox.y - pad);
  state.svgO = { x: ox, y: oy };
  svg.style.left = ox + 'px';
  svg.style.top = oy + 'px';
  svg.style.width = (state.bbox.w + pad * 2) + 'px';
  svg.style.height = (state.bbox.h + pad * 2) + 'px';

  /* desired branch bundles, one per expanded parent */
  const want = new Map();
  for (const [uid, r] of state.pos) {
    const u = state.unions.get(uid);
    if (state.expanded.get(uid) === false) continue;
    const kids = u.children.filter(c => state.pos.has(c.id));
    if (!kids.length) continue;

    const py0 = dropOriginY(r);
    const targets = kids.map(c => {
      const cr = state.pos.get(c.id);
      return [cr.cx, joinTopY(cr)];
    });

    let pts;
    if (kids.length === 1) {
      pts = [r.cx, py0, targets[0][0], targets[0][1]];
    } else {
      const barY = r.y + C + BAR1;
      pts = [r.cx, py0, barY, targets[0][0], targets[targets.length - 1][0]];
      for (const t of targets) pts.push(t[0], t[1]);
    }
    want.set(uid, { n: kids.length, pts });
  }

  for (const [uid, w] of want) {
    let rec = state.edges.get(uid);
    if (rec && rec.g.isConnected && rec.n === w.n) {
      /* same shape → morph the points to follow the animated circles */
      const changed = w.pts.some((v, i) => Math.abs(v - rec.to[i]) > 0.01);
      rec.from = rec.pts.slice();
      rec.to = w.pts;
      if (changed) { rec.phase = 'move'; rec.t0 = performance.now(); }
    } else {
      if (rec && rec.g.isConnected) { rec.g.classList.add('out'); setTimeout(() => rec.g.remove(), 340); }
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'eg new');
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('class', 'edge');
      g.appendChild(path);
      const dots = [];
      if (w.n > 1) for (let j = 0; j < w.n; j++) {
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('class', 'edot');
        dot.setAttribute('r', '2.6');
        g.appendChild(dot);
        dots.push(dot);
      }
      svg.appendChild(g);
      rec = { g, path, dots, n: w.n, pts: w.pts.slice(), from: w.pts.slice(), to: w.pts, phase: 'idle', t0: 0 };
      paintEdge(rec);
      state.edges.set(uid, rec);
    }
  }

  for (const [uid, rec] of [...state.edges]) {
    if (!want.has(uid) && rec.g.isConnected) {
      rec.g.classList.add('out');
      setTimeout(() => { rec.g.remove(); state.edges.delete(uid); }, 340);
    }
  }
}

/* matches CSS cubic-bezier(.22,1,.36,1) exactly, so edges track circles 1:1 */
function cssEase(x) {
  const X1 = 0.22, X2 = 0.36;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 10; i++) {
    const mt = 1 - t;
    const dx = 3 * mt * mt * t * X1 + 3 * mt * t * t * X2 + t * t * t - x;
    if (Math.abs(dx) < 1e-5) break;
    const ddx = 3 * mt * mt * X1 + 6 * mt * t * (X2 - X1) + 3 * t * t * (1 - X2);
    if (Math.abs(ddx) < 1e-6) break;
    t -= dx / ddx;
  }
  return 1 - Math.pow(1 - t, 3); /* y1 = y2 = 1 */
}

function tickEdges(t) {
  for (const rec of state.edges.values()) {
    if (rec.phase !== 'move') continue;
    const k = Math.min(1, (t - rec.t0) / 550);
    const q = cssEase(k);
    rec.pts = rec.pts.map((v, i) => lerp(rec.from[i], rec.to[i], q));
    paintEdge(rec);
    if (k >= 1) { rec.phase = 'idle'; rec.pts = rec.to.slice(); paintEdge(rec); }
  }
}

function renderGenLabels() {
  if (!state.bbox) return;
  $('#genlabels').innerHTML = [...state.depthMinX]
    .sort((a, b) => a[0] - b[0])
    .map(([d, mx]) => `<div class="gen-label" style="left:${mx - 22}px;top:${d * VSTEP + C / 2}px">Gen ${ROMAN[d] || d + 1}</div>`)
    .join('');
}

/* ============================================================
   camera — pan / zoom / fit
   ============================================================ */

const vpEl = () => $('#viewport');

function applyTransform() {
  $('#world').style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) scale(${cur.s})`;
  const vp = vpEl();
  /* blueprint grid: major lines every 150px, minor every 30px — both pan+scale */
  const s30 = 30 * cur.s, s150 = 150 * cur.s;
  const pos = `${cur.x}px ${cur.y}px`;
  vp.style.backgroundPosition = `${pos}, ${pos}, ${pos}, ${pos}`;
  vp.style.backgroundSize = `${s150}px ${s150}px, ${s150}px ${s150}px, ${s30}px ${s30}px, ${s30}px ${s30}px`;
  $('#zoompill').textContent = Math.round(cur.s * 100) + '%';
}

function zoomAt(px, py, f) {
  const ns = clamp(target.s * f, 0.16, 2.8);
  target.x = px - (px - target.x) * (ns / target.s);
  target.y = py - (py - target.y) * (ns / target.s);
  target.s = ns;
  clampPan();
}

function clampPan() {
  const b = state.bbox;
  if (!b || state.boot) return;
  const m = 300;
  const s = target.s;
  const lox = innerWidth - (b.x + b.w) * s - m, hix = -b.x * s + m;
  const loy = innerHeight - (b.y + b.h) * s - m, hiy = -b.y * s + m;
  target.x = lox > hix ? (lox + hix) / 2 : clamp(target.x, lox, hix);
  target.y = loy > hiy ? (loy + hiy) / 2 : clamp(target.y, loy, hiy);
}

function fitView(pad = 140, maxS = 1.05) {
  const b = state.bbox;
  if (!b) return;
  const s = clamp(Math.min((innerWidth - pad * 2) / b.w, (innerHeight - pad * 2) / b.h), 0.16, maxS);
  target.s = s;
  target.x = innerWidth / 2 - (b.x + b.w / 2) * s;
  target.y = innerHeight / 2 - (b.y + b.h / 2) * s;
  clampPan();
}

/* main animation loop: smooth camera + edge morphs */
function frame(t) {
  cur.x = near(cur.x, target.x, 0.22);
  cur.y = near(cur.y, target.y, 0.22);
  cur.s = near(cur.s, target.s, 0.22);
  applyTransform();
  tickEdges(t || 0);
  requestAnimationFrame(frame);
}

/* ============================================================
   gestures — pointer pan, pinch zoom, wheel, click resolution
   ============================================================ */

function initGestures() {
  const vp = vpEl();
  const pointers = new Map();
  let dragStart = null, movedPx = 0, downTarget = null, pinchPrev = null;

  vp.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    vp.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dismissHint();
    if (pointers.size === 1) {
      dragStart = { x: target.x, y: target.y, px: e.clientX, py: e.clientY };
      movedPx = 0;
      downTarget = e.target;
      vp.classList.add('dragging');
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchPrev = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      dragStart = null;
    }
  });

  vp.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && dragStart) {
      const dx = e.clientX - dragStart.px, dy = e.clientY - dragStart.py;
      movedPx = Math.max(movedPx, Math.hypot(dx, dy));
      target.x = dragStart.x + dx;
      target.y = dragStart.y + dy;
      cur.x = target.x;
      cur.y = target.y;
      clampPan();
    } else if (pointers.size === 2 && pinchPrev) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinchPrev.d > 0) zoomAt(mx, my, d / pinchPrev.d);
      target.x += mx - pinchPrev.mx;
      target.y += my - pinchPrev.my;
      cur.x = target.x;
      cur.y = target.y;
      pinchPrev = { d, mx, my };
    }
  });

  const endPointer = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchPrev = null;
    if (pointers.size === 0) {
      vp.classList.remove('dragging');
      if (dragStart && movedPx < 5 && downTarget && !state.boot) resolveTap(downTarget);
      dragStart = null;
      downTarget = null;
    }
  };
  vp.addEventListener('pointerup', endPointer);
  vp.addEventListener('pointercancel', endPointer);

  vp.addEventListener('wheel', e => {
    e.preventDefault();
    dismissHint();
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.2) {
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.009 : 0.0016));
      zoomAt(e.clientX, e.clientY, f);
    } else {
      target.x -= e.deltaX;
      target.y -= e.deltaY;
      cur.x = target.x;
      cur.y = target.y;
      clampPan();
    }
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('#drawer').classList.contains('open')) closeDrawer();
      else clearSearch();
      return;
    }
    if (e.target.tagName === 'INPUT') return;
    const step = 130;
    if (e.key === '+' || e.key === '=') zoomAt(innerWidth / 2, innerHeight / 2, 1.3);
    else if (e.key === '-' || e.key === '_') zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.3);
    else if (e.key === '0') fitView(140);
    else if (e.key === 'ArrowLeft') { target.x += step; clampPan(); }
    else if (e.key === 'ArrowRight') { target.x -= step; clampPan(); }
    else if (e.key === 'ArrowUp') { target.y += step; clampPan(); }
    else if (e.key === 'ArrowDown') { target.y -= step; clampPan(); }
  });

  window.addEventListener('resize', () => clampPan());
}

function resolveTap(el) {
  const chev = el.closest('.chev');
  if (chev) {
    const unionEl = chev.closest('.union');
    if (unionEl) toggleUnion(unionEl.dataset.uid);
    return;
  }
  const node = el.closest('.node');
  if (node) { openDrawer(node.dataset.pid); return; }
  if (!el.closest('.union')) closeDrawer();
}

/* ============================================================
   expand / collapse
   ============================================================ */

function toggleUnion(uid) {
  const u = state.unions.get(uid);
  if (!u || !u.children.length) return;
  state.expanded.set(uid, state.expanded.get(uid) === false);
  relayout();
}

function initHud() {
  $('#btn-zin').addEventListener('click', () => zoomAt(innerWidth / 2, innerHeight / 2, 1.35));
  $('#btn-zout').addEventListener('click', () => zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.35));
  $('#btn-fit').addEventListener('click', () => fitView(160));
  $('#btn-xall').addEventListener('click', () => {
    for (const [uid, u] of state.unions) if (u.children.length) state.expanded.set(uid, true);
    relayout();
    setTimeout(() => fitView(180), 650);
  });
  $('#btn-call').addEventListener('click', () => {
    for (const [uid, u] of state.unions) if (u.children.length) state.expanded.set(uid, false);
    relayout();
    setTimeout(() => fitView(220), 650);
  });
}

function dismissHint() {
  const h = $('#hint');
  if (h && !h.classList.contains('off')) h.classList.add('off');
}

/* ============================================================
   search
   ============================================================ */

let searchList = [], searchIdx = -1;

function initSearch() {
  const input = $('#search');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    state.query = q;
    searchIdx = -1;
    if (!q) { clearSearch(); return; }
    searchList = Object.keys(state.people)
      .filter(pid => (state.people[pid].name || '').toLowerCase().includes(q))
      .slice(0, 8);
    renderResults();
    applySearchDim();
  });
  input.addEventListener('keydown', e => {
    if (!searchList.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); searchIdx = Math.min(searchIdx + 1, searchList.length - 1); highlightResult(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); searchIdx = Math.max(searchIdx - 1, 0); highlightResult(); }
    else if (e.key === 'Enter') { e.preventDefault(); choosePid(searchList[searchIdx >= 0 ? searchIdx : 0]); }
  });
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('#search-wrap')) $('#results').classList.remove('show');
  });
}

function renderResults() {
  const box = $('#results');
  box.innerHTML = '';
  if (!state.query || !searchList.length) { box.classList.remove('show'); return; }
  searchList.forEach(pid => {
    const p = state.people[pid];
    const btn = document.createElement('button');
    btn.className = 'result';
    btn.innerHTML = `
      <span class="avatar r-av ${gradClass(pid, p.gender)}">${esc(initialsOf(p))}</span>
      <span class="r-name">${esc(p.name)}</span>
      <span class="r-years">${esc(yearsText(p))}</span>`;
    btn.addEventListener('pointerup', () => choosePid(pid));
    box.appendChild(btn);
  });
  box.classList.add('show');
}

function highlightResult() {
  [...$('#results').children].forEach((el, i) => el.classList.toggle('sel', i === searchIdx));
}

function clearSearch() {
  state.query = '';
  $('#search').value = '';
  $('#results').classList.remove('show');
  searchList = [];
  applySearchDim();
}

function applySearchDim() {
  const q = state.query;
  const on = !!q;
  document.body.classList.toggle('searching', on);
  if (!on) { for (const n of state.nodes.values()) n.el.classList.remove('hit'); return; }
  for (const [uid, n] of state.nodes) {
    const u = state.unions.get(uid);
    const hit = u.partners.some(pid => (state.people[pid].name || '').toLowerCase().includes(q));
    n.el.classList.toggle('hit', hit);
  }
}

function choosePid(pid) {
  if (!pid) return;
  $('#results').classList.remove('show');
  $('#search').value = state.people[pid] ? state.people[pid].name : '';
  state.query = '';
  applySearchDim();
  dismissHint();
  focusPerson(pid);
}

/* reveal the branch containing a person, then fly to them */
function focusPerson(pid) {
  const path = [];
  (function dfs(u) {
    if (u.partners.includes(pid)) { path.unshift(u); return true; }
    for (const c of u.children) if (dfs(c)) { path.unshift(u); return true; }
    return false;
  })(state.root);

  path.slice(0, -1).forEach(u => state.expanded.set(u.id, true));
  relayout();

  setTimeout(() => {
    for (const [uid, p] of state.pos) {
      const u = state.unions.get(uid);
      const idx = u.partners.indexOf(pid);
      if (idx < 0) continue;
      const cx = p.x + idx * (C + MG) + C / 2;
      const cy = p.y + C / 2;
      const s = clamp(cur.s, 0.85, 1.25);
      target.s = s;
      target.x = innerWidth / 2 - cx * s;
      target.y = innerHeight / 2 - cy * s;
      clampPan();
      const n = state.nodes.get(uid);
      const el = n && $(`.node[data-pid="${CSS.escape(pid)}"]`, n.el);
      if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2400); }
      break;
    }
  }, 640);
}

/* ============================================================
   person drawer
   ============================================================ */

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

function openDrawer(pid) {
  if (!pid) return;
  state.selected = pid;
  const p = state.people[pid] || ensurePerson(pid);
  const body = $('#drawer-body');
  body.innerHTML = '';

  /* hero */
  const hero = h('div', 'd-hero');
  const av = h('div', 'd-avatar ' + gradClass(pid, p.gender));
  if (p.photo) { const im = h('img'); im.src = p.photo; im.alt = ''; av.appendChild(im); }
  else av.appendChild(h('span', null, initialsOf(p)));
  const info = h('div', 'd-hinfo');
  info.appendChild(h('h2', 'd-name', p.name));
  info.appendChild(h('div', 'd-sub', yearsText(p)));
  const chips = h('div', 'd-chips');
  if (p.death) chips.appendChild(h('span', 'chip', 'Deceased'));
  else if (p.birth) chips.appendChild(h('span', 'chip', 'Age ' + (new Date().getFullYear() - p.birth)));
  chips.appendChild(h('span', 'chip ' + (p.gender || 'unknown'), p.gender === 'male' ? 'Male' : p.gender === 'female' ? 'Female' : 'Unspecified'));
  if (p.occupation) chips.appendChild(h('span', 'chip', p.occupation));
  if (p.location) chips.appendChild(h('span', 'chip', p.location));
  info.appendChild(chips);
  hero.append(av, info);
  body.appendChild(hero);

  /* immediate family quick-links */
  const union = [...state.unions.values()].find(u => u.partners.includes(pid));
  if (union) {
    const members = [];
    union.partners.forEach(o => { if (o !== pid && state.people[o]) members.push([o, 'Spouse']); });
    union.children.forEach(c => { const k = c.partners[0]; if (k && state.people[k]) members.push([k, 'Child']); });
    if (members.length) {
      const sec = h('section', 'dsec');
      sec.appendChild(h('h3', 'd-h', 'Immediate family'));
      const row = h('div', 'flinks');
      members.forEach(([id, role]) => {
        const other = state.people[id];
        const b = h('button', 'flink');
        b.innerHTML = `<i class="gdot ${other.gender || 'unknown'}"></i><span>${esc(other.name)}</span><em>${role}</em>`;
        b.addEventListener('click', () => openDrawer(id));
        row.appendChild(b);
      });
      sec.appendChild(row);
      body.appendChild(sec);
    }
  }

  /* biography */
  if (p.bio) {
    const sec = h('section', 'dsec');
    sec.appendChild(h('h3', 'd-h', 'Biography'));
    sec.appendChild(h('p', 'd-bio', p.bio));
    body.appendChild(sec);
  }

  /* timeline */
  if (p.timeline && p.timeline.length) {
    const sec = h('section', 'dsec');
    sec.appendChild(h('h3', 'd-h', 'Historical timeline'));
    const list = h('div', 'tl');
    [...p.timeline].sort((a, b) => (a.year || 0) - (b.year || 0)).forEach(ev => {
      const it = h('div', 'tl-item');
      it.appendChild(h('b', 'tl-year', ev.year));
      it.appendChild(h('div', 'tl-title', ev.title));
      if (ev.text) it.appendChild(h('p', 'tl-text', ev.text));
      list.appendChild(it);
    });
    sec.appendChild(list);
    body.appendChild(sec);
  }

  /* photo album */
  const sec = h('section', 'dsec');
  sec.appendChild(h('h3', 'd-h', 'Family album'));
  const grid = h('div', 'phgrid');
  const photos = (p.photos || []).map(x => (typeof x === 'string' ? { caption: x } : x));
  if (!photos.length) {
    const g = h('figure', 'ph ghost');
    g.innerHTML = ICON_IMG + '<figcaption>No photos yet — add captions to this person’s photos[] in data.json</figcaption>';
    grid.appendChild(g);
  } else {
    photos.forEach(item => grid.appendChild(photoTile(item)));
  }
  sec.appendChild(grid);
  body.appendChild(sec);

  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#drawer-overlay').classList.add('show');
}

function photoTile(item) {
  const f = h('figure', 'ph');
  const m = (item.caption || '').match(/(19|20)\d{2}/);
  const year = item.year || (m && m[0]);
  if (item.src) {
    const im = h('img');
    im.src = item.src;
    im.alt = item.caption || '';
    im.loading = 'lazy';
    f.appendChild(im);
  } else {
    const art = h('div', 'ph-art');
    art.innerHTML = ICON_IMG;
    f.appendChild(art);
  }
  f.appendChild(h('figcaption', null, item.caption || ''));
  if (year) f.appendChild(h('span', 'ph-year', year));
  return f;
}

function closeDrawer() {
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#drawer-overlay').classList.remove('show');
  state.selected = null;
}

function initDrawer() {
  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-overlay').addEventListener('click', closeDrawer);
}

/* ============================================================
   misc UI
   ============================================================ */

let toastTimer = null;
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 6000);
}

function computeStats() {
  let gens = 1;
  (function walk(u) { gens = Math.max(gens, u.depth + 1); u.children.forEach(walk); })(state.root);
  $('#st-total').textContent = Object.keys(state.people).length;
  $('#st-gen').textContent = gens;
  $('#st-living').textContent = Object.values(state.people).filter(p => !p.death).length;
  const name = state.meta.familyName || 'Family Tree';
  $('#brand-name').textContent = name;
  $('#brand-sub').textContent = state.meta.tagline || 'Interactive lineage';
  document.title = name + ' — Interactive Tree';
}

/* ============================================================
   boot
   ============================================================ */

(async function main() {
  requestAnimationFrame(frame);
  initGestures();
  initHud();
  initSearch();
  initDrawer();

  try {
    const data = await loadData();
    buildModel(data);
    computeStats();
    /* ?expand=all — dev/preview: show every generation */
    if (new URLSearchParams(location.search).has('expand')) {
      for (const [uid, u] of state.unions) if (u.children.length) state.expanded.set(uid, true);
    }
    relayout();

    cur.x = innerWidth / 2 - 100;
    cur.y = innerHeight / 2 - 60;
    Object.assign(target, cur);
    requestAnimationFrame(() => fitView(170, 1.02));

    $('#loading').classList.add('done');
    setTimeout(() => { const l = $('#loading'); if (l) l.remove(); }, 1000);
  } catch (err) {
    const l = $('#loading');
    l.classList.add('done');
    const p = l && l.querySelector('p');
    if (p) p.textContent = 'Failed to load family data.';
  }

  state.boot = false;
  setTimeout(dismissHint, 9000);
})();
