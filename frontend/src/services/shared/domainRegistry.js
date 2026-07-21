const registry = new Map();

/**
 * Domain Registry
 * Manages all registered domains and provides operational visibility.
 */

export function registerDomain(input = {}) {
  const normalized = typeof input?.register === "function" ? input.register() : input;
  const { name, service, hook, routes = [], permissions = [], icon = null, workspace = null } = normalized || {};

  if (!name) {
    throw new Error("registerDomain requires a name");
  }

  registry.set(name, { name, service, hook, routes, permissions, icon, workspace });
}

export function getDomain(name) {
  return registry.get(name);
}

export function getAllDomains() {
  return Array.from(registry.values());
}

/**
 * Get health status of all domains.
 * Returns map of domain name → health status (healthy|degraded|unhealthy).
 */
export async function getHealth() {
  const health = {};
  for (const [name, domain] of registry) {
    try {
      if (domain.service.manifest?.healthCheck) {
        const result = await domain.service.manifest.healthCheck(domain.service);
        health[name] = result.status;
      } else {
        health[name] = "unknown";
      }
    } catch (err) {
      health[name] = "unhealthy";
    }
  }
  return health;
}

/**
 * Get version map of all domains.
 * Returns map of domain name → version.
 */
export function getVersions() {
  const versions = {};
  for (const [name, domain] of registry) {
    versions[name] = domain.service.manifest?.version || "unknown";
  }
  return versions;
}

/**
 * Get metadata (owner, description, status) of all domains.
 * Returns map of domain name → metadata object.
 */
export function getMetadata() {
  const metadata = {};
  for (const [name, domain] of registry) {
    const manifest = domain.service.manifest;
    metadata[name] = {
      name,
      version: manifest?.version,
      owner: manifest?.owner,
      description: manifest?.description,
      service: domain.service,
    };
  }
  return metadata;
}

/**
 * Get all permission definitions from all domains.
 * Returns map of domain name → permissions object.
 */
export function getPermissions() {
  const allPermissions = {};
  for (const [name, domain] of registry) {
    const permissions = domain.service.permissions || domain.service.manifest?.permissions;
    if (permissions) {
      allPermissions[name] = permissions;
    }
  }
  return allPermissions;
}

/**
 * Get all event definitions from all domains.
 * Returns map of domain name → event bus + event type constants.
 */
export function getEvents() {
  const allEvents = {};
  for (const [name, domain] of registry) {
    const events = domain.service.events || domain.service.manifest?.events;
    const eventTypes = domain.service.manifest?.eventTypes;
    if (events) {
      allEvents[name] = { events, eventTypes };
    }
  }
  return allEvents;
}

/**
 * Get runtime information from all domains.
 * Returns map of domain name → runtime metrics (version, owner, status, etc).
 */
export function getRuntimeInfo() {
  const runtimeInfo = {};
  for (const [name, domain] of registry) {
    const runtime = domain.service.runtime || domain.service.manifest?.runtime;
    if (runtime) {
      runtimeInfo[name] = runtime;
    }
  }
  return runtimeInfo;
}

/**
 * Get complete dependency graph.
 * Returns map of domain name → array of dependency names.
 */
export function getDependencyGraph() {
  const graph = {};
  for (const [name, domain] of registry) {
    const manifest = domain.service.manifest;
    graph[name] = manifest?.dependsOn || [];
  }
  return graph;
}

