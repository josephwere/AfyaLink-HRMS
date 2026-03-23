import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LegalLinks from "../components/LegalLinks";
import { apiFetch } from "../utils/apiFetch";
import { useSystemSettings } from "../utils/systemSettings.jsx";

function maskEmail(value) {
  const raw = String(value || "").trim();
  if (!raw || !raw.includes("@")) return "";
  const [local, domain] = raw.split("@");
  if (!local || !domain) return raw;
  const visible = local.length <= 2 ? `${local[0] || ""}*` : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

export default function ForgotPassword() {
  const { settings } = useSystemSettings();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setError("");

    try {
      await apiFetch("/healthz", {
        method: "GET",
        timeoutMs: 4000,
        _skipOfflineQueue: true,
      });

      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
        timeoutMs: 45000,
      });

      setSubmitted(true);
      setMsg("If an AfyaLink account matches this email, a secure reset link is already on the way.");
    } catch (err) {
      const message = err.message || "Something went wrong";
      if (message.toLowerCase().includes("network error")) {
        setError("Backend is unavailable right now. Please wait 20–30 seconds and try again.");
        return;
      }
      if (message.toLowerCase().includes("timed out")) {
        setError("Server is waking up. Please wait 20–30 seconds and try again.");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const maskedEmail = maskEmail(email);

  return (
    <div className={`auth-bg ${settings?.branding?.loginBackground ? "auth-bg-ready" : ""}`}>
      <form className="auth-card" onSubmit={submit}>
        {settings?.branding?.logo && (
          <div
            className="brand-logo"
            style={{
              backgroundImage: `url(${settings.branding.logo})`,
              margin: "0 auto 10px",
            }}
          />
        )}
        <h1>Forgot password</h1>
        <p className="subtitle">Enter your email and we’ll send you a reset link</p>

        {error && <div className="auth-error">{error}</div>}
        {msg && !submitted && <div className="auth-info">{msg}</div>}
        {submitted ? (
          <div className="auth-success-panel">
            <div className="auth-success-badge">Reset link requested</div>
            <h3>Check your email</h3>
            <p className="auth-success-copy">
              {msg}
            </p>
            {maskedEmail ? (
              <p className="auth-success-meta">
                Requested for <strong>{maskedEmail}</strong>
              </p>
            ) : null}
            <div className="auth-success-steps">
              <div className="auth-success-step">
                <span>1</span>
                <div>
                  <strong>Open your inbox</strong>
                  <p>Look for an email from AfyaLink HRMS in the next few minutes.</p>
                </div>
              </div>
              <div className="auth-success-step">
                <span>2</span>
                <div>
                  <strong>Check spam or promotions</strong>
                  <p>If you do not see it in your main inbox, check your other folders too.</p>
                </div>
              </div>
              <div className="auth-success-step">
                <span>3</span>
                <div>
                  <strong>Use the link within 1 hour</strong>
                  <p>The reset link expires for security, so open it as soon as it arrives.</p>
                </div>
              </div>
            </div>
            <p className="auth-success-note">
              For privacy and security, we always show the same confirmation message whether the email exists or not.
            </p>
          </div>
        ) : null}

        <label>Email address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : submitted ? "Send again" : "Send reset link"}
        </button>

        <div className="auth-footer">
          <span>Remembered your password?</span>
          <Link to="/login">Back to login</Link>
        </div>

        <LegalLinks className="auth-legal-links" />
      </form>
    </div>
  );
}
