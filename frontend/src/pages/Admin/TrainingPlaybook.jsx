import { useMemo, useState } from "react";
import playbookRaw from "../../../docs/role-training-playbook.md?raw";
import DownloadMenu from "../../components/DownloadMenu";
import { exportRichTextDocument } from "../../utils/fileExport";

const ROLE_HEADERS = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "HOSPITAL_ADMIN",
  "DEVELOPER",
  "DOCTOR",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_OFFICER",
  "SECURITY_ADMIN",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "COMMUNITY_HEALTH_WORKER",
  "PATIENT",
];

function parseRoleSections(markdown) {
  const lines = String(markdown || "").split("\n");
  const sections = {};
  let current = "__INTRO__";
  sections[current] = [];

  lines.forEach((line) => {
    const role = ROLE_HEADERS.find((r) => line.trim() === `## ${r}`);
    if (role) {
      current = role;
      sections[current] = [];
      return;
    }
    sections[current].push(line);
  });

  return sections;
}

export default function TrainingPlaybook() {
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const sections = useMemo(() => parseRoleSections(playbookRaw), []);

  const filteredText = useMemo(() => {
    let txt = playbookRaw;
    if (roleFilter !== "ALL") {
      const intro = (sections.__INTRO__ || []).join("\n").trim();
      const roleText = (sections[roleFilter] || []).join("\n").trim();
      txt = [intro, `## ${roleFilter}`, roleText].filter(Boolean).join("\n\n");
    }
    const query = q.trim().toLowerCase();
    if (!query) return txt;
    return txt
      .split("\n")
      .filter((line) => line.toLowerCase().includes(query) || line.startsWith("#"))
      .join("\n");
  }, [q, roleFilter, sections]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(filteredText);
      setMsg("Playbook copied.");
    } catch {
      setMsg("Failed to copy playbook.");
    }
  };

  const exportPlaybook = (format) => {
    try {
      const html = filteredText
        .replace(/^### (.*)$/gm, "<h3>$1</h3>")
        .replace(/^## (.*)$/gm, "<h2>$1</h2>")
        .replace(/^# (.*)$/gm, "<h1>$1</h1>")
        .replace(/^- (.*)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/gms, "<ul>$1</ul>")
        .replace(/\n\n/g, "<br/>");
      exportRichTextDocument({
        filenameBase:
          roleFilter === "ALL"
            ? "afyalink-role-training-playbook"
            : `afyalink-training-${roleFilter.toLowerCase()}`,
        format,
        plainText: filteredText,
        markdownText: filteredText,
        htmlBody: html,
        title: "AfyaLink Training Playbook",
      });
      setMsg(format === "pdf" ? "PDF export opened." : `Playbook downloaded as .${format}.`);
    } catch {
      setMsg("Failed to download playbook.");
    }
  };

  const print = () => {
    try {
      const html = filteredText
        .replace(/^### (.*)$/gm, "<h3>$1</h3>")
        .replace(/^## (.*)$/gm, "<h2>$1</h2>")
        .replace(/^# (.*)$/gm, "<h1>$1</h1>")
        .replace(/^- (.*)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/gms, "<ul>$1</ul>")
        .replace(/\n\n/g, "<br/>");
      const w = window.open("", "_blank");
      if (!w) {
        setMsg("Pop-up blocked. Allow pop-ups to print.");
        return;
      }
      w.document.open();
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>AfyaLink Training Playbook</title><style>body{font-family:Arial,sans-serif;padding:18px;line-height:1.5}h1,h2,h3{margin-top:14px}ul{margin-top:4px}</style></head><body>${html}</body></html>`);
      w.document.close();
      w.focus();
      w.print();
      setMsg("Print view opened.");
    } catch {
      setMsg("Failed to open print view.");
    }
  };

  return (
    <div className="container">
      <h1>Training Playbook</h1>
      <p className="muted">
        Central training guide for all AfyaLink roles. Filter by role, search content, then copy/download/print.
      </p>
      <div className="card">
        <form className="stacked-form" onSubmit={(e) => e.preventDefault()}>
          <label>Role</label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="ALL">All Roles</option>
            {ROLE_HEADERS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <label>Search text</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search steps, safety rules, KPI..."
          />

          <div className="form-actions">
            <button type="button" className="secondary" onClick={copy}>
              Copy
            </button>
            <DownloadMenu
              label="Download"
              options={[
                { value: "txt", label: "Download .txt", onClick: () => exportPlaybook("txt") },
                { value: "md", label: "Download .md", onClick: () => exportPlaybook("md") },
                { value: "doc", label: "Download .doc (Word)", onClick: () => exportPlaybook("doc") },
                { value: "html", label: "Download .html", onClick: () => exportPlaybook("html") },
                { value: "pdf", label: "Export PDF", onClick: () => exportPlaybook("pdf") },
              ]}
            />
            <button type="button" className="secondary" onClick={print}>
              Print
            </button>
          </div>
          {msg ? <p className="muted">{msg}</p> : null}
        </form>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{filteredText}</pre>
      </div>
    </div>
  );
}
