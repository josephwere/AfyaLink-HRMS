import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import {
  createPharmacyReferral,
  listPharmacyReferrals,
  listRegisteredPharmacies,
} from "../../services/pharmacyNetworkApi";

export default function Referrals() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const [patient, setPatient] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [q, setQ] = useState("");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    patientName: "",
    patientPhone: "",
    reason: "",
    medicationNotes: "",
    urgent: false,
  });

  useEffect(() => {
    if (!patientId) return;
    apiFetch(`/api/patients/${patientId}`)
      .then((res) => {
        setPatient(res || null);
        setForm((prev) => ({
          ...prev,
          patientName:
            `${res?.firstName || ""} ${res?.lastName || ""}`.trim() || prev.patientName,
          patientPhone: res?.contact || prev.patientPhone,
        }));
      })
      .catch(() => setPatient(null));
  }, [patientId]);

  const loadPharmacies = async () => {
    setLoading(true);
    try {
      const data = await listRegisteredPharmacies({ q, limit: 100 });
      const items = Array.isArray(data?.items) ? data.items : [];
      setPharmacies(items);
      if (!selectedPharmacyId && items.length) setSelectedPharmacyId(String(items[0]._id));
    } catch (err) {
      setMsg(err?.message || "Could not load pharmacies.");
      setPharmacies([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReferrals = async () => {
    try {
      const data = await listPharmacyReferrals({ limit: 100 });
      setReferrals(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setReferrals([]);
    }
  };

  useEffect(() => {
    loadPharmacies();
    loadReferrals();
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadPharmacies, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const selectedPharmacy = useMemo(
    () => pharmacies.find((item) => String(item._id) === String(selectedPharmacyId)) || null,
    [pharmacies, selectedPharmacyId]
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedPharmacyId || !form.patientName.trim()) {
      setMsg("Select a pharmacy and patient first.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await createPharmacyReferral({
        pharmacyId: selectedPharmacyId,
        patientName: form.patientName,
        patientPhone: form.patientPhone,
        reason: form.reason,
        medicationNotes: form.medicationNotes,
        urgent: form.urgent,
      });
      setMsg("Referral sent to pharmacy.");
      setForm((prev) => ({
        ...prev,
        reason: "",
        medicationNotes: "",
        urgent: false,
      }));
      await loadReferrals();
    } catch (err) {
      setMsg(err?.message || "Could not create referral.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Referrals</h2>
          <p className="muted">Send a patient to a registered pharmacy when medicine is not available in your hospital.</p>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Pharmacy Referral</h3>
          <form className="panel-grid" onSubmit={submit}>
            <label>Patient</label>
            <input
              value={form.patientName}
              onChange={(e) => setForm((prev) => ({ ...prev, patientName: e.target.value }))}
              placeholder="Patient name"
            />

            <label>Phone</label>
            <input
              value={form.patientPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, patientPhone: e.target.value }))}
              placeholder="Phone number"
            />

            <label>Search Pharmacy</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, city, license" />

            <label>Target Pharmacy</label>
            <select value={selectedPharmacyId} onChange={(e) => setSelectedPharmacyId(e.target.value)} disabled={loading}>
              <option value="">Select pharmacy</option>
              {pharmacies.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name} {item?.location?.city ? `• ${item.location.city}` : ""}
                </option>
              ))}
            </select>

            <label>Reason</label>
            <input
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Medicine unavailable in hospital stock"
            />

            <label>Medication Notes</label>
            <textarea
              rows={4}
              value={form.medicationNotes}
              onChange={(e) => setForm((prev) => ({ ...prev, medicationNotes: e.target.value }))}
              placeholder="Drug name, strength, duration, handling notes"
            />

            <label className="remember">
              <input
                type="checkbox"
                checked={form.urgent}
                onChange={(e) => setForm((prev) => ({ ...prev, urgent: e.target.checked }))}
              />
              Mark urgent
            </label>

            <div className="doctor-actions-row">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Sending..." : "Send Referral"}
              </button>
            </div>
          </form>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Selected Pharmacy</h3>
          {selectedPharmacy ? (
            <div className="alert-stack">
              <div className="card">
                <strong>{selectedPharmacy.name}</strong>
                <p className="muted">{selectedPharmacy.licenseNumber || "No license listed"}</p>
                <p className="muted">
                  {selectedPharmacy?.location?.city || "—"} {selectedPharmacy?.location?.region ? `• ${selectedPharmacy.location.region}` : ""}
                </p>
                <p className="muted">{selectedPharmacy?.contact?.phone || selectedPharmacy?.contact?.email || "No contact"}</p>
              </div>
              {patient ? (
                <div className="card">
                  <strong>Patient Context</strong>
                  <p className="muted">
                    {`${patient.firstName || ""} ${patient.lastName || ""}`.trim()}
                    {patient?.nationalId ? ` • ${patient.nationalId}` : ""}
                  </p>
                </div>
              ) : (
                <div className="muted">No patient linked from query yet.</div>
              )}
            </div>
          ) : (
            <div className="muted">Select a pharmacy to see details.</div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <h3>Recent Referrals</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Pharmacy</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((item) => (
                  <tr key={item._id}>
                    <td>
                      {item.patientName}
                      <div className="muted">{item.patientPhone || "—"}</div>
                    </td>
                    <td>{item?.pharmacy?.name || "—"}</td>
                    <td>{item.status}</td>
                    <td>{item.reason || "—"}</td>
                    <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
                {!referrals.length && (
                  <tr>
                    <td colSpan={5} className="muted">No referrals yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
