import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import { StatCard } from "../../components/Cards";
import { getHospitalAdminDashboard } from "../../services/dashboardApi";

export default function ConsultationMonitor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [calls, setCalls] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [filter, setFilter] = useState(() => searchParams.get("status") || "ALL");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const highlightedCallId = searchParams.get("callId") || "";

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const [data, dashboard] = await Promise.all([
        apiFetch("/api/appointments/calls"),
        getHospitalAdminDashboard(),
      ]);
      setCalls(Array.isArray(data?.items) ? data.items : []);
      setEscalations(Array.isArray(dashboard?.escalationSummary?.items) ? dashboard.escalationSummary.items : []);
    } catch (err) {
      setMsg(err?.message || "Could not load consultation monitor.");
      setCalls([]);
      setEscalations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const visibleCalls = useMemo(() => {
    if (filter === "ALL") return calls;
    return calls.filter((call) => String(call.status) === filter);
  }, [calls, filter]);

  const summary = useMemo(
    () => ({
      requested: calls.filter((call) => call.status === "REQUESTED").length,
      active: calls.filter((call) => call.status === "ACTIVE").length,
      ended: calls.filter((call) => call.status === "ENDED").length,
      blocked: calls.filter((call) => call.status === "TERMINATED" || call.isBlocked).length,
      wardEscalations: escalations.filter((item) => !item.resolvedAt).length,
    }),
    [calls, escalations]
  );

  const blockCall = async (callId) => {
    try {
      await apiFetch(`/api/appointments/calls/${callId}/block`, {
        method: "PATCH",
        body: { reason: "Blocked from consultation monitor" },
      });
      setMsg("Call blocked.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Could not block call.");
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Consultation Monitor</h2>
          <p className="muted">Live hospital view for requested, active, completed, and blocked consultation calls.</p>
        </div>
        <div className="welcome-actions">
          <Link className="btn-secondary" to="/hospital-admin/escalations">
            Open Escalation Queue
          </Link>
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="grid info-grid">
          <StatCard title="Requested" value={summary.requested} onClick={() => setFilter("REQUESTED")} />
          <StatCard title="Active" value={summary.active} onClick={() => setFilter("ACTIVE")} />
          <StatCard title="Ended" value={summary.ended} onClick={() => setFilter("ENDED")} />
          <StatCard title="Blocked" value={summary.blocked} onClick={() => setFilter("TERMINATED")} />
          <StatCard title="Ward Escalations" value={summary.wardEscalations} onClick={() => navigate("/hospital-admin/escalations?status=OPEN")} />
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <label>Filter</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">All Calls</option>
            <option value="REQUESTED">Requested</option>
            <option value="ACTIVE">Active</option>
            <option value="ENDED">Ended</option>
            <option value="TERMINATED">Blocked / Terminated</option>
          </select>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>Ward Escalations</h3>
              <p className="muted">Nurse-raised blockers that need clinician or operations follow-up.</p>
            </div>
            <div className="action-pill warning">Open: {summary.wardEscalations}</div>
          </div>
          <div className="alert-stack" style={{ marginTop: 12 }}>
            {escalations.slice(0, 8).map((item) => (
              <div key={item.id} className="card">
                <div className="card-header-actions">
                  <div>
                    <strong>{item.patientName}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {item.resolvedAt ? "Resolved" : "Needs follow-up"}
                      {item.missingRequirements?.length ? ` • Missing: ${item.missingRequirements.join(", ")}` : ""}
                    </div>
                  </div>
                  <div className={`action-pill${item.resolvedAt ? "" : " warning"}`}>
                    {item.resolvedAt ? "Resolved" : "Open"}
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>{item.body || item.title}</p>
                <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                  <Link className="btn-secondary" to={item.path || "/hospital-admin/ward-board"}>
                    Open Workflow
                  </Link>
                </div>
              </div>
            ))}
            {!escalations.length ? <div className="action-pill">No ward escalations in this hospital.</div> : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Service</th>
                  <th>Started</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCalls.map((call) => (
                  <tr key={call._id} className={String(call._id) === String(highlightedCallId) ? "query-highlight-row" : ""}>
                    <td>{call.callType}</td>
                    <td>{call.status}</td>
                    <td>
                      {call.patient?.firstName
                        ? `${call.patient.firstName} ${call.patient.lastName || ""}`.trim()
                        : "Patient"}
                    </td>
                    <td>{call.doctor?.name || "Doctor"}</td>
                    <td>{call.appointment?.serviceType || "Consultation"}</td>
                    <td>{call.startedAt ? new Date(call.startedAt).toLocaleString() : "—"}</td>
                    <td>
                      <div className="doctor-actions-row">
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={call.status === "TERMINATED" || call.isBlocked}
                          onClick={() => blockCall(call._id)}
                        >
                          Block
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleCalls.length && (
                  <tr>
                    <td colSpan={7} className="muted">No calls in this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
