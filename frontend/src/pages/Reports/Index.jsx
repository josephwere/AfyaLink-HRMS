import React from "react";
import { useReportsPage } from "../../hooks/useReportsPage";

export default function Reports() {
  const {
    canSeeAll,
    canCreate,
    canSeeMine,
    current,
    canLoadMore,
    loadingMore,
    tab,
    setTab,
    error,
    transfers,
    transferError,
    form,
    setForm,
    onCreate,
    onDelete,
    onLoadMore,
  } = useReportsPage();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Reports</h2>
          <p className="muted">Clinical and operational reporting.</p>
        </div>
      </div>

      {error && <div className="card">{error}</div>}

      <section className="section">
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
          <div className="table-wrap" style={{ marginTop: 12 }}>
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

      <section className="section">
        <div className="action-list">
          {canSeeAll && (
            <button type="button"
              className={`action-pill ${tab === "all" ? "active" : ""}`}
              onClick={() => setTab("all")}
            >
              All Reports
            </button>
          )}
          {canSeeMine && (
            <button type="button"
              className={`action-pill ${tab === "mine" ? "active" : ""}`}
              onClick={() => setTab("mine")}
            >
              My Reports
            </button>
          )}
        </div>
      </section>

      {canCreate && (
        <section className="section">
          <h3>Create Report</h3>
          <div className="card form">
            <label>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <label>Patient ID (optional)</label>
            <input
              value={form.patient}
              onChange={(e) => setForm((f) => ({ ...f, patient: e.target.value }))}
            />
            <label>Content</label>
            <textarea
              rows={5}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
            <button type="button" className="btn-primary" onClick={onCreate}>
              Create Report
            </button>
          </div>
        </section>
      )}

      <section className="section">
        <h3>{tab === "all" ? "All Reports" : "My Reports"}</h3>
        <div className="card">
          {current.length === 0 ? (
            <div className="muted">No reports found.</div>
          ) : (
            <div className="report-list">
              {current.map((r) => (
                <div key={r._id} className="report-item">
                  <div>
                    <div className="report-title">{r.title || "Untitled"}</div>
                    <div className="muted">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                    </div>
                    {r.content && (
                      <div className="report-content">
                        {String(r.content).slice(0, 200)}
                      </div>
                    )}
                  </div>
                  {canSeeAll && (
                    <button type="button"
                      className="btn-secondary"
                      onClick={() => onDelete(r._id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {canLoadMore && (
            <div style={{ marginTop: 12 }}>
              <button type="button"
                className="btn-secondary"
                disabled={loadingMore}
                onClick={onLoadMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
