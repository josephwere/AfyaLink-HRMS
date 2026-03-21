import { Link } from "react-router-dom";

export default function AccessDeniedCard({
  title = "Access denied",
  message = "This area is not available for the current role view or account privileges.",
}) {
  return (
    <div className="auth-status-shell">
      <div className="auth-status-card premium-card">
        <div className="auth-status-icon">🚫</div>
        <h1>{title}</h1>
        <p className="subtitle">{message}</p>
        <div className="auth-status-actions">
          <Link to="/profile" className="btn-secondary">
            Role View Switcher
          </Link>
          <Link to="/" className="btn-primary">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
