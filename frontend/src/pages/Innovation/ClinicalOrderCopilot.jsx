import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { normalizeRole } from "../../utils/normalizeRole";
import apiFetch from "../../utils/apiFetch";
import { getClinicalOrderCopilotSnapshot } from "../../services/platformInnovationApi";

function formatPct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function resolveActionPath(actorRole, item, navigate) {
  if (actorRole === "DOCTOR") return item.actionPath || "/doctor/opd";
  if (["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"].includes(actorRole)) {
    if (item.orderType === "AUTHORIZATION") return "/hospital-admin/claims";
    if (item.orderType === "REFERRAL") return "/hospital-admin/pharmacy-referrals";
    if (item.orderType === "LAB") return "/hospital-admin/appointment-analytics";
    return "/hospital-admin/appointments";
  }
  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole)) {
    if (item.orderType === "AUTHORIZATION") return "/system-admin/revenue-intelligence";
    return "/system-admin/clinical-intelligence";
  }
  return item.actionPath || "/doctor/opd";
}

function resolveDraftsPath(actorRole) {
  if (actorRole === "DOCTOR") return "/doctor/reports-notes";
  if (["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"].includes(actorRole)) {
    return "/hospital-admin/consultation-monitor";
  }
  return "/system-admin/clinical-intelligence";
}

function resolveLabPath(actorRole) {
  if (actorRole === "DOCTOR") return "/doctor/lab-results";
  return "/hospital-admin/appointment-analytics";
}

