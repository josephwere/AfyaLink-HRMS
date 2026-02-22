# Phase 4 Execution (Global Expansion Operations)

## Scope
- Country readiness pack automation
- Rollout wave planning automation
- Global readiness verification gate

## Commands

1. Initialize country readiness pack:
```bash
npm --prefix backend run global:country:init -- "Kenya"
npm --prefix backend run global:country:init -- "Uganda"
```

2. Generate rollout wave plan:
```bash
npm --prefix backend run global:wave:plan
```

3. Verify global readiness assets and country packs:
```bash
npm --prefix backend run global:readiness:verify
```

4. Full phase gate:
```bash
npm --prefix backend run phase4:gate
```

## Artifacts
- `backend/artifacts/global-rollout/<country>/manifest.json`
- `backend/ops/global/waves/wave-plan-*.json`
