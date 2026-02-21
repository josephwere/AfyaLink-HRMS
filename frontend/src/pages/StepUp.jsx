import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch, { ApiError } from "../utils/apiFetch";

export default function StepUp() {
  const navigate = useNavigate();
  const [sessionRisk, setSessionRisk] = useState(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadRisk = async () => {
    try {
      const data = await apiFetch("/api/auth/session-risk");
      setSessionRisk(data || null);
    } catch (err) {
      setSessionRisk(null);
      setError(err?.message || "Failed to load session risk");
    }
  };

  useEffect(() => {
    loadRisk();
  }, []);

  const requestCode = async () => {
    setRequesting(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/api/auth/step-up/request", { method: "POST" });
      setMessage("Step-up code sent. Check your email or phone.");
    } catch (err) {
      setError(err?.message || "Failed to request step-up code");
    } finally {
      setRequesting(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await apiFetch("/api/auth/step-up/verify", {
        method: "POST",
        body: { otp: otp.trim() },
      });
      if (data?.accessToken) {
        localStorage.setItem("token", data.accessToken);
      }
      setMessage("Session unlocked successfully.");
      setTimeout(() => navigate(-1), 600);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to verify step-up code");
      }
    } finally {
      setLoading(false);
    }
  };

  const risk = sessionRisk?.risk || {};
  const restriction = sessionRisk?.restriction || null;

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Session Security Check</h2>
          <p className="muted">
            Complete a step-up verification to continue sensitive actions.
          </p>
        </div>
        <div className="welcome-actions">
          <button className="btn-secondary" onClick={loadRisk}>
            Refresh Risk
          </button>
          <button className="btn-primary" onClick={requestCode} disabled={requesting}>
            {requesting ? "Sending..." : "Send Step-up Code"}
          </button>
        </div>
      </div>

      <section className="section">
        <div className="grid info-grid">
          <div className="card"><strong>Risk Level:</strong> {risk.level || "—"}</div>
          <div className="card"><strong>Risk Score:</strong> {risk.score ?? "—"}</div>
          <div className="card"><strong>Step-up Required:</strong> {sessionRisk?.requiresStepUp ? "Yes" : "No"}</div>
          <div className="card"><strong>Step-up Verified At:</strong> {sessionRisk?.stepUpVerifiedAt || "Not yet"}</div>
        </div>
      </section>

      {restriction && (
        <section className="section">
          <div className="card">
            <strong>Restriction Active</strong>
            <div className="muted">Reason: {restriction.reason || "RISK_RESTRICTION_ACTIVE"}</div>
            <div className="muted">Until: {restriction.until || "Auto-expiry pending"}</div>
          </div>
        </section>
      )}

      <section className="section">
        <form className="card" onSubmit={verifyCode}>
          <h3>Verify Step-up Code</h3>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter 6-digit code"
            maxLength={8}
            required
          />
          <div className="welcome-actions" style={{ marginTop: 12 }}>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify & Unlock"}
            </button>
          </div>
          {message && <p className="auth-info">{message}</p>}
          {error && <p className="auth-error">{error}</p>}
        </form>
      </section>
    </div>
  );
}

