import React, { useEffect, useMemo, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { createLabOpsRecord, listLabOpsRecords } from "../../services/labOpsApi";

export default function SafetyChecklist() {
  const [checks, setChecks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ area: "", ppe: true, hazard: false, note: "" });

  const loadChecks = async () => {
    try {
      const data = await listLabOpsRecords({ kind: "SAFETY_CHECK", limit: 80 });
      setChecks(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
      setMessage("");
    } catch (err) {
      setChecks([]);
      setTotal(0);
      setMessage(err?.message || "Unable to load safety checks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChecks();
  }, []);

  const sorted = useMemo(
    () =>
      [...checks].sort(
        (a, b) =>
          new Date(b.observedAt || b.createdAt).getTime() -
          new Date(a.observedAt || a.createdAt).getTime()
      ),
    [checks]
  );

  const save = async (e) => {
    e.preventDefault();
    if (!form.area.trim()) {
      setMessage("Enter the area or room name.");
      return;
    }

    setBusy(true);
    try {
      await createLabOpsRecord({
        kind: "SAFETY_CHECK",
        title: form.area.trim(),
        status: form.hazard ? "FOLLOW_UP" : form.ppe ? "COMPLIANT" : "PPE_GAP",
        note: form.note,
        details: {
          ppe: form.ppe,
          hazard: form.hazard,
        },
      });
      setForm({ area: "", ppe: true, hazard: false, note: "" });
      setShowForm(false);
      await loadChecks();
      setMessage("Safety checklist saved.");
    } catch (err) {
      setMessage(err?.message || "Unable to save the safety checklist.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModuleWorkspace
      title="Safety Checklist"
      subtitle="Lab biosafety compliance checks and hazard readiness."
      kpis={[
        { title: "Safety rounds", value: total, subtitle: "Database total" },
        {
          title: "Hazards found",
          value: sorted.filter((row) => row.details?.hazard).length,
          subtitle: "Needs action",
        },
        {
          title: "PPE gaps",
          value: sorted.filter((row) => row.details?.ppe === false).length,
          subtitle: "Compliance follow-up",
        },
      ]}
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
        {message ? <div className="premium-inline-note">{message}</div> : null}
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
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving..." : "Save Checklist"}
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
                  <th>Area</th>
                  <th>PPE</th>
                  <th>Hazard</th>
                  <th>Note</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5">Loading safety checks...</td>
                  </tr>
                ) : null}
                {sorted.map((check) => (
                  <tr key={check._id}>
                    <td>{check.title}</td>
                    <td>{check.details?.ppe === false ? "No" : "Yes"}</td>
                    <td>{check.details?.hazard ? "Yes" : "No"}</td>
                    <td>{check.note || "-"}</td>
                    <td>{new Date(check.observedAt || check.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {!loading && sorted.length === 0 ? (
                  <tr>
                    <td colSpan="5">No safety checklist records yet.</td>
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
