# Frontend Architecture v1.0 - Frozen

## Overview
AfyaLink HRMS frontend is built on a **domain-driven architecture** where each clinical domain (Encounter, Pharmacy, Laboratory, etc.) is a self-contained module with queries, commands, cache rules, events, and permissions. Pages consume domains exclusively through hooks. The shared runtime provides base abstractions that should not change during domain migrations.

## Core Layer (Frozen v1.0 APIs)

These APIs are stable and will not change during Laboratory, Radiology, Workflow, and Billing migrations:

### Shared Runtime
- `createDomainRuntime(manifest)` – Wraps domain metadata into a runtime object
- `createDomainService(config)` – Creates a service with caching and invalidation
- `useDomain(domainName, ...args)` – Generic hook factory for any registered domain
- `useResource(fetcher, initialData, cacheKey, watchKeys)` – Core async data lifecycle
- `useMutation(mutator, onSuccess)` – Command execution with automatic cache invalidation
- `domainRegistry` – Runtime domain registration (see Registry API section)
- `resourceCache` – Global cache with metadata (timestamp, version, expires, subscribers)

### Registry API
- `registerDomain(manifest)` – Register a domain at runtime
- `getDomain(name)` – Get a registered domain by name
- `getAllDomains()` – List all registered domains
- `getHealth()` – Get health status of all domains
- `getVersions()` – Get version map of all domains
- `getPermissions()` – Get all permission definitions
- `getEvents()` – Get all event definitions

### Hook Contract
Every domain hook follows this signature:
```javascript
export function useDomain(...args) {
  return {
    data: any,
    loading: boolean,
    error: Error | null,
    refresh: () => Promise<void>,
    // Per-command: ${commandName}Loading, ${commandName}Error, ${commandName}()
  };
}
```

### Permission Pattern
Every domain exposes permissions:
```javascript
export const permissions = {
  canList: (user, resource) => boolean,
  canCreate: (user, resource) => boolean,
  canUpdate: (user, resource) => boolean,
  canDelete: (user, resource) => boolean,
  // Domain-specific permissions
};
```

### Event Pattern
Every domain publishes events:
```javascript
export const events = {
  ENTITY_CREATED: "domain:entity:created",
  ENTITY_UPDATED: "domain:entity:updated",
  ENTITY_DELETED: "domain:entity:deleted",
};
```

### Cache Invalidation Pattern
Every domain provides cache rules:
```javascript
export const cache = {
  patterns: {
    list: "domain:list.*",
    item: "domain:item:*",
  },
  invalidateOn: {
    create: ["domain:list.*"],
    update: ["domain:list.*", "domain:item:*"],
    delete: ["domain:list.*", "domain:item:*"],
  },
};
```

## Domain Structure (Required)

Every domain follows this structure:

```
services/domain-name/
├── manifest.js          # Single source of truth
├── queries.js           # Read operations
├── commands.js          # Write operations
├── cache.js             # Cache invalidation rules
├── events.js            # Event definitions
├── permissions.js       # Role-based access control
├── runtime.js           # Metadata (version, owner, health)
├── service.js           # Entrypoint (calls createDomainRuntime)
├── register.js          # Auto-registration (imported by services/domains/index.js)
├── index.js             # Re-exports for backward compatibility
└── domain-name.test.js  # Domain contract tests
```

### manifest.js (Single Source of Truth)
```javascript
export default {
  name: "pharmacy",
  version: "1.0.0",
  owner: "Clinical Operations",
  description: "Inventory management and dispensing",
  healthCheck: async (service) => {
    // Return { status: "healthy"|"degraded"|"unhealthy", checks: {} }
  },
  queries,
  commands,
  cache,
  events,
  permissions,
  runtime,
};
```

### service.js
```javascript
import manifest from "./manifest.js";
import { createDomainRuntime } from "../shared/createDomainRuntime.js";

export const pharmacyService = createDomainRuntime(manifest);
export default pharmacyService;
```

## Page Contract

Pages must:
1. **Import only** from domain hooks, shared UI components, constants/types
2. **Use only** the domain hook for data/commands (never direct API)
3. **Not import** other pages, page components, or service files directly
4. **Delegate** all business logic to domain hooks

