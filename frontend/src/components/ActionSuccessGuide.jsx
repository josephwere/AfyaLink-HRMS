import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const DEFAULT_TIPS = [
  "Book appointments",
  "Consult doctors online",
  "Use the AI health assistant",
  "View prescriptions and records",
];

export function showActionSuccessGuide(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("afyalink:action-success", { detail }));
  if (detail.notificationCreation !== false) {
    window.dispatchEvent(
      new CustomEvent("afyalink:notification-local", {
        detail: {
          title: detail.notificationTitle || detail.title || "Action completed",
          body: detail.notificationBody || detail.message || "Your changes were saved.",
          category: detail.notificationCategory || "ACCOUNT",
          meta: detail.notificationMeta || {},
        },
      })
    );
  }
}

export default function ActionSuccessGuide() {
  const navigate = useNavigate();
  const [guide, setGuide] = useState(null);

  useEffect(() => {
    const onSuccess = (event) => {
      const detail = event?.detail || {};
      setGuide({
        title: detail.title || "Saved Successfully",
        message: detail.message || "Your changes have been securely saved.",
        icon: detail.icon || "✓",
        tips: Array.isArray(detail.tips) && detail.tips.length ? detail.tips : DEFAULT_TIPS,
        aiRecommendation: detail.aiRecommendation || "",
        actions: Array.isArray(detail.nextActions)
          ? detail.nextActions
          : Array.isArray(detail.actions)
            ? detail.actions
            : [],
        aiPrompt: detail.aiPrompt || "",
      });
    };
    window.addEventListener("afyalink:action-success", onSuccess);
    return () => window.removeEventListener("afyalink:action-success", onSuccess);
  }, []);

  if (!guide) return null;

  const close = () => setGuide(null);

  return (
    <div className="success-guide-backdrop" role="dialog" aria-modal="true" aria-live="polite">
      <div className="success-guide-modal">
        <button type="button" className="success-guide-close" onClick={close} aria-label="Close success message">
          ×
        </button>
        <div className="success-guide-icon" aria-hidden="true">
          {guide.icon}
        </div>
        <div className="success-guide-kicker">Action completed</div>
        <h2>{guide.title}</h2>
        <p>{guide.message}</p>
        <div className="success-guide-panel">
          <strong>Did you know you can?</strong>
          <ul>
            {guide.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
        {guide.aiRecommendation ? (
          <div className="success-guide-ai">
            <strong>AI recommendation</strong>
            <p>{guide.aiRecommendation}</p>
          </div>
        ) : null}
        <div className="success-guide-actions">
          {guide.actions.map((action) => (
            <button
              key={`${action.label}-${action.path || "close"}`}
              type="button"
              className={action.variant === "secondary" ? "btn-secondary" : "btn-primary"}
              onClick={() => {
                close();
                if (action.aiPrompt || action.action === "ai") {
                  window.dispatchEvent(
                    new CustomEvent("afyalink:ai-open", {
                      detail: {
                        prompt: action.aiPrompt || guide.aiPrompt || "Help me understand what I should do next in AfyaLink.",
                        source: "success-guide",
                      },
                    })
                  );
                  return;
                }
                if (action.path) navigate(action.path);
              }}
            >
              {action.label}
            </button>
          ))}
          <button type="button" className="btn-secondary" onClick={close}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
