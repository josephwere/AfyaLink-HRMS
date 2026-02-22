# Performance and Capacity Validation Plan

## Load Profiles
- Nationwide daytime peak (8am-6pm): concurrent clinician dashboard + patient booking.
- Shift change spikes: workforce and approvals bursts.
- Monthly reporting spike: exports and analytics.

## Test Types
- Baseline load: expected peak x1.
- Stress load: expected peak x2.
- Endurance soak: 8-24h mixed traffic.
- Chaos tests: region/network/component degradation.

## Success Criteria
- p95 latency within SLO bounds.
- Error rate < 1% under baseline.
- Graceful degradation under stress.
- No data loss during failover drills.

## Metrics to Capture
- API throughput and tail latency.
- DB CPU, locks, read/write latency.
- Queue backlog and retry rates.
- Worker throughput and failure classes.
