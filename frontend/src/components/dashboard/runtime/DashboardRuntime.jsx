import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";
import { useAuth } from "../../../utils/auth";
import dashboardWidgetRegistry, { normalizeDashboardWidget } from "../widgets/registry";
import { createDashboardEventChannel } from "./eventBus.mjs";

const DashboardRuntimeContext = createContext(null);
const REFRESH_POLICY_INTERVALS = {
  realTime: 10000,
  frequent: 30000,
  normal: 120000,
  idle: null,
};

function useDashboardRuntimeContext() {
  const context = useContext(DashboardRuntimeContext);
  return context;
}

function resolveWidgetRefreshInterval(widgetConfig) {
  if (!widgetConfig) return null;
  const explicitInterval = widgetConfig?.refreshInterval ?? widgetConfig?.props?.refreshInterval ?? null;
  if (Number.isFinite(Number(explicitInterval)) && Number(explicitInterval) > 0) {
    return Number(explicitInterval);
  }
  const policy = widgetConfig?.refreshPolicy || widgetConfig?.props?.refreshPolicy || widgetConfig?.policy || null;
  if (typeof policy === "string" && REFRESH_POLICY_INTERVALS[policy] !== undefined) {
    return REFRESH_POLICY_INTERVALS[policy];
  }
  return null;
}

export function DashboardRuntimeProvider({ children, config = {}, dashboardContext = {} }) {
  const { translateText } = useAppLanguage();
  const { user } = useAuth();
  const [widgetState, setWidgetState] = useState({});
  const [isPaused, setIsPaused] = useState(false);
  const [contextState, setContextState] = useState(() => ({
    user,
    language: translateText("en"),
    ...dashboardContext,
  }));
  const widgetRefs = useRef({});
  const timersRef = useRef({});
  const widgetMetaRef = useRef({});
  const eventChannelRef = useRef(null);

  if (!eventChannelRef.current) {
    eventChannelRef.current = createDashboardEventChannel();
  }

  useEffect(() => {
    setContextState((prev) => ({
      ...prev,
      user,
      language: translateText("en"),
      ...dashboardContext,
    }));
  }, [dashboardContext, translateText, user]);

  const cancelWidgetRefresh = useCallback((id) => {
    if (timersRef.current[id]) {
      clearInterval(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const refreshWidget = useCallback(async (id) => {
    const instance = widgetRefs.current[id];
    if (instance && typeof instance.refresh === "function") {
      await instance.refresh();
    }
  }, []);

  const scheduleWidgetRefresh = useCallback(
    (id, interval) => {
      if (!id) return;
      cancelWidgetRefresh(id);
      const nextInterval = Number(interval);
      widgetMetaRef.current[id] = {
        ...(widgetMetaRef.current[id] || {}),
        interval: nextInterval,
      };
      if (!Number.isFinite(nextInterval) || nextInterval <= 0 || isPaused) {
        return;
      }
      timersRef.current[id] = window.setInterval(() => {
        refreshWidget(id);
      }, nextInterval);
    },
    [cancelWidgetRefresh, isPaused, refreshWidget]
  );

  const runtimeValue = useMemo(() => {
    const resolveWidget = (widgetConfig) => {
      if (!widgetConfig) return null;
      const normalized = normalizeDashboardWidget(
        typeof widgetConfig === "string" ? dashboardWidgetRegistry[widgetConfig] : dashboardWidgetRegistry[widgetConfig.widget]
      );
      return { ...normalized, config: widgetConfig };
    };

    return {
      dashboardContext: {
        user,
        language: translateText("en"),
        ...contextState,
      },
      widgetState,
      setWidgetState,
      isPaused,
      setPaused: setIsPaused,
      resolveWidget,
      registerWidget: (id, instance, options = {}) => {
        widgetRefs.current[id] = instance;
        widgetMetaRef.current[id] = {
          ...(widgetMetaRef.current[id] || {}),
          ...options,
        };
        const nextInterval = resolveWidgetRefreshInterval(options);
        if (nextInterval !== null) {
          scheduleWidgetRefresh(id, nextInterval);
        }
      },
      unregisterWidget: (id) => {
        cancelWidgetRefresh(id);
        if (widgetRefs.current[id]) {
          delete widgetRefs.current[id];
        }
        if (widgetMetaRef.current[id]) {
          delete widgetMetaRef.current[id];
        }
      },
      refreshWidget,
      scheduleWidgetRefresh,
      cancelWidgetRefresh,
      setDashboardContextValue: (keyOrValues, value) => {
        setContextState((prev) => {
          if (typeof keyOrValues === "string") {
            return { ...prev, [keyOrValues]: value };
          }
          return { ...prev, ...(keyOrValues || {}) };
        });
      },
      setDashboardContext: (values) => {
        setContextState((prev) => ({ ...prev, ...(values || {}) }));
      },
      publishEvent: (eventName, detail, meta) => eventChannelRef.current?.publish(eventName, detail, meta),
      subscribeToEvent: (eventName, listener) => eventChannelRef.current?.subscribe(eventName, listener),
      subscribeToAllEvents: (listener) => eventChannelRef.current?.subscribeAll(listener),
      getWidgetDefinition: (widgetName) => dashboardWidgetRegistry[widgetName] || null,
    };
  }, [cancelWidgetRefresh, contextState, isPaused, refreshWidget, scheduleWidgetRefresh, translateText, user, widgetState]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPaused(document.visibilityState === "hidden");
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", () => setIsPaused(false));
    window.addEventListener("blur", () => setIsPaused(true));

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", () => setIsPaused(false));
      window.removeEventListener("blur", () => setIsPaused(true));
    };
  }, []);

  useEffect(() => {
    if (isPaused) {
      Object.values(timersRef.current).forEach((timer) => clearInterval(timer));
      timersRef.current = {};
      return;
    }

    Object.entries(widgetMetaRef.current).forEach(([id, meta]) => {
      const nextInterval = resolveWidgetRefreshInterval(meta);
      if (nextInterval !== null) {
        scheduleWidgetRefresh(id, nextInterval);
      }
    });
  }, [isPaused, scheduleWidgetRefresh]);

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timer) => clearInterval(timer));
      timersRef.current = {};
      widgetRefs.current = {};
      widgetMetaRef.current = {};
    };
  }, []);

  useEffect(() => {
    const entries = Array.isArray(config?.widgets) ? config.widgets : [];
    const nextState = {};
    entries.forEach((widgetConfig) => {
      const id = widgetConfig?.id || widgetConfig?.widget || "widget";
      nextState[id] = {
        loading: false,
        error: null,
        refreshedAt: null,
      };
    });
    setWidgetState((prev) => ({ ...prev, ...nextState }));
  }, [config]);

  return <DashboardRuntimeContext.Provider value={runtimeValue}>{children}</DashboardRuntimeContext.Provider>;
}

