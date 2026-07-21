import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function LaboratoryQueueWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const queue = Number(data.laboratoryQueue ?? 0);

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Laboratory queue")}</div>
          <div className="executive-widget-subtitle">{translateText("Pending samples")}</div>
        </div>
        <span className={`executive-widget-badge ${queue > 15 ? "warn" : "good"}`}>{queue}</span>
      </div>
      <div className="executive-widget-value">{queue}</div>
      <div className="executive-widget-meta">{translateText("Samples awaiting processing")}</div>
    </div>
  );
}
