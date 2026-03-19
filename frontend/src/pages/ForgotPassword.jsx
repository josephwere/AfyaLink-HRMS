import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LegalLinks from "../components/LegalLinks";
import { apiFetch } from "../utils/apiFetch";
import { useSystemSettings } from "../utils/systemSettings.jsx";

export default function ForgotPassword() {
  const { settings } = useSystemSettings();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      setMsg("If the email exists, a reset link has been sent.");
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
        {msg && <div className="auth-info">{msg}</div>}

        <label>Email address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
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
