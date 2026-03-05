# AfyaLink Connector Plugin SDK

Use this SDK when a hospital keeps its legacy HIS/EMR/LIS and migrates to AfyaLink gradually.

## Install (local package style)

Copy `backend/sdk/connector-plugin-sdk/index.js` into your integration service, or publish it internally as an npm package.

## Core flow

1. Call manifest: `GET /api/connectors/sdk/manifest`
2. Read runtime mode: `GET /api/connectors/:connectorId/runtime`
3. Push data to ingest endpoint with idempotency key
4. Acknowledge source cursor after successful processing
5. Transition connector runtime mode during migration phases

## Example

```js
import { AfyaLinkConnectorClient } from "./index.js";

const client = new AfyaLinkConnectorClient({
  baseUrl: "https://api.afyalink.example",
  connectorId: "<connector-id>",
  apiToken: process.env.AFYA_TOKEN,
  webhookSecret: process.env.AFYA_WEBHOOK_SECRET,
  retries: 3,
});

const runtime = await client.getRuntime();
console.log(runtime.runtime.mode, runtime.runtime.dryRun);

const result = await client.ingest({
  sourceType: "FHIR",
  idempotencyKey: "hospitalA-patient-evt-123456",
  eventId: "evt-123456",
  payload: {
    resourceType: "Patient",
    id: "ext-001",
    name: [{ given: ["Jane"], family: "Doe" }],
  },
});

await client.ackCursor("fhir-bundle-cursor-8891");
console.log(result);
```

## Migration mode guidance

- `SHADOW`: ingest+validate only, no authoritative writes
- `MIRROR`: dual-write while source remains primary
- `CUTOVER`: AfyaLink is primary
- `ROLLBACK`: ingest for audit only while reverting
- `PAUSED`: reject ingest until resumed

## Idempotency contract

Always send one stable event key in:
- Header: `x-idempotency-key`
- Body: `idempotencyKey`

Duplicate events return deduplicated responses instead of double-processing.
