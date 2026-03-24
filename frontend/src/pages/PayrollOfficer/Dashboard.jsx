import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getPayrollDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function PayrollOfficerDashboard() {
  const { user } = useAuth();
  const { translateText } = useAppLanguage();
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
          <h2>{translateText("Payroll Officer Engine")}</h2>
          <p className="muted">{translateText("Simple payroll view for salary, deductions, and payment history.")}</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/payments/full")}>{translateText("Run Payroll")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/reports")}>{translateText("Tax Reports")}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/workforce/requests#overtime")}>{translateText("Overtime")}</button>
        </div>
      </div>

      <section className="section">
        <h3>{translateText("Payroll Status")}</h3>
        <div className="grid info-grid">
          <StatCard title={translateText("Current Payroll Status")} value={data?.invoicesThisMonth ?? "—"} onClick={() => navigate("/payments/full")} />
          <StatCard title={translateText("Total Gross")} value={data?.totalThisMonth ?? "—"} onClick={() => navigate("/payments/full")} />
          <StatCard title={translateText("Total Deductions")} value={data?.unpaidInvoices ?? "—"} onClick={() => navigate("/payments/full")} />
          <StatCard title={translateText("Net Pay Summary")} value={data?.paidThisMonth ?? "—"} onClick={() => navigate("/payments/full")} />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>{translateText("Payroll Table")}</h3>
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/payments/full")}>{translateText("Overtime Management")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/payments/full")}>{translateText("Allowances & Deductions")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/reports")}>{translateText("Loan Management")}</button>
            <button type="button" className="action-link" onClick={() => navigate("/payments/full")}>{translateText("Generate Payslips")}</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>{translateText("Alerts")}</h3>
          <div className="alert-stack">
            <div className="action-pill">{translateText("Pending Approvals")}: {data?.pendingApprovals ?? "—"}</div>
            <div className="action-pill">{translateText("Overdue Payroll")}: {data?.overduePayroll ?? "—"}</div>
            <button type="button" className="btn-secondary" onClick={() => navigate("/reports")}>{translateText("Audit Trail")}</button>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>{translateText("Transfer Continuity")}</h3>
              <p className="muted">{translateText("Recent transfers and handoff status.")}</p>
            </div>
            <div className="action-pill">{translateText("Pending")}: {transfers.filter((t) => t.status === "Pending").length}</div>
          </div>
          {transferError ? <div className="muted">{translateText(transferError)}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>{translateText("Patient")}</th>
                  <th>{translateText("Route")}</th>
                  <th>{translateText("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>{translateText(t.status)}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">{translateText("No transfers yet.")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              {translateText("Transfer Command Center")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/payments/full")}>
              {translateText("Payroll Overview")}
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>{translateText("Continuity Actions")}</h3>
          <div className="alert-stack">
            <div className="alert-item">{translateText("Monitor staffing cost shifts tied to transfer volumes.")}</div>
            <div className="alert-item">{translateText("Align overtime approvals with transfer surges.")}</div>
            <div className="alert-item">{translateText("Flag transfer-heavy wards for payroll review.")}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
