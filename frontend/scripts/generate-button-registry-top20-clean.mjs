import fs from 'fs';

const inFile = 'docs/button-action-registry-top20.csv';
const outFile = 'docs/button-action-registry-top20-clean.csv';

const raw = fs.readFileSync(inFile, 'utf8').trim().split('\n');
const header = raw[0];
const rows = raw.slice(1);

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
    } else if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function esc(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const filtered = [];
for (const line of rows) {
  if (!line.trim()) continue;
  const cols = parseCsvLine(line);
  const page = cols[0] || '';
  const text = cols[1] || '';
  const handler = cols[2] || '';
  const target = cols[3] || '';
  const status = cols[4] || '';
  const type = cols[5] || '';

  if (!text || text === '(dynamic/no-text)') continue;
  if (!target || target === '(manual)') continue;
  if (status.startsWith('MANUAL_REVIEW')) continue;

  filtered.push([page, text, handler, target, status, type]);
}

filtered.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

const out = [header, ...filtered.map((r) => r.map(esc).join(','))].join('\n') + '\n';
fs.writeFileSync(outFile, out, 'utf8');
console.log(`Wrote ${filtered.length} rows to ${outFile}`);
