// frontend/src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import PasswordInput from "../components/PasswordInput";
import { redirectByRole } from "../utils/redirectByRole";
import { useAuth } from "../utils/auth";
import { useGoogleAuth } from "../auth/useGoogleAuth.jsx";
import { useSystemSettings } from "../utils/systemSettings.jsx";

export default function Login() {
  const { login } = useAuth();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const { GoogleButton, error: googleError, clearError } = useGoogleAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [submitting, setSubmitting] = useState(false);

  /* -------------------------
     Post-register notice
  -------------------------- */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verify")) {
      setInfo("Account created. Verify your email from Profile inside the app.");
    }
  }, [location.search]);

  /* -------------------------
     Restore remembered email
  -------------------------- */
  useEffect(() => {
    const saved = localStorage.getItem("remember_email");
    if (saved) {
      setIdentifier(saved);
      setRememberMe(true);
    }
  }, []);

  /* -------------------------
     Email/password login
  -------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    clearError?.();

    try {
      rememberMe
        ? localStorage.setItem("remember_email", identifier)
        : localStorage.removeItem("remember_email");

      const result = await login(identifier.trim(), password);

      if (result?.requires2FA) {
        navigate("/2fa", { state: { userId: result.userId, email: identifier } });
        return;
      }

      if (!result?.user) throw new Error("Invalid credentials");

      if (!result.user.emailVerified && !result.user.phoneVerified) {
        setInfo("Account not verified. Complete verification in Profile.");
        navigate("/profile", { replace: true });
        return;
      }

      navigate(redirectByRole(result.user), { replace: true });
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------
     UI
  -------------------------- */
  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={handleSubmit}>
        {settings?.branding?.logo && (
          <div
            className="brand-logo"
            style={{
              backgroundImage: `url(${settings.branding.logo})`,
              margin: "0 auto 10px",
            }}
          />
        )}
        <h1>Welcome back</h1>
        <p className="subtitle">Sign in to AfyaLink HRMS</p>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}
        {googleError && <div className="auth-error">{googleError}</div>}

        <label>Email or phone</label>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />

        <PasswordInput
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="auth-row">
          <label className="remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>

          <Link to="/forgot-password" className="forgot-link">
            Forgot password?
          </Link>
        </div>

        <button disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>

        <div className="divider">or</div>

        {/* Google login button */}
        <div onClick={() => clearError?.()}>
          <GoogleButton />
        </div>

        <div className="auth-footer">
          <span>Don’t have an account?</span>
          <Link to="/register">Create account</Link>
        </div>
      </form>
    </div>
  );
}
