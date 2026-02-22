import React, { useMemo, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

const STORAGE_KEY = "labtech_equipment_logs";

const loadLogs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function EquipmentLogs() {
  const [logs, setLogs] = useState(loadLogs);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ device: "", status: "UP", note: "" });

  const sorted = useMemo(
    () => [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [logs]
  );

  const persist = (next) => {
    setLogs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const save = (e) => {
    e.preventDefault();
    if (!form.device.trim()) return;
    const next = [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...form,
        createdAt: new Date().toISOString(),
      },
      ...logs,
    ];
    persist(next);
    setForm({ device: "", status: "UP", note: "" });
    setShowForm(false);
  };

  return (
    <ModuleWorkspace
      title="Equipment Logs"
      subtitle="Track machine uptime, calibration and maintenance events."
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
              <button type="submit" className="btn-primary">Save Log</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
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
                {sorted.map((log) => (
                  <tr key={log.id}>
                    <td>{log.device}</td>
                    <td>{log.status}</td>
                    <td>{log.note || "-"}</td>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan="4">No equipment logs yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </ModuleWorkspace>
  );
}
