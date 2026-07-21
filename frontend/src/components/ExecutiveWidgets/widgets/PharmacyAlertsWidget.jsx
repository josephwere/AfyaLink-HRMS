import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function PharmacyAlertsWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const alerts = Number(data.pharmacyAlerts ?? 0);

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Pharmacy alerts")}</div>
          <div className="executive-widget-subtitle">{translateText("Stock and coverage pressure")}</div>
        </div>
        <span className={`executive-widget-badge ${alerts > 0 ? "warn" : "good"}`}>{alerts}</span>
      </div>
      <div className="executive-widget-value">{alerts}</div>
      <div className="executive-widget-meta">{translateText("Open stock and supply issues")}</div>
    </div>
  );
}
