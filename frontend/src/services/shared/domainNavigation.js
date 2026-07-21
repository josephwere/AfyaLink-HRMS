import { getAllDomains } from "./domainRegistry";

function toNavigationItem(domain, userPermissions = []) {
  const manifest = domain.service?.manifest || {};
  const permissions = Array.isArray(domain.permissions) ? domain.permissions : [];
  const manifestPermissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  const allowedPermissions = [...permissions, ...manifestPermissions];
  const canAccess = allowedPermissions.length === 0 || allowedPermissions.some((permission) => userPermissions.includes(permission));

  return {
    id: domain.name,
    label: manifest.title || manifest.name?.replace(/(^\w|[-_\s]+\w)/g, (match) => match.replace(/[-_\s]/g, "").toUpperCase()),
    route: manifest.route || "/app/operations/home/index",
    icon: domain.icon || manifest.icon || "apps",
    workspace: manifest.workspace || domain.workspace || "platform",
    category: manifest.category || "platform",
    enabled: manifest.enabled !== false,
    permissions: allowedPermissions,
    dependencies: manifest.dependsOn || [],
    canAccess,
  };
}

export function getNavigationItems({ userPermissions = [] } = {}) {
  return getAllDomains()
    .map((domain) => toNavigationItem(domain, userPermissions))
    .filter((item) => item.enabled && item.canAccess);
}

export default getNavigationItems;
