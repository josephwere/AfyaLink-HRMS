import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import { useNotificationsPage } from "../../hooks/useNotificationsPage";

export default function Page() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleLabel = String(user?.actualRole || user?.role || "your role");
  const {
    navigate: navigateTo,
    canTrainingOps,
    canMachineOps,
    canSlaOps,
    canPharmacyOps,
    items,
    loading,
    category,
    setCategory,
    read,
    setRead,
    msg,
    setMsg,
    markAllRead,
    toggleNotification,
  } = useNotificationsPage({ user, location, navigate });

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Notifications</h2>
          <p className="muted">Recent workflow and system updates.</p>
        </div>
        <div className="welcome-actions">
          {canTrainingOps && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigateTo("/admin/training-tracker?overdue=1")}
            >
              Open Overdue Tracker
            </button>
          )}
          {canMachineOps && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigateTo("/hospital-admin/machine-alerts")}
            >
              Open Machine Alerts
            </button>
          )}
          {canSlaOps && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigateTo("/hospital-admin/approvals?view=breached#pending")}
            >
              Open SLA Breaches
            </button>
          )}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="ALL">All Categories</option>
            <option value="WORKFORCE">Workforce</option>
            <option value="SECURITY">Security</option>
            <option value="BILLING">Billing</option>
            <option value="SYSTEM">System</option>
            <option value="INTEGRATION">Integration</option>
            <option value="AI">AI</option>
            <option value="TRAINING">Training</option>
            <option value="PHARMACY">Pharmacy</option>
            <option value="WELLNESS">Wellness</option>
          </select>
          <select value={read} onChange={(e) => setRead(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
          </select>
          <button type="button" className="btn-secondary" onClick={markAllRead}>
            Mark all read
          </button>
        </div>
      </div>

      <section className="section">
        <div className="card">
          <div className="welcome-actions mb-12">
            {canTrainingOps && (
              <button
                type="button"
                className={`btn-secondary ${category === "TRAINING" ? "active" : ""}`}
                onClick={() => {
                  setCategory("TRAINING");
                  setRead("UNREAD");
                }}
              >
                Training Unread
              </button>
            )}
            {canMachineOps && (
              <button
                type="button"
                className={`btn-secondary ${category === "INTEGRATION" ? "active" : ""}`}
                onClick={() => {
                  setCategory("INTEGRATION");
                  setRead("UNREAD");
                }}
              >
                Integration Unread
              </button>
            )}
            {canPharmacyOps && (
              <button
                type="button"
                className={`btn-secondary ${category === "PHARMACY" ? "active" : ""}`}
                onClick={() => {
                  setCategory("PHARMACY");
                  setRead("UNREAD");
                }}
              >
                Pharmacy Unread
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCategory("ALL");
                setRead("ALL");
              }}
            >
              Reset Filters
            </button>
          </div>
          {msg ? <p className="muted">{msg}</p> : null}
          {loading && <p>Loading...</p>}
          {!loading && (
            <table className="table lite">
            <thead>
              <tr>
                <th>Time</th>
                <th>Title</th>
                <th>Category</th>
                <th>Message</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n._id}>
                  <td>{new Date(n.createdAt).toLocaleString()}</td>
                  <td>
                    {n.title || "Notification"}
                    {!n.read && <span className="badge-dot" style={{ marginLeft: 8 }}>!</span>}
                  </td>
                  <td>{n.category || "SYSTEM"}</td>
                  <td>
                    {n.body || "-"}
                    {String(n?.meta?.type || "").toUpperCase() === "PHARMACY_COVERAGE_RISK" ? (
                      <div className="muted" style={{ marginTop: 6 }}>
                        Action: link pharmacists to registered pharmacies before referrals or dispensing fail.
                      </div>
                    ) : null}
                    {String(n?.meta?.kind || "").toUpperCase() === "DAILY_ROLE_QUOTE" ? (
                      <div className="muted" style={{ marginTop: 6 }}>
                        Daily quote for {String(n?.meta?.quoteRole || roleLabel).replaceAll("_", " ")}.
                      </div>
                    ) : null}
                  </td>
                  <td>
                      {n?.meta?.path ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => navigateTo(String(n.meta.path))}
                        >
                          Open
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => toggleNotification(n)}
                      >
                        {n.read ? "Mark unread" : "Mark read"}
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="5">No notifications yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
