import React from "react";
import { useAppLanguage } from "../../../utils/appLanguage.jsx";

export default function MachineHealthWidget({ data = {} }) {
  const { translateText } = useAppLanguage();
  const offline = Number(data.machineOffline ?? 0);

  return (
    <div className="card premium-card executive-widget-card">
      <div className="executive-widget-head">
        <div>
          <div className="executive-widget-title">{translateText("Machine health")}</div>
          <div className="executive-widget-subtitle">{translateText("Device connectivity")}</div>
        </div>
        <span className={`executive-widget-badge ${offline > 0 ? "warn" : "good"}`}>{offline}</span>
      </div>
      <div className="executive-widget-value">{offline}</div>
      <div className="executive-widget-meta">{translateText("Devices offline or degraded")}</div>
    </div>
  );
}
