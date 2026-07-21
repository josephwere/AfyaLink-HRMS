import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function RadiologyQueueWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const queue = Number(data.radiologyQueue ?? 0);

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Radiology queue")}</div>
          <div className="executive-widget-subtitle">{translateText("Imaging turnaround")}</div>
        </div>
        <span className={`executive-widget-badge ${queue > 10 ? "warn" : "good"}`}>{queue}</span>
      </div>
      <div className="executive-widget-value">{queue}</div>
      <div className="executive-widget-meta">{translateText("Studies awaiting review")}</div>
    </div>
  );
}
