import { guardedConsoleFetch } from "./guardedConsoleFetch";

/**
 * Frontend Capability Service
 * Provides access to user capabilities and metadata
 */

let cachedCapabilities = null;
let capabilitiesCache = null;
let capabilitiesRequestPromise = null;
let lastFailureAt = 0;
const FAILURE_COOLDOWN_MS = 10 * 1000; // when a recent failure happened, avoid hammering the API

/**
 * Fetch user's capabilities from backend
 */
export async function getUserCapabilities() {
  // Return fast cache when available
  if (cachedCapabilities) return cachedCapabilities;

  // If we had a recent failure, throttle retries to avoid creating many concurrent requests
  if (Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS && capabilitiesRequestPromise == null) {
    return null;
  }

  if (capabilitiesRequestPromise) {
    return capabilitiesRequestPromise;
  }

  capabilitiesRequestPromise = (async () => {
    const maxAttempts = 3;
    const baseDelay = 500;
    let lastErr = null;
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const result = await guardedConsoleFetch("/api/auth/capabilities", {
            warmupKey: "user-capabilities",
          });

          if (result?.payload?.success) {
            cachedCapabilities = result.payload;
            lastFailureAt = 0;
            return cachedCapabilities;
          }

          // If backend responded but without payload, treat as failure and retry
          lastErr = new Error("Invalid capabilities payload");
        } catch (err) {
          lastErr = err;
          // If the error looks like a rate-limit or auth-throttle, record failure timestamp and break
          const code = String(err?.code || "").toUpperCase();
          const msg = String(err?.message || "").toLowerCase();
          if (err?.status === 429 || msg.includes("too many") || code.includes("RATE") || code.includes("THROTTLE") || msg.includes("auth")) {
            lastFailureAt = Date.now();
            break;
          }
          // otherwise wait before retrying
          await new Promise((res) => setTimeout(res, baseDelay * (attempt + 1)));
        }
      }
      console.error("Failed to fetch user capabilities:", lastErr);
      return null;
    } finally {
      capabilitiesRequestPromise = null;
    }
  })();

  return capabilitiesRequestPromise;
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
  capabilitiesRequestPromise = null;
  lastFailureAt = 0;
}

/**
 * Refresh capabilities from backend (bypass cache)
 */
export async function refreshCapabilities() {
  cachedCapabilities = null;
  return getUserCapabilities();
}
