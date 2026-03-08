import React, { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import { listPharmacyReferrals } from "../../services/pharmacyNetworkApi";

export default function PatientPrescriptions() {
  const [items, setItems] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await apiFetch("/api/pharmacy/prescriptions");
      setItems(Array.isArray(res?.items) ? res.items : []);
      const referralRes = await listPharmacyReferrals({ limit: 50 });
      setReferrals(Array.isArray(referralRes?.items) ? referralRes.items : []);
    } catch (err) {
      setItems([]);
      setReferrals([]);
      setMsg(err?.message || "Could not load prescriptions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((item) => String(item.status) === filter);
  }, [items, filter]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Prescriptions</h2>
          <p className="muted">See active medicines, care advice, and past prescription history.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="card premium-card">
          <label>Filter</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">All Prescriptions</option>
            <option value="CREATED">Active</option>
            <option value="DISPENSED">Dispensed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </section>

      <section className="section">
        <div className="doctor-main-grid">
          <div className="grid info-grid">
          {visible.map((item) => (
            <div key={item._id} className="card premium-card">
              <h3 style={{ marginTop: 0 }}>
                {item?.appointment?.serviceType || item.summary || "Prescription"}
              </h3>
              <p className="muted">Status: {item.status}</p>
              {item.dispensedAt ? (
                <p className="muted">
                  Dispensed: {new Date(item.dispensedAt).toLocaleString()}
                </p>
              ) : null}
              {item.summary ? <p>{item.summary}</p> : null}
              {item.advice ? <p className="muted">Advice: {item.advice}</p> : null}
              <div className="alert-stack">
                {(item.medications || []).map((med, index) => (
                  <div key={index} className="card">
                    <strong>{med.name || "Medicine"}</strong>
                    <div className="muted">
                      {med.dosage || "—"} • {med.frequency || "—"} • {med.duration || "—"}
                    </div>
                  </div>
                ))}
                {!(item.medications || []).length ? <div className="muted">No medication lines.</div> : null}
              </div>
              {item?.appointment?.metadata?.consultationSummary?.followUpDate ? (
                <div className="action-pill" style={{ marginTop: 10 }}>
                  Follow-up: {new Date(item.appointment.metadata.consultationSummary.followUpDate).toLocaleDateString()}
                </div>
              ) : null}
            </div>
          ))}
          {!visible.length ? (
            <div className="card premium-card">
              <p className="muted">No prescriptions in this filter.</p>
            </div>
          ) : null}
          </div>

          <div className="card premium-card">
            <h3>Pharmacy Referral Progress</h3>
            <div className="alert-stack">
              {referrals.map((item) => (
                <div key={item._id} className="card">
                  <strong>{item?.pharmacy?.name || "Pharmacy"}</strong>
                  <p className="muted">{item.reason || "Medication handoff"}</p>
                  <div className="action-pill">{item.status}</div>
                  {item.medicationNotes ? <p className="muted" style={{ marginTop: 8 }}>{item.medicationNotes}</p> : null}
                </div>
              ))}
              {!referrals.length ? <div className="muted">No pharmacy referrals yet.</div> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
