import React, { useMemo, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

const STORAGE_KEY = "labtech_sample_tracking";

const loadItems = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function SampleTracking() {
  const [items, setItems] = useState(loadItems);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sampleId: "", patientId: "", stage: "COLLECTED" });

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items]
  );

  const save = (e) => {
    e.preventDefault();
    if (!form.sampleId.trim() || !form.patientId.trim()) return;
    const next = [
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...form, createdAt: new Date().toISOString() },
      ...items,
    ];
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setForm({ sampleId: "", patientId: "", stage: "COLLECTED" });
    setShowForm(false);
  };

  return (
    <ModuleWorkspace
      title="Sample Tracking"
      subtitle="Monitor sample lifecycle from collection to result release."
      actions={[
        { label: "Track Sample", variant: "primary", onClick: () => setShowForm(true) },
        { label: "Flag Delay", path: "/notifications" },
      ]}
      panels={[
        { title: "Collection", body: "Collected sample inventory and timestamps." },
        { title: "Processing", body: "In-lab progress state and queue slot." },
        { title: "Release", body: "Result-ready and signed-off status." },
      ]}
    >
      <section className="section">
        {showForm && (
          <form className="card form" onSubmit={save}>
            <input
              placeholder="Sample ID"
              value={form.sampleId}
              onChange={(e) => setForm((prev) => ({ ...prev, sampleId: e.target.value }))}
            />
            <input
              placeholder="Patient ID"
              value={form.patientId}
              onChange={(e) => setForm((prev) => ({ ...prev, patientId: e.target.value }))}
            />
            <select
              value={form.stage}
              onChange={(e) => setForm((prev) => ({ ...prev, stage: e.target.value }))}
            >
              <option value="COLLECTED">Collected</option>
              <option value="PROCESSING">Processing</option>
              <option value="RESULT_READY">Result Ready</option>
              <option value="RELEASED">Released</option>
            </select>
            <div>
              <button type="submit" className="btn-primary">Save Tracking</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sample</th>
                  <th>Patient</th>
                  <th>Stage</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sampleId}</td>
                    <td>{row.patientId}</td>
                    <td>{row.stage}</td>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan="4">No sample tracking records yet.</td>
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
