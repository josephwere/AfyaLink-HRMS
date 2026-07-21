# AfyaLink-HRMS

## Purpose
- Hospital management and HRMS platform with a Node.js backend and a React/Vite frontend.

## Repository layout
- backend/: Express server, routes, controllers, models, jobs, workers, AI services, and tests.
- frontend/: Vite React SPA and route smoke checks.

## Key commands
- Backend
  - cd backend && pnpm install --frozen-lockfile
  - cd backend && pnpm run dev
  - cd backend && pnpm start
  - cd backend && pnpm test
  - cd backend && pnpm run test:gateway:ci
- Frontend
  - cd frontend && npm install
  - cd frontend && npm run dev
  - cd frontend && npm run build
  - cd frontend && npm run ci:smoke-routes

## Important conventions
- Backend uses ESM and the pnpm lockfile in backend/pnpm-lock.yaml.
- GitHub workflows should use the existing backend pnpm lockfile for caching and install steps.
- AI-related code is concentrated in backend/ai/, backend/services/aiAdapter.js, and backend/controllers/aiGatewayController.js.
- Platform architecture follows the encounter-runtime policy in docs/architecture/encounter-runtime-policy.md.
- Clinical workflows must be modeled as encounters; domain services must remain operational and event-driven; AI must subscribe to runtime events; media must be treated as an adapter layer.