/**
 * Validate all domain dependencies.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateDependencies() {
  const errors = [];
  const graph = getDependencyGraph();
  const visited = new Set();
  const recursionStack = new Set();

  function hasCycleDFS(domain) {
    visited.add(domain);
    recursionStack.add(domain);

    const deps = graph[domain] || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (hasCycleDFS(dep)) return true;
      } else if (recursionStack.has(dep)) {
        errors.push(`Circular dependency detected: ${domain} → ${dep}`);
        return true;
      }
    }

    recursionStack.delete(domain);
    return false;
  }

  // Check for circular dependencies
  for (const domain of Object.keys(graph)) {
    if (!visited.has(domain)) {
      hasCycleDFS(domain);
    }
  }

  // Check that all dependencies are registered
  for (const [domain, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (!registry.has(dep)) {
        errors.push(`Domain "${domain}" depends on "${dep}" which is not registered`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get startup order for all domains (topologically sorted by dependencies).
 * Returns array of domain names in startup order, or null if circular dependencies exist.
 */
export function getStartupOrder() {
  const validation = validateDependencies();
  if (!validation.valid) {
    console.warn("Cannot determine startup order due to dependency errors:", validation.errors);
    return null;
  }

  const graph = getDependencyGraph();
  const inDegree = {};
  const adjList = {};

  // Initialize
  for (const domain of registry.keys()) {
    inDegree[domain] = 0;
    adjList[domain] = [];
  }

  // Build adjacency list and in-degree count
  for (const [domain, deps] of Object.entries(graph)) {
    inDegree[domain] = deps.length;
    for (const dep of deps) {
      adjList[dep].push(domain);
    }
  }

  // Kahn's algorithm
  const queue = Object.keys(inDegree).filter((d) => inDegree[d] === 0);
  const order = [];

  while (queue.length > 0) {
    const domain = queue.shift();
    order.push(domain);

    for (const dependent of adjList[domain]) {
      inDegree[dependent]--;
      if (inDegree[dependent] === 0) {
        queue.push(dependent);
      }
    }
  }

  return order;
}

/**
 * Get all capabilities across all domains.
 * Returns map of capability name → array of domains that have it.
 */
export function getCapabilities() {
  const capabilities = {};

  for (const [name, domain] of registry) {
    const manifest = domain.service.manifest;
    const domainCapabilities = manifest?.capabilities || {};

    for (const [capability, enabled] of Object.entries(domainCapabilities)) {
      if (enabled) {
        if (!capabilities[capability]) {
          capabilities[capability] = [];
        }
        capabilities[capability].push(name);
      }
    }
  }

  return capabilities;
}

/**
 * Get a summary of all domain capabilities.
 * Returns map of domain name → { capability: boolean }.
 */
export function getCapabilitySummary() {
  const summary = {};
  for (const [name, domain] of registry) {
    const manifest = domain.service.manifest;
    summary[name] = manifest?.capabilities || {};
  }
  return summary;
}

export function getNavigationItems({ userPermissions = [] } = {}) {
  return getAllDomains()
    .map((domain) => {
      const manifest = domain.service?.manifest || {};
      const permissions = Array.isArray(domain.permissions) ? domain.permissions : [];
      const manifestPermissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
      const allowedPermissions = [...permissions, ...manifestPermissions];
      const canAccess = allowedPermissions.length === 0 || allowedPermissions.some((permission) => userPermissions.includes(permission));

      return {
        id: domain.name,
        label: manifest.title || domain.name?.replace(/(^\w|[-_\s]+\w)/g, (match) => match.replace(/[-_\s]/g, "").toUpperCase()),
        route: manifest.route || "/app/operations/home/index",
        icon: domain.icon || manifest.icon || "apps",
        workspace: manifest.workspace || domain.workspace || "platform",
        category: manifest.category || "platform",
        enabled: manifest.enabled !== false,
        permissions: allowedPermissions,
        dependencies: manifest.dependsOn || [],
        canAccess,
      };
    })
    .filter((item) => item.enabled && item.canAccess);
}

export default {
  registerDomain,
  getDomain,
  getAllDomains,
  getHealth,
  getVersions,
  getMetadata,
  getPermissions,
  getEvents,
  getRuntimeInfo,
  getDependencyGraph,
  validateDependencies,
  getStartupOrder,
  getCapabilities,
  getCapabilitySummary,
  getNavigationItems,
};

