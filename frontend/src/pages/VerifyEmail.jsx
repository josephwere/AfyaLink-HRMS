import { Link } from "react-router-dom";
import AuthPageShell from "../components/AuthPageShell";
import { useVerifyEmail } from "../hooks/useVerifyEmail";
import "./verify.css";

export default function VerifyEmail() {
  const { status, cooldown, loading, email, setEmail, message, token, handleResend } = useVerifyEmail();

  return (
    <AuthPageShell>
      <div className="verify-page">
      {status === "verifying" && (
        <div className="auth-card auth-status-card premium-card verify-card">
          <div className="auth-kicker">Email verification</div>
          <h1>Checking verification link</h1>
          <p className="subtitle">Please wait while we confirm that this link is still valid.</p>
        </div>
      )}

      {status === "success" && (
        <div className="auth-card auth-status-card premium-card verify-card success">
          <div className="auth-kicker">Email verification</div>
          <div className="auth-status-icon">OK</div>
          <h1>Email confirmed</h1>
          <p className="subtitle">This email address is now ready for sign-in and account recovery.</p>
          <Link to="/login" className="btn-primary">
            Go to sign in
          </Link>
        </div>
      )}

      {status === "invalid" && (
        <div className="auth-card auth-status-card premium-card verify-card error">
          <div className="auth-kicker">Email verification</div>
          <div className="auth-status-icon">!</div>
          <h1>Verification link is not valid</h1>
          <p className="subtitle">Open the latest verification email and use the newest link.</p>
        </div>
      )}

      {status === "error" && (
        <div className="auth-card auth-status-card premium-card verify-card error">
          <div className="auth-kicker">Email verification</div>
          <div className="auth-status-icon">!</div>
          <h1>Link expired or already used</h1>
          <p className="subtitle">
            Enter your email address below and we will send a new verification link.
          </p>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginTop: 12 }}
          />

          {message ? <div className="auth-info">{message}</div> : null}

          <button
            type="button"
            onClick={handleResend}
            disabled={loading || cooldown > 0 || !email}
            className="btn-secondary"
          >
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : loading
              ? "Sending…"
              : "Resend verification email"}
          </button>
        </div>
      )}
      </div>
    </AuthPageShell>
  );
}
