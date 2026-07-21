import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function EmergencyOverrideWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const overrides = Number(data.activeOverrides ?? 0);

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Emergency overrides")}</div>
          <div className="executive-widget-subtitle">{translateText("Operational exceptions")}</div>
        </div>
        <span className={`executive-widget-badge ${overrides > 0 ? "risk" : "good"}`}>{overrides}</span>
      </div>
      <div className="executive-widget-value">{overrides}</div>
      <div className="executive-widget-meta">{translateText("Active emergency or supervisor overrides")}</div>
    </div>
  );
}
