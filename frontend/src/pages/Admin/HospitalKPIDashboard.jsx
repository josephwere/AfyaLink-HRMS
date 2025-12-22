import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";

/**
 * HOSPITAL KPI DASHBOARD
 * 🔒 Admin only
 * 📊 Read-only
 * 🔁 Auto-refresh
 */

export default function HospitalKPIDashboard() {
  const { user } = useAuth();

  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "admin") {
      loadKPIs();

      // 🔁 Auto refresh every 30s
      const t = setInterval(loadKPIs, 30000);
      return () => clearInterval(t);
    }
  }, [user]);

  async function loadKPIs() {
    try {
      const res = await apiFetch("/api/kpis/hospital");
      if (!res.ok) throw new Error();
      setKpis(await res.json());
      setError("");
    } catch {
      setError("Failed to load hospital KPIs");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return <div>Please log in</div>;
  if (user.role !== "admin") return <div>Access denied</div>;
  if (loading) return <div>Loading KPIs…</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!kpis) return null;

  return (
    <div className="card premium-card">
      <h2>🏥 Hospital KPI Dashboard</h2>

      {/* =============================
          ENCOUNTERS
      ============================== */}
      <Section title="Encounters">
        <Kpi label="Total" value={kpis.encounters.total} />
        <Kpi label="Active" value={kpis.encounters.active} />
        <Kpi label="Completed" value={kpis.encounters.completed} />
      </Section>

      {/* =============================
          INSURANCE — SHA
      ============================== */}
      <Section title={`Insurance (${kpis.insurance.provider})`}>
        <Kpi label="Pending" value={kpis.insurance.pending} warn />
        <Kpi label="Approved" value={kpis.insurance.approved} success />
        <Kpi label="Rejected" value={kpis.insurance.rejected} danger />
      </Section>

      {/* =============================
          CLINICAL FLOW
      ============================== */}
      <Section title="Clinical Flow">
        <Kpi label="Lab Pending" value={kpis.flow.labPending} warn />
        <Kpi label="Pharmacy Pending" value={kpis.flow.pharmacyPending} />
      </Section>

      {/* =============================
          BILLING
      ============================== */}
      <Section title="Billing">
        <Kpi
          label="Total Revenue"
          value={`KES ${kpis.billing.totalRevenue.toLocaleString()}`}
          success
        />
        <Kpi
          label="Pending Payments"
          value={kpis.billing.pendingPayments}
          warn
        />
      </Section>
    </div>
  );
}

/* ===============================
   KPI SECTION
=============================== */
function Section({ title, children }) {
  return (
    <section className="kpi-section">
      <h3>{title}</h3>
      <div className="kpi-grid">{children}</div>
    </section>
  );
}

/* ===============================
   KPI CARD
=============================== */
function Kpi({ label, value, warn, success, danger }) {
  let color = "#111827";
  if (warn) color = "#f59e0b";
  if (success) color = "#16a34a";
  if (danger) color = "#dc2626";

  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}
