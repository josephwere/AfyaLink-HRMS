import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function AdmissionsWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const admissions = Number(data.admissionsToday ?? 0);

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Admissions")}</div>
          <div className="executive-widget-subtitle">{translateText("New arrivals today")}</div>
        </div>
        <span className="executive-widget-badge good">{translateText("Live")}</span>
      </div>
      <div className="executive-widget-value">{admissions}</div>
      <div className="executive-widget-meta">{translateText("Patients admitted across the hospital")}</div>
    </div>
  );
}
