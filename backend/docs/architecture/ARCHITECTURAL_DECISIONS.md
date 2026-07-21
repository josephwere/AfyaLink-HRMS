# Architectural Decisions Log

## ADR-001: Adopt verification-driven autonomous execution
- Date: 2026-07-04
- Problem: Autonomous implementation was drifting toward open-ended completion goals and occasional placeholder work.
- Alternatives considered:
  - Continue with open-ended "complete everything" execution.
  - Adopt milestone-based, verification-driven execution.
- Decision taken: Use verification-driven, milestone-based execution with explicit green-baseline checks before and after every change.
- Rationale: This reduces regression risk and keeps the backend production-safe as the platform grows.
- Consequences:
  - Future work must be verified before being considered complete.
  - New runtime work is gated by baseline health and regression tests.
- Related blueprint sections: verification-driven prompt, runtime completion criteria.

## ADR-002: Introduce shared runtime primitives
- Date: 2026-07-04
- Problem: Repeated runtime implementations were duplicating state transition and workflow logic.
- Alternatives considered:
  - Continue duplicating transition logic in each runtime.
  - Introduce shared state machine and workflow runtime primitives.
- Decision taken: Create a shared state machine engine and shared workflow runtime to standardize runtime behavior.
- Rationale: Shared primitives reduce duplication and improve consistency across domains.
- Consequences:
  - Future runtimes should reuse the shared engine rather than each creating ad hoc transition logic.
- Related blueprint sections: shared services, state machine reuse, workflow reuse.

## ADR-003: Use bounded-context governance documents for autonomous execution
- Date: 2026-07-04
- Problem: Autonomous agents need a reliable source of truth for what to build next and how to report progress.
- Alternatives considered:
  - Rely on memory, prompts, and ad hoc repository scanning.
  - Add explicit roadmap, runtime status, sprint, and architecture decision documents.
- Decision taken: Maintain a small set of governance documents that describe roadmap, runtime status, current sprint, and architectural decisions.
- Rationale: This makes repository state machine-readable and reduces architectural drift.
- Consequences:
  - Future automation can read the repository and execute one dependency-ready task at a time.
- Related blueprint sections: implementation status, roadmap, runtime status.
