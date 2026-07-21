import React from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useComplianceCenter } from "../../hooks/useComplianceCenter";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function ComplianceCenter() {
  const navigate = useNavigate();
  const {
    data,
    loading,
    loadError,
    statusMessage,
    clientMeta,
    saving,
    releasingId,
    form,
    setForm,
    load,
    hasData,
    initialLoading,
    refreshing,
    settings,
    activeHolds,
    recentHolds,
    evidencePacks,
    summaryCards,
    createHold,
    releaseHold,
  } = useComplianceCenter();
  const privacyTemplates = Object.entries(settings?.privacyTemplates || {});

  const summary = data?.auditSummary || {};

  return (
    <div className="dashboard premium-shell compliance-center-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Formal compliance center</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Compliance Center</h1>
            <p className="premium-shell-subtitle">
              Manage legal holds, retention rules, privacy templates, and evidence packs from one founder-grade compliance workspace.
            </p>
          </div>
          <div className="welcome-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => load({ preserveData: hasData })}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate("/super-admin/settings")}>Policy settings</button>
          </div>
        </div>
        <div className="premium-note-grid">
          <div className="premium-note">
            <strong>Default region</strong>
            <span>{settings.defaultRegion || "KE"}</span>
          </div>
          <div className="premium-note">
            <strong>Sensitive exports</strong>
            <span>{settings.requireStepUpForSensitiveExports === false ? "Step-up disabled" : "Step-up required"}</span>
          </div>
          <div className="premium-note">
            <strong>Regional notice</strong>
            <span>{settings.requireRegionalPrivacyNotice === false ? "Optional" : "Required"}</span>
          </div>
          <div className="premium-note">
            <strong>Status</strong>
            <span>
              {refreshing
                ? "Updating live data while your current view stays visible."
                : clientMeta?.attempts > 1
                ? `Loaded after ${clientMeta.attempts} attempts.`
                : clientMeta?.loadedAt
                ? `Live sync completed ${formatDate(clientMeta.loadedAt)}.`
                : "Ready for the first update."}
            </span>
          </div>
        </div>
      </section>

      {initialLoading ? (
        <section className="section">
          <div className="card premium-card innovation-console-state-card">
            <span className="developer-tool-eyebrow">Preparing</span>
            <strong>Preparing live compliance posture</strong>
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

      {loadError ? (
        <div className="premium-inline-note innovation-console-inline-state innovation-console-inline-state-warn">
          <span>{loadError}</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => load({ preserveData: hasData })}
          >
            Try again
          </button>
        </div>
      ) : null}

      {statusMessage ? <div className="premium-inline-note">{statusMessage}</div> : null}

      {refreshing ? (
        <div className="premium-inline-note innovation-console-inline-state">
          <span>
            Refreshing live compliance posture. The current workspace stays visible until the new
            snapshot arrives.
          </span>
          <span className="action-pill">Live sync in progress</span>
        </div>
      ) : null}

      {hasData ? (
        <>
          <section className="section">
            <div className="grid info-grid">
              {summaryCards.map((card) => (
                <StatCard key={card.title} title={card.title} value={card.value} onClick={card.onClick} />
              ))}
            </div>
          </section>

          <section className="section compliance-panel-grid">
            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Policy Library</h3>
                  <p className="muted">The live compliance rules now shaping retention, export controls, and family/legal workflows.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/regulatory-reports")}>Regulatory reports</button>
              </div>
              <div className="panel-grid" style={{ marginTop: 12 }}>
                <div className="card premium-card">
                  <h4>Retention rules</h4>
                  <p className="muted">Audit logs: {settings.auditRetentionDays ?? 365} days</p>
                  <p className="muted">Messaging: {settings.messagingRetentionDays ?? 180} days</p>
                  <p className="muted">Evidence packs: {settings.evidencePackRetentionDays ?? 365} days</p>
                  <p className="muted">Clinical records: {settings.clinicalRecordRetentionYears ?? 7} years</p>
                </div>
                <div className="card premium-card">
                  <h4>Control flags</h4>
                  <p className="muted">Legal-hold reason required: {settings.requireLegalHoldReason === false ? "No" : "Yes"}</p>
                  <p className="muted">Regional notice required: {settings.requireRegionalPrivacyNotice === false ? "No" : "Yes"}</p>
                  <p className="muted">Sensitive export step-up: {settings.requireStepUpForSensitiveExports === false ? "No" : "Yes"}</p>
                </div>
              </div>
            </div>

            <form className="card premium-card form" onSubmit={createHold}>
              <div className="card-header-actions">
                <div>
                  <h3>Create Legal Hold</h3>
                  <p className="muted">Freeze records across a scope when litigation, regulatory review, or formal investigation begins.</p>
                </div>
                <div className="action-pill">Protected write</div>
              </div>
              <input placeholder="Hold title" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
              <div className="grid info-grid" style={{ gap: 12 }}>
                <select value={form.region} onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}>
                  {["DEFAULT", "KE", "UG", "TZ"].map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
                <select value={form.scopeType} onChange={(e) => setForm((prev) => ({ ...prev, scopeType: e.target.value }))}>
                  {["SYSTEM", "HOSPITAL", "PATIENT", "CLAIM", "EXPORT", "LEGAL_REQUEST"].map((scope) => <option key={scope} value={scope}>{scope}</option>)}
                </select>
                <input placeholder="Scope reference" value={form.scopeRef} onChange={(e) => setForm((prev) => ({ ...prev, scopeRef: e.target.value }))} />
                <input type="number" min="1" placeholder="Retention override days" value={form.retentionOverrideDays} onChange={(e) => setForm((prev) => ({ ...prev, retentionOverrideDays: e.target.value }))} />
              </div>
              <input placeholder="Legal basis or case reference" value={form.legalBasis} onChange={(e) => setForm((prev) => ({ ...prev, legalBasis: e.target.value }))} />
              <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
              <button type="submit" className="btn-primary" disabled={saving || !form.title.trim()}>
                {saving ? "Creating..." : "Create Legal Hold"}
              </button>
            </form>
          </section>

          <section className="section compliance-panel-grid">
            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Active Legal Holds</h3>
                  <p className="muted">Anything here overrides normal retention behavior until a release is recorded.</p>
                </div>
                <div className="action-pill">{activeHolds.length} active</div>
              </div>
              <div className="compliance-hold-list">
                {activeHolds.length ? (
                  activeHolds.map((hold) => (
                    <div key={hold._id} className="compliance-hold-card">
                      <div className="card-header-actions">
                        <div>
                          <strong>{hold.title}</strong>
                          <p className="muted">{hold.scopeType} • {hold.region} • {formatDate(hold.createdAt)}</p>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => releaseHold(hold._id)}
                          disabled={releasingId === hold._id}
                        >
                          {releasingId === hold._id ? "Releasing..." : "Release"}
                        </button>
                      </div>
                      {hold.description ? <p className="muted">{hold.description}</p> : null}
                      <div className="patient-language-chips">
                        {hold.legalBasis ? <span className="action-pill">{hold.legalBasis}</span> : null}
                        {hold.scopeRef ? <span className="action-pill">{hold.scopeRef}</span> : null}
                        {hold.retentionOverrideDays ? <span className="action-pill">Override {hold.retentionOverrideDays} days</span> : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="muted">No active legal holds.</div>
                )}
              </div>
            </div>

            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Regional Privacy Templates</h3>
                  <p className="muted">Founder-configured notices that should appear when users operate under different jurisdictions.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate("/super-admin/settings")}>Edit templates</button>
              </div>
              <div className="panel-grid" style={{ marginTop: 12 }}>
                {privacyTemplates.length ? (
                  privacyTemplates.map(([code, template]) => (
                    <div key={code} className="card premium-card">
                      <h4>{template?.label || code}</h4>
                      <p className="muted"><strong>{template?.noticeTitle || "Notice"}</strong></p>
                      <p className="muted">{template?.consentSummary || "No summary configured yet."}</p>
                      <p className="muted">Breach contact: {template?.breachContact || "Not set"}</p>
                      <div className="action-pill">{template?.enabled === false ? "Disabled" : "Active"}</div>
                    </div>
                  ))
                ) : (
                  <div className="muted">No privacy templates configured yet.</div>
                )}
              </div>
            </div>
          </section>

          <section className="section compliance-panel-grid">
            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Evidence Packs</h3>
                  <p className="muted">Latest generated compliance evidence bundles available for export.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate("/admin/audit-logs")}>Audit logs</button>
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table premium-table">
                  <thead>
                    <tr>
                      <th>Pack</th>
                      <th>Generated</th>
                      <th>Manifest</th>
                      <th>README</th>
                      <th>Checklist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidencePacks.map((pack) => (
                      <tr key={pack.id}>
                        <td>{pack.id}</td>
                        <td>{formatDate(pack.generatedAt)}</td>
                        <td>{pack.hasManifest ? "Yes" : "No"}</td>
                        <td>{pack.hasReadme ? "Yes" : "No"}</td>
                        <td>{pack.commandCount}</td>
                      </tr>
                    ))}
                    {!evidencePacks.length ? (
                      <tr>
                        <td colSpan={5}>No evidence packs found yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Recent Hold Activity</h3>
                  <p className="muted">Latest create/release actions to support fast legal and compliance review.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/regulatory-reports")}>Open reports</button>
              </div>
              <div className="compliance-hold-list">
                {recentHolds.length ? (
                  recentHolds.map((hold) => (
                    <div key={hold._id} className="compliance-hold-card compact">
                      <strong>{hold.title}</strong>
                      <p className="muted">{hold.status} • {hold.scopeType} • {hold.region}</p>
                      <p className="muted">Created: {formatDate(hold.createdAt)}</p>
                      {hold.releasedAt ? <p className="muted">Released: {formatDate(hold.releasedAt)}</p> : null}
                    </div>
                  ))
                ) : (
                  <div className="muted">No recent hold activity yet.</div>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
