import React, { useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { useLabOps } from "../../hooks/useLabOps";

export default function QualityControl() {
  const [showForm, setShowForm] = useState(false);
  const { records: runs, sorted, total, loading, busy, message, setMessage, form, setForm, createRecord } = useLabOps({
    kind: "QUALITY_CONTROL",
    limit: 80,
    initialForm: { testKit: "", outcome: "PASS", note: "" },
  });

  const save = async (e) => {
    e.preventDefault();
    if (!form.testKit.trim()) {
      setMessage("Enter the QC kit or instrument.");
      return;
    }

    const ok = await createRecord({
      kind: "QUALITY_CONTROL",
      title: form.testKit.trim(),
      status: form.outcome,
      note: form.note,
    });
    if (ok) {
      setForm({ testKit: "", outcome: "PASS", note: "" });
      setShowForm(false);
    }
  };

  return (
    <ModuleWorkspace
      title="Quality Control"
      subtitle="QC runs, deviations and corrective action tracking."
      kpis={[
        { title: "QC runs", value: total, subtitle: "Database total" },
        {
          title: "Pass",
          value: sorted.filter((row) => row.status === "PASS").length,
          subtitle: "Within limits",
        },
        {
          title: "Fail",
          value: sorted.filter((row) => row.status === "FAIL").length,
          subtitle: "Needs review",
        },
      ]}
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
        {message ? <div className="premium-inline-note">{message}</div> : null}
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
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving..." : "Save QC Run"}
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
                  <th>Kit/Instrument</th>
                  <th>Outcome</th>
                  <th>Note</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4">Loading quality control runs...</td>
                  </tr>
                ) : null}
                {sorted.map((run) => (
                  <tr key={run._id}>
                    <td>{run.title}</td>
                    <td>{run.status}</td>
                    <td>{run.note || "-"}</td>
                    <td>{new Date(run.observedAt || run.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {!loading && sorted.length === 0 ? (
                  <tr>
                    <td colSpan="4">No QC runs logged.</td>
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
