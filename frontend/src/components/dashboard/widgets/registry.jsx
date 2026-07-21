import React from "react";

function DashboardListWidget({ items = [], listClassName = "", translateText }) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  return (
    <ul className={`dashboard-section-list ${listClassName || ""}`.trim()}>
      {items.map((item, index) => {
        const key = item?.key || item?.label || `list-item-${index}`;
        const label = typeof item === "string" ? translateText(item) : item?.label;
        return <li key={key}>{label ?? item}</li>;
      })}
    </ul>
  );
}

function DashboardTableWidget({
  columns = [],
  rows = [],
  emptyMessage = "No items yet.",
  tableClassName = "doctor-table",
  translateText,
}) {
  if (!columns.length && !rows.length) {
    return emptyMessage ? <div className="muted">{translateText(emptyMessage)}</div> : null;
  }

  return (
    <div className="table-wrap" style={{ marginTop: 12 }}>
      <table className={tableClassName}>
        {columns.length ? (
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key || column.label}>{translateText(column.label || column.key || "")}</th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.length ? (
            rows.map((row, index) => {
              const cells = Array.isArray(row?.cells) ? row.cells : Array.isArray(row) ? row : [];
              return (
                <tr key={row?.key || `table-row-${index}`}>
                  {cells.map((cell, cellIndex) => (
                    <td key={`${row?.key || index}-${cellIndex}`}>
                      {typeof cell === "string" ? translateText(cell) : cell}
                    </td>
                  ))}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={Math.max(columns.length, 1)} className="muted">
                {translateText(emptyMessage)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DashboardMessageWidget({ message = "", body = "", className = "muted", translateText }) {
  const content = message || body || "";
  if (!content) return null;
  return <div className={className}>{translateText(content)}</div>;
}

function createWidgetDefinition(component, overrides = {}) {
  return {
    id: overrides?.id || null,
    component,
    title: overrides?.title || null,
    permissions: Array.isArray(overrides?.permissions) ? overrides.permissions : [],
    refreshInterval: overrides?.refreshInterval ?? null,
    refreshPolicy: overrides?.refreshPolicy || null,
    lazy: Boolean(overrides?.lazy),
    loader: overrides?.loader || null,
    defaultSize: overrides?.defaultSize || {
      width: overrides?.defaultWidth || "full",
      height: overrides?.defaultHeight || "medium",
    },
    defaultWidth: overrides?.defaultWidth || "full",
    defaultHeight: overrides?.defaultHeight || "medium",
    lifecycle: overrides?.lifecycle || ["mount", "refresh", "unmount", "pause", "resume"],
    ...overrides,
  };
}

export function normalizeDashboardWidget(definition) {
  if (!definition) return null;
  if (typeof definition === "function") {
    return createWidgetDefinition(definition);
  }
  if (typeof definition !== "object") return null;
  return createWidgetDefinition(definition.component || null, definition);
}

export const dashboardWidgetRegistry = {
  list: createWidgetDefinition(DashboardListWidget, {
    id: "list",
    title: "List",
    defaultWidth: "full",
    defaultHeight: "medium",
    permissions: [],
  }),
  table: createWidgetDefinition(DashboardTableWidget, {
    id: "table",
    title: "Table",
    defaultWidth: "full",
    defaultHeight: "medium",
    permissions: [],
  }),
  message: createWidgetDefinition(DashboardMessageWidget, {
    id: "message",
    title: "Message",
    defaultWidth: "full",
    defaultHeight: "short",
    permissions: [],
  }),
};

export default dashboardWidgetRegistry;
