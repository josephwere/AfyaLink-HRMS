# Domain Migration Checklist

This checklist ensures every new domain migration follows the same pattern and meets the same quality standards. Use this for Laboratory, Radiology, Workflow, Billing, and all subsequent domains.

## Phase 1: Domain Structure Setup

### Phase 1.1: Create Domain Files

- [ ] Create directory: `frontend/src/services/{domain-name}/`
- [ ] Create `manifest.js` – Single source of truth for domain metadata
- [ ] Create `queries.js` – Read-only operations
- [ ] Create `commands.js` or `mutations.js` – Write/action operations
- [ ] Create `events.js` – Event bus + event type constants
- [ ] Create `permissions.js` – Role-based access control
- [ ] Create `cache.js` – Cache invalidation rules
- [ ] Create `runtime.js` – Runtime metadata (version, owner, status)
- [ ] Create `service.js` – Domain service entrypoint
- [ ] Create `register.js` – Auto-registration logic
- [ ] Create `index.js` – Re-exports for backward compatibility
- [ ] Create `{domain-name}.test.js` – Domain tests

### Phase 1.2: Manifest Specification

In `manifest.js`, define:

```javascript
export default {
  name: "{domain-name}",                      // ✓ Must match directory
  version: "1.0.0",                           // ✓ Semantic versioning
  owner: "{team-name}",                       // ✓ Owning team
  description: "{description}",               // ✓ Purpose
  healthCheck: async (service) => {...},      // ✓ Optional but recommended
  queries,                                    // ✓ Read operations
  commands,                                   // ✓ Write operations  
  cache,                                      // ✓ Invalidation rules
  events: {...},                              // ✓ Event bus
  permissions: {...},                         // ✓ Permission definitions
  runtime: {...},                             // ✓ Metadata
};
```

### Phase 1.3: Service File

`service.js` must contain:

```javascript
import { createDomainRuntime } from "../shared/createDomainRuntime.js";
import manifest from "./manifest.js";

const {domainName}Service = createDomainRuntime(manifest);
export default {domainName}Service;
```

**No additional logic in service.js** – all logic belongs in queries, commands, cache, events, permissions.

## Phase 2: Domain Contracts

### Phase 2.1: Queries Definition

In `queries.js`, export async functions:

```javascript
export async function listItems({ q = "", page = 1, limit = 25 } = {}) { ... }
export async function getItem(id) { ... }
export async function search(query) { ... }
// Domain-specific queries
```

- [ ] All queries are async functions
- [ ] All queries accept optional parameters
- [ ] All queries return consistent shape
- [ ] Queries are read-only (no side effects)

### Phase 2.2: Commands Definition

In `commands.js` or `mutations.js`, export async functions:

```javascript
export async function createItem(payload) { ... }
export async function updateItem(id, payload) { ... }
export async function deleteItem(id) { ... }
// Domain-specific commands
```

- [ ] All commands are async functions
- [ ] All commands accept required parameters
- [ ] Commands return operation result
- [ ] Commands have clear names (verb-noun pattern)

### Phase 2.3: Events Definition

In `events.js`, export:

```javascript
const listeners = new Map();
export const {domain}Events = {
  on(event, handler) { ... },
  off(event, handler) { ... },
  emit(event, payload) { ... },
};

export const {DOMAIN}_EVENTS = {
  ENTITY_CREATED: "{domain}:entity:created",
  ENTITY_UPDATED: "{domain}:entity:updated",
  ENTITY_DELETED: "{domain}:entity:deleted",
  // Domain-specific events
};
```

- [ ] Event bus provides on(), off(), emit()
- [ ] Event type constants defined with domain prefix
- [ ] At least 3 event types defined
- [ ] Events follow `{domain}:{entity}:{action}` naming

### Phase 2.4: Permissions Definition

In `permissions.js`, export:

```javascript
export const {domain}Permissions = {
  canList: ["role1", "role2"],
  canGet: ["role1", "role2"],
  canCreate: ["role1"],
  canUpdate: ["role1"],
  canDelete: ["role1"],
  // Domain-specific permissions
};

export function checkPermission(role, action) { ... }
```

- [ ] At least 5 permission rules defined
- [ ] Each rule is an array of role strings
- [ ] checkPermission() helper function provided
- [ ] Permissions follow `can{Action}` naming

