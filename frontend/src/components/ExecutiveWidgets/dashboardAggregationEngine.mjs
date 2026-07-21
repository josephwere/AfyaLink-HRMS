import { DASHBOARD_DATA_REGISTRY } from './dashboardDataRegistry.js';
import { createDashboardCacheManager } from './dashboardCacheManager.mjs';
import { createDashboardRequestCoordinator } from './dashboardRequestCoordinator.mjs';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_REFRESH_POLICY = 'MANUAL';

function normalizePolicy(policy) {
  return String(policy ?? DEFAULT_REFRESH_POLICY).toUpperCase();
}

function getSourceTtlMs(sourceConfig, cacheTtlMs) {
  if (sourceConfig?.cache != null) {
    return Number(sourceConfig.cache) * 60 * 1000;
  }

  return cacheTtlMs;
}

function createDashboardAggregationEngine(options = {}) {
  const {
    fetcher = async () => ({}),
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    defaultRefreshPolicy = DEFAULT_REFRESH_POLICY,
    cacheManager = createDashboardCacheManager({ defaultTtlMs: cacheTtlMs }),
    requestCoordinator = createDashboardRequestCoordinator({ fetcher }),
  } = options;

  async function aggregate({ widgets = [], context = {}, signal, refreshPolicy, metadata = {} } = {}) {
    const widgetList = Array.isArray(widgets) ? widgets.filter(Boolean) : [];
    const requestedSources = [];
    const dependencyGraph = {};

    widgetList.forEach((widget) => {
      const sourceId = widget?.dataSource;
      if (!sourceId) return;
      if (!requestedSources.includes(sourceId)) {
        requestedSources.push(sourceId);
      }

      dependencyGraph[sourceId] = dependencyGraph[sourceId] || {
        widgets: [],
        refreshPolicy: normalizePolicy(widget?.refreshPolicy ?? refreshPolicy ?? defaultRefreshPolicy),
      };
      dependencyGraph[sourceId].widgets.push(widget.id ?? sourceId);
    });

    const data = {};
    const errors = [];
    const sourceVersions = {};
    const startedAt = Date.now();
    let cacheHitCount = 0;
    let cacheMissCount = 0;
    let staleCount = 0;

    for (const sourceId of requestedSources) {
      const sourceConfig = DASHBOARD_DATA_REGISTRY[sourceId] ?? null;
      const sourcePolicy = normalizePolicy(
        sourceConfig?.refreshPolicy ?? widgetList.find((widget) => widget?.dataSource === sourceId)?.refreshPolicy ?? refreshPolicy ?? defaultRefreshPolicy,
      );
      const defaultData = sourceConfig?.defaultData ?? {};
      const now = Date.now();
      const cachedEntry = cacheManager.get(sourceId);
      const cachedEntryMeta = cacheManager.getEntry?.(sourceId) ?? null;
      const ttlMs = getSourceTtlMs(sourceConfig, cacheTtlMs);
      const isFresh = Boolean(cachedEntryMeta && now - cachedEntryMeta.updatedAt < ttlMs);
      const shouldRefresh = sourcePolicy === 'REALTIME' ? false : !isFresh;
      const cacheStatus = cachedEntry ? (isFresh ? 'hit' : 'stale') : 'miss';

      if (cacheStatus === 'hit') {
        cacheHitCount += 1;
      } else {
        cacheMissCount += 1;
      }

      if (cacheStatus === 'stale') {
        staleCount += 1;
      }

      dependencyGraph[sourceId].staleStatus = cacheStatus;
      dependencyGraph[sourceId].refreshPolicy = sourcePolicy;
      dependencyGraph[sourceId].cacheTtlMs = ttlMs;

      const nextData = sourceId
        ? { ...defaultData, ...(context?.[sourceId] ?? context ?? {}) }
        : { ...defaultData, ...(context ?? {}) };

      if (!sourceId) {
        data[sourceId] = nextData;
        continue;
      }

      if (cachedEntry && isFresh) {
        data[sourceId] = cachedEntry;
        sourceVersions[sourceId] = 'cached';
        continue;
      }

      if (signal?.aborted) {
        errors.push({ sourceId, message: 'Request aborted' });
        data[sourceId] = nextData;
        continue;
      }

      try {
        const shouldFetch = shouldRefresh || sourcePolicy === 'MANUAL' || sourcePolicy === 'STATIC';
        const fetched = shouldFetch
          ? await requestCoordinator.request({
              source: sourceId,
              priority: sourcePolicy === 'REALTIME' ? 'high' : 'normal',
              timeoutMs: 8000,
              signal,
              cachePolicy: sourcePolicy,
              payload: nextData,
              context,
              widgets: widgetList,
              sourceConfig,
              refreshPolicy: sourcePolicy,
            })
          : cachedEntry?.data ?? nextData;

        const resolvedData = fetched && typeof fetched === 'object' ? { ...defaultData, ...fetched } : nextData;
        const resolvedVersion = metadata?.sourceVersions?.[sourceId] ?? `${sourceId}:${now}`;

        cacheManager.set(sourceId, resolvedData, ttlMs);
        data[sourceId] = resolvedData;
        sourceVersions[sourceId] = resolvedVersion;
      } catch (error) {
        const message = error?.message ?? 'Aggregation failed';
        errors.push({ sourceId, message });
        data[sourceId] = nextData;
      }
    }

    const finishedAt = Date.now();

    return {
      data,
      loading: false,
      errors,
      metadata: {
        fetchDurationMs: finishedAt - startedAt,
        cacheHit: cacheHitCount > 0,
        cacheHits: cacheHitCount,
        cacheMiss: cacheMissCount > 0,
        cacheMisses: cacheMissCount,
        staleStatus: staleCount > 0 ? 'stale' : 'fresh',
        refreshTimestamp: finishedAt,
        sourceVersions,
        dependencyGraph,
        requestedSources,
        refreshPolicy: normalizePolicy(refreshPolicy ?? defaultRefreshPolicy),
      },
    };
  }

  async function resolveWidgetState(widget, dashboardData = {}, options = {}) {
    const dataSource = widget?.dataSource;
    const result = await aggregate({
      widgets: dataSource ? [widget] : [],
      context: dataSource ? { ...(dashboardData ?? {}), [dataSource]: dashboardData?.[dataSource] ?? dashboardData ?? {} } : dashboardData,
      signal: options?.signal,
      refreshPolicy: options?.refreshPolicy ?? widget?.refreshPolicy,
      metadata: options?.metadata ?? {},
    });

    const resolvedData = dataSource ? result.data[dataSource] ?? {} : result.data;

    return {
      data: resolvedData,
      loading: result.loading,
      error: result.errors?.[0]?.message ?? null,
      source: dataSource,
      metadata: result.metadata,
    };
  }

  function createWidgetRuntime(widget, options = {}) {
    let currentState = {
      stage: 'initialize',
      data: {},
      error: null,
      metadata: {},
    };

    return {
      initialize: () => {
        currentState.stage = 'initialize';
        return currentState;
      },
      resolveDependencies: () => {
        currentState.stage = 'resolveDependencies';
        return currentState;
      },
      load: async (context = {}) => {
        currentState.stage = 'load';
        const result = await aggregate({ widgets: [widget], context, signal: options?.signal, refreshPolicy: options?.refreshPolicy });
        currentState = { ...currentState, data: result.data, error: result.errors?.[0]?.message ?? null, metadata: result.metadata };
        return currentState;
      },
      hydrate: () => {
        currentState.stage = 'hydrate';
        return currentState;
      },
      render: () => {
        currentState.stage = 'render';
        return currentState;
      },
      refresh: async (context = {}) => {
        currentState.stage = 'refresh';
        const result = await aggregate({ widgets: [widget], context, signal: options?.signal, refreshPolicy: options?.refreshPolicy });
        currentState = { ...currentState, data: result.data, error: result.errors?.[0]?.message ?? null, metadata: result.metadata };
        return currentState;
      },
      dispose: () => {
        currentState.stage = 'dispose';
        return currentState;
      },
      getState: () => currentState,
    };
  }

  return {
    aggregate,
    resolveWidgetState,
    createWidgetRuntime,
    clearCache: () => cacheManager.invalidateAll?.() ?? null,
    getCacheManager: () => cacheManager,
    getCacheDiagnostics: () => cacheManager.getDiagnostics?.(),
    getRequestCoordinator: () => requestCoordinator,
  };
}

export { createDashboardAggregationEngine };
export default createDashboardAggregationEngine;
