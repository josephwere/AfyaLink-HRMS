import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import { listRegisteredPharmacies } from "../../services/pharmacyNetworkApi";

export default function PharmacyAccessAudit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [summary, setSummary] = useState({
    total: 0,
    linked: 0,
    unlinked: 0,
  });
  const [items, setItems] = useState([]);
  const [pharmacyNameById, setPharmacyNameById] = useState({});
  const [preview, setPreview] = useState({
    summary: { scanned: 0, matched: 0, ambiguous: 0, skipped: 0 },
    matched: [],
    ambiguous: [],
    skipped: [],
  });

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const [allRes, missingRes, pharmacyRes, previewRes] = await Promise.all([
        apiFetch("/api/users?role=PHARMACIST&page=1&limit=500"),
        apiFetch("/api/users?missingRegisteredPharmacy=1&page=1&limit=500"),
        listRegisteredPharmacies({ includeInactive: true, limit: 500 }),
        apiFetch("/api/users/pharmacy-link-backfill-preview"),
      ]);
      const all = Array.isArray(allRes?.items) ? allRes.items : [];
      const missing = Array.isArray(missingRes?.items) ? missingRes.items : [];
      const pharmacies = Array.isArray(pharmacyRes?.items) ? pharmacyRes.items : [];
      setItems(all);
      setSummary({
        total: all.length,
        unlinked: missing.length,
        linked: Math.max(all.length - missing.length, 0),
      });
      setPharmacyNameById(
        pharmacies.reduce((acc, item) => {
          acc[String(item._id)] = item.name;
          return acc;
        }, {})
      );
      setPreview({
        summary: previewRes?.summary || { scanned: 0, matched: 0, ambiguous: 0, skipped: 0 },
        matched: Array.isArray(previewRes?.matched) ? previewRes.matched : [],
        ambiguous: Array.isArray(previewRes?.ambiguous) ? previewRes.ambiguous : [],
        skipped: Array.isArray(previewRes?.skipped) ? previewRes.skipped : [],
      });
    } catch (err) {
      setMsg(err?.message || "Could not load pharmacy access audit.");
      setItems([]);
      setSummary({ total: 0, linked: 0, unlinked: 0 });
      setPharmacyNameById({});
      setPreview({ summary: { scanned: 0, matched: 0, ambiguous: 0, skipped: 0 }, matched: [], ambiguous: [], skipped: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const unlinkedRows = items.filter((item) => !item.registeredPharmacy);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Pharmacy Access Audit</h2>
          <p className="muted">Review pharmacist linkage to registered pharmacies and fix broken access before referrals or dispensing fail.</p>
        </div>
        <div className="welcome-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/hospital-admin/staff?missingRegisteredPharmacy=1&q=pharmacist")}
          >
            Open Staff Management
          </button>
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="grid info-grid">
          <div className="card premium-card">
            <strong>Total Pharmacists</strong>
            <p>{summary.total}</p>
          </div>
          <div className="card premium-card">
            <strong>Linked Pharmacists</strong>
            <p>{summary.linked}</p>
          </div>
          <div className="card premium-card">
            <strong>Unlinked Pharmacists</strong>
            <p>{summary.unlinked}</p>
          </div>
          <div className="card premium-card">
            <strong>Backfill Matches</strong>
            <p>{preview.summary.matched}</p>
          </div>
          <div className="card premium-card">
            <strong>Ambiguous Matches</strong>
            <p>{preview.summary.ambiguous}</p>
          </div>
          <div className="card premium-card">
            <strong>Skipped Backfill</strong>
            <p>{preview.summary.skipped}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <h3>Resolution Runbook</h3>
          <div className="alert-stack">
            <div className="card">
              <strong>1. Review Backfill Ready Matches</strong>
              <p className="muted">If the matched pharmacy is correct, proceed with the automated linking workflow for this release.</p>
            </div>
            <div className="card">
              <strong>2. Resolve Ambiguous Matches Manually</strong>
              <p className="muted">Open filtered staff management, confirm the pharmacist identity, then assign the correct registered pharmacy by hand.</p>
            </div>
            <div className="card">
              <strong>3. Fix Skipped Rows</strong>
              <p className="muted">Complete missing phone or email on the pharmacist account, or update the registered pharmacy contact so automatic matching can work.</p>
            </div>
            <div className="card">
              <strong>4. Confirm Risk Notifications Clear</strong>
              <p className="muted">Once pharmacists are linked, hospital admins should stop seeing pharmacy coverage risk warnings for that hospital.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card premium-card">
          <h3>Backfill Ready Matches</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Pharmacist</th>
                  <th>Hospital</th>
                  <th>Matched Pharmacy</th>
                  <th>Match Source</th>
                </tr>
              </thead>
              <tbody>
                {preview.matched.slice(0, 20).map((item) => (
                  <tr key={item.user._id}>
                    <td>{item.user.name}</td>
                    <td>{item.user.hospital?.name || "—"}</td>
                    <td>{item.pharmacy?.name || "—"}</td>
                    <td>
                      {[item.emailMatched ? "Email" : null, item.phoneMatched ? "Phone" : null]
                        .filter(Boolean)
                        .join(" + ") || "Contact match"}
                    </td>
                  </tr>
                ))}
                {!preview.matched.length ? (
                  <tr>
                    <td colSpan={4} className="muted">No automatic backfill matches found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card premium-card">
          <h3>Ambiguous Backfill Matches</h3>
          <div className="alert-stack">
            {preview.ambiguous.map((item) => (
              <div key={item.user._id} className="card">
                <strong>{item.user.name}</strong>
                <p className="muted">{item.user.email || item.user.phone || "No contact"}</p>
                <p className="muted">Hospital: {item.user.hospital?.name || "—"}</p>
                <p className="muted">
                  Candidates: {item.candidates.map((candidate) => candidate.name).join(", ") || "—"}
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    navigate(`/hospital-admin/staff?missingRegisteredPharmacy=1&q=${encodeURIComponent(item.user.email || item.user.name || "")}`)
                  }
                >
                  Resolve Manually
                </button>
              </div>
            ))}
            {!preview.ambiguous.length ? <div className="muted">No ambiguous matches.</div> : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <h3>Skipped Backfill Rows</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Hospital</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {preview.skipped.slice(0, 20).map((item) => (
                  <tr key={item.user._id}>
                    <td>{item.user.name}</td>
                    <td>{item.user.hospital?.name || "—"}</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
                {!preview.skipped.length ? (
                  <tr>
                    <td colSpan={3} className="muted">No skipped pharmacists.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card premium-card">
          <h3>Unlinked Pharmacists</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Hospital</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {unlinkedRows.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{item.email || "—"}</td>
                    <td>{item.hospital?.name || item.hospital || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          navigate(
                            `/hospital-admin/staff?missingRegisteredPharmacy=1&q=${encodeURIComponent(
                              item.email || item.name || ""
                            )}`
                          )
                        }
                      >
                        Fix Link
                      </button>
                    </td>
                  </tr>
                ))}
                {!unlinkedRows.length ? (
                  <tr>
                    <td colSpan={4} className="muted">No unlinked pharmacists.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card premium-card">
          <h3>Linked Pharmacists</h3>
          <div className="alert-stack">
            {items
              .filter((item) => item.registeredPharmacy)
              .slice(0, 20)
              .map((item) => (
                <div key={item._id} className="card">
                  <strong>{item.name}</strong>
                  <p className="muted">{item.email || "No email"}</p>
                  <p className="muted">
                    {pharmacyNameById[String(item.registeredPharmacy)] || "Linked pharmacy"}
                  </p>
                </div>
              ))}
            {!items.filter((item) => item.registeredPharmacy).length ? (
              <div className="muted">No linked pharmacists yet.</div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
