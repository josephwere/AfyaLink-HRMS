import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardAggregationEngine } from './dashboardAggregationEngine.mjs';
import { createDashboardDependencyGraph } from './dashboardDependencyGraph.mjs';
import { createDashboardExecutionContext } from './dashboardExecutionContext.mjs';
import { createDashboardEventBus } from './dashboardEventBus.mjs';
import { createDashboardExecutionPlanner } from './dashboardExecutionPlanner.mjs';
import { createDashboardTelemetry } from './dashboardTelemetry.mjs';
import { createDashboardRuntime } from './dashboardRuntime.mjs';

test('createDashboardAggregationEngine resolves widget data from a declared data source', async () => {
  const engine = createDashboardAggregationEngine({
    fetcher: async () => ({ occupiedBeds: 12, totalBeds: 20 }),
  });

  const state = await engine.resolveWidgetState(
    { id: 'bed-occupancy', dataSource: 'facilitySummary' },
    { facilitySummary: { occupiedBeds: 8, totalBeds: 16 } },
  );

  assert.equal(state.loading, false);
  assert.equal(state.data.occupiedBeds, 12);
  assert.equal(state.data.totalBeds, 20);
  assert.equal(state.error, null);
});

test('createDashboardAggregationEngine falls back to default data when no fetcher result is available', async () => {
  const engine = createDashboardAggregationEngine({});

  const state = await engine.resolveWidgetState(
    { id: 'revenue', dataSource: 'financeSummary' },
    {},
  );

  assert.equal(state.loading, false);
  assert.equal(state.data.revenueToday, '—');
});

