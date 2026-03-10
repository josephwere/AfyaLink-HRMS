import React, { useEffect, useMemo, useState } from "react";
import {
  getRevenueDaily,
  getDoctorUtilization,
  getPharmacyProfit,
} from "../../services/analyticsApi";
import { listTransfers } from "../../services/transferApi";

export default function Analytics() {
  const [revenue, setRevenue] = useState([]);
  const [utilization, setUtilization] = useState([]);
  const [profit, setProfit] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [error, setError] = useState("");
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    Promise.all([
      getRevenueDaily(),
      getDoctorUtilization(),
      getPharmacyProfit(),
    ])
      .then(([rev, util, prof]) => {
        setRevenue(Array.isArray(rev) ? rev : []);
        setUtilization(Array.isArray(util) ? util : []);
        setProfit(Array.isArray(prof) ? prof : []);
      })
      .catch(() => setError("Failed to load analytics"));
  }, []);

  useEffect(() => {
    listTransfers({ limit: 6, scope: "facility" })
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Unable to load transfers.");
      });
  }, []);

  const revenueTotal = useMemo(
    () => revenue.reduce((sum, r) => sum + (r.total || 0), 0),
    [revenue]
  );
  const revenueMax = useMemo(
    () => Math.max(1, ...revenue.map((r) => r.total || 0)),
    [revenue]
  );
  const utilMax = useMemo(
    () => Math.max(1, ...utilization.map((u) => u.count || 0)),
    [utilization]
  );
  const profitMax = useMemo(
    () => Math.max(1, ...profit.map((p) => p.profit || 0)),
    [profit]
  );

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Analytics</h2>
          <p className="muted">Live metrics and operational insights.</p>
        </div>
      </div>

      {error && <div className="card">{error}</div>}

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">
              Pending: {transfers.filter((t) => t.status === "Pending").length}
            </div>
          </div>
          {transferError ? <div className="muted">{transferError}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>
                      {t?.fromHospital?.name || t?.fromHospital?.code || "—"} →{" "}
                      {t?.toHospital?.name || t?.toHospital?.code || "—"}
                    </td>
                    <td>{t.status}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">No transfers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Revenue (Last 30 Days)</h3>
        <div className="grid info-grid">
          <div className="card">
            <div className="card-title">Total Revenue</div>
            <div className="card-value">KES {revenueTotal.toLocaleString()}</div>
          </div>
          <div className="card">
            <div className="card-title">Days Tracked</div>
            <div className="card-value">{revenue.length}</div>
          </div>
        </div>
        <div className="card chart-card">
          {revenue.length === 0 ? (
            <div className="muted">No revenue data yet.</div>
          ) : (
            <div className="simple-chart">
              {revenue.slice(-14).map((r) => (
                <div key={r._id} className="bar-row">
                  <span className="bar-label">{r._id}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(r.total / revenueMax) * 100}%` }}
                    />
                  </div>
                  <span className="bar-value">KES {r.total?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h3>Doctor Utilization (Top 10)</h3>
        <div className="card chart-card">
          {utilization.length === 0 ? (
            <div className="muted">No utilization data yet.</div>
          ) : (
            <div className="simple-chart">
              {utilization.slice(0, 10).map((u, idx) => (
                <div key={u._id || idx} className="bar-row">
                  <span className="bar-label">
                    {(u.doctor?.name || "Doctor").split(" ")[0]}
                  </span>
                  <div className="bar-track">
                    <div
                      className="bar-fill blue"
                      style={{ width: `${(u.count / utilMax) * 100}%` }}
                    />
                  </div>
                  <span className="bar-value">{u.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h3>Pharmacy Profit (Top Items)</h3>
        <div className="card chart-card">
          {profit.length === 0 ? (
            <div className="muted">No pharmacy profit data yet.</div>
          ) : (
            <div className="simple-chart">
              {profit.slice(0, 10).map((p, idx) => (
                <div key={p._id || idx} className="bar-row">
                  <span className="bar-label">{p._id || "Item"}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill green"
                      style={{ width: `${(p.profit / profitMax) * 100}%` }}
                    />
                  </div>
                  <span className="bar-value">KES {p.profit?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
