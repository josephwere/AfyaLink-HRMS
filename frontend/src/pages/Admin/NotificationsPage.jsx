import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import {
  listNotificationsFiltered,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../../services/notificationsApi";

export default function Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const role = String(user?.actualRole || user?.role || "").toUpperCase();
  const canTrainingOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER"].includes(role);
  const canMachineOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(role);
  const canSlaOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER"].includes(role);
  const canPharmacyOps = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "PHARMACIST"].includes(role);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const queryFilters = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      category: params.get("category") || "ALL",
      read: params.get("read") || "ALL",
    };
  }, [location.search]);
  const [category, setCategory] = useState(queryFilters.category);
  const [read, setRead] = useState(queryFilters.read);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setCategory(queryFilters.category);
    setRead(queryFilters.read);
  }, [queryFilters]);

  useEffect(() => {
    setLoading(true);
    const readParam =
      read === "ALL" ? undefined : read === "READ" ? "true" : "false";
    listNotificationsFiltered({ category, read: readParam })
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else if (Array.isArray(data?.items)) setItems(data.items);
        else setItems([]);
      })
      .catch(() => {
        setItems([]);
        setMsg("Failed to load notifications");
      })
      .finally(() => setLoading(false));
  }, [category, read]);

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
              onClick={() => navigate("/admin/training-tracker?overdue=1")}
            >
              Open Overdue Tracker
            </button>
          )}
          {canMachineOps && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/hospital-admin/machine-alerts")}
            >
              Open Machine Alerts
            </button>
          )}
          {canSlaOps && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/hospital-admin/approvals?view=breached#pending")}
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
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                await markAllNotificationsRead();
                setItems((prev) => prev.map((n) => ({ ...n, read: true })));
                setMsg("All notifications marked as read.");
              } catch (e) {
                setMsg(e?.message || "Failed to mark notifications as read");
              }
            }}
          >
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
                        Daily quote for {String(n?.meta?.quoteRole || role || "your role").replaceAll("_", " ")}.
                      </div>
                    ) : null}
                  </td>
                  <td>
                      {n?.meta?.path ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => navigate(String(n.meta.path))}
                        >
                          Open
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={async () => {
                          try {
                            if (n.read) {
                              await markNotificationUnread(n._id);
                              setItems((prev) =>
                                prev.map((item) =>
                                  item._id === n._id ? { ...item, read: false } : item
                                )
                              );
                            } else {
                              await markNotificationRead(n._id);
                              setItems((prev) =>
                                prev.map((item) =>
                                  item._id === n._id ? { ...item, read: true } : item
                                )
                              );
                            }
                          } catch (e) {
                            setMsg(e?.message || "Failed to update notification");
                          }
                        }}
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
