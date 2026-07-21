import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function StaffOnDutyWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const staff = Number(data.staffOnDuty ?? 0);

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Staff on duty")}</div>
          <div className="executive-widget-subtitle">{translateText("Current shift coverage")}</div>
        </div>
        <span className="executive-widget-badge good">{translateText("Shift")}</span>
      </div>
      <div className="executive-widget-value">{staff}</div>
      <div className="executive-widget-meta">{translateText("Clinical and support staff active now")}</div>
    </div>
  );
}
