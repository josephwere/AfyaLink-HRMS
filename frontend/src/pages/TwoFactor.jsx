import React from "react";
import { Link } from "react-router-dom";
import LegalLinks from "../components/LegalLinks";
import { useTwoFactor } from "../hooks/useTwoFactor";

export default function TwoFactor() {
  const {
    settings,
    methodCopy,
    pendingMethod,
    otp,
    setOtp,
    error,
    info,
    loading,
    resending,
    cooldown,
    submitOtp,
    resendCode,
    switchAccount,
  } = useTwoFactor();

  return (
    <div className={`auth-bg ${settings?.branding?.loginBackground ? "auth-bg-ready" : ""}`}>
      <div className="auth-card auth-card-wide auth-card-2fa">
        {settings?.branding?.logo ? (
          <div
            className="brand-logo"
            style={{
              backgroundImage: `url(${settings.branding.logo})`,
              margin: "0 auto 12px",
            }}
          />
        ) : null}

        <div className="auth-kicker">Access verification</div>
        <div className="auth-2fa-badge">{methodCopy.badge}</div>
        <h1>{methodCopy.title}</h1>
        <p className="subtitle">{methodCopy.subtitle}</p>

        {methodCopy.destination ? <p className="auth-2fa-destination">{methodCopy.destination}</p> : null}
        <div className="auth-2fa-tip">{methodCopy.helper}</div>

        {error ? <div className="auth-error">{error}</div> : null}
        {info ? <div className="auth-info">{info}</div> : null}

        <form className="form auth-2fa-form" onSubmit={submitOtp}>
          <label htmlFor="two-factor-code">Authenticator, OTP, or recovery code</label>
          <input
            id="two-factor-code"
            type="text"
            inputMode={pendingMethod === "TOTP" ? "text" : "numeric"}
            autoComplete="one-time-code"
            maxLength={20}
            placeholder={pendingMethod === "TOTP" ? "123456 or ABCD1234" : "123456 or ABCD1234"}
            value={otp}
            onChange={(e) => setOtp(e.target.value.toUpperCase().replace(/\s+/g, ""))}
            className="auth-2fa-input"
            required
          />

          <div className="auth-2fa-inline-meta">
            <span>6-digit codes work instantly.</span>
            <span>Recovery codes can be pasted in full.</span>
          </div>

          <div className="auth-2fa-actions">
            <button className="btn-primary" type="submit" disabled={loading || otp.trim().length < 6}>
              {loading ? "Verifying..." : "Verify and continue"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={resendCode}
              disabled={!methodCopy.canResend || resending || cooldown > 0}
            >
              {methodCopy.canResend
                ? resending
                  ? "Sending..."
                  : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : "Resend code"
                : "Authenticator app in use"}
            </button>
          </div>
        </form>

        <div className="auth-2fa-grid">
          <div className="card premium-card">
            <strong>Authenticator app</strong>
            <p className="muted">
              Use the current 6-digit code from Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app.
            </p>
          </div>
          <div className="card premium-card">
            <strong>Recovery code fallback</strong>
            <p className="muted">
              If your device is unavailable, paste one saved recovery code here. Each recovery code can be used once.
            </p>
          </div>
        </div>

        <div className="auth-2fa-footer">
          <button type="button" className="auth-link-button" onClick={switchAccount}>
            Use another account
          </button>
          <Link to="/forgot-password" className="auth-link-button">
            Forgot password?
          </Link>
        </div>

        <LegalLinks />
      </div>
    </div>
  );
}
