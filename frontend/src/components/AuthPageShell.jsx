import { useEffect } from "react";
import { useSystemSettings } from "../utils/systemSettings.jsx";

export default function AuthPageShell({ children, className = "" }) {
  const { settings } = useSystemSettings();

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  const backgroundReady = settings?.branding?.loginBackground ? "auth-bg-ready" : "";

  return <div className={`auth-bg ${backgroundReady} ${className}`.trim()}>{children}</div>;
}
