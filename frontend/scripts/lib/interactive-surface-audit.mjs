import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DOCS_DIR = path.join(ROOT_DIR, "docs");
const APP_SOURCE_PATH = path.join(ROOT_DIR, "src", "App.jsx");
const WORKSPACES_SOURCE_PATH = path.join(ROOT_DIR, "src", "app", "navigation", "workspaces.js");

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function normalizeTarget(rawTarget) {
  if (!rawTarget) return "";
  const trimmed = rawTarget.trim();
  const withoutQuotes = trimmed.replace(/^['"`]/, "").replace(/['"`]$/, "");
  const withoutHash = withoutQuotes.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];
  return withoutQuery || "/";
}

function classifySurface(relativePath, lineText) {
  const text = `${relativePath}\n${lineText}`;
  if (/StatCard|dashboard|card/i.test(text)) return "dashboard-card";
  if (/quick-action|QuickActions|quick-actions/i.test(text)) return "quick-action";
  if (/<Link|href=|to=|window\.location/i.test(text)) return "deep-link";
  return "button";
}

async function collectRouteInventory() {
  const [appSource, workspaceSource] = await Promise.all([
    fs.readFile(APP_SOURCE_PATH, "utf8"),
    fs.readFile(WORKSPACES_SOURCE_PATH, "utf8"),
  ]);

  const routePattern = /path=(?:"([^"]+)"|'([^']+)')/g;
  const paths = [];
  for (const match of appSource.matchAll(routePattern)) {
    const value = match[1] || match[2] || "";
    if (value.startsWith("/")) paths.push(normalizeTarget(value));
  }

  const workspacePattern = /path:\s*(?:"([^"]+)"|'([^']+)')/g;
  for (const match of workspaceSource.matchAll(workspacePattern)) {
    const value = match[1] || match[2] || "";
    if (value.startsWith("/")) paths.push(normalizeTarget(value));
  }

  return [...new Set(paths)].sort();
}

async function walkSourceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkSourceFiles(fullPath)));
      continue;
    }

    if (/\.(jsx|js|ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }

  return files;
}

