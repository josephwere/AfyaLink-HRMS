import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "afyalinkUxAuditMode";
const AUDIT_CLASS = "ux-audit-flag";
const FLAG_SELECTOR = `.${AUDIT_CLASS}`;

const LEGACY_TEXT_RULES = [
  {
    key: "empty-state",
    reason: "Legacy empty state. Use GuidedEmptyState or TableEmptyState with next actions and AI support.",
    pattern: /\bNo\s+[^.]{1,80}(found|yet|available|listed|captured|configured|submitted|selected)\b/i,
  },
  {
    key: "loading",
    reason: "Legacy loading text. Use ContentSkeleton for this section.",
    pattern: /\bLoading(\.\.\.|…)?\b/i,
  },
  {
    key: "success",
    reason: "Inline success text. Use ActionSuccessGuide so the save creates guidance, notification, and AI action.",
    pattern: /\b(saved|updated|created|submitted|sent)\s+(successfully|and encrypted|to pharmacy|for this session)?\.?$/i,
  },
];

function getInitialEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("uxAudit") === "1" || window.localStorage.getItem(STORAGE_KEY) === "true";
}

function clearFlags(root = document) {
  root.querySelectorAll(FLAG_SELECTOR).forEach((node) => {
    node.classList.remove(AUDIT_CLASS);
    node.removeAttribute("data-ux-audit-reason");
  });
}

function mark(node, reason) {
  if (!node || node.closest(".ux-audit-panel")) return false;
  node.classList.add(AUDIT_CLASS);
  node.setAttribute("data-ux-audit-reason", reason);
  return true;
}

function countByReason(items) {
  return items.reduce((acc, item) => {
    acc[item.key] = (acc[item.key] || 0) + 1;
    return acc;
  }, {});
}

function scanUxDebt() {
  if (typeof document === "undefined") return [];
  clearFlags();
  const results = [];
  const root = document.querySelector("#root") || document.body;

  root.querySelectorAll("section, article, div, td, p, span").forEach((node) => {
    if (
      node.closest(".guided-empty-state, .content-skeleton, .editable-section, .success-guide-modal, .ux-audit-panel")
    ) {
      return;
    }
    const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 180) return;
    const rule = LEGACY_TEXT_RULES.find((candidate) => candidate.pattern.test(text));
    if (rule && mark(node, rule.reason)) {
      results.push({ key: rule.key, reason: rule.reason });
    }
  });

  root.querySelectorAll("form, .card, .profile-card, .premium-card").forEach((node) => {
    if (node.closest(".editable-section, .success-guide-modal, .ux-audit-panel")) return;
    const saveButton = Array.from(node.querySelectorAll("button")).find((button) =>
      /^Save\b/i.test(String(button.textContent || "").trim())
    );
    if (saveButton && mark(node, "Save action outside EditableSection. It should lock fields and use ActionSuccessGuide.")) {
      results.push({ key: "save-edit", reason: "Save action outside EditableSection." });
    }
  });

  root.querySelectorAll("table").forEach((table) => {
    if (table.closest(".content-skeleton, .success-guide-modal, .ux-audit-panel")) return;
    const hasRows = table.querySelectorAll("tbody tr").length > 0;
    const hasGuidedEmpty = Boolean(table.querySelector(".guided-empty-state"));
    if (!hasRows && mark(table, "Table has no rows. Use ContentSkeleton while loading or TableEmptyState when empty.")) {
      results.push({ key: "table-state", reason: "Table missing skeleton or empty state." });
    }
    if (!hasGuidedEmpty && /\bNo\s+[^.]{1,80}(found|yet|available)\b/i.test(table.textContent || "")) {
      mark(table, "Table uses legacy empty text. Replace with TableEmptyState.");
      results.push({ key: "table-state", reason: "Table uses legacy empty text." });
    }
  });

  return results;
}

export default function UXAuditMode() {
  const location = useLocation();
  const [enabled, setEnabled] = useState(getInitialEnabled);
  const [items, setItems] = useState([]);

  const totals = useMemo(() => countByReason(items), [items]);

  const runScan = useCallback(() => {
    if (!enabled) {
      clearFlags();
      setItems([]);
      return;
    }
    window.requestAnimationFrame(() => {
      setItems(scanUxDebt());
    });
  }, [enabled]);

  useEffect(() => {
    const toggle = () => {
      setEnabled((value) => {
        const next = !value;
        window.localStorage.setItem(STORAGE_KEY, String(next));
        return next;
      });
    };
    window.addEventListener("afyalink:toggle-ux-audit", toggle);
    return () => window.removeEventListener("afyalink:toggle-ux-audit", toggle);
  }, []);

  useEffect(() => {
    runScan();
    if (!enabled) return undefined;
    const timer = window.setTimeout(runScan, 450);
    return () => window.clearTimeout(timer);
  }, [enabled, location.pathname, location.search, runScan]);

  useEffect(() => {
    if (!enabled) return undefined;
    const observer = new MutationObserver(() => runScan());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled, runScan]);

  useEffect(() => () => clearFlags(), []);

  if (!enabled) return null;

  return (
    <aside className="ux-audit-panel" aria-live="polite">
      <div>
        <strong>UX Audit Mode: ON</strong>
        <p>{items.length ? `${items.length} consistency issue${items.length === 1 ? "" : "s"} flagged.` : "No issues visible on this screen."}</p>
      </div>
      <div className="ux-audit-counts">
        {Object.entries(totals).map(([key, value]) => (
          <span key={key}>{key}: {value}</span>
        ))}
      </div>
      <div className="ux-audit-actions">
        <button type="button" className="btn-secondary" onClick={runScan}>Rescan</button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, "false");
            setEnabled(false);
          }}
        >
          Off
        </button>
      </div>
    </aside>
  );
}
