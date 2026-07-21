import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function RevenueWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const revenue = data.revenueToday ?? "—";

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Revenue today")}</div>
          <div className="executive-widget-subtitle">{translateText("Financial pulse")}</div>
        </div>
        <span className="executive-widget-badge good">{translateText("Cash")}</span>
      </div>
      <div className="executive-widget-value">{revenue}</div>
      <div className="executive-widget-meta">{translateText("Fee collection and billing activity")}</div>
    </div>
  );
}
