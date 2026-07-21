import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function DischargesWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const discharges = Number(data.dischargesToday ?? 0);

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Discharges")}</div>
          <div className="executive-widget-subtitle">{translateText("Patients leaving care today")}</div>
        </div>
        <span className="executive-widget-badge good">{translateText("Flow")}</span>
      </div>
      <div className="executive-widget-value">{discharges}</div>
      <div className="executive-widget-meta">{translateText("Bed turnover and throughput")}</div>
    </div>
  );
}
