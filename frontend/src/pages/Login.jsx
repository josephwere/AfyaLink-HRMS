// frontend/src/pages/Login.jsx
import React from "react";
import { Link } from "react-router-dom";

import PasswordInput from "../components/PasswordInput";
import LegalLinks from "../components/LegalLinks";
import { useLogin } from "../hooks/useLogin";

export default function Login() {
  const {
    settings,
    identifier,
    setIdentifier,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    error,
    info,
    submitting,
    slowAuth,
    isOffline,
    GoogleButton,
    googleError,
    clearError,
    fieldErrors,
    handleFieldChange,
    handleSubmit,
  } = useLogin();

  /* -------------------------
     UI
  -------------------------- */
  return (
    <div className={`auth-page-shell auth-bg ${settings?.branding?.loginBackground ? "auth-bg-ready" : ""}`}>
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
        <div className="auth-kicker">Welcome Onboard</div>
        <h1>Sign in</h1>
        <p className="subtitle">
          Use your work email, phone number, or national ID to open your AfyaLink workspace.
        </p>

        <div className="auth-utility-list" aria-label="Sign-in details">
          <div className="auth-utility-item">Open schedules, requests, reports, and patient workflows for your role.</div>
          <div className="auth-utility-item">Use offline sign-in only on devices you have already used successfully.</div>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}
        {googleError && googleError !== error && <div className="auth-error">{googleError}</div>}
        {isOffline && (
          <div className="auth-info">
            You are offline. Sign-in only works for accounts that were previously used on this device.
          </div>
        )}
        {slowAuth && (
          <div className="auth-info">
            Secure sign-in is still loading. Wait a few seconds, then try again.
          </div>
        )}

        <label htmlFor="login-identifier">Email, phone or national ID</label>
        <input
          id="login-identifier"
          type="text"
          value={identifier}
          onChange={(e) => handleFieldChange("identifier", e.target.value)}
          placeholder="you@example.com, +2547..., or ID number"
          required
          aria-invalid={Boolean(fieldErrors?.identifier)}
        />
        {fieldErrors?.identifier ? <div className="auth-error">❌ {fieldErrors.identifier}</div> : null}

        <PasswordInput
          id="login-password"
          label="Password"
          value={password}
          onChange={(e) => handleFieldChange("password", e.target.value)}
          required
          helperText={fieldErrors?.password ? `❌ ${fieldErrors.password}` : ""}
          inputClassName={fieldErrors?.password ? "input-error" : ""}
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
          <span>Need an account?</span>
          <Link to="/register">Create account</Link>
        </div>

        <div className="auth-footer">
          <span>Review hospital job listings?</span>
          <Link to="/careers?src=LOGIN_PAGE">View careers</Link>
        </div>

        <LegalLinks className="auth-legal-links" />
      </form>
    </div>
  );
}
