import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LegalLinks from "../components/LegalLinks";
import { useAuth } from "../utils/auth";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import {
  guardedAuthFetch,
  normalizeAuthUiError,
  warmAuthRuntime,
} from "../services/guardedAuthFetch";

function maskIdentifier(value) {
  const raw = String(value || "").trim();
  if (!raw) return "your account";
  if (raw.includes("@")) {
    const [local, domain] = raw.split("@");
    if (!local || !domain) return raw;
    return `${local.slice(0, 2)}***@${domain}`;
  }
  const compact = raw.replace(/\s+/g, "");
  if (/^\+?\d+$/.test(compact)) {
    const visible = compact.slice(-3);
    return `${compact.slice(0, Math.min(4, compact.length)).replace(/\d/g, "*")}***${visible}`;
  }
  if (compact.length <= 4) return `${compact[0] || "*"}***`;
  return `${compact.slice(0, 2)}***${compact.slice(-2)}`;
}

function clearPending2FAState() {
  localStorage.removeItem("2fa_pending");
  localStorage.removeItem("2fa_user");
  localStorage.removeItem("2fa_method");
  localStorage.removeItem("2fa_reason");
  localStorage.removeItem("2fa_identifier");
}

export default function TwoFactor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { complete2FA } = useAuth();
  const { settings } = useSystemSettings();

  const userId = location.state?.userId || localStorage.getItem("2fa_user");
  const pendingMethod = String(
    location.state?.method || localStorage.getItem("2fa_method") || "OTP"
  ).toUpperCase();
  const pendingReason = String(
    location.state?.reason || localStorage.getItem("2fa_reason") || "ACCOUNT_2FA"
  ).toUpperCase();
  const pendingIdentifier =
    location.state?.email ||
    location.state?.identifier ||
    localStorage.getItem("2fa_identifier") ||
    "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  useEffect(() => {
    warmAuthRuntime("auth-entry").catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) {
      navigate("/login", { replace: true });
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const methodCopy = useMemo(() => {
    if (pendingMethod === "TOTP") {
      return {
        badge: "Authenticator required",
        title: "Approve your sign-in",
        subtitle:
          "Open your authenticator app and enter the current 6-digit code. Recovery codes also work here.",
        helper:
          pendingReason === "RISK_STEP_UP" || pendingReason === "RISK_CRITICAL_RESTRICTED"
            ? "We asked for an extra check because this sign-in looked unusual."
            : "Your account is protected with authenticator-based two-factor verification.",
        destination: null,
        canResend: false,
      };
    }

    return {
      badge: "Security code sent",
      title: "Finish signing in",
      subtitle:
        "Enter the one-time security code we sent to your verified contact channel. Recovery codes also work here.",
      helper:
        pendingReason === "RISK_STEP_UP" || pendingReason === "RISK_CRITICAL_RESTRICTED"
          ? "We added this check because the sign-in risk score was elevated."
          : "Your account requires a second verification step before we open the workspace.",
      destination: pendingIdentifier ? `Last login attempt: ${maskIdentifier(pendingIdentifier)}` : null,
      canResend: true,
    };
  }, [pendingIdentifier, pendingMethod, pendingReason]);

  if (!userId) return null;

  const submitOtp = async (e) => {
    e.preventDefault();
    if (otp.trim().length < 6) return;

    setError("");
    setInfo("");
    setLoading(true);

    try {
      const data = await guardedAuthFetch("/api/auth/2fa/verify", {
        method: "POST",
        body: { userId, otp: otp.trim().toUpperCase() },
      });

      complete2FA(data.accessToken, data.refreshToken);
      clearPending2FAState();
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        normalizeAuthUiError(err, {
          timeoutMessage:
            "Two-factor verification is taking longer than usual. Please wait a few seconds and try again.",
          networkMessage:
            "Two-factor verification is temporarily unavailable. Please check your connection and try again.",
          fallback: "Verification failed",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!methodCopy.canResend || cooldown > 0) return;
    setResending(true);
    setError("");
    setInfo("");
    try {
      const data = await guardedAuthFetch("/api/auth/2fa/resend", {
        method: "POST",
        body: { userId },
      });
      setInfo(data?.msg || "A fresh 2FA code is on the way.");
      setCooldown(30);
    } catch (err) {
      setError(
        normalizeAuthUiError(err, {
          timeoutMessage:
            "Resending the security code is taking longer than usual. Please wait a few seconds and try again.",
          networkMessage:
            "Resending the security code is temporarily unavailable. Please check your connection and try again.",
          fallback: "Failed to resend the security code",
        })
      );
    } finally {
      setResending(false);
    }
  };

  const switchAccount = () => {
    clearPending2FAState();
    navigate("/login", { replace: true });
  };

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
              Best for fast, phishing-resistant sign-in. Use the current 6-digit code from Google Authenticator,
              Microsoft Authenticator, Authy, or another TOTP app.
            </p>
          </div>
          <div className="card premium-card">
            <strong>Recovery code fallback</strong>
            <p className="muted">
              If your phone is unavailable, paste one of your saved recovery codes here. Each recovery code works once.
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
