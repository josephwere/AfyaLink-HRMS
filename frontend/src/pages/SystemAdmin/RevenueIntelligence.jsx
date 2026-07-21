import React from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useRevenueIntelligence } from "../../hooks/useRevenueIntelligence";

function formatMoney(value) {
  return Number(value || 0).toLocaleString();
}

function formatPct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function severityClass(severity) {
  switch (String(severity || "").toUpperCase()) {
    case "HIGH":
      return "warn";
    case "MEDIUM":
      return "watch";
    default:
      return "ok";
  }
}

export default function RevenueIntelligence() {
  const navigate = useNavigate();
  const {
    hospitalId,
    setHospitalId,
    setSearchParams,
    canSwitchHospital,
    snapshot,
    hospitals,
    loading,
    msg,
    clientMeta,
    load,
    hasSnapshot,
    initialLoading,
    refreshing,
    summary,
    actions,
    payerMix,
    overdueInvoices,
    topDenialReasons,
    preauthSummary,
    hospitalComparisons,
    summaryCards,
  } = useRevenueIntelligence();

  return (
    <div className="dashboard premium-shell revenue-intelligence-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Revenue-cycle intelligence</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Revenue Intelligence Center</h1>
            <p className="premium-shell-subtitle">
              Monitor denial pressure, prior-authorization backlog, collection speed, and payer mix from one premium revenue workspace.
            </p>
          </div>
          <div className="welcome-actions">
            {canSwitchHospital ? (
              <select
                value={hospitalId}
                onChange={(e) => {
                  const next = e.target.value;
                  setHospitalId(next);
                  setSearchParams(next ? { hospitalId: next } : {});
                }}
              >
                <option value="">All hospitals</option>
                {hospitals.map((hospital) => (
                  <option key={hospital._id} value={hospital._id}>
                    {hospital.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => load({ preserveSnapshot: hasSnapshot })}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
        <div className="premium-note-grid">
          <div className="premium-note">
            <strong>Scope</strong>
            <span>{snapshot?.scope?.hospitalName || "Revenue scope loading..."}</span>
          </div>
          <div className="premium-note">
            <strong>Risk threshold</strong>
            <span>{snapshot?.config?.denialRiskThreshold ?? 65} risk score and above is flagged.</span>
          </div>
          <div className="premium-note">
            <strong>Target</strong>
            <span>{snapshot?.config?.targetCollectionDays ?? 7}-day collection target and {snapshot?.config?.preauthPendingSlaHours ?? 24}-hour preauth SLA.</span>
          </div>
          <div className="premium-note">
            <strong>Status</strong>
            <span>
              {refreshing
                ? "Updating live data while your current view stays visible."
                : clientMeta?.attempts > 1
                ? `Loaded after ${clientMeta.attempts} attempts.`
                : clientMeta?.loadedAt
                ? `Live sync completed ${new Date(clientMeta.loadedAt).toLocaleString()}.`
                : "Ready for the first update."}
            </span>
          </div>
        </div>
      </section>

      {initialLoading ? (
        <section className="section">
          <div className="card premium-card innovation-console-state-card">
            <span className="developer-tool-eyebrow">Preparing</span>
            <strong>Preparing live revenue signals</strong>
            <p className="muted">
              We are preparing the first snapshot. This can take a moment on the first visit.
            </p>
            <div className="innovation-console-skeleton-grid" aria-hidden="true">
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
            </div>
          </div>
        </section>
      ) : null}

      {msg ? (
        <div className="premium-inline-note innovation-console-inline-state innovation-console-inline-state-warn">
          <span>{msg}</span>
          <button type="button" className="btn-secondary" onClick={() => load({ preserveSnapshot: hasSnapshot })}>
            Try again
          </button>
        </div>
      ) : null}

      {refreshing ? (
        <div className="premium-inline-note innovation-console-inline-state">
          <span>Refreshing live revenue signals. The current workspace stays visible until the new snapshot arrives.</span>
          <span className="action-pill">Live sync in progress</span>
        </div>
      ) : null}

      {hasSnapshot ? (
        <>
          <section className="section">
            <div className="grid info-grid">
              {summaryCards.map((card) => (
                <StatCard key={card.title} title={card.title} value={card.value} onClick={card.onClick} />
              ))}
            </div>
          </section>

          <section className="section revenue-alert-grid">
            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Recommended Actions</h3>
                  <p className="muted">The highest-value next moves based on live claim and invoice pressure.</p>
                </div>
                <div className="action-pill">{actions.length} live actions</div>
              </div>
              <div className="revenue-action-list">
                {actions.length ? (
                  actions.map((item) => (
                    <div key={`${item.severity}-${item.title}`} className={`revenue-action-card ${severityClass(item.severity)}`}>
                      <div className="card-header-actions">
                        <strong>{item.title}</strong>
                        <span className={`action-pill ${severityClass(item.severity)}`}>{item.severity}</span>
                      </div>
                      <p className="muted">{item.detail}</p>
                    </div>
                  ))
                ) : (
                  <div className="developer-empty-state compact">
                    <strong>No urgent revenue actions right now.</strong>
                    <p className="muted">This lane stays quiet until claims, invoices, or preauth queues create new pressure.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Config Snapshot</h3>
                  <p className="muted">These guardrails come from founder/system settings and stay durable across deploys.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate("/super-admin/settings")}>Revenue policy</button>
              </div>
              <div className="premium-note-grid" style={{ marginTop: 12 }}>
                <div className="premium-note">
                  <strong>Overdue invoices</strong>
                  <span>{snapshot?.config?.overdueInvoiceDays ?? 14} days</span>
                </div>
                <div className="premium-note">
                  <strong>Preauth SLA</strong>
                  <span>{snapshot?.config?.preauthPendingSlaHours ?? 24} hours</span>
                </div>
                <div className="premium-note">
                  <strong>Auto-flag risk</strong>
                  <span>{snapshot?.config?.autoFlagHighRiskClaims === false ? "Disabled" : "Enabled"}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="section revenue-panel-grid">
            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Payer Mix</h3>
                  <p className="muted">Which payers carry the most volume and denial pressure.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/claims")}>Claims dashboard</button>
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table premium-table">
                  <thead>
                    <tr>
                      <th>Payer</th>
                      <th>Claims</th>
                      <th>Share</th>
                      <th>Denial Rate</th>
                      <th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payerMix.map((row) => (
                      <tr key={row.providerCode}>
                        <td>{row.providerCode}</td>
                        <td>{row.claims}</td>
                        <td>{formatPct(row.shareOfClaims)}</td>
                        <td>{formatPct(row.denialRate)}</td>
                        <td>{formatMoney(row.totalAmount)}</td>
                      </tr>
                    ))}
                    {!payerMix.length ? (
                      <tr>
                        <td colSpan={5}>No payer mix data yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Top Denial Signals</h3>
                  <p className="muted">The rule and signal patterns creating the most friction.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/fraud-guard")}>Fraud guard</button>
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table premium-table">
                  <thead>
                    <tr>
                      <th>Signal</th>
                      <th>Total</th>
                      <th>Rejected</th>
                      <th>Review Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDenialReasons.map((row) => (
                      <tr key={row.code}>
                        <td>{row.code}</td>
                        <td>{row.count}</td>
                        <td>{row.rejectedCount}</td>
                        <td>{row.reviewCount}</td>
                      </tr>
                    ))}
                    {!topDenialReasons.length ? (
                      <tr>
                        <td colSpan={4}>No denial signals recorded yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="section revenue-panel-grid">
            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Overdue Invoices</h3>
                  <p className="muted">Old receivables that need follow-up before they turn into write-offs.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/financials")}>Financials</button>
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table premium-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Hospital</th>
                      <th>Age</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueInvoices.map((row) => (
                      <tr key={row.invoiceId || `${row.hospitalName}-${row.ageDays}`}>
                        <td>{row.invoiceNumber || row.invoiceId || "—"}</td>
                        <td>{row.hospitalName || "—"}</td>
                        <td>{row.ageDays ?? 0} days</td>
                        <td>{formatMoney(row.total || row.amount)}</td>
                      </tr>
                    ))}
                    {!overdueInvoices.length ? (
                      <tr>
                        <td colSpan={4}>No overdue invoices right now.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Prior Authorization Backlog</h3>
                  <p className="muted">Pending authorizations that are slowing revenue release.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/claims")}>Open claims</button>
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table premium-table">
                  <thead>
                    <tr>
                      <th>Payer</th>
                      <th>Total</th>
                      <th>Pending</th>
                      <th>Approved</th>
                      <th>Approval Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preauthSummary.map((row) => (
                      <tr key={row.providerCode || row.category}>
                        <td>{row.providerCode || row.category || "General"}</td>
                        <td>{row.total ?? row.totalCount ?? 0}</td>
                        <td>{row.pending ?? row.pendingCount ?? 0}</td>
                        <td>{row.approved ?? row.approvedCount ?? 0}</td>
                        <td>{formatPct(row.approvalRate ?? row.shareApproved)}</td>
                      </tr>
                    ))}
                    {!preauthSummary.length ? (
                      <tr>
                        <td colSpan={5}>No prior authorization data yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {!hospitalId && hospitalComparisons.length ? (
            <section className="section">
              <div className="card premium-card">
                <div className="card-header-actions">
                  <div>
                    <h3>Hospital Comparison</h3>
                    <p className="muted">Spot facilities with the heaviest denial pressure across the network.</p>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/government-claims")}>Government claims</button>
                </div>
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="table premium-table">
                    <thead>
                      <tr>
                        <th>Hospital</th>
                        <th>Claims</th>
                        <th>Approval Rate</th>
                        <th>Denial Rate</th>
                        <th>Review Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hospitalComparisons.map((row) => (
                        <tr key={row.hospitalId || row.hospitalName}>
                          <td>{row.hospitalName}</td>
                          <td>{row.claims}</td>
                          <td>{formatPct(row.approvalRate)}</td>
                          <td>{formatPct(row.denialRate)}</td>
                          <td>{row.reviewRequired}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
