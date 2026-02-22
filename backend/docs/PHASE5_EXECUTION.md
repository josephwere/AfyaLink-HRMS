# Phase 5 Execution (Launch Command Center)

## Scope
- Wave execution automation
- Launch command center snapshots
- Final launch verification gate

## Commands

1. Ensure at least one country pack exists:
```bash
npm --prefix backend run global:country:init -- "Kenya"
```

2. Generate (or refresh) rollout waves:
```bash
npm --prefix backend run global:wave:plan
```

3. Start a wave:
```bash
npm --prefix backend run global:wave:execute -- 1
```

4. Capture launch command center snapshot:
```bash
npm --prefix backend run launch:command-center:snapshot
```

5. Final phase gate:
```bash
npm --prefix backend run phase5:gate
```

## Artifacts
- `backend/artifacts/global-rollout/executions/wave-*.json`
- `backend/artifacts/launch-command-center/snapshot-*.json`
