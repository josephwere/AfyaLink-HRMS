import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

export default function WorkflowReplay({ encounterId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!encounterId) return;
    apiFetch(`/api/workflows/replay/${encounterId}`)
      .then(r => r.json())
      .then(setData);
  }, [encounterId]);

  if (!data) return null;

  return (
    <div className="card premium-card">
      <h3>Encounter Replay</h3>

      <ol>
        {data.timeline.map((s, i) => (
          <li key={i}>
            <strong>{s.state}</strong> —{" "}
            {new Date(s.at).toLocaleString()}
          </li>
        ))}
      </ol>
    </div>
  );
}
