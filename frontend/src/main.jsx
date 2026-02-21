// frontend/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./App";
import { AuthProvider } from "./utils/auth";
import { ThemeProvider } from "./utils/theme.jsx";
import { SystemSettingsProvider } from "./utils/systemSettings.jsx";
import "./styles.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <ThemeProvider>
          <SystemSettingsProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </SystemSettingsProvider>
        </ThemeProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
