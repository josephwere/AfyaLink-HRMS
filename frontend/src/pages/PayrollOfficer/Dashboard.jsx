import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getPayrollDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";

export default function PayrollOfficerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    getPayrollDashboard().then(setData).catch(() => setData(null));
    listTransfers({ limit: 8, scope: "facility" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Payroll Officer Engine</h2>
          <p className="muted">Simple payroll view for salary, deductions, and payment history.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/payments/full")}>Run Payroll</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/reports")}>Tax Reports</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/workforce/requests#overtime")}>Overtime</button>
        </div>
      </div>

      <section className="section">
        <h3>Payroll Status</h3>
        <div className="grid info-grid">
          <StatCard title="Current Payroll Status" value={data?.invoicesThisMonth ?? "—"} />
          <StatCard title="Total Gross" value={data?.totalThisMonth ?? "—"} />
          <StatCard title="Total Deductions" value={data?.unpaidInvoices ?? "—"} />
          <StatCard title="Net Pay Summary" value={data?.paidThisMonth ?? "—"} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Payroll Table</h3>
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/payments/full")}>Overtime Management</button>
            <button type="button" className="action-link" onClick={() => navigate("/payments/full")}>Allowances & Deductions</button>
            <button type="button" className="action-link" onClick={() => navigate("/reports")}>Loan Management</button>
            <button type="button" className="action-link" onClick={() => navigate("/payments/full")}>Generate Payslips</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Alerts</h3>
          <div className="alert-stack">
            <div className="action-pill">Pending Approvals: {data?.pendingApprovals ?? "—"}</div>
            <div className="action-pill">Overdue Payroll: {data?.overduePayroll ?? "—"}</div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/reports")}>Audit Trail</button>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">Pending: {transfers.filter((t) => t.status === "Pending").length}</div>
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
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
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
          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              Transfer Command Center
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/payments/full")}>
              Payroll Overview
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Monitor staffing cost shifts tied to transfer volumes.</div>
            <div className="alert-item">Align overtime approvals with transfer surges.</div>
            <div className="alert-item">Flag transfer-heavy wards for payroll review.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
