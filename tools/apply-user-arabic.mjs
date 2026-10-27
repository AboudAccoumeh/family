/**
 * apply-user-arabic.mjs — one-shot: replay the review-page card order,
 * match the user's 34 items onto cards, write corrected arabic-map.json.
 * Prints the full mapping so the user can verify. Run before regenerating.
 *   node tools/apply-user-arabic.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = JSON.parse(fs.readFileSync(path.join(PROJ, 'data.json'), 'utf8'));
const MAP = JSON.parse(fs.readFileSync(path.join(PROJ, 'tools', 'arabic-map.json'), 'utf8'));

const txt = fs.readFileSync(path.join(PROJ, 'arabicNames.txt'), 'utf8');
const items = txt.replace(/\\n/g, '\n').split('\n').map(s => s.trim()).filter(Boolean).filter(s => s !== "'");

/* replay card order exactly as gen-arabic-draft.mjs renders it */
const famKeys = Object.keys(MAP.family).filter(k => MAP.family[k].conf !== 'HIGH');
const seenFirst = new Set();
const lowFirsts = [];
const medFirsts = [];
for (const [, p] of Object.entries(DATA.people)) {
  const first = String(p.name).trim().split(/\s+/)[0];
  const f = MAP.first[first];
  if (!f) continue;
  if (f.conf === 'LOW' && !seenFirst.has(first)) { seenFirst.add(first); lowFirsts.push(first); }
  if (f.conf === 'MEDIUM' && f.alts && !seenMed(first)) medFirsts.push(first);
}
function seenMed(x) { return medFirsts.includes(x); }

const cards = [];
famKeys.forEach(k => cards.push({ kind: 'fam', key: k }));
lowFirsts.forEach(k => cards.push({ kind: 'first', key: k }));
medFirsts.forEach(k => cards.push({ kind: 'first', key: k }));
/* medFamCards (family MEDIUM with alts) come after medCards on the page */
famKeys.filter(k => MAP.family[k].conf === 'MEDIUM' && MAP.family[k].alts).forEach(k => cards.push({ kind: 'fam', key: k }));

if (items.length !== cards.length) {
  console.error('COUNT MISMATCH — items:', items.length, 'cards:', cards.length, '— not applying anything');
  process.exit(1);
}

console.log('--- mapping (user value -> applied) ---');
const updates = [];
cards.forEach((c, i) => {
  const entry = c.kind === 'fam' ? MAP.family[c.key] : MAP.first[c.key];
  const old = entry.ar;
  entry.ar = items[i];
  entry.conf = 'USER';
  entry.note = 'user-confirmed spelling';
  entry.alts = undefined; /* decided — no need for candidates anymore */
  console.log(String(i + 1).padStart(3), c.kind, c.key, '->', old, '=>', entry.ar);
  updates.push(c);
});

/* clean undefined alts keys */
for (const sec of ['family', 'first']) {
  for (const k of Object.keys(MAP[sec])) {
    if (MAP[sec][k].alts === undefined) delete MAP[sec][k].alts;
  }
}

fs.writeFileSync(path.join(PROJ, 'tools', 'arabic-map.json'), JSON.stringify(MAP, null, 2) + '\n');
console.log('\narabic-map.json updated with', updates.length, 'user-confirmed spellings');
