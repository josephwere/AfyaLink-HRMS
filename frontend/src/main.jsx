// frontend/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
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
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <SystemSettingsProvider>
            <AuthProvider>
              <AppLanguageProvider>
                <AppErrorBoundary>
                  <App />
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
      navigator.serviceWorker.register("/sw.js").catch(() => {
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