export default function ClinicalOrderCopilot() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const canSwitchHospital = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole);
  const [hospitalId, setHospitalId] = useState(() => searchParams.get("hospitalId") || "");
  const [snapshot, setSnapshot] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [clientMeta, setClientMeta] = useState(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!canSwitchHospital) return;
    apiFetch("/api/hospitals/marketplace?limit=200")
      .then((res) => setHospitals(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setHospitals([]));
  }, [canSwitchHospital]);

  const loadSnapshot = useCallback(
    async ({ preserveSnapshot = false } = {}) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      setMsg("");
      try {
        const result = await getClinicalOrderCopilotSnapshot({
          hospitalId: hospitalId || undefined,
        });
        if (requestRef.current !== requestId) return;
        setSnapshot(result?.payload || null);
        setClientMeta(result?.clientMeta || null);
      } catch (err) {
        if (requestRef.current !== requestId) return;
        if (!preserveSnapshot) setSnapshot(null);
        setMsg(
          err?.message ||
            "We could not load the clinical order copilot yet. Try again in a moment."
        );
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [hospitalId]
  );

  useEffect(() => {
    loadSnapshot({ preserveSnapshot: false });
  }, [loadSnapshot]);

  const hasSnapshot = Boolean(snapshot);
  const initialLoading = loading && !hasSnapshot;
  const refreshing = loading && hasSnapshot;

  const summary = snapshot?.summary || {};
  const suggestions = snapshot?.suggestions || [];
  const diagnosisSignals = snapshot?.diagnosisSignals || [];
  const topLabOrders = snapshot?.topLabOrders || [];
  const topMedications = snapshot?.topMedications || [];
  const recentEncounters = snapshot?.recentEncounters || [];

  const summaryCards = useMemo(
    () => [
      {
        title: "Recent Encounters",
        value: summary.recentEncounters ?? 0,
        onClick: () => window.scrollTo({ top: 940, behavior: "smooth" }),
      },
      {
        title: "Suggested Orders",
        value: summary.suggestionCount ?? 0,
        onClick: () => window.scrollTo({ top: 520, behavior: "smooth" }),
      },
      {
        title: "Pending Authorizations",
        value: summary.pendingAuthorizations ?? 0,
        onClick: () => navigate(actorRole === "DOCTOR" ? "/doctor/referrals" : "/hospital-admin/claims"),
      },
      {
        title: "Pending Lab Orders",
        value: summary.pendingLabOrders ?? 0,
        onClick: () => navigate(resolveLabPath(actorRole)),
      },
      {
        title: "Open Drafts",
        value: summary.openDrafts ?? 0,
        onClick: () => navigate(resolveDraftsPath(actorRole)),
      },
      {
        title: "Transfers Needing Context",
        value: summary.transfersNeedingContext ?? 0,
        onClick: () => navigate("/hospital-admin/transfer-command-center"),
      },
    ],
    [actorRole, navigate, summary]
  );

  const heroPulses = useMemo(
    () => [
      {
        label: "Suggestion pressure",
        value: summary.suggestionCount ?? 0,
        tone: Number(summary.suggestionCount || 0) > 12 ? "warn" : "good",
        detail: "Review-ready bundles waiting for clinician or admin review.",
      },
      {
        label: "Authorization drag",
        value: summary.pendingAuthorizations ?? 0,
        tone: Number(summary.pendingAuthorizations || 0) > 6 ? "risk" : Number(summary.pendingAuthorizations || 0) > 0 ? "warn" : "good",
        detail: "Orders likely to hit payer or approval friction.",
      },
      {
        label: "Lab demand",
        value: summary.pendingLabOrders ?? 0,
        tone: Number(summary.pendingLabOrders || 0) > 10 ? "warn" : "good",
        detail: "Open lab-driven recommendations still shaping clinical next steps.",
      },
      {
        label: "Draft continuity",
        value: summary.openDrafts ?? 0,
        tone: Number(summary.openDrafts || 0) > 8 ? "warn" : "neutral",
        detail: "Clinical drafts that still need review, completion, or escalation context.",
      },
    ],
    [summary]
  );

  const controlPaths = useMemo(
    () => [
      {
        eyebrow: "Clinical flow",
        title: "Review active care lanes",
        body: "Jump into the primary clinical workspace where staff can act on reviewed suggestions without losing patient context.",
        actionLabel: actorRole === "DOCTOR" ? "Open OPD" : "Open appointments",
        onClick: () => navigate(actorRole === "DOCTOR" ? "/doctor/opd" : "/hospital-admin/appointments"),
      },
      {
        eyebrow: "Payer rail",
        title: "Handle approval friction",
        body: "Move straight to the claims and authorization workspace when payer drag is the real blocker.",
        actionLabel:
          actorRole === "DOCTOR"
            ? "Open referrals"
            : ["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"].includes(actorRole)
            ? "Open claims"
            : "Open revenue intelligence",
        onClick: () =>
          navigate(
            actorRole === "DOCTOR"
              ? "/doctor/referrals"
              : ["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"].includes(actorRole)
              ? "/hospital-admin/claims"
              : "/system-admin/revenue-intelligence"
          ),
      },
      {
        eyebrow: "Lab rail",
        title: "Watch downstream demand",
        body: "Keep lab pressure visible so suggestions do not create bottlenecks for samples, queues, or reporting.",
        actionLabel: "Open lab workflow",
        onClick: () => navigate(resolveLabPath(actorRole)),
      },
      {
        eyebrow: "Transfer context",
        title: "Protect handover continuity",
        body: "When the next decision depends on transfer context, open the command flow without leaving this order-planning frame.",
        actionLabel: "Open transfer center",
        onClick: () => navigate("/hospital-admin/transfer-command-center"),
      },
    ],
    [actorRole, navigate]
  );

  return (
    <div className="dashboard premium-shell clinical-order-copilot-shell innovation-console-page">
      <section className="premium-card premium-shell-head innovation-console-hero">
        <div className="innovation-console-hero-layout">
          <div className="innovation-console-hero-copy">
            <div className="premium-shell-kicker">Structured clinical order co-pilot</div>
            <h1 className="premium-shell-title">Clinical Order Copilot</h1>
            <p className="premium-shell-subtitle">
              Surface review-ready order suggestions, payer friction, lab demand, and recent diagnostic patterns before a clinician or supervisor commits to the next workflow.
            </p>
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
                onClick={() => loadSnapshot({ preserveSnapshot: hasSnapshot })}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="innovation-console-hero-meta">
            {heroPulses.map((item) => (
              <div key={item.label} className={`innovation-console-pulse ${item.tone}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="premium-note-grid">
          <div className="premium-note">
            <strong>Coverage scope</strong>
            <span>{snapshot?.scope?.hospitalId ? "Scoped to selected hospital" : actorRole === "DOCTOR" ? "Scoped to your clinical stream" : "Network-wide oversight"}</span>
          </div>
          <div className="premium-note">
            <strong>Decision style</strong>
            <span>Suggested bundles stay review-first and never auto-place orders.</span>
          </div>
          <div className="premium-note">
            <strong>Best use</strong>
            <span>Use it to shorten order planning, preauth prep, and escalation framing.</span>
          </div>
          <div className="premium-note">
            <strong>Status</strong>
            <span>
              {refreshing
                ? "Updating live data while your current view stays visible."
                : clientMeta?.attempts > 1
                ? `Loaded after ${clientMeta.attempts} attempts.`
                : clientMeta?.loadedAt
                ? `Live sync completed ${formatWhen(clientMeta.loadedAt)}.`
                : "Ready for the first update."}
            </span>
          </div>
        </div>
      </section>

      {initialLoading ? (
        <section className="section">
          <div className="card premium-card innovation-console-state-card">
            <span className="developer-tool-eyebrow">Preparing</span>
            <strong>Preparing live clinical insights</strong>
            <p className="muted">
              We are preparing the first live snapshot. This can take a moment on the first visit.
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
          <button
            type="button"
            className="btn-secondary"
            onClick={() => loadSnapshot({ preserveSnapshot: hasSnapshot })}
          >
            Try again
          </button>
        </div>
      ) : null}

      {refreshing ? (
        <div className="premium-inline-note innovation-console-inline-state">
          <span>Refreshing live clinical signals. The current view stays in place until the new snapshot arrives.</span>
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

          <section className="section">
            <div className="innovation-console-brief-grid">
              <div className="innovation-console-brief-card">
                <span className="innovation-console-brief-badge">Care lane</span>
                <h3>Review before you route</h3>
                <p className="muted">
                  {summary.suggestionCount ?? 0} live suggestion bundles are waiting for a clinician
                  or supervisor review. Keep this lane close when demand rises faster than staffing.
                </p>
              </div>
              <div className="innovation-console-brief-card">
                <span className="innovation-console-brief-badge">Safety rail</span>
                <h3>Guardrails stay human-first</h3>
                <p className="muted">
                  Suggestions can accelerate prep, but they never auto-place orders. Confidence and
                  recent patient context stay visible before anyone commits.
                </p>
              </div>
              <div className="innovation-console-brief-card">
                <span className="innovation-console-brief-badge">Revenue continuity</span>
                <h3>Watch payer drag early</h3>
                <p className="muted">
                  {summary.pendingAuthorizations ?? 0} active authorization blockers are already
                  visible here, so teams can fix payer friction before it stalls treatment flow.
                </p>
              </div>
            </div>
          </section>

          <section className="section revenue-alert-grid">
            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Review-Ready Suggestions</h3>
                  <p className="muted">These are draft suggestions, not automatic orders. Confidence helps triage review priority.</p>
                </div>
                <div className="action-pill">{suggestions.length} active suggestions</div>
              </div>
              <div className="revenue-action-list">
                {suggestions.length ? (
                  suggestions.map((item) => (
                    <div key={`${item.orderType}-${item.title}`} className="revenue-action-card watch">
                      <div className="card-header-actions">
                        <div>
                          <strong>{item.title}</strong>
                          <p className="muted">{item.orderType} • {item.diagnosis || "Pattern-based"}</p>
                        </div>
                        <span className="action-pill">{formatPct(item.confidence)}</span>
                      </div>
                      <p className="muted">{item.reason}</p>
                      <div className="doctor-actions-row" style={{ marginTop: 10 }}>
                        <span className="action-pill">{item.recentCount || 0} related encounters</span>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => navigate(resolveActionPath(actorRole, item, navigate))}
                        >
                          Open workflow
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="developer-empty-state compact">
                    <strong>No suggested order bundles right now.</strong>
                    <p className="muted">When live encounter pressure rises, review-ready bundles will appear here first.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Signal Summary</h3>
                  <p className="muted">Top diagnostic pressure and ordering demand from the last 30 days.</p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate(actorRole === "DOCTOR" ? "/doctor/opd" : "/hospital-admin/appointments")}
                >
                  Open source workflows
                </button>
              </div>
              <div className="panel-grid" style={{ marginTop: 12 }}>
                <div className="card premium-card compact-card">
                  <h4>Top Diagnoses</h4>
                  <div className="signal-chip-grid">
                    {diagnosisSignals.map((item) => (
                      <span key={item.diagnosis} className="action-pill">
                        {item.diagnosis} • {item.count}
                      </span>
                    ))}
                    {!diagnosisSignals.length ? (
                      <div className="developer-empty-state compact">
                        <strong>No diagnosis signals yet.</strong>
                        <p className="muted">Recent encounter patterns will accumulate here as the order graph becomes busier.</p>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="card premium-card compact-card">
                  <h4>Top Medications</h4>
                  <div className="signal-chip-grid">
                    {topMedications.map((item) => (
                      <span key={item.name} className="action-pill">
                        {item.name} • {item.count}
                      </span>
                    ))}
                    {!topMedications.length ? (
                      <div className="developer-empty-state compact">
                        <strong>No medication pressure yet.</strong>
                        <p className="muted">Medication demand appears here when live ordering patterns start to cluster.</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section revenue-panel-grid">
            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Top Lab Bundles</h3>
                  <p className="muted">Which test groups are most active, and how much pending backlog they carry.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate(resolveLabPath(actorRole))}>
                  Lab workflow
                </button>
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table premium-table">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Total Orders</th>
                      <th>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLabOrders.map((row) => (
                      <tr key={row.testName}>
                        <td>{row.testName || "Unspecified test"}</td>
                        <td>{row.count}</td>
                        <td>{row.pending}</td>
                      </tr>
                    ))}
                    {!topLabOrders.length ? (
                      <tr>
                        <td colSpan={3}>No lab demand data yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card premium-card">
              <div className="card-header-actions">
                <div>
                  <h3>Recent Encounter Context</h3>
                  <p className="muted">A lightweight context rail so order reviews stay grounded in the active patient story.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => navigate(actorRole === "DOCTOR" ? "/doctor/patients" : "/hospital-admin/consultation-monitor")}>
                  Open live context
                </button>
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table premium-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Diagnosis</th>
                      <th>State</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEncounters.map((row) => (
                      <tr key={row._id}>
                        <td>
                          <div>{row.patientName}</div>
                          <div className="muted">{row.hospitalName}</div>
                        </td>
                        <td>{row.diagnosis}</td>
                        <td>{row.state}</td>
                        <td>{formatWhen(row.createdAt)}</td>
                      </tr>
                    ))}
                    {!recentEncounters.length ? (
                      <tr>
                        <td colSpan={4}>No encounter context yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="card-header-actions">
              <div>
                <h3>Control Paths</h3>
                <p className="muted">Keep the next operational move one click away, even when the console is quiet.</p>
              </div>
            </div>
            <div className="developer-tool-grid innovation-console-tool-grid">
              {controlPaths.map((item) => (
                <div key={item.title} className="developer-tool-card">
                  <span className="developer-tool-eyebrow">{item.eyebrow}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <div className="developer-inline-actions compact">
                    <button type="button" className="btn-secondary" onClick={item.onClick}>
                      {item.actionLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
