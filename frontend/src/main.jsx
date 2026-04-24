// frontend/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { AuthProvider } from "./utils/auth";
import { ThemeProvider } from "./utils/theme.jsx";
import { SystemSettingsProvider } from "./utils/systemSettings.jsx";
import { AppLanguageProvider } from "./utils/appLanguage.jsx";
import "./styles.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter future={{ v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <SystemSettingsProvider>
            <AuthProvider>
              <AppLanguageProvider>
                <AppErrorBoundary>
                  <App />
                  <Analytics />
                </AppErrorBoundary>
              </AppLanguageProvider>
            </AuthProvider>
          </SystemSettingsProvider>
        </ThemeProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      const buildId = import.meta.env.VITE_BUILD_ID || "v2";
      navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(buildId)}`).catch(() => {
        // Keep app functional even if service worker registration fails.
      });
    });
  } else {
    // Avoid stale-cache white screens during Vite HMR.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  }
}
