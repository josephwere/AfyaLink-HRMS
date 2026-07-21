import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { StatCard } from "../../components/Cards";
import { useHospitalKPIDashboard } from "../../hooks/useHospitalKPIDashboard";

export default function HospitalKPIDashboard() {
  const {
    loading,
    error,
    loadKPIs,
    totalEncounters,
    activeEncounters,
    pendingInsurance,
    labPending,
    pharmacyPending,
    totalRevenue,
  } = useHospitalKPIDashboard();

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
