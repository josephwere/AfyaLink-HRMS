import { Link } from "react-router-dom";
import AuthPageShell from "../components/AuthPageShell";

export default function VerifySuccess() {
  return (
    <AuthPageShell className="auth-status-shell">
      <div className="auth-card auth-status-card premium-card">
        <div className="auth-kicker">Email verification</div>
        <div className="auth-status-icon">OK</div>
        <h1>Email confirmed</h1>
        <p className="subtitle">
          Your email address is verified. You can sign in and finish the remaining account checks from Profile.
        </p>
        <div className="premium-note-grid">
          <div className="premium-note">
            <strong>Account status</strong>
            <span>Email-based account recovery is now available for this account.</span>
          </div>
          <div className="premium-note">
            <strong>Next step</strong>
            <span>Sign in and review phone verification, password settings, and privacy controls.</span>
          </div>
        </div>

        <div className="auth-status-actions">
          <Link to="/login" className="btn-primary">
            Go to sign in
          </Link>
        </div>
      </div>
    </AuthPageShell>
  );
}
