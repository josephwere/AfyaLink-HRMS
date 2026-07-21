# Release Gates

## Purpose

This document defines the objective criteria that must be satisfied before a runtime or feature may be promoted from Development to Verified to Production Ready.

## Promotion Levels

### Development
A runtime may be considered Development-ready when:
- implementation exists
- repository and runtime are present
- routes and controller entry points exist
- basic validation and error handling exist
- targeted unit tests exist

### Verified
A runtime may be promoted to Verified only when:
- unit tests pass
- integration tests pass
- API compatibility checks pass
- blueprint compliance checks pass
- runtime architecture tests pass
- repository consistency checks pass
- documentation is present
- audit and timeline hooks are present

### Production Ready
A runtime may be promoted to Production Ready only when:
- all Verified criteria are satisfied
- security review is complete
- performance review is complete
- rollback and recovery behaviour are validated
- API contracts are stable
- regression coverage is complete
- deployment readiness is verified

## Required Evidence

Each promotion should be backed by:
- test output
- startup verification output
- blueprint compliance evidence
- API compatibility evidence
- security review summary
- documentation references
