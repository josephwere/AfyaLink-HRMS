import React, { useMemo, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

const STORAGE_KEY = "labtech_safety_checks";

const loadChecks = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function SafetyChecklist() {
  const [checks, setChecks] = useState(loadChecks);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ area: "", ppe: true, hazard: false, note: "" });

  const sorted = useMemo(
    () => [...checks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [checks]
  );

  const save = (e) => {
    e.preventDefault();
    if (!form.area.trim()) return;
    const next = [
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...form, createdAt: new Date().toISOString() },
      ...checks,
    ];
    setChecks(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setForm({ area: "", ppe: true, hazard: false, note: "" });
    setShowForm(false);
  };

  return (
    <ModuleWorkspace
      title="Safety Checklist"
      subtitle="Lab biosafety compliance checks and hazard readiness."
      actions={[
        { label: "Start Checklist", variant: "primary", onClick: () => setShowForm(true) },
        { label: "Report Hazard", path: "/notifications" },
      ]}
      panels={[
        { title: "PPE", body: "Protective gear compliance checks." },
        { title: "Biohazard", body: "Containment and disposal controls." },
        { title: "Safety Audits", body: "Audit history and corrective tasks." },
      ]}
    >
      <section className="section">
        {showForm && (
          <form className="card form" onSubmit={save}>
            <input
              placeholder="Area / Room"
              value={form.area}
              onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))}
            />
            <label className="input-inline-check">
              <input
                type="checkbox"
                checked={form.ppe}
                onChange={(e) => setForm((prev) => ({ ...prev, ppe: e.target.checked }))}
              />
              PPE compliant
            </label>
            <label className="input-inline-check">
              <input
                type="checkbox"
                checked={form.hazard}
                onChange={(e) => setForm((prev) => ({ ...prev, hazard: e.target.checked }))}
              />
              Hazard observed
            </label>
            <textarea
              rows={3}
              placeholder="Checklist note"
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            />
            <div>
              <button type="submit" className="btn-primary">Save Checklist</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Area</th>
                  <th>PPE</th>
                  <th>Hazard</th>
                  <th>Note</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((check) => (
                  <tr key={check.id}>
                    <td>{check.area}</td>
                    <td>{check.ppe ? "Yes" : "No"}</td>
                    <td>{check.hazard ? "Yes" : "No"}</td>
                    <td>{check.note || "-"}</td>
                    <td>{new Date(check.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan="5">No safety checklist records yet.</td>
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
