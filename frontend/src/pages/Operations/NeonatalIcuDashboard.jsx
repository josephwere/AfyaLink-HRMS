import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getNeonatalIcuDashboard } from "../../services/dashboardApi";

export default function NeonatalIcuDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getNeonatalIcuDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Neonatal ICU Dashboard</h2>
          <p className="muted">Simple view for NICU admissions and risk follow-up.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/ops/icu")}>Open ICU Ops</button>
        </div>
      </div>
      <section className="section">
        <h3>Live Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="NICU Admissions Today" value={data?.nicuAdmissionsToday ?? "-"} />
          <StatCard title="Active NICU Cases" value={data?.activeNicuCases ?? "-"} />
          <StatCard title="High-Risk Followups" value={data?.highRiskFollowups ?? "-"} />
          <StatCard title="Pending Critical Labs" value={data?.pendingCriticalLabs ?? "-"} />
        </div>
      </section>
    </div>
  );
}
