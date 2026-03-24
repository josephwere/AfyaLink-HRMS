import { useEffect } from "react";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import LanguageSwitcher from "./LanguageSwitcher";

export default function AuthPageShell({ children, className = "" }) {
  const { settings } = useSystemSettings();

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  const backgroundReady = settings?.branding?.loginBackground ? "auth-bg-ready" : "";

  return (
    <div className={`auth-bg ${backgroundReady} ${className}`.trim()}>
      <LanguageSwitcher compact className="auth-language-switcher" />
      {children}
    </div>
  );
}
