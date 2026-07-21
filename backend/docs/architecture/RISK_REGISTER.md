# Risk Register

## Purpose

This document tracks known technical debt, deferred work, limitations, and architectural risks so they are managed intentionally.

## Current Risks

| Risk ID | Area | Description | Severity | Status | Mitigation |
| --- | --- | --- | --- | --- | --- |
| R-001 | Shared platform services | Notification runtime and shared workflow orchestration are still emerging. | Medium | Open | Continue implementing shared workflow and notification primitives. |
| R-002 | Runtime consolidation | Some runtimes still live outside the bounded-context runtime structure. | Medium | Open | Migrate existing runtimes into the shared runtime directory over time. |
| R-003 | Contract discipline | API contracts are not yet fully centralized. | Medium | Open | Introduce API contract governance and OpenAPI-based checks. |
| R-004 | Governance maturity | Autonomous execution is improving but still needs stronger promotion gates. | Medium | Open | Maintain release gates, dependency graph, and test matrix as enforcement tools. |

## Deferred Work

- Full OpenAPI contract generation
- Shared notification runtime implementation
- Full identity and RBAC service hardening
- Additional performance and recovery tests for each runtime
