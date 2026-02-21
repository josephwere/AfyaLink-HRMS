import React from "react";
import AIChatWS from "../../components/AIChatWS";
import { useAuth } from "../../utils/auth";

export default function MedicalAssistant() {
  const { user } = useAuth();
  const token = localStorage.getItem("token");

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Medical Assistant</h2>
          <p className="muted">
            Real-time clinical assistant chat for {user?.name || "current user"}.
          </p>
        </div>
      </div>
      <section className="section">
        <div className="card">
          <AIChatWS token={token} />
        </div>
      </section>
    </div>
  );
}
