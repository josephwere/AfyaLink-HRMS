import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { WORKSPACE_HOME_PATH, workspacesForUser } from "../app/navigation/workspaces";
import AppIcon from "./AppIcon";

function isActivePath(pathname, targetPath) {
  const current = String(pathname || "").replace(/\/+$/, "") || "/";
  const target = String(targetPath || "").replace(/\/+$/, "") || "/";
  return current === target || current.startsWith(`${target}/`);
}

export default function MobileTabBar({ user, onOpenMore }) {
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(() => {
    const workspaceTabs = workspacesForUser(user)
      .slice(0, 3)
      .map((workspace) => ({
        key: workspace.id,
        label: workspace.label,
        icon: workspace.icon,
        path: WORKSPACE_HOME_PATH[workspace.id],
      }));

    return [
      ...workspaceTabs,
      {
        key: "more",
        label: "Menu",
        icon: "more",
        onClick: onOpenMore,
      },
      {
        key: "profile",
        label: "Profile",
        icon: "account",
        path: "/app/platform/account/profile",
      },
    ];
  }, [onOpenMore, user]);

  if (!user) return null;

  return (
    <nav className="mobile-tabbar" aria-label="Primary navigation">
      {items.map((item) => {
        const active = item.path ? isActivePath(location.pathname, item.path) : false;
        return (
          <button
            key={item.key}
            type="button"
            className={`mobile-tabbar-item${active ? " active" : ""}`.trim()}
            onClick={() => {
              if (item.onClick) {
                item.onClick();
                return;
              }
              if (item.path) {
                navigate(item.path);
              }
            }}
            aria-current={active ? "page" : undefined}
          >
            <AppIcon name={item.icon} size={18} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
