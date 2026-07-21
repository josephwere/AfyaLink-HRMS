import { createDashboardCacheManager } from './dashboardCacheManager.mjs';
import { createDashboardRequestCoordinator } from './dashboardRequestCoordinator.mjs';
import { createDashboardScheduler } from './dashboardScheduler.mjs';
import { createDashboardEventBus } from './dashboardEventBus.mjs';
import { createDashboardExecutionPlanner } from './dashboardExecutionPlanner.mjs';
import { createDashboardTelemetry } from './dashboardTelemetry.mjs';

function createDashboardExecutionContext(options = {}) {
  const {
    scheduler = createDashboardScheduler(),
    coordinator = createDashboardRequestCoordinator(),
    cache = createDashboardCacheManager(),
    graph = null,
    diagnostics = {},
    capabilities = {},
    events = createDashboardEventBus(),
    abortController = null,
    planner = createDashboardExecutionPlanner({ graph }),
    telemetry = createDashboardTelemetry(),
  } = options;

  return Object.freeze({
    scheduler,
    coordinator,
    cache,
    graph,
    diagnostics,
    capabilities,
    events,
    abortController,
    planner,
    telemetry,
  });
}

export { createDashboardExecutionContext };
export default createDashboardExecutionContext;
