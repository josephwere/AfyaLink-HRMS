import React, { useState } from "react";
import { getRegulatoryAutoReport } from "../../services/intelligenceApi";
import { StatCard } from "../../components/Cards";

export default function RegulatoryReports() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setMsg("");
    try {
      const out = await getRegulatoryAutoReport();
      setData(out?.report || null);
    } catch (e) {
      setMsg(e?.message || "Failed to generate regulatory auto report");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Regulatory Auto Report</h2>
          <p className="muted">Generated compliance snapshot for workforce, approvals, and security events.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={run} disabled={loading}>
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
              <StatCard title="Staff Total" value={data?.workforce?.staffTotal ?? "—"} />
              <StatCard title="Inactive Staff" value={data?.workforce?.inactiveStaff ?? "—"} />
              <StatCard title="Pending Approvals" value={data?.approvals?.total ?? "—"} />
              <StatCard title="Export Events (30d)" value={data?.compliance?.exportEvents ?? "—"} />
              <StatCard title="ABAC Denials (30d)" value={data?.compliance?.abacDeniedEvents ?? "—"} />
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

