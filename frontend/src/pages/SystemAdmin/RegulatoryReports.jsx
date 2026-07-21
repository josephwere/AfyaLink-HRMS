import React from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useRegulatoryReports } from "../../hooks/useRegulatoryReports";

export default function RegulatoryReports() {
  const navigate = useNavigate();
  const { data, msg, loading, run } = useRegulatoryReports();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Regulatory Auto Report</h2>
          <p className="muted">Generated compliance snapshot for workforce, approvals, and security events.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={run} disabled={loading}>
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      {data && (
        <>
          <section className="section">
            <h3>Summary</h3>
            <div className="grid info-grid">
              <StatCard title="Staff Total" value={data?.workforce?.staffTotal ?? "—"} onClick={() => navigate("/admin/access-control")} />
              <StatCard title="Inactive Staff" value={data?.workforce?.inactiveStaff ?? "—"} onClick={() => navigate("/admin/access-control")} />
              <StatCard title="Pending Approvals" value={data?.approvals?.total ?? "—"} onClick={() => navigate("/hospital-admin/approvals")} />
              <StatCard title="Export Events (30d)" value={data?.compliance?.exportEvents ?? "—"} onClick={() => navigate("/admin/audit-logs?q=export")} />
              <StatCard title="ABAC Denials (30d)" value={data?.compliance?.abacDeniedEvents ?? "—"} onClick={() => navigate("/admin/audit-logs?q=abac")} />
            </div>
          </section>

          <section className="section">
            <h3>Flags</h3>
            <div className="panel-grid">
              {(data.flags || []).map((f) => (
                <div key={f} className="card">
                  {f}
                </div>
              ))}
              {(data.flags || []).length === 0 && <div className="card muted">No critical flags.</div>}
            </div>
          </section>

          <section className="section">
            <h3>Raw Report</h3>
            <div className="card">
              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