### Phase 2.5: Cache Rules Definition

In `cache.js`, export:

```javascript
import { invalidateResourceCachePattern } from "../shared/resourceCache.js";

export const {domain}Cache = {
  invalidateList() { invalidateResourceCachePattern(`^{domain}:list`); },
  invalidateItem(id) { invalidateResourceCachePattern(`^{domain}:(get|detail):`); },
  invalidateAll() { invalidateResourceCachePattern(`^{domain}:`); },
};
```

- [ ] At least 3 invalidation functions defined
- [ ] Uses resourceCache.invalidateResourceCachePattern()
- [ ] Follows naming pattern: `invalidate{Entity}`
- [ ] Cache rules align with command side effects

### Phase 2.6: Runtime Metadata

In `runtime.js`, export:

```javascript
export const {domain}Runtime = {
  version: "1.0.0",               // ✓ Matches manifest version
  owner: "{team-name}",           // ✓ Owning team
  description: "{description}",   // ✓ Purpose
  status: "stable",               // ✓ stable|beta|experimental
  metrics: {
    queries: 3,                   // ✓ Count of query functions
    commands: 5,                  // ✓ Count of command functions
    permissions: 6,               // ✓ Count of permission rules
    events: 4,                    // ✓ Count of event types
  },
  health() {
    return { status: "healthy", timestamp: Date.now() };
  },
};
```

- [ ] version matches manifest.version
- [ ] owner is team name
- [ ] status is valid (stable|beta|experimental)
- [ ] metrics counts are accurate
- [ ] health() method provided

## Phase 3: Hooks and Pages

### Phase 3.1: Domain Hook

Create `frontend/src/hooks/use{Domain}.js`:

```javascript
import { useCallback } from "react";
import { useResource } from "./shared/useResource.js";
import { useMutation } from "./shared/useMutation.js";
import {domain}Service from "../services/{domain}/service.js";

export function use{Domain}({ ...args } = {}) {
  const fetcher = useCallback(async () => {
    return {domain}Service.{primaryQuery}({ ...args });
  }, [args]);

  const { data, loading, error, refresh } = useResource({
    fetcher,
    initialData: { /* appropriate default shape */ },
    cacheKey: ["{domain}", ...args].join(":"),
    watchKeys: [...args],
  });

  // Command mutations
  const { execute: doCommand, loading: doCommandLoading } = useMutation(
    async (params) => {domain}Service.doCommand(params),
    async () => refresh()
  );

  return {
    data,
    loading,
    error,
    refresh,
    doCommand,
    doCommandLoading,
  };
}
```

- [ ] Hook file created at `frontend/src/hooks/use{Domain}.js`
- [ ] Hook imports domain service, not queries/commands directly
- [ ] Hook returns { data, loading, error, refresh, ...commands }
- [ ] All commands exposed as mutations with loading states
- [ ] Cache keys use domain name prefix
- [ ] initialData shape matches API response

### Phase 3.2: Hook Tests

In `frontend/src/hooks/use{Domain}.test.js`:

```javascript
import { renderHook, act, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { use{Domain} } from "./use{Domain}.js";

describe("use{Domain}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads data and updates state", async () => {
    // Mock {domain}Service.{query}
    vi.mock("../services/{domain}/queries", () => ({
      {query}: vi.fn().mockResolvedValue({ ... }),
    }));

    const { result } = renderHook(() => use{Domain}());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ ... });
  });

  it("handles errors gracefully", async () => {
    // Mock error case
    // Assert error state
  });

  it("allows refresh", async () => {
    // Call refresh, verify re-fetch
  });

  it("allows command execution", async () => {
    // Mock command, call execute, verify state
  });
});
```

- [ ] Hook tests created and passing
- [ ] Tests mock queries and commands
- [ ] Tests verify loading, error, success states
- [ ] Tests verify refresh works
- [ ] Tests verify command execution

### Phase 3.3: Page Migration

Update pages to use only domain hook:

```javascript
import { use{Domain} } from "../hooks/use{Domain}.js";

export default function {Domain}Page() {
  const { domain } = use{Domain}({ /* params */ });

  return (
    <div>
      {/* Use only domain.data, domain.doCommand */}
    </div>
  );
}
```

