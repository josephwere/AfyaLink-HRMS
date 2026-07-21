import { createDashboardAggregationEngine } from './dashboardAggregationEngine.mjs';
import { createDashboardScheduler } from './dashboardScheduler.mjs';
import { createDashboardCacheManager } from './dashboardCacheManager.mjs';
import { createDashboardRequestCoordinator } from './dashboardRequestCoordinator.mjs';
import { createDashboardDependencyGraph } from './dashboardDependencyGraph.mjs';
import { createDashboardExecutionContext } from './dashboardExecutionContext.mjs';
import { createDashboardEventBus } from './dashboardEventBus.mjs';

function createDashboardRuntime(options = {}) {
  const cacheManager = createDashboardCacheManager({ defaultTtlMs: options.cacheTtlMs });
  const coordinator = createDashboardRequestCoordinator({ fetcher: options.fetcher });
  const graph = createDashboardDependencyGraph();
  const eventBus = options.events ?? createDashboardEventBus();
  const widgetControllers = new Map();
  const executionContext = createDashboardExecutionContext({
    scheduler: createDashboardScheduler({
      onTick: async (job) => {
        if (job?.onRefresh) {
          await job.onRefresh(job);
        }
      },
    }),
    coordinator,
    cache: cacheManager,
    graph,
    capabilities: options.capabilities ?? {},
    diagnostics: {},
    events: eventBus,
    abortController: options.abortController ?? null,
    planner: null,
    telemetry: options.telemetry ?? null,
  });
  const engine = createDashboardAggregationEngine({ ...options, cacheManager, requestCoordinator: coordinator });
  const scheduler = executionContext.scheduler;

  function createWidgetController(widget, runtimeOptions = {}) {
    if (widget?.dependsOn) {
      graph.registerWidget(widget);
    }
    const runtime = {
      stage: 'initialize',
      data: {},
      error: null,
      metadata: {},
    };

    function snapshot() {
      return {
        stage: runtime.stage,
        data: runtime.data,
        error: runtime.error,
        metadata: runtime.metadata,
      };
    }

    const controller = {
      initialize: () => {
        runtime.stage = 'initialize';
        return snapshot();
      },
      resolveDependencies: () => {
        runtime.stage = 'resolveDependencies';
        return snapshot();
      },
      load: async (context = {}) => {
        runtime.stage = 'load';
        const result = await engine.aggregate({ widgets: [widget], context, refreshPolicy: runtimeOptions?.refreshPolicy });
        runtime.data = result.data;
        runtime.error = result.errors?.[0]?.message ?? null;
        runtime.metadata = result.metadata;
        if (typeof runtimeOptions?.onStateChange === 'function') {
          runtimeOptions.onStateChange(snapshot());
        }
        return snapshot();
      },
      hydrate: () => {
        runtime.stage = 'hydrate';
        return snapshot();
      },
      render: () => {
        runtime.stage = 'render';
        return snapshot();
      },
      refresh: async (context = {}) => {
        runtime.stage = 'refresh';
        const result = await engine.aggregate({ widgets: [widget], context, refreshPolicy: runtimeOptions?.refreshPolicy });
        runtime.data = result.data;
        runtime.error = result.errors?.[0]?.message ?? null;
        runtime.metadata = result.metadata;
        if (typeof runtimeOptions?.onStateChange === 'function') {
          runtimeOptions.onStateChange(snapshot());
        }
        return snapshot();
      },
      dispose: () => {
        runtime.stage = 'dispose';
        return snapshot();
      },
      getState: () => snapshot(),
    };

    widgetControllers.set(widget?.id ?? widget?.dataSource ?? 'anonymous', {
      widget,
      runtimeOptions,
      controller,
    });

    return controller;
  }

  async function refreshWidgets(widgets = [], context = {}, runtimeOptions = {}) {
    return engine.aggregate({ widgets, context, refreshPolicy: runtimeOptions?.refreshPolicy });
  }

  function scheduleRefresh(job, policy) {
    return scheduler.schedule(job, policy);
  }

  function cancelRefresh(id) {
    scheduler.cancel(id);
  }

  function getDiagnostics() {
    return scheduler.getDiagnostics();
  }

  async function handleEvent(eventName, payload = {}) {
    const affectedNodes = graph.getAffectedNodes(payload?.nodeId ?? null) ?? [];
    const targets = Array.from(new Set([payload?.nodeId, ...affectedNodes].filter(Boolean)));

    eventBus.publish(eventName, payload);

    if (!targets.length) {
      return { refreshed: 0, affectedNodes: targets };
    }

    const refreshTargets = Array.from(widgetControllers.values())
      .map((entry) => entry.widget)
      .filter((widget) => targets.includes(widget?.id) || targets.includes(widget?.dataSource));

    if (!refreshTargets.length) {
      return { refreshed: 0, affectedNodes: targets };
    }

    const refreshed = await Promise.all(
      refreshTargets.map((widget) => {
        const existingEntry = widgetControllers.get(widget?.id ?? widget?.dataSource ?? 'anonymous');
        const controller = existingEntry?.controller ?? createWidgetController(widget, {
          ...existingEntry?.runtimeOptions,
          onStateChange: existingEntry?.runtimeOptions?.onStateChange,
        });
        return controller.refresh(payload?.context ?? {});
      }),
    );

    return {
      refreshed: refreshed.length,
      affectedNodes: targets,
    };
  }

  return {
    createWidgetController,
    refreshWidgets,
    scheduleRefresh,
    cancelRefresh,
    getDiagnostics,
    clearCache: () => engine.clearCache(),
    eventBus,
    handleEvent,
    planner: {
      createPlan: (rootNodes) => executionContext.planner?.createPlan(rootNodes) ?? null,
    },
    telemetry: {
      record: (eventName, payload) => executionContext.telemetry?.record?.(eventName, payload),
      getSummary: () => executionContext.telemetry?.getSummary?.() ?? null,
    },
    invalidate: (nodeId) => {
      eventBus.publish('invalidate', { nodeId });
      return graph.getAffectedNodes(nodeId);
    },
    executionContext,
    graph: {
      registerWidget: (widget) => graph.registerWidget(widget),
      getAffectedNodes: (nodeId) => graph.getAffectedNodes(nodeId),
      getNode: (nodeId) => graph.getNode(nodeId),
      toJSON: () => graph.toJSON(),
    },
    coordinator: {
      request: (config) => coordinator.request(config),
      batch: (items) => coordinator.batch(items),
      cancel: (requestId) => coordinator.cancel(requestId),
      flush: () => coordinator.flush(),
      getDiagnostics: () => coordinator.getDiagnostics(),
    },
    cache: {
      get: (key) => cacheManager.get(key),
      set: (key, value, ttlMs) => cacheManager.set(key, value, ttlMs),
      invalidate: (key) => cacheManager.invalidate(key),
      invalidateAll: () => cacheManager.invalidateAll(),
      subscribe: (key, listener) => cacheManager.subscribe(key, listener),
      prefetch: (key, loader, ttlMs) => cacheManager.prefetch(key, loader, ttlMs),
      gc: () => cacheManager.gc(),
      getDiagnostics: () => cacheManager.getDiagnostics(),
    },
  };
}

export { createDashboardRuntime };
export default createDashboardRuntime;
