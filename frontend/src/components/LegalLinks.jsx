import { Link } from "react-router-dom";

export default function LegalLinks({ compact = false, className = "" }) {
  return (
    <div className={`legal-links${compact ? " compact" : ""}${className ? ` ${className}` : ""}`.trim()}>
      <Link to="/terms">Terms</Link>
      <span className="legal-links-separator">•</span>
      <Link to="/privacy">Privacy</Link>
    </div>
  );
}