- [ ] Page imports ONLY domain hook
- [ ] Page does NOT import API client directly
- [ ] Page does NOT import service files
- [ ] Page does NOT import other domain hooks (except shared)
- [ ] All data access through domain hook
- [ ] All commands through domain hook

## Phase 4: Registration and Validation

### Phase 4.1: Domain Registration

In `{domain}/register.js`:

```javascript
import { registerDomain } from "../shared/domainRegistry.js";
import {domain}Service from "./service.js";
import { use{Domain} } from "../../hooks/use{Domain}.js";

registerDomain({
  name: "{domain}",
  service: {domain}Service,
  hook: use{Domain},
  routes: [/* optional */],
  permissions: ["admin", "relevant-roles"],
  icon: "{icon-name}",
});
```

Then in `services/domains/index.js`, add:

```javascript
import "../{domain}/register.js";
```

- [ ] register.js calls registerDomain()
- [ ] Register call includes name, service, hook
- [ ] Domain imported in services/domains/index.js
- [ ] Domain appears in domainRegistry.getAllDomains()

### Phase 4.2: Contract Validation

Run domain contract test:

```bash
cd frontend && pnpm exec vitest run src/services/domain.contract.test.js
```

- [ ] At least one test passes for the new domain
- [ ] Domain appears in registry.getAllDomains()
- [ ] Manifest has all required properties
- [ ] Queries exported and callable
- [ ] Commands exported and callable
- [ ] Permissions defined
- [ ] Events defined
- [ ] Cache rules defined

### Phase 4.3: Hook Test Validation

```bash
cd frontend && pnpm exec vitest run src/hooks/use{Domain}.test.js
```

- [ ] All hook tests pass
- [ ] Loading state works
- [ ] Error state works
- [ ] Refresh works
- [ ] Commands work
- [ ] Cache invalidation works

## Phase 5: Architectural Compliance

### Phase 5.1: Page API Usage Checker

```bash
cd frontend && pnpm run check:page-api-usage
```

- [ ] No pages directly import API client
- [ ] No pages directly import service files
- [ ] All API access through domain hooks
- [ ] No circular dependencies

### Phase 5.2: Dependency Verification

- [ ] Domain service only imports from utils, shared
- [ ] Domain service does NOT import React
- [ ] Hook imports service and shared hooks only
- [ ] Hook does NOT import page components
- [ ] Page imports hook and shared UI only
- [ ] Page does NOT import other pages

### Phase 5.3: Documentation

- [ ] Domain has ARCHITECTURE.md entry
- [ ] Domain description added to ARCHITECTURE.md
- [ ] Hook documented with JSDoc comments
- [ ] Commands documented with parameter types
- [ ] Permission rules documented

## Phase 6: Completion Verification

- [ ] All files created and reviewed
- [ ] All tests passing
- [ ] Contract validation passing
- [ ] Architectural checker passing
- [ ] Domain appears in registry.getAllDomains()
- [ ] Domain metadata complete (version, owner, description)
- [ ] At least one page migrated to use domain hook
- [ ] Migration checklist items all checked

## Troubleshooting

### Import Path Errors

If seeing "Failed to resolve import", check:
- Relative paths count correctly (../../ from deeply nested files)
- All imports use .js extensions
- File case matches exactly

### Mock Data Not Appearing in Tests

If hook tests show initialData but no mocked data:
- Verify mock is set up before hook renders
- Mock at query/command function level, not service level
- Use vi.mock() before importing hooks

### Domain Not Registering

If domain doesn't appear in registry:
- Verify register.js calls registerDomain() with all required params
- Verify register.js imported in services/domains/index.js
- Check import order (domains/index.js must import before any other code uses registry)

### Cache Not Invalidating

If cache changes aren't visible after commands:
- Verify cache.js uses invalidateResourceCachePattern()
- Verify commands call cache invalidation methods
- Check that hook's cacheKey matches cache patterns

## Success Criteria

A domain migration is successful when:

✅ All files created per checklist  
✅ All tests passing (domain tests + contract tests)  
✅ All pages using domain hook exclusively  
✅ Registry contains complete domain metadata  
✅ No direct API imports in pages  
✅ Architectural checker reports no violations  

Next domain can begin immediately using this same checklist.
