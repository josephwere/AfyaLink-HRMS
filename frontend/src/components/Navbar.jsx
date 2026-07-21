import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../utils/auth";
import { redirectByRole } from "../utils/redirectByRole";
import { useTheme } from "../utils/theme.jsx";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { useAppLanguage } from "../utils/appLanguage.jsx";
import { triggerAction } from "../services/actionApi";
import AppIcon from "./AppIcon";
import GlobalCallLauncher from "./GlobalCallLauncher";
import NotificationCenter from "./NotificationCenter";
import { useUserContext } from "../contexts/UserContextContext";

export default function Navbar({ onToggleSidebar, onToggleContextRail, contextOpen = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toggleMode, isMyHealthMode, canUseMyHealthContext } = useUserContext();
  const [switchingContext, setSwitchingContext] = useState(false);
  const { theme, cycleTheme } = useTheme();
  const { settings } = useSystemSettings();
  const { translateText } = useAppLanguage();
  const logo = settings?.branding?.logo || "/logo.png";
  const nextThemeLabel = theme === "dark" ? "Light mode" : "Dark mode";
  const role = String(user?.role || "").toUpperCase();
  const canUseUxAudit = ["DEVELOPER", "SYSTEM_ADMIN", "SUPER_ADMIN"].includes(role);

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
          {logo ? (
            <img
              className="brand-logo"
              src={logo}
              alt="AfyaLink"
              onError={(event) => {
                event.currentTarget.src = "/logo.png";
              }}
            />
          ) : (
            "AfyaLink"
          )}
        </button>
      </div>

      <div className="navbar-center" />

      <div className="navbar-right">
        {switchingContext ? (
          <div className="context-switch-overlay" style={{ position: "fixed", inset: 0, background: "rgba(6, 17, 31, 0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div className="card premium-card" style={{ minWidth: 320, textAlign: "center", padding: 24 }}>
              <div className="appointment-success-kicker">Context switch</div>
              <h3 style={{ margin: "8px 0" }}>{isMyHealthMode ? "Switching to Work Mode" : "Switching to My Health"}</h3>
              <p className="muted" style={{ margin: 0 }}>Preparing your {isMyHealthMode ? "operational workspace" : "personal health profile"}...</p>
            </div>
          </div>
        ) : null}
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

        {user && canUseMyHealthContext ? (
          <button
            type="button"
            className={`icon-btn ghost${isMyHealthMode ? " active" : ""}`}
            title={isMyHealthMode ? "Switch to Work Mode" : "Switch to My Health"}
            aria-label={isMyHealthMode ? "Switch to Work Mode" : "Switch to My Health"}
            onClick={() => {
              setSwitchingContext(true);
              toggleMode();
              window.setTimeout(() => {
                if (isMyHealthMode) {
                  navigate(redirectByRole(user, "WORK"));
                } else {
                  navigate(redirectByRole(user, "MY_HEALTH"));
                }
                setSwitchingContext(false);
              }, 350);
            }}
          >
            <AppIcon name={isMyHealthMode ? "doctor" : "heart"} />
          </button>
        ) : null}

        {user ? <NotificationCenter /> : null}

        {user ? <GlobalCallLauncher user={user} /> : null}

        {canUseUxAudit ? (
          <button
            type="button"
            className="icon-btn ghost ux-audit-nav-button"
            title="Toggle UX audit mode"
            aria-label="Toggle UX audit mode"
            onClick={() => window.dispatchEvent(new CustomEvent("afyalink:toggle-ux-audit"))}
          >
            UX
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
