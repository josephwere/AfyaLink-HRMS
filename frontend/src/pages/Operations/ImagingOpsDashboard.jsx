import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getImagingOpsDashboard } from "../../services/dashboardApi";

export default function ImagingOpsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getImagingOpsDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Imaging Operations</h2>
          <p className="muted">Simple imaging ops view for queue and critical reads.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/radiologist")}>
            Open Radiologist Dashboard
          </button>
        </div>
      </div>
      <section className="section">
        <h3>Live Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Pending Imaging" value={data?.imagingPending ?? "—"} />
          <StatCard title="Completed Today" value={data?.imagingCompletedToday ?? "—"} />
          <StatCard title="Critical Reads Backlog" value={data?.criticalReadsBacklog ?? "—"} />
          <StatCard title="Open Equipment Issues" value={data?.openEquipmentIssues ?? "—"} />
        </div>
      </section>
    </div>
  );
}
