import fs from "fs";
import path from "path";

const ROOT = path.resolve("frontend/src");
const APP_FILE = path.resolve("frontend/src/App.jsx");
const OUT_FILE = path.resolve("frontend/docs/button-action-registry.csv");

const exts = new Set([".js", ".jsx", ".ts", ".tsx"]);

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

function clean(s = "") {
  return s
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function extractRoutes(appSrc) {
  const routes = new Set();
  const re = /path\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(appSrc))) routes.add(m[1]);
  return routes;
}

function inferTarget(handler) {
  if (!handler) return { target: "", kind: "" };

  const nav = handler.match(/navigate\((?:\s*`([^`]+)`\s*|\s*"([^"]+)"\s*|\s*'([^']+)'\s*)\)/);
  if (nav) {
    const t = nav[1] || nav[2] || nav[3] || "";
    return { target: t, kind: "route" };
  }

  const apiFetch = handler.match(/apiFetch\((?:\s*`([^`]+)`\s*|\s*"([^"]+)"\s*|\s*'([^']+)'\s*)\)/);
  if (apiFetch) {
    const t = apiFetch[1] || apiFetch[2] || apiFetch[3] || "";
    return { target: t, kind: "api" };
  }

  const apiObj = handler.match(/\bAPI\.(?:get|post|put|patch|delete)\((?:\s*`([^`]+)`\s*|\s*"([^"]+)"\s*|\s*'([^']+)'\s*)\)/);
  if (apiObj) {
    const t = apiObj[1] || apiObj[2] || apiObj[3] || "";
    return { target: t, kind: "api" };
  }

  return { target: "", kind: "" };
}

function statusFor(kind, target, routes) {
  if (kind === "route") {
    return routes.has(target) ? "VERIFIED_ROUTE" : "MANUAL_REVIEW_ROUTE";
  }
  if (kind === "api") {
    return target ? "API_TARGET_FOUND" : "MANUAL_REVIEW_API";
  }
  return "MANUAL_REVIEW";
}

function parseButtons(src) {
  const out = [];
  const re = /<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g;
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1] || "";
    const rawText = clean(m[2] || "");
    const text = rawText.replace(/<[^>]+>/g, "").trim();

    const typeM = attrs.match(/\btype\s*=\s*"([^"]+)"|\btype\s*=\s*'([^']+)'/);
    const type = typeM ? (typeM[1] || typeM[2] || "") : "";

    const onClickM = attrs.match(/\bonClick\s*=\s*\{([\s\S]*?)\}/);
    const handler = clean(onClickM ? onClickM[1] : "");

    out.push({ text, type, handler });
  }
  return out;
}

const files = walk(ROOT);
const appSrc = fs.readFileSync(APP_FILE, "utf8");
const routes = extractRoutes(appSrc);

const rows = [];
for (const file of files) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
  const src = fs.readFileSync(file, "utf8");
  const buttons = parseButtons(src);
  for (const b of buttons) {
    const { target, kind } = inferTarget(b.handler);
    const status = statusFor(kind, target, routes);
    rows.push({
      page: rel,
      button_text: b.text || "(icon/no-text)",
      handler: b.handler || "(none)",
      target: target || "(manual)",
      status,
      type: b.type || "(default)",
    });
  }
}

rows.sort((a, b) => a.page.localeCompare(b.page) || a.button_text.localeCompare(b.button_text));

const header = ["page", "button_text", "handler", "target_route_or_api", "status", "button_type"];
const lines = [header.join(",")];
for (const r of rows) {
  lines.push([
    csvEscape(r.page),
    csvEscape(r.button_text),
    csvEscape(r.handler),
    csvEscape(r.target),
    csvEscape(r.status),
    csvEscape(r.type),
  ].join(","));
}

fs.writeFileSync(OUT_FILE, lines.join("\n") + "\n", "utf8");
console.log(`Wrote ${rows.length} rows to ${path.relative(process.cwd(), OUT_FILE)}`);
