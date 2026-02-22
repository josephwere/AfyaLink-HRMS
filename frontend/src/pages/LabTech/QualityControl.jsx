import React, { useMemo, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

const STORAGE_KEY = "labtech_quality_control_runs";

const loadRuns = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function QualityControl() {
  const [runs, setRuns] = useState(loadRuns);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ testKit: "", outcome: "PASS", note: "" });

  const sorted = useMemo(
    () => [...runs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [runs]
  );

  const save = (e) => {
    e.preventDefault();
    if (!form.testKit.trim()) return;
    const next = [
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...form, createdAt: new Date().toISOString() },
      ...runs,
    ];
    setRuns(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setForm({ testKit: "", outcome: "PASS", note: "" });
    setShowForm(false);
  };

  return (
    <ModuleWorkspace
      title="Quality Control"
      subtitle="QC runs, deviations and corrective action tracking."
      actions={[
        { label: "Run QC", variant: "primary", onClick: () => setShowForm(true) },
        { label: "Deviation Log", path: "/reports" },
      ]}
      panels={[
        { title: "QC Runs", body: "Daily and batch QC checkpoints." },
        { title: "Deviations", body: "Abnormal QC outcomes and escalation." },
        { title: "Corrective Actions", body: "Action ownership and closure tracking." },
      ]}
    >
      <section className="section">
        {showForm && (
          <form className="card form" onSubmit={save}>
            <input
              placeholder="QC Kit / Instrument"
              value={form.testKit}
              onChange={(e) => setForm((prev) => ({ ...prev, testKit: e.target.value }))}
            />
            <select
              value={form.outcome}
              onChange={(e) => setForm((prev) => ({ ...prev, outcome: e.target.value }))}
            >
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
            </select>
            <textarea
              rows={3}
              placeholder="Observation / corrective note"
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            />
            <div>
              <button type="submit" className="btn-primary">Save QC Run</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kit/Instrument</th>
                  <th>Outcome</th>
                  <th>Note</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((run) => (
                  <tr key={run.id}>
                    <td>{run.testKit}</td>
                    <td>{run.outcome}</td>
                    <td>{run.note || "-"}</td>
                    <td>{new Date(run.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan="4">No QC runs logged.</td>
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