Example:
```javascript
import { usePharmacy } from "../services/domains/index.js";

export default function PharmacyPage() {
  const pharmacy = usePharmacy({ q: "", page: 1, limit: 25 });
  
  // No direct API calls, no service imports
  return (
    <div>
      {pharmacy.data.items.map(item => (
        <Item key={item._id} item={item} />
      ))}
    </div>
  );
}
```

## Hook Contract

Hooks must:
1. **Import only** domain services, shared hooks, utilities
2. **Not import** React page components
3. **Return** { data, loading, error, refresh, ...commands }
4. **Use** `useResource()` for queries, `useMutation()` for commands

Example:
```javascript
import { useCallback, useMemo } from "react";
import { useResource } from "./shared/useResource.js";
import { useMutation } from "./shared/useMutation.js";
import pharmacyService from "../services/pharmacy/service.js";

export function usePharmacy({ q = "", page = 1, limit = 25 } = {}) {
  const fetcher = useCallback(
    async () => pharmacyService.listItems({ q, page, limit }),
    [q, page, limit]
  );

  const { data, loading, error, refresh } = useResource({
    fetcher,
    initialData: { items: [], total: 0 },
    cacheKey: ["pharmacy", q, page, limit].join(":"),
    watchKeys: [q, page, limit],
  });

  const { execute: dispenseStock, loading: dispensing, error: dispenseError } = 
    useMutation(
      async (params) => pharmacyService.dispenseStock(params),
      async () => refresh()
    );

  return { data, loading, error, refresh, dispenseStock, dispensing, dispenseError };
}
```

## Testing Contract

Every domain must pass:
1. **Hook tests** – Query/command execution and state updates
2. **Contract tests** – Structure, metadata, permissions, events
3. **Integration tests** – Multi-domain interactions
4. **Checker** – Architectural rules (no direct API in pages, etc.)

## Registry Queries

The registry enables operational visibility:

```javascript
import { domainRegistry } from "../services/shared/domainRegistry.js";

// List all domains
const domains = domainRegistry.list();
// [{name: "encounter", version: "1.0.0", owner: "Clinical", ...}, ...]

// Get single domain
const pharmacy = domainRegistry.get("pharmacy");

// Health status
const health = domainRegistry.getHealth();
// { "encounter": "healthy", "pharmacy": "healthy", "laboratory": "degraded" }

// Versions
const versions = domainRegistry.getVersions();
// { "encounter": "1.0.0", "pharmacy": "1.0.0", "laboratory": "0.9.0" }

// All permissions
const perms = domainRegistry.getPermissions();
// { "encounter": {...}, "pharmacy": {...}, ... }

// All events
const events = domainRegistry.getEvents();
// { "encounter": {...}, "pharmacy": {...}, ... }
```

## Constraint: No API Changes During Migration

The shared layer (v1.0) will not change:
- **Do not** add parameters to `createDomainRuntime()`
- **Do not** change `useResource()` or `useMutation()` signatures
- **Do not** add methods to `domainRegistry`
- **Do not** modify `resourceCache` API

If shortcomings are discovered during Laboratory, Radiology, or Workflow migrations:
1. Document the limitation
2. Fix it **once** in the shared layer
3. Apply the fix to all existing domains
4. Continue migration

## Next Domains (In Order)

1. **Laboratory** – Similar workflow to Encounter; validates sample submission, results, approvals
2. **Radiology** – Similar workflow to Laboratory; reinforces abstraction
3. **Workflow** – Cross-domain orchestration; validates multi-domain interactions
4. **Billing** – More complex command flows; tests stateful operations
5. **Platform** – Consumes registry to provide operational visibility

Each domain uses the same structure and hooks with **zero framework changes**.

## Success Criteria

The architecture is successful when:
1. Laboratory, Radiology, and Workflow are fully migrated using existing runtime/hooks
2. No framework APIs were changed
3. Checklist-based migration is repeatable for remaining 15+ domains
4. Pages pass architectural checker (no direct API usage)
5. Contract tests validate every domain automatically
