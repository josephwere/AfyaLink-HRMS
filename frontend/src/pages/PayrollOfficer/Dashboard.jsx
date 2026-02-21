import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { getPayrollDashboard } from "../../services/dashboardApi";

export default function PayrollOfficerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getPayrollDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Payroll Officer Engine</h2>
          <p className="muted">Run payroll, manage deductions, taxes, loans and audit-ready payroll history.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/payments/full")}>Run Payroll</button>
          <button className="btn-secondary" onClick={() => navigate("/reports")}>Tax Reports</button>
          <button className="btn-secondary" onClick={() => navigate("/workforce/requests#overtime")}>Overtime</button>
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
            <button className="action-link" onClick={() => navigate("/payments/full")}>Overtime Management</button>
            <button className="action-link" onClick={() => navigate("/payments/full")}>Allowances & Deductions</button>
            <button className="action-link" onClick={() => navigate("/reports")}>Loan Management</button>
            <button className="action-link" onClick={() => navigate("/payments/full")}>Generate Payslips</button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Right Insights</h3>
          <div className="alert-stack">
            <div className="action-pill">Pending Approvals: {data?.pendingApprovals ?? "—"}</div>
            <div className="action-pill">Overdue Payroll: {data?.overduePayroll ?? "—"}</div>
            <button className="btn-secondary" onClick={() => navigate("/reports")}>Audit Trail</button>
          </div>
        </div>
      </section>
    </div>
  );
}
