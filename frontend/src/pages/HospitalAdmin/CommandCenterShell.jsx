import React from "react";
import { ActionCard } from "../../components/Cards";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";

export { DashboardSection };

export default function HospitalAdminCommandCenterShell({
  className = "",
  shellKey = "hospital-admin",
  kicker = "Hospital operations",
  title,
  subtitle,
  actions = [],
  stats = [],
  brief = null,
  runway = [],
  pinnedTools = [],
  recentItems = [],
  savedViews = [],
  contextCards = [],
  commandGroups = [],
  children,
}) {
  return (
    <DashboardHomeShell
      className={`hospital-admin-dashboard-shell ${className}`.trim()}
      shellKey={shellKey}
      kicker={kicker}
      title={title}
      subtitle={subtitle}
      actions={actions}
      stats={stats}
      brief={brief}
      runway={runway}
      pinnedTools={pinnedTools}
      recentItems={recentItems}
      savedViews={savedViews}
      contextCards={contextCards}
    >
      {Array.isArray(commandGroups) && commandGroups.length > 0 ? (
        <DashboardSection
          title="Command center"
          subtitle="Fast entry points into operations, workforce, revenue, and facility workflows."
        >
          <div className="hospital-admin-command-grid">
            {commandGroups.map((item) => (
              <ActionCard
                key={item.id || item.title}
                title={item.title}
                description={item.description}
                eyebrow={item.eyebrow}
                badge={item.badge}
                variant={item.variant || "compact"}
                path={item.path}
                onClick={item.onClick}
              />
            ))}
          </div>
        </DashboardSection>
      ) : null}
      {children}
    </DashboardHomeShell>
  );
}
