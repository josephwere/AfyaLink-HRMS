import React from "react";
import { useSystemSettings } from "../utils/systemSettings.jsx";

export default function FloatingAI() {
  const { settings } = useSystemSettings();
  const ai = settings?.ai;

  if (!ai?.enabled || !ai?.url) return null;

  return (
    <button
      className="ai-float"
      onClick={() => window.open(ai.url, "_blank")}
      title={ai.name || "NeuroEdge"}
    >
      <span className="ai-float-badge">{ai.name || "NeuroEdge"}</span>
      <span className="ai-float-sub">{ai.greeting || "Ask AI"}</span>
    </button>
  );
}
