/**
 * add-arabic-names.mjs — write nameAr fields into data.json from
 * tools/arabic-map.json (first token + family token Arabic).
 * Rerunnable: overwrites existing nameAr. Then run `node tools/build.mjs`.
 *   node tools/add-arabic-names.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_PATH = path.join(PROJ, 'data.json');
const DATA = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const MAP = JSON.parse(fs.readFileSync(path.join(PROJ, 'tools', 'arabic-map.json'), 'utf8'));

let filled = 0, missing = [];
for (const p of Object.values(DATA.people)) {
  const parts = String(p.name).trim().split(/\s+/);
  const first = parts[0];
  const fam = parts.slice(1).join(' ');
  const f = MAP.first[first];
  if (!f) { missing.push(first + ' :: ' + p.name); continue; }
  let famAr = '';
  if (fam) {
    const f2 = MAP.family[fam];
    if (f2) famAr = ' ' + f2.ar;
    else { famAr = ''; missing.push('FAM ' + fam + ' :: ' + p.name); }
  }
  p.nameAr = f.ar + famAr;
  filled++;
}

/* nice meta Arabic if user later provides — no-op for now */
fs.writeFileSync(DATA_PATH, JSON.stringify(DATA, null, 2) + '\n');
console.log('nameAr set for', filled, 'people');
if (missing.length) { console.log('MISSING:'); missing.forEach(m => console.log('  ?', m)); }
