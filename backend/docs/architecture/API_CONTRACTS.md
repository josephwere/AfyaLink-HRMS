# API Contracts

## Purpose

This document records the public API contracts that implementations must preserve over time.

## Contract Principles

- Public endpoints must remain backward compatible unless explicitly versioned.
- Runtime APIs must preserve request and response shape where possible.
- New fields should be additive rather than breaking.
- Contract changes should be recorded in the architectural decisions log.

## Current Contract Areas

- Authentication and identity endpoints
- Scheduling and appointment endpoints
- Encounter and clinical workflows
- Laboratory and radiology endpoints
- Prescription and orders endpoints
- Billing and claims endpoints

## Governance

Any change to a public contract should:
1. update this document
2. update or add contract tests
3. verify compatibility with dependent runtimes
4. document the change in the architectural decisions log