function WidgetBoundary({ widgetConfig, children, fallback }) {
  const { translateText } = useAppLanguage();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const widgetId = widgetConfig?.id || widgetConfig?.widget || "widget";
  const runtime = useDashboardRuntimeContext();

  useEffect(() => {
    runtime?.registerWidget(widgetId, {
      refresh: async () => {
        setLoading(true);
        setError(null);
        try {
          await Promise.resolve();
        } finally {
          setLoading(false);
        }
      },
    }, {
      refreshInterval: widgetConfig?.refreshInterval ?? widgetConfig?.props?.refreshInterval ?? null,
      refreshPolicy: widgetConfig?.refreshPolicy || widgetConfig?.props?.refreshPolicy || widgetConfig?.policy || null,
    });

    return () => {
      runtime?.unregisterWidget(widgetId);
    };
  }, [runtime, widgetConfig, widgetId]);

  const safeChildren = () => {
    try {
      return typeof children === "function" ? children({ setLoading, setError, runtime, translateText }) : children;
    } catch (err) {
      setError(err?.message || "Widget failed to render.");
      return null;
    }
  };

  const content = safeChildren();

  return (
    <div className="dashboard-widget-boundary">
      {loading ? <div className="muted">Loading widget…</div> : null}
      {error ? (
        <div className="dashboard-widget-error">
          <div className="muted">{translateText(error)}</div>
          <button type="button" className="btn-secondary" onClick={() => setError(null)}>
            {translateText("Retry")}
          </button>
        </div>
      ) : null}
      {!loading && !error ? content : null}
      {fallback}
    </div>
  );
}

export function DashboardWidgetHost({ widgetConfig, children }) {
  const widgetDefinition = useMemo(() => normalizeDashboardWidget(dashboardWidgetRegistry[widgetConfig?.widget]), [widgetConfig?.widget]);

  return (
    <div className={`dashboard-widget-host ${widgetDefinition?.defaultWidth ? `dashboard-widget-width-${widgetDefinition.defaultWidth}` : ""}`}>
      <WidgetBoundary widgetConfig={widgetConfig}>{children}</WidgetBoundary>
    </div>
  );
}

export function useDashboardRuntime() {
  return useDashboardRuntimeContext();
}
