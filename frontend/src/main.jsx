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
import { AIContextProvider } from "./context/AIContextProvider";
import { UserContextProvider } from "./contexts/UserContextContext";
import { initializeFrontendRuntime } from "./services/shared/frontendRuntime";
import "./styles.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

async function clearLegacyServiceWorkers() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    // Ignore cleanup issues and keep boot non-blocking.
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("afyalink-"))
          .map((key) => caches.delete(key))
      );
    }
  } catch {
    // Ignore cache cleanup issues and keep boot non-blocking.
  }
}

async function bootstrapApp() {
  try {
    await initializeFrontendRuntime();
  } catch (error) {
    console.warn("Frontend runtime bootstrap failed", error);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <GoogleOAuthProvider clientId={googleClientId}>
        <BrowserRouter future={{ v7_relativeSplatPath: true }}>
          <ThemeProvider>
            <SystemSettingsProvider>
              <AuthProvider>
                <AppLanguageProvider>
                  <UserContextProvider>
                    <AIContextProvider>
                      <AppErrorBoundary>
                        <App />
                        <Analytics />
                      </AppErrorBoundary>
                    </AIContextProvider>
                  </UserContextProvider>
                </AppLanguageProvider>
              </AuthProvider>
            </SystemSettingsProvider>
          </ThemeProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </React.StrictMode>
  );
}

bootstrapApp();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    clearLegacyServiceWorkers().catch(() => {});
  });
}
