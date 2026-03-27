import React, { useEffect, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { StatCard } from "../../components/Cards";
import { getPayrollDashboard } from "../../services/dashboardApi";
import { listTransfers } from "../../services/transferApi";
import { useAppLanguage } from "../../utils/appLanguage.jsx";

export default function PayrollOfficerDashboard() {
  const { translateText } = useAppLanguage();
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
    <DashboardHomeShell
      shellKey="people_payroll_officer"
      kicker={translateText("Revenue")}
      title={translateText("Payroll Operations")}
      subtitle={translateText("Run payroll, audit deductions, and keep approvals moving.")}
      actions={[
        { label: translateText("Run Payroll"), path: "/app/revenue/payments/index" },
        { label: translateText("Tax Reports"), path: "/app/platform/reports/index", variant: "secondary" },
        { label: translateText("Overtime"), path: "/app/people/requests/index#overtime", variant: "secondary" },
      ]}
      stats={[
        { label: translateText("Pending Approvals"), value: data?.pendingApprovals ?? "—", path: "/app/revenue/payments/index" },
        { label: translateText("Overdue Payroll"), value: data?.overduePayroll ?? "—", path: "/app/revenue/payments/index" },
        { label: translateText("Total Gross"), value: data?.totalThisMonth ?? "—", path: "/app/revenue/payments/index" },
        { label: translateText("Net Pay Summary"), value: data?.paidThisMonth ?? "—", path: "/app/revenue/payments/index" },
      ]}
    >
      <DashboardSection title={translateText("Payroll Status")} subtitle={translateText("Core payroll metrics for this cycle.")}>
        <div className="grid info-grid">
          <StatCard title={translateText("Current Payroll Status")} value={data?.invoicesThisMonth ?? "—"} path="/app/revenue/payments/index" />
          <StatCard title={translateText("Total Gross")} value={data?.totalThisMonth ?? "—"} path="/app/revenue/payments/index" />
          <StatCard title={translateText("Total Deductions")} value={data?.unpaidInvoices ?? "—"} path="/app/revenue/payments/index" />
          <StatCard title={translateText("Net Pay Summary")} value={data?.paidThisMonth ?? "—"} path="/app/revenue/payments/index" />
        </div>
      </DashboardSection>

      <DashboardSection title={translateText("Transfer Continuity")} subtitle={translateText("Operational handoffs that affect staffing and overtime cost.")}>
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
                  <td>
                    {t?.patient?.firstName || ""} {t?.patient?.lastName || ""}
                  </td>
                  <td>
                    {t?.fromHospital?.name || t?.fromHospital?.code || "—"} →{" "}
                    {t?.toHospital?.name || t?.toHospital?.code || "—"}
                  </td>
                  <td>{translateText(t.status)}</td>
                </tr>
              ))}
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="muted">
                    {translateText("No transfers yet.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}

