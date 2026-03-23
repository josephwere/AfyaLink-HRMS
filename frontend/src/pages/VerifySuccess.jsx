import { Link } from "react-router-dom";

export default function VerifySuccess() {
  return (
    <div className="auth-bg auth-status-shell">
      <div className="auth-card auth-status-card premium-card">
        <div className="auth-status-icon">✓</div>
        <h1>Email Verified</h1>
        <p className="subtitle">
          Your email has been successfully verified.
          You can now log in to your account.
        </p>
        <div className="premium-note-grid">
          <div className="premium-note">
            <strong>Account status</strong>
            <span>Identity verification completed. You can continue into the platform immediately.</span>
          </div>
          <div className="premium-note">
            <strong>Next step</strong>
            <span>Sign in and finish any required setup such as 2FA, role view, or profile completion.</span>
          </div>
        </div>

        <div className="auth-status-actions">
          <Link to="/login" className="btn-primary">
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}
