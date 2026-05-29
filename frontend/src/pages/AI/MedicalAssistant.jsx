import React from "react";
import AIChatWS from "../../components/AIChatWS";
import { useAuth } from "../../utils/auth";
import { getAccessToken } from "../../utils/browserSession";

export default function MedicalAssistant() {
  const { user } = useAuth();
  const token = getAccessToken();

  return (
    <div className="dashboard premium-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Clinical copilot</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Medical Assistant</h1>
            <p className="premium-shell-subtitle">
              Real-time clinical assistant chat for {user?.name || "current user"} with authenticated streaming responses and safe feedback capture.
            </p>
          </div>
          <div className="premium-shell-meta">
            <div className="premium-shell-stat">
              <span>Token</span>
              <strong>{token ? "Live" : "Missing"}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>User</span>
              <strong>{user?.role || "Session"}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="premium-split">
        <section className="card premium-card">
          <AIChatWS token={token} />
        </section>
        <aside className="card premium-card premium-stack">
          <div className="premium-tag">Usage notes</div>
          <div className="premium-note-grid">
            <div className="premium-note">
              <strong>Best for</strong>
              <span>Rapid symptom summarization, workflow guidance, and draft clinical support responses.</span>
            </div>
            <div className="premium-note">
              <strong>Guardrail</strong>
              <span>All AI outputs remain assistive. Human review is still required before clinical or operational action.</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
