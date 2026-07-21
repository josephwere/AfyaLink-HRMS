import React from "react";
import { useStepUp } from "../hooks/useStepUp";
import AuthPageShell from "../components/AuthPageShell";

export default function StepUp() {
  const { sessionRisk, otp, setOtp, loading, requesting, message, error, loadRisk, requestCode, verifyCode } = useStepUp();

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
