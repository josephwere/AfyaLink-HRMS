import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import { useSupportTickets } from "../../hooks/useSupportTickets";

export default function SupportTickets() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    tickets,
    loading,
    busyId,
    message,
    q,
    setQ,
    status,
    setStatus,
    priority,
    setPriority,
    form,
    setForm,
    highlightedTicketId,
    load,
    submit,
    updateTicket,
    exportCsv,
  } = useSupportTickets({ searchParams, user });

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Support Tickets</h2>
          <p className="muted">Track support workload and link tickets to live incidents.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!tickets.length}>
            Export CSV
          </button>
        </div>
      </div>

      {message ? (
        <section className="section"><div className="card"><p className="muted">{message}</p></div></section>
      ) : null}

      <section className="section">
        <div className="card">
          <h3>Open Ticket</h3>
          <form className="form-grid" onSubmit={submit}>
            <label>
              Category
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                <option value="ACCOUNT">ACCOUNT</option>
                <option value="INTEGRATION">INTEGRATION</option>
                <option value="BILLING">BILLING</option>
                <option value="TRAINING">TRAINING</option>
                <option value="CLINICAL">CLINICAL</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>
            <label>
              Priority
              <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </label>
            <label>
              Linked Incident ID (optional)
              <input value={form.linkedIncident} onChange={(e) => setForm((p) => ({ ...p, linkedIncident: e.target.value }))} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Title
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Description
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </label>
            <button type="submit" className="btn primary" disabled={busyId === "create"}>
              {busyId === "create" ? "Saving..." : "Create Ticket"}
            </button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <h3>Ticket Queue</h3>
          <div className="form-row">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search key/title/description" />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All status</option>
              <option value="OPEN">OPEN</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="ESCALATED">ESCALATED</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">All priority</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Title</th>
                  <th>Incident</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket._id} className={String(ticket._id) === String(highlightedTicketId) ? "query-highlight-row" : ""}>
                    <td>{ticket.ticketKey}</td>
                    <td>{ticket.status}</td>
                    <td>{ticket.priority}</td>
                    <td>{ticket.title}</td>
                    <td>{ticket.linkedIncident?.incidentKey || "—"}</td>
                    <td>
                      <div className="form-row">
                        <button type="button" className="btn" disabled={busyId === ticket._id} onClick={() => updateTicket(ticket, { status: "ESCALATED", note: "Escalated by operations" })}>Escalate</button>
                        <button type="button" className="btn" disabled={busyId === ticket._id} onClick={() => updateTicket(ticket, { status: "RESOLVED", note: "Resolved" })}>Resolve</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!tickets.length && (
                  <tr><td colSpan={6} className="muted">No support tickets found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
