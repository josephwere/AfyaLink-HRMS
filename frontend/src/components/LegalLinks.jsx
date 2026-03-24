import { Link } from "react-router-dom";
import { useAppLanguage } from "../utils/appLanguage.jsx";

export default function LegalLinks({ compact = false, className = "" }) {
  const { translateText } = useAppLanguage();
  return (
    <div className={`legal-links${compact ? " compact" : ""}${className ? ` ${className}` : ""}`.trim()}>
      <Link to="/terms">{translateText("Terms")}</Link>
      <span className="legal-links-separator">•</span>
      <Link to="/privacy">{translateText("Privacy")}</Link>
    </div>
  );
}
