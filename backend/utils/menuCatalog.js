import { MENU } from "../config/menuConfig.js";

export function getMenuPermissionCatalog() {
  const byPath = new Map();

  for (const section of MENU || []) {
    for (const item of section.items || []) {
      if (!item?.path) continue;
      if (!byPath.has(item.path)) {
        byPath.set(item.path, {
          permissionKey: item.path,
          label: item.label || item.path,
          icon: item.icon || "settings",
          section: section.section || "General",
          roles: Array.isArray(item.roles) && item.roles.length > 0
            ? item.roles
            : section.roles || [],
        });
      }
    }
  }

  return Array.from(byPath.values()).sort((a, b) =>
    a.section === b.section
      ? a.label.localeCompare(b.label)
      : a.section.localeCompare(b.section)
  );
}

export function getPermissionByPath(path) {
  const catalog = getMenuPermissionCatalog();
  return catalog.find((row) => row.permissionKey === path) || null;
}

