import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";
import { listTransfers } from "../../services/transferApi";
import { normalizeRole } from "../../utils/normalizeRole";
import AccessDeniedCard from "../../components/AccessDeniedCard";

/**
 * HOSPITAL KPI DASHBOARD
 * 🔒 Admin only
 * 📊 Read-only
 * 🔁 Auto-refresh
 */

export default function HospitalKPIDashboard() {
  const { user } = useAuth();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const navigate = useNavigate();

  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    if (actorRole === "HOSPITAL_ADMIN" || actorRole === "SUPER_ADMIN") {
      loadKPIs();
      loadTransfers();

      // 🔁 Auto refresh every 30s
      const t = setInterval(loadKPIs, 30000);
      return () => clearInterval(t);
    }
  }, [actorRole]);

  async function loadKPIs() {
    try {
      const data = await apiFetch("/api/admin/kpis");
      setKpis(data);
      setError("");
    } catch {
      setError("Failed to load hospital KPIs");
    } finally {
      setLoading(false);
    }
  }

  async function loadTransfers() {
    try {
      const data = await listTransfers({ limit: 6, scope: "facility" });
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setTransfers(items);
      setTransferError("");
    } catch (err) {
      setTransfers([]);
      setTransferError(err?.message || "Unable to load transfers.");
    }
  }

  if (!user) return <div>Please log in</div>;
  if (actorRole !== "HOSPITAL_ADMIN" && actorRole !== "SUPER_ADMIN")
    return <AccessDeniedCard message="Hospital KPI visibility is restricted to hospital admin and founder roles." />;
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
        <Kpi label="Total" value={kpis?.encounters?.total ?? kpis?.totalEncounters ?? 0} onClick={() => navigate("/doctor/opd")} />
        <Kpi label="Active" value={kpis?.encounters?.active ?? "—"} onClick={() => navigate("/doctor/opd?focus=RECORD")} />
        <Kpi label="Completed" value={kpis?.encounters?.completed ?? "—"} onClick={() => navigate("/reports")} />
      </Section>

      {/* =============================
          INSURANCE — SHA
      ============================== */}
      <Section title={`Insurance (${kpis?.insurance?.provider || "SHA"})`}>
        <Kpi label="Pending" value={kpis?.insurance?.pending ?? "—"} warn onClick={() => navigate("/hospital-admin/financials")} />
        <Kpi label="Approved" value={kpis?.insurance?.approved ?? "—"} success onClick={() => navigate("/hospital-admin/financials")} />
        <Kpi label="Rejected" value={kpis?.insurance?.rejected ?? "—"} danger onClick={() => navigate("/hospital-admin/financials")} />
      </Section>

      {/* =============================
          CLINICAL FLOW
      ============================== */}
      <Section title="Clinical Flow">
        <Kpi label="Lab Pending" value={kpis?.flow?.labPending ?? "—"} warn onClick={() => navigate("/lab-tech/test-queue")} />
        <Kpi label="Pharmacy Pending" value={kpis?.flow?.pharmacyPending ?? "—"} onClick={() => navigate("/pharmacy")} />
      </Section>

      {/* =============================
          BILLING
      ============================== */}
      <Section title="Billing">
        <Kpi
          label="Total Revenue"
          value={`KES ${Number(kpis?.billing?.totalRevenue || 0).toLocaleString()}`}
          success
          onClick={() => navigate("/hospital-admin/financials")}
        />
        <Kpi
          label="Pending Payments"
          value={kpis?.billing?.pendingPayments ?? "—"}
          warn
          onClick={() => navigate("/hospital-admin/financials")}
        />
      </Section>

      <section className="kpi-section">
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
          <div className="table-wrap">
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
function Kpi({ label, value, warn, success, danger, onClick }) {
  let color = "#111827";
  if (warn) color = "#f59e0b";
  if (success) color = "#16a34a";
  if (danger) color = "#dc2626";

  return (
    <div
      className={`kpi-card${typeof onClick === "function" ? " kpi-card-clickable" : ""}`}
      role={typeof onClick === "function" ? "button" : undefined}
      tabIndex={typeof onClick === "function" ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (typeof onClick !== "function") return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}
