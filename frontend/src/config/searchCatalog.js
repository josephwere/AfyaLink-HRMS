import { workspacesForUser, navForWorkspace, WORKSPACE_HOME_PATH } from "../app/navigation/workspaces";
import { normalizeRole } from "../utils/normalizeRole";

function dedupeByPath(items = []) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const path = String(item?.path || "");
    if (!path || seen.has(path)) return false;
    seen.add(path);
    return true;
  });
}

function extraCatalogItemsForRole(role) {
  const r = normalizeRole(role || "");
  const base = [
    { label: "Profile", path: "/app/platform/account/profile", description: "Account settings and workspace panels." },
    { label: "Notifications", path: "/app/platform/inbox/notifications", description: "Your alerts and inbox." },
    { label: "Communication Center", path: "/app/platform/inbox/communication", description: "Messages and broadcast center." },
    { label: "Hospital Communication Center", path: "/app/platform/inbox/hospital-communication", description: "Hospital-specific templates, campaigns, and broadcast delivery." },
  ];

  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(r)) {
    base.push({
      label: "System Settings",
      path: "/app/platform/settings/system",
      description: "Branding, payments, AI, and compliance configuration.",
    });
  }

  return base;
}

function navCatalogForUser(user) {
  const workspaces = workspacesForUser(user);
  const items = [];

  workspaces.forEach((ws) => {
    const groups = navForWorkspace(ws.id);
    groups.forEach((group) => {
      (group.items || []).forEach((item) => {
        items.push({
          label: item.label,
          path: item.path,
          description: `${ws.label} · ${group.group}`,
          badge: ws.label,
        });
      });
    });

    const homePath = WORKSPACE_HOME_PATH?.[ws.id];
    if (homePath) {
      items.push({
        label: `${ws.label} Home`,
        path: homePath,
        description: `${ws.label} · Home`,
        badge: ws.label,
      });
    }
  });

  return items;
}

/**
 * Command palette catalog.
 *
 * Rule: navigation comes from the workspace model (single source of truth).
 * Add only a small number of cross-cutting non-nav destinations here.
 */
export function getSearchCatalog(user) {
  if (!user) return [];
  const merged = [
    ...navCatalogForUser(user),
    ...extraCatalogItemsForRole(user?.role),
  ];
  return dedupeByPath(merged);
}

