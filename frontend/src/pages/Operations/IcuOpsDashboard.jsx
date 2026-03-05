import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getIcuOpsDashboard } from "../../services/dashboardApi";

export default function IcuOpsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getIcuOpsDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>ICU & Ward Operations</h2>
          <p className="muted">Simple ICU/ward view for admissions and high-risk follow-up.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/doctor/ward")}>
            Open Ward Workspace
          </button>
        </div>
      </div>
      <section className="section">
        <h3>Live Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Active Inpatients" value={data?.activeInpatients ?? "—"} />
          <StatCard title="Admissions Today" value={data?.admissionsToday ?? "—"} />
          <StatCard title="High-Risk Followups" value={data?.highRiskFollowups ?? "—"} />
          <StatCard title="Pending Lab Results" value={data?.pendingLabResults ?? "—"} />
        </div>
      </section>
    </div>
  );
}
