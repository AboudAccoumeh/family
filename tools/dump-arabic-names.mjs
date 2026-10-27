/* dump-arabic-names.mjs — list the user's corrections, one per line */
import fs from 'node:fs';
const txt = fs.readFileSync('arabicNames.txt', 'utf8');
const items = txt.replace(/\\n/g, '\n').split('\n').map(s => s.trim()).filter(Boolean).filter(s => s !== "'");
console.log('items:', items.length);
items.forEach((s, i) => console.log(String(i + 1).padStart(3), s));
