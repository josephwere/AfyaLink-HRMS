import React, { useEffect, useMemo, useState } from "react";
import { getExecutiveDashboard } from "../../services/dashboardApi";

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(numeric);
}

function formatPercent(value) {
  const numeric = Number(value || 0);
  return `${numeric.toFixed(1)}%`;
}

export default function FinanceExecutiveDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getExecutiveDashboard();
        if (active) setData(payload || null);
      } catch (err) {
        if (active) setError(err?.message || "Unable to load executive dashboard data.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const finance = data?.domains?.finance || {};
  const operations = data?.domains?.operations || {};
  const pharmacy = data?.domains?.pharmacy || {};
  const clinical = data?.domains?.clinical || {};

  const summary = useMemo(() => {
    return [
      { title: "Revenue today", value: formatCurrency(finance.revenueToday ?? data?.revenueToday), subtitle: "Collected revenue for the day" },
      { title: "Outstanding receivables", value: formatCurrency(finance.outstandingAmount), subtitle: "Unpaid open invoices" },
      { title: "Pending claims", value: finance.totalClaims ?? data?.pendingClaims ?? 0, subtitle: "Claims awaiting review" },
      { title: "Bed occupancy", value: formatPercent(operations.bedOccupancyRate ?? data?.bedOccupancyRate), subtitle: "Current occupancy pressure" },
    ];
  }, [data, finance, operations]);

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Executive dashboard</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">CFO Dashboard</h1>
            <p className="premium-shell-subtitle">
              Executive oversight for revenue, approvals, operational pressure, and care delivery risk.
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="section">
          <div className="card">Loading executive overview…</div>
        </section>
      ) : error ? (
        <section className="section">
          <div className="card">{error}</div>
        </section>
      ) : (
        <>
          <section className="section">
            <div className="card">
              <div className="welcome-actions" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>Executive overview</strong>
                  <div className="muted">A CFO-facing view of the current operating and financial pulse.</div>
                </div>
              </div>
              <div className="premium-metrics-grid" style={{ marginTop: 12 }}>
                {summary.map((item) => (
                  <div key={item.title} className="metric-card">
                    <div className="metric-label">{item.title}</div>
                    <div className="metric-value">{item.value}</div>
                    <div className="metric-subtitle">{item.subtitle}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="card">
              <strong>Finance pulse</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Collected: {formatCurrency(data?.domains?.finance?.collectedAmount ?? data?.domains?.finance?.revenueToday)} · Approval rate: {formatPercent(data?.domains?.finance?.approvalRate)} · Denial rate: {formatPercent(data?.domains?.finance?.denialRate)}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="card">
              <strong>Care operations</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Beds: {operations.totalBeds ?? 0} · Occupied: {operations.occupiedBeds ?? 0} · Available: {operations.availableBeds ?? 0} · Pending admissions: {operations.pendingAdmissions ?? 0}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="card">
              <strong>Pharmacy and clinical risk</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Pharmacy alerts: {pharmacy.alerts ?? 0} · Pending prescriptions: {pharmacy.pendingPrescriptions ?? 0} · Lab queue: {clinical.pendingLabOrders ?? 0} · Imaging queue: {clinical.pendingImagingStudies ?? 0}
              </div>
            </div>
          </section>

          {Array.isArray(data?.domains?.finance?.actions) && data.domains.finance.actions.length > 0 ? (
            <section className="section">
              <div className="card">
                <strong>Executive actions</strong>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  {data.domains.finance.actions.map((action, index) => (
                    <li key={`${action.title}-${index}`}>
                      <strong>{action.title}</strong>: {action.detail}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
