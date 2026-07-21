import React, { useMemo, useState, useEffect } from "react";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { getDataSourceConfig } from "./dashboardDataRegistry";
import { createDashboardRuntime } from "./dashboardRuntime.mjs";

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

  const content = useMemo(() => {
    if (!children) return null;
    return children;
  }, [children]);

  const dataSource = useMemo(() => getDataSourceConfig(widget?.dataSource), [widget?.dataSource]);
  const widgetData = useMemo(() => {
    if (!widget?.dataSource) return data;
    return data?.[widget.dataSource] ?? data ?? {};
  }, [data, widget?.dataSource]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const controller = dashboardRuntime.createWidgetController(widget, {
        refreshPolicy: widget?.refreshPolicy,
      });
      controller.initialize();
      controller.resolveDependencies();
      const resolved = await controller.load(data);

      if (active) {
        const resolvedData = widget?.dataSource ? resolved.data?.[widget.dataSource] ?? {} : resolved.data ?? {};
        setWidgetState({
          data: resolvedData,
          loading: false,
          error: resolved.error,
          metadata: resolved.metadata,
        });
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [widget, data]);

  if (hasError) {
    return <WidgetErrorState message={translateText("There was a problem loading this widget.")} />;
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
            ? React.cloneElement(content, {
                data: widgetState.data ?? widgetData,
                dataSource,
                loading: widgetState.loading,
                error: widgetState.error,
                metadata: widgetState.metadata,
              })
            : content}
        </div>
      </div>
    );
  } catch (error) {
    setHasError(true);
    return <WidgetErrorState message={error?.message ?? "Unknown error"} />;
  }
}
