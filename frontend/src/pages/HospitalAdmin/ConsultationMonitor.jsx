import React, { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";

export default function ConsultationMonitor() {
  const [calls, setCalls] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const data = await apiFetch("/api/appointments/calls");
      setCalls(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setMsg(err?.message || "Could not load consultation monitor.");
      setCalls([]);
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
    }),
    [calls]
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
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="grid info-grid">
          <div className="card"><strong>Requested</strong><div>{summary.requested}</div></div>
          <div className="card"><strong>Active</strong><div>{summary.active}</div></div>
          <div className="card"><strong>Ended</strong><div>{summary.ended}</div></div>
          <div className="card"><strong>Blocked</strong><div>{summary.blocked}</div></div>
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
                  <tr key={call._id}>
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
