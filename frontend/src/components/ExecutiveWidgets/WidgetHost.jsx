import React, { useMemo, useState, useEffect } from "react";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { getDataSourceConfig } from "./dashboardDataRegistry";
import { createDashboardRuntime } from "./dashboardRuntime.mjs";

function buildFallbackState(error, translateText) {
  const message = typeof error === "string" && error.trim()
    ? error
    : translateText("There was a problem loading this widget.");
  return {
    title: translateText("Widget unavailable"),
    subtitle: translateText("This widget could not be rendered."),
    message,
  };
}

function WidgetErrorState({ message }) {
  const { translateText } = useAppLanguage();

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Widget unavailable")}</div>
          <div className="executive-widget-subtitle">{translateText("This widget could not be rendered.")}</div>
        </div>
      </div>
      <div className="executive-widget-meta">{message}</div>
    </div>
  );
}

const dashboardRuntime = createDashboardRuntime();

export default function WidgetHost({ widget, data = {}, children }) {
  const { translateText } = useAppLanguage();
  const [hasError, setHasError] = useState(false);
  const [widgetState, setWidgetState] = useState({ data: {}, loading: true, error: null });
  const fallbackState = useMemo(() => buildFallbackState(widgetState.error, translateText), [translateText, widgetState.error]);

  const content = useMemo(() => {
    if (!children) return null;
    return children;
  }, [children]);

  const dataSource = useMemo(() => getDataSourceConfig(widget?.dataSource), [widget?.dataSource]);
  const widgetData = useMemo(() => {
    if (!widget?.dataSource) return data;
    return data?.[widget.dataSource] ?? data ?? {};
  }, [data, widget?.dataSource]);
  const childProps = useMemo(() => ({
    data: widgetState.data ?? widgetData,
    dataSource,
    loading: widgetState.loading,
    error: widgetState.error,
    metadata: widgetState.metadata,
  }), [dataSource, widgetData, widgetState.data, widgetState.error, widgetState.loading, widgetState.metadata]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const controller = dashboardRuntime.createWidgetController(widget, {
          refreshPolicy: widget?.refreshPolicy,
        });
        controller.initialize();
        controller.resolveDependencies();
        const resolved = await controller.load(data);

        if (!active) return;

        const resolvedData = widget?.dataSource ? resolved.data?.[widget.dataSource] ?? {} : resolved.data ?? {};
        setWidgetState({
          data: resolvedData,
          loading: false,
          error: resolved.error || null,
          metadata: resolved.metadata,
        });
      } catch (error) {
        if (!active) return;
        setWidgetState({
          data: {},
          loading: false,
          error: error?.message || "There was a problem loading this widget.",
          metadata: {},
        });
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [widget, data]);

  if (hasError || widgetState.error) {
    return <WidgetErrorState message={fallbackState.message} />;
  }

  try {
    return (
      <div className="card premium-card executive-widget-card">
        <div className="executive-widget-head">
          <div>
            <div className="executive-widget-title">{translateText(widget?.title ?? "Widget")}</div>
            <div className="executive-widget-subtitle">{translateText(widget?.subtitle ?? "Operational view")}</div>
          </div>
          {widget?.refreshInterval ? (
            <span className="executive-widget-badge good">{Math.round(widget.refreshInterval / 1000)}s</span>
          ) : null}
        </div>
        <div className="executive-widget-body">
          {React.isValidElement(content)
            ? (typeof content.type === 'string'
              ? content
              : React.cloneElement(content, childProps))
            : content}
        </div>
      </div>
    );
  } catch (error) {
    setHasError(true);
    return <WidgetErrorState message={error?.message ?? "Unknown error"} />;
  }
}
