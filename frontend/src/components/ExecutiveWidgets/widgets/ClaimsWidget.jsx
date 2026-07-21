import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function ClaimsWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const pending = Number(data.pendingClaims ?? 0);

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Claims pending")}</div>
          <div className="executive-widget-subtitle">{translateText("Revenue cycle attention")}</div>
        </div>
        <span className={`executive-widget-badge ${pending > 0 ? "warn" : "good"}`}>{pending}</span>
      </div>
      <div className="executive-widget-value">{pending}</div>
      <div className="executive-widget-meta">{translateText("Claims waiting for review")}</div>
    </div>
  );
}
