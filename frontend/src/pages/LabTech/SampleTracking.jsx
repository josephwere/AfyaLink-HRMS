import React, { useEffect, useMemo, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { createLabOpsRecord, listLabOpsRecords } from "../../services/labOpsApi";

export default function SampleTracking() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sampleId: "", patientId: "", stage: "COLLECTED" });

  const loadItems = async () => {
    try {
      const data = await listLabOpsRecords({ kind: "SAMPLE_TRACKING", limit: 80 });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
      setMessage("");
    } catch (err) {
      setItems([]);
      setTotal(0);
      setMessage(err?.message || "Unable to load sample tracking records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.observedAt || b.createdAt).getTime() -
          new Date(a.observedAt || a.createdAt).getTime()
      ),
    [items]
  );

  const save = async (e) => {
    e.preventDefault();
    if (!form.sampleId.trim() || !form.patientId.trim()) {
      setMessage("Enter both the sample ID and patient ID.");
      return;
    }

    setBusy(true);
    try {
      await createLabOpsRecord({
        kind: "SAMPLE_TRACKING",
        title: form.sampleId.trim(),
        reference: form.patientId.trim(),
        status: form.stage,
      });
      setForm({ sampleId: "", patientId: "", stage: "COLLECTED" });
      setShowForm(false);
      await loadItems();
      setMessage("Sample tracking record saved.");
    } catch (err) {
      setMessage(err?.message || "Unable to save the sample tracking record.");
    } finally {
      setBusy(false);
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
