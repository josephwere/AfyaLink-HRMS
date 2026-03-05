import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";

export default function StaffTransfers() {
  const [items, setItems] = useState([]);
  const [staffRows, setStaffRows] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [form, setForm] = useState({
    staffUserId: "",
    toHospitalId: "",
    transferLetterRef: "",
    note: "",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [transfers, users, hs] = await Promise.all([
        apiFetch("/api/staff-transfers?limit=100"),
        apiFetch("/api/users?limit=200"),
        apiFetch("/api/hospitals?limit=1000").catch(() => ({ items: [] })),
      ]);
      setItems(Array.isArray(transfers?.items) ? transfers.items : []);
      const usersItems = Array.isArray(users?.items) ? users.items : Array.isArray(users) ? users : [];
      setStaffRows(usersItems);
      setHospitals(Array.isArray(hs?.items) ? hs.items : Array.isArray(hs) ? hs : []);
    } catch (err) {
      setMsg(err?.message || "Failed to load transfer data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createTransfer = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await apiFetch("/api/staff-transfers", {
        method: "POST",
        body: form,
      });
      setMsg("Transfer request created");
      setForm({ staffUserId: "", toHospitalId: "", transferLetterRef: "", note: "" });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to create transfer request");
    }
  };

  const doAction = async (id, action, body = {}) => {
    try {
      await apiFetch(`/api/staff-transfers/${id}/${action}`, {
        method: "PATCH",
        body,
      });
      await load();
    } catch (err) {
      setMsg(err?.message || `Failed to ${action}`);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Staff Transfers</h2>
          <p className="muted">Cross-hospital staff transfer with source + target approvals.</p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Create Transfer Request</h3>
        <form className="card form-grid" onSubmit={createTransfer}>
          <label className="field">
            <span>Staff member</span>
            <select
              value={form.staffUserId}
              onChange={(e) => setForm((s) => ({ ...s, staffUserId: e.target.value }))}
              required
            >
              <option value="">Select staff</option>
              {staffRows.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Destination hospital</span>
            <select
              value={form.toHospitalId}
              onChange={(e) => setForm((s) => ({ ...s, toHospitalId: e.target.value }))}
              required
            >
              <option value="">Select hospital</option>
              {hospitals.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name || h.code}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Transfer letter reference</span>
            <input
              value={form.transferLetterRef}
              onChange={(e) => setForm((s) => ({ ...s, transferLetterRef: e.target.value }))}
              placeholder="letter ref / file id"
            />
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea
              value={form.note}
              onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
              rows={3}
            />
          </label>

          <button type="submit" className="btn-primary">
            Submit Transfer Request
          </button>
        </form>
      </section>

      <section className="section">
        <h3>Transfer Queue</h3>
        <div className="card">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <table className="table lite">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.staffUser?.name || "—"}</td>
                    <td>{t?.fromHospital?.name || "—"}</td>
                    <td>{t?.toHospital?.name || "—"}</td>
                    <td>{t.status}</td>
                    <td className="action-row">
                      {t.status === "PENDING_SOURCE_APPROVAL" && (
                        <button type="button" className="btn-secondary" onClick={() => doAction(t._id, "source-approve")}>
                          Source Approve
                        </button>
                      )}
                      {t.status === "PENDING_TARGET_APPROVAL" && (
                        <button type="button" className="btn-secondary" onClick={() => doAction(t._id, "target-approve")}>
                          Target Approve
                        </button>
                      )}
                      {(t.status === "PENDING_SOURCE_APPROVAL" || t.status === "PENDING_TARGET_APPROVAL") && (
                        <>
                          <button type="button" className="btn-secondary" onClick={() => doAction(t._id, "reject", { reason: "Rejected by admin" })}>
                            Reject
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => doAction(t._id, "cancel")}>
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={5}>No transfer requests found</td>
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
