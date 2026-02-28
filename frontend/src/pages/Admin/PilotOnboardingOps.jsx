import { useEffect, useState } from "react";
import {
  listPilotOnboarding,
  updatePilotOnboardingItem,
  upsertPilotOnboarding,
} from "../../services/opsApi";

const DEFAULT_ITEMS = [
  { key: "governance", title: "Governance and legal onboarding complete" },
  { key: "identity", title: "Admin identity and 2FA setup complete" },
  { key: "data_migration", title: "Initial data migration validated" },
  { key: "integrations", title: "FHIR/HL7 integrations smoke-tested" },
  { key: "training", title: "Role-based training completed" },
  { key: "dr_drill", title: "DR and incident drill completed" },
  { key: "go_live", title: "Go-live readiness sign-off" },
];

export default function PilotOnboardingOps() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [hospital, setHospital] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await listPilotOnboarding({ hospital: hospital || undefined });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setMessage(err?.message || "Failed to load onboarding checklists.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [hospital]);

  const createChecklist = async () => {
    if (!hospital.trim()) {
      setMessage("Hospital ID is required for creating a checklist.");
      return;
    }
    setBusy("create");
    setMessage("");
    try {
      await upsertPilotOnboarding({
        hospital,
        items: DEFAULT_ITEMS,
      });
      await load();
      setMessage("Pilot onboarding checklist created/updated.");
    } catch (err) {
      setMessage(err?.message || "Failed to create checklist.");
    } finally {
      setBusy("");
    }
  };

  const toggleItem = async (checklist, key, completed) => {
    setBusy(`${checklist._id}:${key}`);
    setMessage("");
    try {
      await updatePilotOnboardingItem(checklist._id, key, { completed: !completed });
      await load();
    } catch (err) {
      setMessage(err?.message || "Failed to update checklist item.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Pilot Onboarding Ops</h2>
          <p className="muted">Track per-hospital go-live readiness and completion evidence.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {message ? (
        <section className="section"><div className="card"><p className="muted">{message}</p></div></section>
      ) : null}

      <section className="section">
        <div className="card">
          <h3>Checklist Scope</h3>
          <div className="form-row">
            <input value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="Hospital ID" />
            <button type="button" className="btn primary" onClick={createChecklist} disabled={busy === "create"}>
              {busy === "create" ? "Saving..." : "Create/Update Checklist"}
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <h3>Checklists</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Status</th>
                  <th>Phase</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry._id}>
                    <td>{entry.hospital || "—"}</td>
                    <td>{entry.status}</td>
                    <td>{entry.phase}</td>
                    <td>
                      <div className="form-grid">
                        {(entry.items || []).map((item) => (
                          <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={Boolean(item.completed)}
                              onChange={() => toggleItem(entry, item.key, item.completed)}
                              disabled={busy === `${entry._id}:${item.key}`}
                            />
                            <span>{item.title}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr><td colSpan={4} className="muted">No checklists found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
