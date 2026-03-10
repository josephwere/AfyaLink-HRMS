import React, { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import { listPharmacyReferrals, updatePharmacyReferral } from "../../services/pharmacyNetworkApi";
import { listTransfers } from "../../services/transferApi";

export default function PrescriptionQueue() {
  const [items, setItems] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [filter, setFilter] = useState("CREATED");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await apiFetch("/api/pharmacy/prescriptions");
      setItems(Array.isArray(res?.items) ? res.items : []);
      const referralRes = await listPharmacyReferrals({ limit: 50 });
      setReferrals(Array.isArray(referralRes?.items) ? referralRes.items : []);
      const transferRes = await listTransfers({ limit: 6, scope: "facility" });
      setTransfers(Array.isArray(transferRes?.items) ? transferRes.items : []);
      setTransferError("");
    } catch (err) {
      setItems([]);
      setReferrals([]);
      setTransfers([]);
      setTransferError(err?.message || "Failed to load transfers.");
      setMsg(err?.message || "Could not load pharmacy queue.");
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

  const dispense = async (item) => {
    try {
      setMsg("");
      await apiFetch("/api/pharmacy/dispense", {
        method: "POST",
        body: {
          prescriptionId: item._id,
          encounterId: item.encounter || undefined,
        },
      });
      setMsg("Prescription dispensed.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Could not dispense prescription.");
    }
  };

  const updateReferralStatus = async (item, status) => {
    try {
      setMsg("");
      await updatePharmacyReferral(item._id, { status });
      setMsg(`Referral marked ${status.toLowerCase()}.`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Could not update referral status.");
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Prescription Queue</h2>
          <p className="muted">Review prescriptions and referrals linked to your pharmacy and mark medicines as issued.</p>
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
            <option value="ALL">All</option>
            <option value="CREATED">Pending</option>
            <option value="DISPENSED">Dispensed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </section>

      <section className="section">
        <div className="doctor-main-grid">
          <div className="card premium-card">
            <div className="table-wrap">
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Summary</th>
                    <th>Status</th>
                    <th>Medicines</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item._id}>
                      <td>
                        {item?.patientRecord?.firstName
                          ? `${item.patientRecord.firstName} ${item.patientRecord.lastName || ""}`.trim()
                          : "Patient"}
                      </td>
                      <td>{item?.doctor?.name || "Doctor"}</td>
                      <td>{item.summary || item?.appointment?.serviceType || "Prescription"}</td>
                      <td>{item.status}</td>
                      <td>
                        {(item.medications || []).slice(0, 3).map((med, index) => (
                          <div key={index} className="muted">
                            {med.name} {med.dosage || ""}
                          </div>
                        ))}
                      </td>
                      <td>
                        <div className="doctor-actions-row">
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={item.status !== "CREATED"}
                            onClick={() => dispense(item)}
                          >
                            Dispense
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr>
                      <td colSpan={6} className="muted">No prescriptions in this queue.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card premium-card">
            <h3>Recent Pharmacy Referrals</h3>
            <div className="alert-stack">
              {referrals.slice(0, 8).map((item) => (
                <div key={item._id} className="card">
                  <strong>{item.patientName}</strong>
                  <p className="muted">{item.reason || "Medication handoff"}</p>
                  <p className="muted">
                    {item?.pharmacy?.name || "Pharmacy"} • {item.status}
                  </p>
                  <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                    <button type="button" className="btn-secondary" disabled={item.status === "ACCEPTED"} onClick={() => updateReferralStatus(item, "ACCEPTED")}>
                      Accept
                    </button>
                    <button type="button" className="btn-secondary" disabled={item.status === "FULFILLED"} onClick={() => updateReferralStatus(item, "FULFILLED")}>
                      Fulfill
                    </button>
                    <button type="button" className="btn-secondary" disabled={item.status === "CANCELLED"} onClick={() => updateReferralStatus(item, "CANCELLED")}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
              {!referrals.length ? <div className="muted">No referrals for your pharmacy.</div> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">Pending: {transfers.filter((t) => t.status === "Pending").length}</div>
          </div>
          {transferError ? <div className="muted">{transferError}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">No transfers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Route prescriptions to nearest linked pharmacy.</div>
            <div className="alert-item">Attach substitution notes before transfer completion.</div>
            <div className="alert-item">Flag stock-outs for transfer handover summary.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
