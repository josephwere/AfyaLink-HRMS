import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch, { ApiError } from "../utils/apiFetch";
import { setAccessToken } from "../utils/browserSession";
import AuthPageShell from "../components/AuthPageShell";

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
        setAccessToken(data.accessToken);
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
    <AuthPageShell>
      <div className="auth-card auth-card-wide">
        <div className="auth-kicker">Additional verification</div>
        <h1>Confirm this session</h1>
        <p className="subtitle">
          Sensitive actions are paused until you verify this session with a one-time code.
        </p>

        <div className="auth-detail-grid">
          <div className="auth-detail-card">
            <strong>Risk level</strong>
            <span>{risk.level || "Unknown"}</span>
          </div>
          <div className="auth-detail-card">
            <strong>Risk score</strong>
            <span>{risk.score ?? "Unavailable"}</span>
          </div>
          <div className="auth-detail-card">
            <strong>Verification required</strong>
            <span>{sessionRisk?.requiresStepUp ? "Yes" : "No"}</span>
          </div>
          <div className="auth-detail-card">
            <strong>Last verified</strong>
            <span>{sessionRisk?.stepUpVerifiedAt || "Not verified in this session"}</span>
          </div>
        </div>

        {restriction ? (
          <div className="auth-error" style={{ marginTop: 16 }}>
            <strong>Restriction active.</strong> {restriction.reason || "Risk restriction is active"} until{" "}
            {restriction.until || "the current review period ends"}.
          </div>
        ) : null}

        {message && <div className="auth-info">{message}</div>}
        {error && <div className="auth-error">{error}</div>}

        <form className="form" onSubmit={verifyCode}>
          <label htmlFor="step-up-code">One-time code</label>
          <input
            id="step-up-code"
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter the 6-digit code"
            maxLength={8}
            required
          />
          <div className="auth-inline-links">
            <button type="button" className="btn-secondary" onClick={loadRisk}>
              Refresh session risk
            </button>
            <button type="button" className="btn-secondary" onClick={requestCode} disabled={requesting}>
              {requesting ? "Sending..." : "Send new code"}
            </button>
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify and continue"}
          </button>
        </form>
      </div>
    </AuthPageShell>
  );
}
