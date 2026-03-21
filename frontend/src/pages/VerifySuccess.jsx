import { Link } from "react-router-dom";

export default function VerifySuccess() {
  return (
    <div className="auth-bg auth-status-shell">
      <div className="auth-card auth-status-card">
        <div className="auth-status-icon">✓</div>
        <h1>Email Verified</h1>
        <p className="subtitle">
          Your email has been successfully verified.
          You can now log in to your account.
        </p>

        <div className="auth-status-actions">
          <Link to="/login" className="btn-primary">
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}