function extractTargetsFromLine(line, relativePath) {
  const targets = [];
  const navigateRegex = /navigate\(\s*(?:`([^`]+)`|"([^"]+)"|'([^']+)')/g;
  for (const match of line.matchAll(navigateRegex)) {
    const value = match[1] || match[2] || match[3] || "";
    if (value.startsWith("/")) {
      targets.push({ target: normalizeTarget(value), kind: classifySurface(relativePath, line) });
    }
  }

  const linkRegex = /\bto\s*=\s*(?:`([^`]+)`|"([^"]+)"|'([^']+)')/g;
  for (const match of line.matchAll(linkRegex)) {
    const value = match[1] || match[2] || match[3] || "";
    if (value.startsWith("/")) {
      targets.push({ target: normalizeTarget(value), kind: "deep-link" });
    }
  }

  const hrefRegex = /href\s*=\s*(?:`([^`]+)`|"([^"]+)"|'([^']+)')/g;
  for (const match of line.matchAll(hrefRegex)) {
    const value = match[1] || match[2] || match[3] || "";
    if (value.startsWith("/")) {
      targets.push({ target: normalizeTarget(value), kind: "deep-link" });
    }
  }

  return targets;
}

function extractLabel(line) {
  const titleMatch = line.match(/title=\s*["']([^"']+)["']/i) || line.match(/aria-label=\s*["']([^"']+)["']/i);
  if (titleMatch) return titleMatch[1].trim();
  const buttonMatch = line.match(/>([^<>{]+)<\//);
  if (buttonMatch) return buttonMatch[1].trim();
  return "interactive action";
}

function normalizeRoute(target, routeInventory) {
  const normalized = normalizeTarget(target);
  if (!normalized) return { resolved: false, reason: "empty target" };
  if (routeInventory.includes(normalized)) {
    return { resolved: true, reason: `matches canonical route ${normalized}` };
  }
  if (routeInventory.some((route) => normalized.startsWith(route + "/") || normalized === route)) {
    return { resolved: true, reason: `matches parent route ${normalized}` };
  }
  return { resolved: false, reason: "no matching canonical route" };
}

function buildReportEntries(entries, routeInventory) {
  return entries.map((entry) => {
    const validation = normalizeRoute(entry.target, routeInventory);
    return {
      id: `${entry.surface}-${entry.file}-${entry.line}`,
      surface: entry.surface,
      file: entry.file,
      line: entry.line,
      label: entry.label,
      target: entry.target,
      resolved: validation.resolved,
      reason: validation.reason,
    };
  });
}

export async function runInteractiveSurfaceAudit() {
  const [routeInventory, files] = await Promise.all([collectRouteInventory(), walkSourceFiles(path.join(ROOT_DIR, "src"))]);
  const entries = [];

  for (const file of files) {
    const relativePath = toPosix(path.relative(ROOT_DIR, file));
    const content = await fs.readFile(file, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      const targets = extractTargetsFromLine(line, relativePath);
      targets.forEach(({ target, kind }) => {
        entries.push({
          surface: kind,
          file: relativePath,
          line: index + 1,
          label: extractLabel(line),
          target,
        });
      });
    });
  }

  const reportEntries = buildReportEntries(entries, routeInventory);
  const resolvedEntries = reportEntries.filter((entry) => entry.resolved);
  const unresolvedEntries = reportEntries.filter((entry) => !entry.resolved);
  const bySurface = reportEntries.reduce((acc, entry) => {
    acc[entry.surface] = (acc[entry.surface] || 0) + 1;
    return acc;
  }, {});

  const summary = {
    generatedAt: new Date().toISOString(),
    total: reportEntries.length,
    resolved: resolvedEntries.length,
    unresolved: unresolvedEntries.length,
    bySurface,
    canonicalRoutes: routeInventory.length,
  };

  return { summary, surfaces: reportEntries, unresolved: unresolvedEntries, routeInventory };
}

export async function writeAuditReports(payload) {
  await fs.mkdir(DOCS_DIR, { recursive: true });

  const writeJson = async (fileName, data) => {
    await fs.writeFile(path.join(DOCS_DIR, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  };

  const writeMarkdown = async (fileName, lines) => {
    await fs.writeFile(path.join(DOCS_DIR, fileName), `${lines.join("\n")}\n`, "utf8");
  };

  const overallMarkdown = [
    "# AFY-P1-020 Interactive Surface Audit",
    "",
    `- Generated: ${payload.summary.generatedAt}`,
    `- Total interactive surfaces scanned: ${payload.summary.total}`,
    `- Resolved: ${payload.summary.resolved}`,
    `- Unresolved: ${payload.summary.unresolved}`,
    `- Canonical routes discovered: ${payload.summary.canonicalRoutes}`,
    "",
    "## Surface distribution",
    "",
    ...Object.entries(payload.summary.bySurface).map(([surface, count]) => `- ${surface}: ${count}`),
    "",
    "## Unresolved targets",
    "",
    ...(payload.unresolved.length === 0
      ? ["- None"]
      : payload.unresolved.slice(0, 20).map((entry) => `- ${entry.file}:${entry.line} [${entry.surface}] ${entry.label} -> ${entry.target} (${entry.reason})`)),
  ];

  const dashboardCards = payload.surfaces.filter((entry) => entry.surface === "dashboard-card");
  const buttons = payload.surfaces.filter((entry) => entry.surface === "button");
  const quickActions = payload.surfaces.filter((entry) => entry.surface === "quick-action");
  const deepLinks = payload.surfaces.filter((entry) => entry.surface === "deep-link");

  const makeSectionMarkdown = (title, entries) => [
    `# ${title}`,
    "",
    `- Total entries: ${entries.length}`,
    `- Resolved: ${entries.filter((entry) => entry.resolved).length}`,
    `- Unresolved: ${entries.filter((entry) => !entry.resolved).length}`,
    "",
    ...entries.slice(0, 30).map((entry) => `- ${entry.file}:${entry.line} ${entry.label} -> ${entry.target} (${entry.resolved ? "resolved" : "unresolved"})`),
  ];

  await writeJson("afy-p1-020-interactive-surface-audit.json", payload);
  await writeMarkdown("afy-p1-020-interactive-surface-audit.md", overallMarkdown);
  await writeJson("afy-p1-020-dashboard-cards-audit.json", { summary: { total: dashboardCards.length, resolved: dashboardCards.filter((e) => e.resolved).length, unresolved: dashboardCards.filter((e) => !e.resolved).length }, surfaces: dashboardCards });
  await writeMarkdown("afy-p1-020-dashboard-cards-audit.md", makeSectionMarkdown("AFY-P1-020 Dashboard Cards Audit", dashboardCards));
  await writeJson("afy-p1-020-buttons-audit.json", { summary: { total: buttons.length, resolved: buttons.filter((e) => e.resolved).length, unresolved: buttons.filter((e) => !e.resolved).length }, surfaces: buttons });
  await writeMarkdown("afy-p1-020-buttons-audit.md", makeSectionMarkdown("AFY-P1-020 Buttons Audit", buttons));
  await writeJson("afy-p1-020-quick-actions-audit.json", { summary: { total: quickActions.length, resolved: quickActions.filter((e) => e.resolved).length, unresolved: quickActions.filter((e) => !e.resolved).length }, surfaces: quickActions });
  await writeMarkdown("afy-p1-020-quick-actions-audit.md", makeSectionMarkdown("AFY-P1-020 Quick Actions Audit", quickActions));
  await writeJson("afy-p1-020-deep-links-audit.json", { summary: { total: deepLinks.length, resolved: deepLinks.filter((e) => e.resolved).length, unresolved: deepLinks.filter((e) => !e.resolved).length }, surfaces: deepLinks });
  await writeMarkdown("afy-p1-020-deep-links-audit.md", makeSectionMarkdown("AFY-P1-020 Deep Links Audit", deepLinks));

  const completionPayload = {
    generatedAt: new Date().toISOString(),
    validationCommands: ["npm run audit:interactive-surfaces", "npm run audit:simulate-clicks"],
    summary: payload.summary,
    unresolved: payload.unresolved.slice(0, 20),
  };
  await writeJson("afy-p1-020-completion-report.json", completionPayload);
  await writeMarkdown("afy-p1-020-completion-report.md", [
    "# AFY-P1-020 Completion Report",
    "",
    `- Generated: ${completionPayload.generatedAt}`,
    `- Total interactive surfaces scanned: ${completionPayload.summary.total}`,
    `- Resolved: ${completionPayload.summary.resolved}`,
    `- Unresolved: ${completionPayload.summary.unresolved}`,
    "",
    "## Validation commands",
    "",
    ...completionPayload.validationCommands.map((command) => `- ${command}`),
    "",
    "## Notes",
    "",
    ...(completionPayload.unresolved.length === 0 ? ["- No unresolved interactive targets were detected."] : completionPayload.unresolved.map((entry) => `- ${entry.file}:${entry.line} ${entry.target} (${entry.reason})`)),
  ]);
}
