import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LegalLinks from "../components/LegalLinks";
import LanguageSwitcher from "../components/LanguageSwitcher";
import PasswordInput from "../components/PasswordInput";
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
  const [channel, setChannel] = useState("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneResetComplete, setPhoneResetComplete] = useState(false);

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  const submitEmail = async (e) => {
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

  const requestPhoneResetCode = async (e) => {
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

      await apiFetch("/api/auth/forgot-password/phone/request-otp", {
        method: "POST",
        body: { phone },
        timeoutMs: 45000,
      });

      setPhoneResetComplete(false);
      setPhoneCodeSent(true);
      setSubmitted(true);
      setMsg("If an AfyaLink account matches this phone number, a secure reset code is already on the way.");
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

  const submitPhoneReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setError("");

    try {
      await apiFetch("/api/auth/reset-password/phone", {
        method: "POST",
        body: { phone, otp: phoneOtp, password: phonePassword },
        timeoutMs: 45000,
      });

      setPhoneResetComplete(true);
      setMsg("Password reset successful. You can now sign in with the new password.");
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Invalid or expired reset code");
    } finally {
      setLoading(false);
    }
  };

  const maskedEmail = maskEmail(email);
  const maskedPhone = phone
    ? `${phone.slice(0, Math.min(4, phone.length))}${"*".repeat(Math.max(0, phone.length - Math.min(4, phone.length)))}`
    : "";
  const isEmailMode = channel === "email";

  return (
    <div className={`auth-bg ${settings?.branding?.loginBackground ? "auth-bg-ready" : ""}`}>
      <LanguageSwitcher compact className="auth-language-switcher" />
      <form className="auth-card" onSubmit={isEmailMode ? submitEmail : phoneCodeSent ? submitPhoneReset : requestPhoneResetCode}>
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
        <p className="subtitle">
          Use your email for a reset link, or your phone number for a one-time reset code.
        </p>

        <div className="auth-segmented" role="tablist" aria-label="Password recovery method">
          <button
            type="button"
            className={`auth-segmented-btn ${isEmailMode ? "active" : ""}`}
            onClick={() => {
              setChannel("email");
              setMsg("");
              setError("");
              setSubmitted(false);
              setPhoneCodeSent(false);
              setPhoneResetComplete(false);
            }}
          >
            Email link
          </button>
          <button
            type="button"
            className={`auth-segmented-btn ${!isEmailMode ? "active" : ""}`}
            onClick={() => {
              setChannel("phone");
              setMsg("");
              setError("");
              setSubmitted(false);
              setPhoneResetComplete(false);
            }}
          >
            Phone OTP
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {msg && !submitted && <div className="auth-info">{msg}</div>}
        {submitted ? (
            <div className="auth-success-panel">
            <div className="auth-success-badge">
              {isEmailMode ? "Reset link requested" : phoneResetComplete ? "Password updated" : "Reset code sent"}
            </div>
            <h3>{isEmailMode ? "Check your email" : phoneResetComplete ? "Password updated" : "Check your phone"}</h3>
            <p className="auth-success-copy">
              {msg}
            </p>
            {isEmailMode && maskedEmail ? (
              <p className="auth-success-meta">
                Requested for <strong>{maskedEmail}</strong>
              </p>
            ) : null}
            {!isEmailMode && maskedPhone ? (
              <p className="auth-success-meta">
                Requested for <strong>{maskedPhone}</strong>
              </p>
            ) : null}
            <div className="auth-success-steps">
              <div className="auth-success-step">
                <span>1</span>
                <div>
                  <strong>{isEmailMode ? "Open your inbox" : "Open your messages"}</strong>
                  <p>
                    {isEmailMode
                      ? "Look for an email from AfyaLink HRMS in the next few minutes."
                      : phoneResetComplete
                        ? "Your password has been updated successfully."
                        : "Look for a 6-digit AfyaLink reset code on the phone number you entered."}
                  </p>
                </div>
              </div>
              <div className="auth-success-step">
                <span>2</span>
                <div>
                  <strong>{isEmailMode ? "Check spam or promotions" : "Enter the code and set a new password"}</strong>
                  <p>
                    {isEmailMode
                      ? "If you do not see it in your main inbox, check your other folders too."
                      : phoneResetComplete
                        ? "Return to login and use the new password on your next sign-in."
                        : "Codes expire quickly for security, so complete the reset as soon as it arrives."}
                  </p>
                </div>
              </div>
              <div className="auth-success-step">
                <span>3</span>
                <div>
                  <strong>{isEmailMode ? "Use the link within 1 hour" : "Sign in with the new password"}</strong>
                  <p>
                    {isEmailMode
                      ? "The reset link expires for security, so open it as soon as it arrives."
                      : phoneResetComplete
                        ? "If you need another code later, you can request a fresh one from this page."
                        : "Once the reset succeeds, go back to login and use the new password immediately."}
                  </p>
                </div>
              </div>
            </div>
            <p className="auth-success-note">
              For privacy and security, we always show the same confirmation message whether the account exists or not.
            </p>
          </div>
        ) : null}

        {isEmailMode ? (
          <>
            <label>Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </>
        ) : (
          <>
            <label>Phone number</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+2547..."
            />
            {phoneCodeSent ? (
              <>
                <label>Reset code</label>
                <input
                  type="text"
                  required
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value)}
                  placeholder="6-digit code"
                />
                <PasswordInput
                  label="New password"
                  value={phonePassword}
                  onChange={(e) => setPhonePassword(e.target.value)}
                  required
                  showStrength
                />
              </>
            ) : null}
          </>
        )}

        <button type="submit" disabled={loading}>
          {loading
            ? "Sending..."
            : isEmailMode
              ? submitted
                ? "Send again"
                : "Send reset link"
              : phoneCodeSent
                ? "Reset with code"
                : "Send reset code"}
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
