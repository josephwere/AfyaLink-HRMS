import React from "react";
import { Link } from "react-router-dom";
import LegalLinks from "../components/LegalLinks";
import PasswordInput from "../components/PasswordInput";
import { useForgotPassword } from "../hooks/useForgotPassword";

export default function ForgotPassword() {
  const {
    settings,
    isEmailMode,
    submitEmail,
    requestPhoneResetCode,
    submitPhoneReset,
    email,
    setEmail,
    phone,
    setPhone,
    phoneOtp,
    setPhoneOtp,
    phonePassword,
    setPhonePassword,
    msg,
    setMsg,
    error,
    setError,
    loading,
    submitted,
    phoneCodeSent,
    setChannel,
    setSubmitted,
    setPhoneCodeSent,
    setPhoneResetComplete,
    phoneResetComplete,
    maskedEmail,
    maskedPhone,
  } = useForgotPassword();

  return (
    <div className={`auth-bg ${settings?.branding?.loginBackground ? "auth-bg-ready" : ""}`}>
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
        <div className="auth-kicker">Password recovery</div>
        <h1>Reset password</h1>
        <p className="subtitle">
          Use your email for a reset link or your phone number for a one-time reset code.
        </p>

        <div className="auth-utility-list" aria-label="Password reset details">
          <div className="auth-utility-item">Email reset links expire quickly and should be opened on a trusted device.</div>
          <div className="auth-utility-item">Phone reset codes let you set a new password without opening your email inbox.</div>
        </div>

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
            <p className="auth-success-copy">{msg}</p>
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
                : "Send reset email"
              : phoneCodeSent
                ? "Reset with code"
                : "Send reset code"}
        </button>

        <div className="auth-footer">
          <span>Remembered your password?</span>
          <Link to="/login">Back to sign in</Link>
        </div>

        <LegalLinks className="auth-legal-links" />
      </form>
    </div>
  );
}
