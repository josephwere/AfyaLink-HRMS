import React from "react";
import { useNavigate } from "react-router-dom";

function runEmptyStateAction(action, navigate) {
  if (typeof action?.onClick === "function") {
    action.onClick(navigate);
    return;
  }
  if (action?.aiPrompt) {
    window.dispatchEvent(
      new CustomEvent("afyalink:ai-open", {
        detail: {
          prompt: action.aiPrompt,
          source: "empty-state",
        },
      })
    );
    return;
  }
  if (action?.path) navigate(action.path);
}

export default function GuidedEmptyState({
  icon = "Med",
  title = "Nothing here yet",
  body = "This workspace will update as soon as new information is available.",
  actions = [],
  compact = false,
}) {
  const navigate = useNavigate();

  return (
    <div className={`guided-empty-state${compact ? " compact" : ""}`}>
      <div className="guided-empty-icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {actions.length ? (
        <div className="guided-empty-actions">
          {actions.map((action) => (
            <button
              key={`${action.label}-${action.path || action.aiPrompt || "inline"}`}
              type="button"
              className={action.variant === "primary" ? "btn-primary" : "btn-secondary"}
              onClick={() => runEmptyStateAction(action, navigate)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TableEmptyState({ colSpan = 1, ...props }) {
  return (
    <tr className="guided-empty-row">
      <td colSpan={colSpan}>
        <GuidedEmptyState compact {...props} />
      </td>
    </tr>
  );
}
