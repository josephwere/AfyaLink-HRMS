import { Link } from "react-router-dom";

export default function VerifySuccess() {
  return (
    <div className="auth-bg">
      <div className="auth-card">
        <h1>🎉 Email Verified</h1>
        <p className="subtitle">
          Your email has been successfully verified.
          You can now log in to your account.
        </p>

        <Link to="/login" className="btn-primary" style={{ display: "inline-flex", textDecoration: "none" }}>
          Go to login
        </Link>
      </div>
    </div>
  );
}
