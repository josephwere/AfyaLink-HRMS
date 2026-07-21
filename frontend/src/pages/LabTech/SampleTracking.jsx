import React, { useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { useLabOps } from "../../hooks/useLabOps";

export default function SampleTracking() {
  const [showForm, setShowForm] = useState(false);
  const { records: items, sorted, total, loading, busy, message, setMessage, form, setForm, createRecord } = useLabOps({
    kind: "SAMPLE_TRACKING",
    limit: 80,
    initialForm: { sampleId: "", patientId: "", stage: "COLLECTED" },
  });

  const save = async (e) => {
    e.preventDefault();
    if (!form.sampleId.trim() || !form.patientId.trim()) {
      setMessage("Enter both the sample ID and patient ID.");
      return;
    }

    const ok = await createRecord({
      kind: "SAMPLE_TRACKING",
      title: form.sampleId.trim(),
      reference: form.patientId.trim(),
      status: form.stage,
    });
    if (ok) {
      setForm({ sampleId: "", patientId: "", stage: "COLLECTED" });
      setShowForm(false);
    }
  };

  return (
    <ModuleWorkspace
      title="Sample Tracking"
      subtitle="Monitor sample lifecycle from collection to result release."
      kpis={[
        { title: "Tracked samples", value: total, subtitle: "Database total" },
        {
          title: "In processing",
          value: sorted.filter((row) => row.status === "PROCESSING").length,
          subtitle: "Current queue",
        },
        {
          title: "Released",
          value: sorted.filter((row) => row.status === "RELEASED").length,
          subtitle: "Completed handoff",
        },
      ]}
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
        {message ? <div className="premium-inline-note">{message}</div> : null}
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
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving..." : "Save Tracking"}
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
                  <th>Sample</th>
                  <th>Patient</th>
                  <th>Stage</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4">Loading live sample records...</td>
                  </tr>
                ) : null}
                {sorted.map((row) => (
                  <tr key={row._id}>
                    <td>{row.title}</td>
                    <td>{row.reference || "—"}</td>
                    <td>{row.status}</td>
                    <td>{new Date(row.observedAt || row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {!loading && sorted.length === 0 ? (
                  <tr>
                    <td colSpan="4">No sample tracking records yet.</td>
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
