import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function BedOccupancyWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const occupied = Number(data.occupiedBeds ?? 0);
  const total = Number(data.totalBeds ?? 0);
  const rate = total ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Bed occupancy")}</div>
          <div className="executive-widget-subtitle">{translateText("Capacity pressure and ward availability")}</div>
        </div>
        <span className={`executive-widget-badge ${rate >= 85 ? "risk" : rate >= 75 ? "warn" : "good"}`}>{rate}%</span>
      </div>
      <div className="executive-widget-value">{occupied}/{total}</div>
      <div className="executive-widget-meta">{translateText("Occupied beds / available capacity")}</div>
    </div>
  );
}
