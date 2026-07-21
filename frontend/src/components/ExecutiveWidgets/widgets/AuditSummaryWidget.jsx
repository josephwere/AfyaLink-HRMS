import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function AuditSummaryWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const auditItems = Number(data.auditAlerts ?? 0);

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Audit summary")}</div>
          <div className="executive-widget-subtitle">{translateText("Compliance and traceability")}</div>
        </div>
        <span className={`executive-widget-badge ${auditItems > 0 ? "warn" : "good"}`}>{auditItems}</span>
      </div>
      <div className="executive-widget-value">{auditItems}</div>
      <div className="executive-widget-meta">{translateText("Open review or compliance items")}</div>
    </div>
  );
}
