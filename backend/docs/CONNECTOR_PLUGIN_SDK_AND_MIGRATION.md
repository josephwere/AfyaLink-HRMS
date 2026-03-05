# Connector Plugin SDK + Gradual Migration Contract

This contract allows hospitals with existing systems to integrate with AfyaLink without a big-bang migration.

## New connector runtime endpoints

- `GET /api/connectors/sdk/manifest`
  - Returns SDK contract metadata (auth headers, modes, source types, endpoint map)
- `GET /api/connectors/:connectorId/runtime`
  - Returns current connector mode, dry-run status, cursor, capabilities
- `PATCH /api/connectors/:connectorId/runtime`
  - Update runtime mode (`SHADOW|MIRROR|CUTOVER|ROLLBACK|PAUSED`), dryRun, migrationProjectId
- `POST /api/connectors/:connectorId/runtime/cursor`
  - Persist source cursor/checkpoint after successful ingest
- `POST /api/connectors/:connectorId/ingest`
  - Idempotent event ingest endpoint for phased migration streams

## Idempotent ingest rules

Required key:
- `x-idempotency-key` header OR `idempotencyKey` in body

Optional:
- `x-event-id` header / `eventId` in body
- `x-afya-signature` HMAC signature for partner-side signing

Deduplication:
- Duplicate `(connectorId, idempotencyKey)` returns prior receipt (no reprocessing)

## Runtime mode behavior

- `SHADOW` => validate/map only (safe dry run)
- `MIRROR` => dual-write phase
- `CUTOVER` => AfyaLink primary
- `ROLLBACK` => revert path while retaining audit ingestion
- `PAUSED` => reject new ingest (`409`)

## Migration project transition hook

`POST /api/migrations/:id/transition`

When migration status changes, connector runtime mode is auto-synced:
- `DRY_RUN` => `SHADOW + dryRun=true`
- `PARALLEL_RUN` => `MIRROR + dryRun=false`
- `CUTOVER_READY` => `MIRROR + dryRun=false`
- `CUTOVER_DONE` => `CUTOVER + dryRun=false`
- `ROLLBACK` => `ROLLBACK + dryRun=true`
- `PAUSED` => `PAUSED + dryRun=true`

## SDK location

- `backend/sdk/connector-plugin-sdk/index.js`
- `backend/sdk/connector-plugin-sdk/README.md`

Use this SDK for hospital-side plugin/adaptor services.
