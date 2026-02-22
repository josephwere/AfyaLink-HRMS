# Multi-Region Production Architecture

## Target
- Support high availability, failover, and horizontal scale for nationwide and global operations.

## Baseline Topology
- Region A (primary): API nodes, workers, Mongo primary, Redis primary.
- Region B (secondary): API nodes, workers, Mongo secondary/replica, Redis replica.
- Global edge: DNS with health checks + weighted routing.

## Compute
- Stateless backend API instances behind HAProxy.
- Separate worker deployment for cron, queues, and automation sweeps.
- Sticky sessions avoided; token auth used for horizontal scaling.

## Data
- Mongo replica set across zones; point-in-time backups.
- Recovery targets:
  - RPO <= 5 minutes
  - RTO <= 30 minutes
- Read replicas for reporting/analytics workloads.

## Queue and Messaging
- Durable queue backend with retry + dead-letter strategy.
- Idempotency keys for critical writes and AI jobs.

## Failover Strategy
1. Detect region degradation (health + synthetic checks).
2. Shift traffic to healthy region.
3. Promote secondary data plane if needed.
4. Replay queued jobs and validate consistency.

## Required Controls
- Infrastructure as code for all environments.
- Immutable deployments and rollback artifacts.
- Monthly failover drill and quarterly disaster recovery drill.
