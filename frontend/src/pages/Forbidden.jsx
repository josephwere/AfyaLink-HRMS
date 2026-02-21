import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <div className="auth-bg">
      <div className="auth-card">
        <h1>403 — Forbidden</h1>
        <p>You don’t have permission to access this page.</p>
        <Link to="/">Go home</Link>
      </div>
    </div>
  );
}