test('aggregate deduplicates shared dependencies and reports runtime metadata', async () => {
  let fetchCalls = 0;
  const engine = createDashboardAggregationEngine({
    fetcher: async (sourceId) => {
      fetchCalls += 1;
      return { occupiedBeds: 10, totalBeds: 20 };
    },
  });

  const result = await engine.aggregate({
    widgets: [
      { id: 'bed-occupancy', dataSource: 'facilitySummary' },
      { id: 'admissions', dataSource: 'facilitySummary' },
    ],
    context: {},
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result.loading, false);
  assert.equal(result.data.facilitySummary.occupiedBeds, 10);
  assert.equal(result.metadata.requestedSources.length, 1);
  assert.equal(result.metadata.dependencyGraph.facilitySummary.widgets.length, 2);
});

test('aggregate preserves refresh policy and cache metadata', async () => {
  const engine = createDashboardAggregationEngine({
    fetcher: async () => ({ revenueToday: 125000 }),
  });

  const first = await engine.aggregate({
    widgets: [{ id: 'revenue', dataSource: 'financeSummary' }],
    refreshPolicy: 'MANUAL',
    context: {},
  });

  const second = await engine.aggregate({
    widgets: [{ id: 'revenue', dataSource: 'financeSummary' }],
    refreshPolicy: 'MANUAL',
    context: {},
  });

  assert.equal(first.metadata.refreshPolicy, 'MANUAL');
  assert.equal(first.metadata.cacheHit, false);
  assert.equal(second.metadata.cacheHit, true);
});

test('dashboard runtime tracks lifecycle phases and preserves successful data on partial failures', async () => {
  const runtime = createDashboardRuntime({
    fetcher: async (sourceId) => {
      if (sourceId === 'financeSummary') {
        throw new Error('finance failed');
      }
      return { occupiedBeds: 11, totalBeds: 24 };
    },
  });

  const controller = runtime.createWidgetController({ id: 'bed-occupancy', dataSource: 'facilitySummary' });
  const initialized = controller.initialize();
  controller.resolveDependencies();
  const loaded = await controller.load({});
  const refreshed = await runtime.refreshWidgets([{ id: 'revenue', dataSource: 'financeSummary' }], {});

  assert.equal(initialized.stage, 'initialize');
  assert.equal(loaded.stage, 'load');
  assert.equal(loaded.metadata.requestedSources[0], 'facilitySummary');
  assert.equal(refreshed.errors[0].sourceId, 'financeSummary');
  assert.equal(refreshed.data.financeSummary.revenueToday, '—');
});

test('dashboard runtime scheduler owns refresh timing and diagnostics', async () => {
  const runtime = createDashboardRuntime({});
  let ticks = 0;
  const handle = runtime.scheduleRefresh({
    id: 'facility-refresh',
    onRefresh: async () => {
      ticks += 1;
    },
  }, 'INTERVAL_30S');

  assert.equal(handle.policy, 'INTERVAL_30S');
  assert.equal(handle.intervalMs, 30000);

  const diagnostics = runtime.getDiagnostics();
  assert.equal(diagnostics.scheduledJobs, 1);

  runtime.cancelRefresh(handle.id);
  const afterCancel = runtime.getDiagnostics();
  assert.equal(afterCancel.scheduledJobs, 0);
  assert.equal(ticks, 0);
});

test('dashboard runtime cache manager supports shared cache operations', async () => {
  const runtime = createDashboardRuntime({});
  runtime.cache.set('facilitySummary', { occupiedBeds: 8 });
  const cached = runtime.cache.get('facilitySummary');

  assert.deepEqual(cached, { occupiedBeds: 8 });
  assert.equal(runtime.cache.getDiagnostics().writes, 1);

  runtime.cache.invalidate('facilitySummary');
  assert.equal(runtime.cache.get('facilitySummary'), null);
});

test('dashboard runtime coordinator deduplicates in-flight requests and reports diagnostics', async () => {
  const runtime = createDashboardRuntime({
    fetcher: async (source) => ({ source, fetched: true }),
  });

  const first = runtime.coordinator.request({ source: 'executiveSummary', priority: 'high' });
  const second = runtime.coordinator.request({ source: 'executiveSummary', priority: 'high' });
  const results = await Promise.all([first, second]);

  assert.equal(results[0].source, 'executiveSummary');
  assert.equal(results[1].source, 'executiveSummary');
  assert.equal(runtime.coordinator.getDiagnostics().completed, 1);
});

test('dashboard dependency graph identifies downstream widgets affected by a dependency change', () => {
  const graph = createDashboardDependencyGraph();
  graph.registerWidget({ id: 'executiveSummary', dataSource: 'executiveSummary', dependsOn: ['facilitySummary', 'admissions'] });
  graph.registerWidget({ id: 'occupancyKpi', dataSource: 'facilitySummary', dependsOn: ['facilitySummary'] });
  graph.registerWidget({ id: 'admissions', dataSource: 'admissions' });

  const affected = graph.getAffectedNodes('facilitySummary');
  assert.deepEqual(affected.sort(), ['executiveSummary', 'occupancyKpi']);
});

test('dashboard execution context exposes a shared runtime bundle for orchestration', () => {
  const graph = createDashboardDependencyGraph();
  const context = createDashboardExecutionContext({ graph, capabilities: { title: 'Executive Dashboard' } });

  assert.equal(context.graph, graph);
  assert.equal(context.capabilities.title, 'Executive Dashboard');
  assert.equal(typeof context.diagnostics, 'object');
  assert.equal(typeof context.coordinator.request, 'function');
});

test('dashboard event bus propagates invalidation events to dependent nodes', () => {
  const graph = createDashboardDependencyGraph();
  graph.registerWidget({ id: 'executiveSummary', dataSource: 'executiveSummary', dependsOn: ['facilitySummary'] });
  graph.registerWidget({ id: 'occupancyKpi', dataSource: 'facilitySummary', dependsOn: ['facilitySummary'] });
  const bus = createDashboardEventBus();
  const received = [];

  bus.subscribe('invalidate', (payload) => received.push(payload));
  bus.publish('invalidate', { nodeId: 'facilitySummary' });

  const affected = graph.getAffectedNodes('facilitySummary');
  assert.deepEqual(affected.sort(), ['executiveSummary', 'occupancyKpi']);
  assert.equal(received.length, 1);
  assert.equal(received[0].nodeId, 'facilitySummary');
});

test('dashboard execution planner produces a dependency-aware execution plan', () => {
  const graph = createDashboardDependencyGraph();
  graph.registerWidget({ id: 'executiveSummary', dataSource: 'executiveSummary', dependsOn: ['facilitySummary', 'admissions'] });
  graph.registerWidget({ id: 'occupancyKpi', dataSource: 'facilitySummary', dependsOn: ['facilitySummary'] });
  graph.registerWidget({ id: 'admissions', dataSource: 'admissions' });

  const planner = createDashboardExecutionPlanner({ graph });
  const plan = planner.createPlan(['executiveSummary']);

  assert.deepEqual(plan.sequential, ['admissions', 'facilitySummary', 'executiveSummary']);
  assert.equal(plan.parallel.length, 0);
});

test('dashboard runtime propagates operational events to affected widgets', async () => {
  const runtime = createDashboardRuntime({
    fetcher: async () => ({ occupiedBeds: 14, totalBeds: 24 }),
  });
  const snapshots = [];
  const controller = runtime.createWidgetController(
    { id: 'occupancy-widget', dataSource: 'facilitySummary', dependsOn: ['facilitySummary'] },
    { onStateChange: (snapshot) => snapshots.push(snapshot) },
  );

  await controller.load({});
  const result = await runtime.handleEvent('admission.created', {
    nodeId: 'facilitySummary',
    context: { facilitySummary: { occupiedBeds: 15, totalBeds: 24 } },
  });

  assert.equal(result.refreshed, 1);
  assert.deepEqual(result.affectedNodes.sort(), ['facilitySummary', 'occupancy-widget']);
  assert.equal(snapshots.length, 2);
});

test('dashboard telemetry records execution activity and exposes summaries', () => {
  const telemetry = createDashboardTelemetry();
  telemetry.record('plan', { nodeId: 'facilitySummary', durationMs: 12 });
  telemetry.record('cache-hit', { nodeId: 'facilitySummary' });
  telemetry.record('cache-miss', { nodeId: 'facilitySummary' });

  const summary = telemetry.getSummary();
  assert.equal(summary.events.plan, 1);
  assert.equal(summary.events['cache-hit'], 1);
  assert.equal(summary.events['cache-miss'], 1);
  assert.equal(summary.latencyMs.plan, 12);
});

test('dashboard runtime shares in-flight source fetches across concurrent aggregate requests', async () => {
  let fetchCalls = 0;
  const runtime = createDashboardRuntime({
    fetcher: async (source) => {
      fetchCalls += 1;
      return { source, fetched: true };
    },
  });

  const [first, second] = await Promise.all([
    runtime.refreshWidgets([{ id: 'widget-a', dataSource: 'facilitySummary' }], {}),
    runtime.refreshWidgets([{ id: 'widget-b', dataSource: 'facilitySummary' }], {}),
  ]);

  assert.equal(fetchCalls, 1);
  assert.equal(first.data.facilitySummary.source, 'facilitySummary');
  assert.equal(second.data.facilitySummary.source, 'facilitySummary');
});
