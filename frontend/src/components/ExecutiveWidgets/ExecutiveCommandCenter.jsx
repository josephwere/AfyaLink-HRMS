import React from "react";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import WidgetHost from "./WidgetHost";
import { WIDGET_REGISTRY, getLayoutWidgetIds, getWidgetsForCapabilities, getWidgetById } from "./widgetRegistry";
import { buildDashboardData } from "./dashboardDataRegistry";
import { BedOccupancyWidget, AdmissionsWidget, DischargesWidget, RevenueWidget, ClaimsWidget, PharmacyAlertsWidget, LaboratoryQueueWidget, RadiologyQueueWidget, StaffOnDutyWidget, EmergencyOverrideWidget, MachineHealthWidget, AuditSummaryWidget } from "./widgets";
import "./ExecutiveWidgets.css";

function KPIBlock({ label, value, note }) {
  const { translateText } = useAppLanguage();

  return (
    <div className="card premium-card">
      <div className="card-title">{translateText(label)}</div>
      <div className="card-value">{value}</div>
      {note ? <div className="card-sub">{translateText(note)}</div> : null}
    </div>
  );
}

const WIDGET_COMPONENTS = {
  "bed-occupancy": BedOccupancyWidget,
  admissions: AdmissionsWidget,
  discharges: DischargesWidget,
  revenue: RevenueWidget,
  claims: ClaimsWidget,
  pharmacy: PharmacyAlertsWidget,
  laboratory: LaboratoryQueueWidget,
  radiology: RadiologyQueueWidget,
  staff: StaffOnDutyWidget,
  emergency: EmergencyOverrideWidget,
  "machine-health": MachineHealthWidget,
  audit: AuditSummaryWidget,
};

export default function ExecutiveCommandCenter({ data = {}, title = "Executive Command Center", capabilities = [] }) {
  const { translateText } = useAppLanguage();

  const kpis = [
    { label: "Bed occupancy", value: data.bedOccupancy ?? "—", note: "Facility utilization" },
    { label: "Admissions today", value: data.admissionsToday ?? "—", note: "Patient intake" },
    { label: "Discharges today", value: data.dischargesToday ?? "—", note: "Care transitions" },
    { label: "Revenue today", value: data.revenueToday ?? "—", note: "Cash flow pulse" },
  ];

  const widgets = getWidgetsForCapabilities(capabilities, WIDGET_REGISTRY);
  const orderedWidgetIds = getLayoutWidgetIds(undefined, widgets);
  const dashboardData = buildDashboardData(data);

  return (
    <div className="executive-command-center">
      <div className="dashboard-home-section-head">
        <div>
          <h3>{translateText(title)}</h3>
          <p className="muted">{translateText("A widget-based operating view for operations, workforce, finance, and compliance.")}</p>
        </div>
      </div>

      <div className="executive-kpi-grid">
        {kpis.map((item) => (
          <KPIBlock key={item.label} label={item.label} value={item.value} note={item.note} />
        ))}
      </div>

      <div className="executive-widgets-grid">
        {orderedWidgetIds.map((widgetId) => {
          const widget = getWidgetById(widgetId, WIDGET_REGISTRY);
          const Component = WIDGET_COMPONENTS[widgetId];

          if (!widget || !Component) return null;

          return (
            <WidgetHost key={widget.id} widget={widget} data={dashboardData}>
              <Component data={dashboardData} />
            </WidgetHost>
          );
        })}
      </div>
    </div>
  );
}
