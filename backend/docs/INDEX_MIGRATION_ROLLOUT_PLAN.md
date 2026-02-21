# Index Migration + Rollout Plan (Production)

Last updated: 2026-02-21

## New/Updated Indexes in Current Batches

## Trust + workflow/data access
- `Transfer`
  - `{ fromHospital: 1, status: 1, createdAt: -1 }`
  - `{ toHospital: 1, status: 1, createdAt: -1 }`
  - `{ requestedBy: 1, createdAt: -1 }`
  - `{ approvedBy: 1, createdAt: -1 }`

- `User`
  - `{ hospital: 1, active: 1, createdAt: -1 }`
  - `{ hospital: 1, role: 1, active: 1, createdAt: -1 }`

- `Transaction`
  - `{ hospital: 1, createdAt: -1 }`
  - `{ hospital: 1, status: 1, createdAt: -1 }`
  - `{ reference: 1, hospital: 1 }`

- `AccessEntry`
  - `{ hospital: 1, checkedOutAt: 1, checkedInAt: 1, expiresAt: 1, status: 1 }`
  - `{ hospital: 1, riskScore: -1, createdAt: -1 }`

- `ComplianceLedger` (new collection)
  - unique `{ tenantKey: 1, chainIndex: -1 }`
  - `{ tenantKey: 1, createdAt: -1 }`
  - unique `entryHash`

## Safe Rollout Order
1. Deploy code with backward-compatible query paths first.
2. Build indexes in production with background/index build enabled.
3. Verify index creation completion from MongoDB (`currentOp`/index list).
4. Enable increased traffic and monitor p95/p99 for:
   - transfers list/export
   - notifications list
   - users list
   - billing list
   - security logs
5. After stable window (24-48h), remove any legacy fallback query paths if needed.

## Operational Commands (Mongo shell examples)
```javascript
db.transfers.createIndex({ fromHospital: 1, status: 1, createdAt: -1 }, { background: true });
db.transfers.createIndex({ toHospital: 1, status: 1, createdAt: -1 }, { background: true });
db.users.createIndex({ hospital: 1, active: 1, createdAt: -1 }, { background: true });
db.transactions.createIndex({ hospital: 1, status: 1, createdAt: -1 }, { background: true });
db.accessentries.createIndex({ hospital: 1, checkedOutAt: 1, checkedInAt: 1, expiresAt: 1, status: 1 }, { background: true });
```

## Pre-Production Checklist
- Ensure no duplicate key risks on unique indexes:
  - `ComplianceLedger.entryHash`
  - `ComplianceLedger { tenantKey, chainIndex }`
- Confirm all large list endpoints have either:
  - cursor pagination, or
  - strict page/limit caps.
- Confirm role overrides are logged and disabled for non-privileged users.

## Rollback Strategy
1. Keep old app version available.
2. If query regression occurs, rollback app first (indexes can remain).
3. If write regression ties to index uniqueness, disable offending write path temporarily and repair data before retry.

## Related Operational Docs
- `backend/docs/EXPORT_READ_ENDPOINT_MATRIX.md`
- `backend/docs/PRODUCTION_RUNBOOK_EXPORT_ABUSE.md`
