import React, { useEffect, useMemo, useState } from "react";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { StatCard } from "../../components/Cards";
import apiFetch from "../../utils/apiFetch";

function formatCurrencyKES(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "KES 0";
  return `KES ${amount.toLocaleString()}`;
}

export default function HospitalKPIDashboard() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totalEncounters = useMemo(
    () => kpis?.encounters?.total ?? kpis?.totalEncounters ?? 0,
    [kpis]
  );
  const activeEncounters = useMemo(() => kpis?.encounters?.active ?? "—", [kpis]);
  const pendingInsurance = useMemo(() => kpis?.insurance?.pending ?? "—", [kpis]);
  const labPending = useMemo(() => kpis?.flow?.labPending ?? "—", [kpis]);
  const pharmacyPending = useMemo(() => kpis?.flow?.pharmacyPending ?? "—", [kpis]);
  const totalRevenue = useMemo(
    () => formatCurrencyKES(kpis?.billing?.totalRevenue || 0),
    [kpis]
  );

  async function loadKPIs() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/admin/kpis");
      setKpis(data || null);
    } catch (err) {
      setKpis(null);
      setError(err?.message || "Failed to load hospital KPIs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKPIs().catch(() => {});
    const timer = setInterval(() => loadKPIs().catch(() => {}), 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <DashboardHomeShell
      shellKey="platform_hospital_kpis"
      kicker="Platform · Analytics"
      title="Hospital KPIs"
      subtitle="A clean KPI surface for encounter flow, insurance, and revenue signals."
      actions={[
        { label: "Refresh", onClick: () => loadKPIs(), variant: "secondary" },
        { label: "Open Financials", path: "/app/revenue/financials/index" },
      ]}
      stats={[
        { label: "Encounters", value: totalEncounters, path: "/app/operations/consultations/monitor" },
        { label: "Active", value: activeEncounters, path: "/app/operations/consultations/monitor" },
        { label: "Insurance pending", value: pendingInsurance, path: "/app/revenue/claims/index" },
        { label: "Revenue", value: totalRevenue, path: "/app/revenue/financials/index" },
      ]}
    >
      <DashboardSection
        title="Operational Pulse"
        subtitle="If it looks clickable it navigates to the matching queue or workspace."
      >
        {error ? (
          <div className="muted" style={{ color: "#dc2626", marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        <div className="grid info-grid">
          <StatCard title="Encounters (Total)" value={totalEncounters} path="/app/operations/consultations/monitor" />
          <StatCard title="Encounters (Active)" value={activeEncounters} path="/app/operations/consultations/monitor" />
          <StatCard title="Lab Pending" value={labPending} path="/app/operations/lab/encounter-queue" />
          <StatCard title="Pharmacy Pending" value={pharmacyPending} path="/app/operations/pharmacy/referrals" />
          <StatCard title="Insurance Pending" value={pendingInsurance} path="/app/revenue/claims/index" />
          <StatCard title="Total Revenue" value={totalRevenue} path="/app/revenue/financials/index" />
        </div>

        {loading ? <div className="muted" style={{ marginTop: 12 }}>Loading…</div> : null}
      </DashboardSection>
    </DashboardHomeShell>
  );
}
