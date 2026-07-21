import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import useSuperAssistants from "../../hooks/useSuperAssistants";
import AccessDeniedCard from "../../components/AccessDeniedCard";

export default function SuperAssistants() {
  const navigate = useNavigate();
  const {
    canManage,
    items,
    summary,
    loading,
    saving,
    msg,
    supportMessage,
    supportLoading,
    selectedId,
    setSelectedId,
    selectedRows,
    setSelectedRows,
    supportTickets,
    supportSummary,
    bulkAction,
    setBulkAction,
    bulkStatus,
    setBulkStatus,
    filters,
    setFilters,
    draftFilters,
    setDraftFilters,
    editForm,
    setEditForm,
    tableSectionRef,
    load,
    loadSupportQueue,
    onSave,
    toggleActive,
    sendInviteOrReset,
    applyBulkAction,
    toggleRowSelection,
    allVisibleSelected,
    focusManagementTable,
    openSupportTickets,
    applySummaryView,
  } = useSuperAssistants();

  if (!canManage) return <AccessDeniedCard message="Human super assistant management is limited to founder and system admin roles." />;

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Customer Support Command</h2>
          <p className="muted">Run customer support across human assistants, AI channels, ticket queues, and handoff controls from one operations view.</p>
        </div>
        <div className="welcome-actions">
          <Link to="/app/platform/ai/unified-assistant" className="btn-secondary">Unified Workspace</Link>
          <Link to="/admin/create-admin" className="btn-primary">Register Super Assistant</Link>
          <button type="button" className="btn-secondary" onClick={() => { load(filters, selectedId); loadSupportQueue(); }} disabled={loading || supportLoading}>
            {loading || supportLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="grid info-grid">
          <StatCard title="Human Agents" value={summary.total} onClick={() => applySummaryView('total')} />
          <StatCard title="Active Access" value={summary.active} />
          <StatCard title="Open Tickets" value={supportSummary.open} onClick={() => openSupportTickets(navigate, { status: 'OPEN' })} />
          <StatCard title="Escalated Queue" value={supportSummary.escalated} onClick={() => openSupportTickets(navigate, { status: 'ESCALATED' })} />
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="table-wrap">
            <table className="doctor-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input type="checkbox" checked={allVisibleSelected} onChange={() => {
                      if (allVisibleSelected) { setSelectedRows({}); return; }
                      const next = {}; items.forEach((r) => (next[String(r._id)] = true)); setSelectedRows(next);
                    }} />
                  </th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const id = String(row._id);
                  const isSelected = id === String(selectedId);
                  return (
                    <tr key={id} onClick={() => setSelectedId(id)} style={isSelected ? { background: 'rgba(37,99,235,0.06)' } : undefined}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={Boolean(selectedRows[id])} onChange={() => toggleRowSelection(id)} />
                      </td>
                      <td>
                        <strong>{row.name || 'Unnamed'}</strong>
                        <div className="muted">{row.email || 'No email'}</div>
                      </td>
                      <td>{row.active === false ? 'Disabled' : (row?.systemProfile?.status || 'ACTIVE')}</td>
                      <td>{row?.sessionSecurity?.lastLoginAt ? new Date(row.sessionSecurity.lastLoginAt).toLocaleString() : '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="welcome-actions">
                          <button type="button" className="btn-secondary" onClick={() => toggleActive(row)} disabled={saving}>{row.active === false ? 'Enable' : 'Disable'}</button>
                          <button type="button" className="btn-secondary" onClick={() => sendInviteOrReset(row)} disabled={saving || !row.email}>{row?.activityMetrics?.bucket === 'NEVER_LOGGED_IN' ? 'Invite' : 'Reset'}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!items.length && (
                  <tr><td colSpan={5} className="muted">No super assistants found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section" ref={tableSectionRef}>
        <div className="card">
          <h3>Assistant Access</h3>
          {selectedId ? (
            <form className="form" onSubmit={onSave} style={{ marginTop: 12 }}>
              <label>Name<input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} /></label>
              <label>Email<input value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} /></label>
              <label>Phone<input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} /></label>
              <label><input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm((p) => ({ ...p, active: e.target.checked }))} /> Account enabled</label>
              <div className="welcome-actions"><button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div>
            </form>
          ) : (
            <div className="muted">Select an assistant to view and edit details.</div>
          )}
        </div>
      </section>
    </div>
  );
}
