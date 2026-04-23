import React, { useEffect, useMemo, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { createLabOpsRecord, listLabOpsRecords } from "../../services/labOpsApi";

export default function EquipmentLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ device: "", status: "UP", note: "" });

  const loadLogs = async () => {
    try {
      const data = await listLabOpsRecords({ kind: "EQUIPMENT_LOG", limit: 80 });
      setLogs(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
      setMessage("");
    } catch (err) {
      setLogs([]);
      setTotal(0);
      setMessage(err?.message || "Unable to load equipment logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const sorted = useMemo(
    () =>
      [...logs].sort(
        (a, b) =>
          new Date(b.observedAt || b.createdAt).getTime() -
          new Date(a.observedAt || a.createdAt).getTime()
      ),
    [logs]
  );

  const save = async (e) => {
    e.preventDefault();
    if (!form.device.trim()) {
      setMessage("Enter the device or analyzer name.");
      return;
    }

    setBusy(true);
    try {
      await createLabOpsRecord({
        kind: "EQUIPMENT_LOG",
        title: form.device.trim(),
        status: form.status,
        note: form.note,
      });
      setForm({ device: "", status: "UP", note: "" });
      setShowForm(false);
      await loadLogs();
      setMessage("Equipment log saved.");
    } catch (err) {
      setMessage(err?.message || "Unable to save the equipment log.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModuleWorkspace
      title="Equipment Logs"
      subtitle="Track machine uptime, calibration and maintenance events."
      kpis={[
        { title: "Logged events", value: total, subtitle: "Database total" },
        {
          title: "Machines down",
          value: sorted.filter((row) => row.status === "DOWN").length,
          subtitle: "Needs follow-up",
        },
        {
          title: "Maintenance due",
          value: sorted.filter(
            (row) => row.status === "CALIBRATION_DUE" || row.status === "MAINTENANCE"
          ).length,
          subtitle: "Open attention items",
        },
      ]}
      actions={[
        { label: "New Log", variant: "primary", onClick: () => setShowForm(true) },
        { label: "Maintenance Calendar", path: "/reports" },
      ]}
      panels={[
        { title: "Uptime", body: "Device uptime and downtime events." },
        { title: "Calibration", body: "Calibration due dates and completion records." },
        { title: "Maintenance", body: "Scheduled and emergency maintenance logs." },
      ]}
    >
      <section className="section">
        {message ? <div className="premium-inline-note">{message}</div> : null}
        {showForm && (
          <form className="card form" onSubmit={save}>
            <input
              placeholder="Device / Analyzer"
              value={form.device}
              onChange={(e) => setForm((prev) => ({ ...prev, device: e.target.value }))}
            />
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="UP">Up</option>
              <option value="DOWN">Down</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="CALIBRATION_DUE">Calibration Due</option>
            </select>
            <textarea
              placeholder="Log note"
              rows={3}
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            />
            <div>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving..." : "Save Log"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4">Loading equipment logs...</td>
                  </tr>
                ) : null}
                {sorted.map((log) => (
                  <tr key={log._id}>
                    <td>{log.title}</td>
                    <td>{log.status}</td>
                    <td>{log.note || "-"}</td>
                    <td>{new Date(log.observedAt || log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {!loading && sorted.length === 0 ? (
                  <tr>
                    <td colSpan="4">No equipment logs yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </ModuleWorkspace>
  );
}
