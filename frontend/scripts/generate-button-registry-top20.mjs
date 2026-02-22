import fs from 'fs';
import { parse } from '@babel/parser';

const files = [
  'src/pages/Doctor/Dashboard.jsx',
  'src/pages/Doctor/Appointments.jsx',
  'src/pages/Doctor/MyPatients.jsx',
  'src/pages/Doctor/Referrals.jsx',
  'src/pages/Doctor/OPDWorkspace.jsx',
  'src/pages/Nurse/Dashboard.jsx',
  'src/pages/Nurse/MyShift.jsx',
  'src/pages/Nurse/AssignedPatients.jsx',
  'src/pages/LabTech/Dashboard.jsx',
  'src/pages/LabTech/LabTests.jsx',
  'src/pages/LabTech/TestQueue.jsx',
  'src/pages/HospitalAdmin/Dashboard.jsx',
  'src/pages/HospitalAdmin/RegisterStaff.jsx',
  'src/pages/HospitalAdmin/StaffManagement.jsx',
  'src/pages/HospitalAdmin/Approvals.jsx',
  'src/pages/HospitalAdmin/RecruitmentAds.jsx',
  'src/pages/HospitalAdmin/CommerceConfig.jsx',
  'src/pages/SuperAdmin/Dashboard.jsx',
  'src/pages/SuperAdmin/Hospitals.jsx',
  'src/pages/SuperAdmin/SystemSettings.jsx',
];

const appSrc = fs.readFileSync('src/App.jsx', 'utf8');
const routeSet = new Set([...appSrc.matchAll(/path\s*=\s*"([^"]+)"/g)].map((m) => m[1]));

function esc(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function srcSlice(src, node) {
  if (!node || node.start == null || node.end == null) return '';
  return src.slice(node.start, node.end).replace(/\s+/g, ' ').trim();
}

function jsxName(n) {
  if (!n) return '';
  if (n.type === 'JSXIdentifier') return n.name;
  if (n.type === 'JSXMemberExpression') return `${jsxName(n.object)}.${jsxName(n.property)}`;
  return '';
}

function getAttr(opening, name) {
  for (const a of opening.attributes || []) {
    if (a.type === 'JSXAttribute' && a.name?.name === name) return a;
  }
  return null;
}

function textFromChildren(children) {
  const parts = [];
  for (const c of children || []) {
    if (c.type === 'JSXText') {
      const t = c.value.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    } else if (c.type === 'JSXExpressionContainer' && c.expression?.type === 'StringLiteral') {
      parts.push(c.expression.value);
    }
  }
  return parts.join(' ').trim() || '(dynamic/no-text)';
}

function inferTarget(handler) {
  const nav = handler.match(/navigate\((?:\s*`([^`]+)`|\s*"([^"]+)"|\s*'([^']+)')/);
  if (nav) return { kind: 'route', target: nav[1] || nav[2] || nav[3] || '' };
  const apiFetch = handler.match(/apiFetch\((?:\s*`([^`]+)`|\s*"([^"]+)"|\s*'([^']+)')/);
  if (apiFetch) return { kind: 'api', target: apiFetch[1] || apiFetch[2] || apiFetch[3] || '' };
  const apiObj = handler.match(/\bAPI\.(?:get|post|put|patch|delete)\((?:\s*`([^`]+)`|\s*"([^"]+)"|\s*'([^']+)')/);
  if (apiObj) return { kind: 'api', target: apiObj[1] || apiObj[2] || apiObj[3] || '' };
  return { kind: '', target: '' };
}

function statusFor(kind, target) {
  if (kind === 'route') return routeSet.has(target) ? 'VERIFIED_ROUTE' : 'MANUAL_REVIEW_ROUTE';
  if (kind === 'api') return target ? 'API_TARGET_FOUND' : 'MANUAL_REVIEW_API';
  return 'MANUAL_REVIEW';
}

function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach((x) => walk(x, fn));
    else if (v && typeof v === 'object') walk(v, fn);
  }
}

const rows = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  walk(ast, (node) => {
    if (node.type !== 'JSXElement') return;
    const opening = node.openingElement;
    if (jsxName(opening.name) !== 'button') return;

    const onClick = getAttr(opening, 'onClick');
    const typeAttr = getAttr(opening, 'type');
    const text = textFromChildren(node.children);

    const handler = onClick?.value?.type === 'JSXExpressionContainer'
      ? srcSlice(src, onClick.value.expression)
      : '';

    const type = typeAttr?.value?.type === 'StringLiteral'
      ? typeAttr.value.value
      : (typeAttr?.value?.type === 'JSXExpressionContainer' ? srcSlice(src, typeAttr.value.expression) : '(default)');

    const { kind, target } = inferTarget(handler);
    rows.push({
      page: `frontend/${f}`,
      button_text: text,
      handler: handler || '(none)',
      target: target || '(manual)',
      status: statusFor(kind, target),
      button_type: type || '(default)',
    });
  });
}

rows.sort((a, b) => a.page.localeCompare(b.page) || a.button_text.localeCompare(b.button_text));

const out = [
  ['page','button_text','handler','target_route_or_api','status','button_type'].join(','),
  ...rows.map((r) => [esc(r.page), esc(r.button_text), esc(r.handler), esc(r.target), esc(r.status), esc(r.button_type)].join(',')),
].join('\n') + '\n';

const outFile = 'docs/button-action-registry-top20.csv';
fs.writeFileSync(outFile, out, 'utf8');
console.log(`Wrote ${rows.length} rows to ${outFile}`);
