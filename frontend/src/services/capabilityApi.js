import { guardedConsoleFetch } from "./guardedConsoleFetch";

/**
 * Frontend Capability Service
 * Provides access to user capabilities and metadata
 */

let cachedCapabilities = null;
let capabilitiesCache = null;

/**
 * Fetch user's capabilities from backend
 */
export async function getUserCapabilities() {
  try {
    if (cachedCapabilities) {
      return cachedCapabilities;
    }

    const result = await guardedConsoleFetch("/api/auth/capabilities", {
      warmupKey: "user-capabilities",
    });

    if (result?.payload?.success) {
      cachedCapabilities = result.payload;
      return cachedCapabilities;
    }

    return null;
  } catch (err) {
    console.error("Failed to fetch user capabilities:", err);
    return null;
  }
}

/**
 * Check if user has a specific capability
 */
export async function hasCapability(capabilityId) {
  const caps = await getUserCapabilities();
  return caps?.capabilities?.includes(capabilityId) || false;
}

/**
 * Check if user has any of the given capabilities
 */
export async function hasAnyCapability(capabilityIds) {
  if (!Array.isArray(capabilityIds) || capabilityIds.length === 0) {
    return false;
  }
  const caps = await getUserCapabilities();
  return capabilityIds.some((id) => caps?.capabilities?.includes(id));
}

/**
 * Check if user has all of the given capabilities
 */
export async function hasAllCapabilities(capabilityIds) {
  if (!Array.isArray(capabilityIds) || capabilityIds.length === 0) {
    return true;
  }
  const caps = await getUserCapabilities();
  return capabilityIds.every((id) => caps?.capabilities?.includes(id));
}

/**
 * Get capability metadata by ID
 */
export async function getCapabilityMetadata(capabilityId) {
  const caps = await getUserCapabilities();
  if (!caps?.capabilitiesWithMetadata) {
    return null;
  }
  return caps.capabilitiesWithMetadata.find((cap) => cap.id === capabilityId) || null;
}

/**
 * Get all capabilities for current user
 */
export async function getAllCapabilities() {
  const caps = await getUserCapabilities();
  return caps?.capabilitiesWithMetadata || [];
}

/**
 * Get capabilities grouped by category
 */
export async function getCapabilitiesByCategory() {
  const caps = await getUserCapabilities();
  return caps?.capabilitiesByCategory || {};
}

/**
 * Get capabilities grouped by module
 */
export async function getCapabilitiesByModule() {
  const caps = await getUserCapabilities();
  return caps?.capabilitiesByModule || {};
}

/**
 * Get navigation items based on capabilities
 * This can be used to build dynamic sidebars and menus
 */
export async function getNavigationItems() {
  const caps = await getUserCapabilities();
  if (!caps?.capabilitiesWithMetadata) {
    return [];
  }

  return caps.capabilitiesWithMetadata
    .filter((cap) => cap.route) // Only items with routes
    .map((cap) => ({
      id: cap.id,
      title: cap.title,
      description: cap.description,
      icon: cap.icon,
      route: cap.route,
      category: cap.category,
      module: cap.module,
      badge: cap.badge,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Get quick actions based on capabilities
 */
export async function getQuickActions() {
  const caps = await getUserCapabilities();
  if (!caps?.capabilitiesWithMetadata) {
    return [];
  }

  return caps.capabilitiesWithMetadata
    .filter((cap) => cap.quickAction) // Only items with quick actions
    .map((cap) => ({
      id: cap.id,
      action: cap.quickAction,
      description: cap.description,
      icon: cap.icon,
      route: cap.route,
      module: cap.module,
    }));
}

/**
 * Clear cached capabilities (call this on logout)
 */
export function clearCapabilitiesCache() {
  cachedCapabilities = null;
  capabilitiesCache = null;
}

/**
 * Refresh capabilities from backend (bypass cache)
 */
export async function refreshCapabilities() {
  cachedCapabilities = null;
  return getUserCapabilities();
}
