import React from "react";
import { useNavigate } from "react-router-dom";
import { useUserCapabilitiesInfo } from "../../utils/useCapabilities";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import {
  getQuickActionsForCapabilities,
} from "../../config/moduleRegistry";
import { canonicalizePath } from "../../app/routing/canonicalizePath";
import "./QuickActions.css";

/**
 * Quick Action Button Component
 */
function QuickActionButton({ action, onActionClick }) {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();

  const handleClick = (e) => {
    e.preventDefault();

    // Execute action callback if provided
    if (action.onClick) {
      action.onClick();
      onActionClick?.(action);
      return;
    }

    // Navigate to route if provided
    if (action.route) {
      const path = canonicalizePath(action.route);
      if (path) {
        navigate(path);
        onActionClick?.(action);
      }
    }
  };

  return (
    <button
      className="quick-action-btn"
      onClick={handleClick}
      title={translateText(action.description || action.title)}
      aria-label={translateText(action.title)}
    >
      <span className="quick-action-icon">{action.icon || "⚡"}</span>
      <span className="quick-action-label">{translateText(action.title)}</span>
    </button>
  );
}

/**
 * Quick Actions Component
 * Displays capability-driven quick action buttons
 *
 * Features:
 * - Capability-filtered actions
 * - Horizontal scrollable layout
 * - Icons and labels
 * - Click handlers for navigation or custom actions
 * - Responsive grid on mobile
 *
 * Usage:
 * <QuickActions onActionClick={handleAction} />
 */
export default function QuickActions({ onActionClick, className = "" }) {
  const { info: capabilitiesInfo, loading } = useUserCapabilitiesInfo();
  const { translateText } = useAppLanguage();

  if (loading || !capabilitiesInfo) {
    return null;
  }

  const capabilities = capabilitiesInfo.capabilities || [];
  const actions = getQuickActionsForCapabilities(capabilities);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={`quick-actions ${className}`.trim()}>
      <div className="quick-actions-container">
        {actions.map((action) => (
          <QuickActionButton
            key={action.id}
            action={action}
            onActionClick={onActionClick}
          />
        ))}
      </div>
    </div>
  );
}
