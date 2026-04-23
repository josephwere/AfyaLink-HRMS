import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../utils/auth";
import { redirectByRole } from "../utils/redirectByRole";
import { useTheme } from "../utils/theme.jsx";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { useAppLanguage } from "../utils/appLanguage.jsx";
import { triggerAction } from "../services/actionApi";
import AppIcon from "./AppIcon";

export default function Navbar({ onToggleSidebar, onToggleContextRail, contextOpen = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, cycleTheme } = useTheme();
  const { settings } = useSystemSettings();
  const { translateText } = useAppLanguage();
  const logo = settings?.branding?.logo;
  const nextThemeLabel = theme === "dark" ? "Light mode" : "Dark mode";

  const homePath = user ? redirectByRole(user) : "/";

  const safeTrigger = useCallback(async (action) => {
    try {
      await triggerAction(action);
    } catch {
      // Ignore telemetry/action hook errors in navbar interactions.
    }
  }, []);

  const openCommandPalette = useCallback(async () => {
    await safeTrigger("OPEN_COMMAND_PALETTE");
    window.dispatchEvent(new CustomEvent("afyalink:open-command-palette"));
  }, [safeTrigger]);

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleSidebar}
          aria-label={translateText("Open navigator")}
          title={translateText("Navigator")}
        >
          <AppIcon name="menu" />
        </button>

        <button type="button" className="brand-btn" onClick={() => navigate(homePath)}>
          {logo ? <span className="brand-logo" style={{ backgroundImage: `url(${logo})` }} /> : "AfyaLink"}
        </button>
      </div>

      <div className="navbar-center" />

      <div className="navbar-right">
        {user ? (
          <button
            type="button"
            className="icon-btn ghost"
            title={translateText("Command palette (Ctrl+K)")}
            aria-label={translateText("Open command palette")}
            onClick={openCommandPalette}
          >
            <AppIcon name="search" />
          </button>
        ) : null}

        {user ? (
          <button
            type="button"
            className={`icon-btn ghost${contextOpen ? " active" : ""}`}
            title={translateText("Context panel")}
            aria-label={translateText("Toggle context panel")}
            onClick={onToggleContextRail}
          >
            <AppIcon name="panel" />
          </button>
        ) : null}

        <button
          type="button"
          className="icon-btn ghost"
          title={translateText(nextThemeLabel)}
          aria-label={translateText(`Switch to ${nextThemeLabel.toLowerCase()}`)}
          onClick={async () => {
            await safeTrigger("TOGGLE_THEME");
            cycleTheme();
          }}
        >
          <AppIcon name={theme === "dark" ? "sun" : "moon"} />
        </button>

        {user ? (
          <button
            type="button"
            className="profile-btn"
            onClick={() => navigate("/app/platform/account/profile")}
            title={translateText("Open profile")}
          >
            <span className="avatar">{user?.name?.[0] || "U"}</span>
            <span className="profile-meta">
              <span className="profile-name">{user?.name || translateText("User")}</span>
              <span className="profile-role">{translateText(String(user?.role || ""))}</span>
            </span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
