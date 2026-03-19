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
  const [slowAuth, setSlowAuth] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
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

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  /* -------------------------
     Email/password login
  -------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    setSlowAuth(false);
    clearError?.();
    const slowTimer = setTimeout(() => setSlowAuth(true), 2500);

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

      if (result?.offline) {
        setInfo("Offline mode: signed in using cached credentials on this device.");
      }

      if (!result.user.emailVerified && !result.user.phoneVerified) {
        setInfo("Account not verified. Complete verification in Profile.");
        navigate("/profile", { replace: true });
        return;
      }

      navigate(redirectByRole(result.user), { replace: true });
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      clearTimeout(slowTimer);
      setSubmitting(false);
      setSlowAuth(false);
    }
  };

  /* -------------------------
     UI
  -------------------------- */
  return (
    <div className={`auth-bg ${settings?.branding?.loginBackground ? "auth-bg-ready" : ""}`}>
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
        {isOffline && (
          <div className="auth-info">
            You are offline. Login works only for accounts previously signed in on this device.
          </div>
        )}
        {slowAuth && (
          <div className="auth-info">
            Signing in is taking longer than usual. Please wait a few seconds.
          </div>
        )}

        <label>Email, phone or national ID</label>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com, +2547..., or ID number"
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

        <button type="submit" disabled={submitting}>
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

        <div className="auth-footer">
          <span>Looking for hospital jobs?</span>
          <Link to="/careers?src=LOGIN_PAGE">View careers</Link>
        </div>
      </form>
    </div>
  );
}
