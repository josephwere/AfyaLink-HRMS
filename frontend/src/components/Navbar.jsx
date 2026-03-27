import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../utils/auth";
import { redirectByRole } from "../utils/redirectByRole";
import { useTheme } from "../utils/theme.jsx";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { useAppLanguage } from "../utils/appLanguage.jsx";
import { triggerAction } from "../services/actionApi";

function Icon({ name }) {
  const icons = {
    menu: "☰",
    sun: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    search: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M16.5 16.5 21 21"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
    panel: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M15 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  };

  return <span className="icon">{icons[name] || null}</span>;
}

export default function Navbar({ onToggleSidebar, onToggleContextRail, contextOpen = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { cycleTheme } = useTheme();
  const { settings } = useSystemSettings();
  const { translateText } = useAppLanguage();
  const logo = settings?.branding?.logo;

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
          <Icon name="menu" />
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
            <Icon name="search" />
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
            <Icon name="panel" />
          </button>
        ) : null}

        <button
          type="button"
          className="icon-btn ghost"
          title={translateText("Theme")}
          onClick={async () => {
            await safeTrigger("TOGGLE_THEME");
            cycleTheme();
          }}
        >
          <Icon name="sun" />
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
