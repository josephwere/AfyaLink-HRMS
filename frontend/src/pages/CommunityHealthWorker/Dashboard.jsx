import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createChwChildGrowth,
  createChwChronic,
  createChwDiseaseReport,
  createChwGeoLog,
  createChwHousehold,
  createChwMaternal,
  createChwReferral,
  createChwVaccination,
  getChwDashboard,
  listChwFieldVisits,
  listChwHouseholds,
  listChwPerformance,
  listChwReferrals,
  recordChwFieldVisit,
} from "../../services/chwApi";
import apiFetch from "../../utils/apiFetch";
import {
  enqueueOfflineAction,
  listOfflineActions,
  startOfflineAutoSync,
} from "../../utils/offlineQueue";

const CATEGORIES = ["GENERAL", "MATERNAL_CHILD", "VACCINATION", "CHRONIC", "SURVEILLANCE"];

export default function CommunityHealthWorkerDashboard() {
  const navigate = useNavigate();
  const [dash, setDash] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [visits, setVisits] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingOffline, setPendingOffline] = useState(0);

  const [householdForm, setHouseholdForm] = useState({
    householdId: "",
    headOfHousehold: "",
    phone: "",
    address: "",
    ward: "",
    memberCount: 0,
    riskLevel: "LOW",
    nextVisitDate: "",
  });
  const [visitForm, setVisitForm] = useState({
    householdId: "",
    category: "GENERAL",
    status: "COMPLETED",
    notes: "",
    nextActionDate: "",
  });
  const [maternalForm, setMaternalForm] = useState({ motherName: "", trimester: 1, ancVisits: 0, highRiskPregnancy: false });
  const [childForm, setChildForm] = useState({ childName: "", ageMonths: 0, weightKg: 0, heightCm: 0, muacCm: 0, nutritionRisk: "LOW" });
  const [vaccForm, setVaccForm] = useState({ memberName: "", vaccine: "", dose: "", batchNumber: "" });
  const [chronicForm, setChronicForm] = useState({ patientName: "", condition: "", medicationCompliance: "GOOD", notes: "" });
  const [diseaseForm, setDiseaseForm] = useState({ disease: "", suspectedCases: 1, severity: "MEDIUM", location: "", notes: "" });
  const [referralForm, setReferralForm] = useState({ patientName: "", patientPhone: "", summary: "", urgency: "MEDIUM" });

  const kpis = useMemo(() => [
    { label: "Households Assigned", value: dash?.householdsAssigned ?? "—" },
    { label: "Visits Today", value: dash?.visitsToday ?? "—" },
    { label: "Vaccinations", value: dash?.vaccinationsDue ?? "—" },
    { label: "High-Risk Patients", value: dash?.highRiskPatients ?? "—" },
    { label: "Referrals Pending", value: dash?.referralsPending ?? "—" },
  ], [dash]);

  const load = async () => {
    const [d, h, v, r, p] = await Promise.all([
      getChwDashboard().catch(() => null),
      listChwHouseholds(q).catch(() => ({ items: [] })),
      listChwFieldVisits().catch(() => ({ items: [] })),
      listChwReferrals().catch(() => ({ items: [] })),
      listChwPerformance().catch(() => ({ items: [] })),
    ]);
    setDash(d);
    setHouseholds(h?.items || []);
    setVisits(v?.items || []);
    setReferrals(r?.items || []);
    setPerformance(p?.items || []);
    setPendingOffline(listOfflineActions().length);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const off = startOfflineAutoSync(async (item) => {
      await apiFetch(item.path, {
        method: item.method,
        body: item.body,
        _skipOfflineQueue: true,
      });
    });
    return off;
  }, []);

  const runOrQueue = async (path, method, body, immediateFn) => {
    setBusy(true);
    setMsg("");
    try {
      if (!navigator.onLine) {
        enqueueOfflineAction({ path, method, body, feature: "CHW" });
        setPendingOffline(listOfflineActions().length);
        setMsg("Offline: action queued and will sync automatically when online.");
        return;
      }
      await immediateFn();
      setMsg("Saved successfully.");
      await load();
    } catch (err) {
      const text = String(err?.message || "");
      if (text.toLowerCase().includes("network")) {
        enqueueOfflineAction({ path, method, body, feature: "CHW" });
        setPendingOffline(listOfflineActions().length);
        setMsg("Network unavailable: action queued for sync.");
      } else {
        setMsg(text || "Action failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitHousehold = async (e) => {
    e.preventDefault();
    const payload = { ...householdForm, memberCount: Number(householdForm.memberCount || 0) };
    await runOrQueue("/api/chw/households", "POST", payload, () => createChwHousehold(payload));
    setHouseholdForm({ householdId: "", headOfHousehold: "", phone: "", address: "", ward: "", memberCount: 0, riskLevel: "LOW", nextVisitDate: "" });
  };

  const submitVisit = async (e) => {
    e.preventDefault();
    if (!visitForm.householdId) {
      setMsg("Select household first");
      return;
    }
    const payload = {
      category: visitForm.category,
      status: visitForm.status,
      notes: visitForm.notes,
      nextActionDate: visitForm.nextActionDate || undefined,
    };
    await runOrQueue(`/api/chw/households/${visitForm.householdId}/visits`, "POST", payload, () =>
      recordChwFieldVisit(visitForm.householdId, payload)
    );
    setVisitForm({ householdId: "", category: "GENERAL", status: "COMPLETED", notes: "", nextActionDate: "" });
  };

  const submitMini = async (kind, payload, fn, reset) => {
    await runOrQueue(`/api/chw/${kind}`, "POST", payload, () => fn(payload));
    reset();
  };

  const captureGeo = async () => {
    if (!navigator.geolocation) {
      setMsg("Geolocation is not available on this device.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const payload = {
          event: "VISIT_LOG",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          note: "Auto capture",
          capturedAt: new Date().toISOString(),
        };
        await runOrQueue("/api/chw/geo-logs", "POST", payload, () => createChwGeoLog(payload));
      },
      () => {
        setBusy(false);
        setMsg("Failed to get GPS location.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="dashboard chw-dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Community Health Worker Console</h2>
          <p className="muted">
            Offline-first household care, maternal/child follow-up, vaccination, surveillance, and referrals.
          </p>
        </div>
        <div className="welcome-actions">
          <button className="btn-secondary" onClick={() => navigate("/communication")}>Communication</button>
          <button className="btn-secondary" onClick={captureGeo} disabled={busy}>Capture GPS</button>
        </div>
      </div>

      <section className="section">
        <div className="grid info-grid">
          {kpis.map((k) => (
            <div className="card" key={k.label}>
              <h3>{k.label}</h3>
              <p>{k.value}</p>
            </div>
          ))}
        </div>
        <p className="muted">
          Sync status: {navigator.onLine ? "Online" : "Offline"} • Pending offline actions: {pendingOffline}
        </p>
      </section>

      {msg ? <section className="section"><div className="card"><p className="muted">{msg}</p></div></section> : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>My Households</h3>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search household/patient"
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Household ID</th>
                  <th>Head</th>
                  <th>Members</th>
                  <th>Risk</th>
                  <th>Next Visit</th>
                </tr>
              </thead>
              <tbody>
                {households.map((h) => (
                  <tr key={h._id}>
                    <td>{h.householdId}</td>
                    <td>{h.headOfHousehold}</td>
                    <td>{h.memberCount}</td>
                    <td>{h.riskLevel}</td>
                    <td>{h.nextVisitDate ? new Date(h.nextVisitDate).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
                {!households.length ? <tr><td colSpan={5}>No households</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Add Household</h3>
          <form className="grid info-grid" onSubmit={submitHousehold}>
            <input required placeholder="Household ID" value={householdForm.householdId} onChange={(e) => setHouseholdForm({ ...householdForm, householdId: e.target.value })} />
            <input required placeholder="Head of household" value={householdForm.headOfHousehold} onChange={(e) => setHouseholdForm({ ...householdForm, headOfHousehold: e.target.value })} />
            <input placeholder="Phone" value={householdForm.phone} onChange={(e) => setHouseholdForm({ ...householdForm, phone: e.target.value })} />
            <input placeholder="Address" value={householdForm.address} onChange={(e) => setHouseholdForm({ ...householdForm, address: e.target.value })} />
            <input placeholder="Ward/Sub-county" value={householdForm.ward} onChange={(e) => setHouseholdForm({ ...householdForm, ward: e.target.value })} />
            <input type="number" placeholder="Members" value={householdForm.memberCount} onChange={(e) => setHouseholdForm({ ...householdForm, memberCount: e.target.value })} />
            <select value={householdForm.riskLevel} onChange={(e) => setHouseholdForm({ ...householdForm, riskLevel: e.target.value })}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
            <input type="date" value={householdForm.nextVisitDate} onChange={(e) => setHouseholdForm({ ...householdForm, nextVisitDate: e.target.value })} />
            <button className="btn-primary" disabled={busy}>Save Household</button>
          </form>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Record Field Visit</h3>
          <form className="grid info-grid" onSubmit={submitVisit}>
            <select value={visitForm.householdId} onChange={(e) => setVisitForm({ ...visitForm, householdId: e.target.value })} required>
              <option value="">Select household</option>
              {households.map((h) => <option key={h._id} value={h._id}>{h.householdId} - {h.headOfHousehold}</option>)}
            </select>
            <select value={visitForm.category} onChange={(e) => setVisitForm({ ...visitForm, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={visitForm.status} onChange={(e) => setVisitForm({ ...visitForm, status: e.target.value })}>
              <option value="COMPLETED">COMPLETED</option>
              <option value="MISSED">MISSED</option>
              <option value="PENDING">PENDING</option>
            </select>
            <input type="date" value={visitForm.nextActionDate} onChange={(e) => setVisitForm({ ...visitForm, nextActionDate: e.target.value })} />
            <textarea placeholder="Visit notes" value={visitForm.notes} onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} />
            <button className="btn-primary" disabled={busy}>Save Visit</button>
          </form>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Recent Visits</h3>
          <div className="alert-stack">
            {visits.slice(0, 8).map((v) => (
              <div key={v._id} className="alert-item">
                {v.category} • {v.status} • {new Date(v.createdAt).toLocaleString()}
              </div>
            ))}
            {!visits.length ? <div className="alert-item">No visits yet</div> : null}
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Maternal, Child, Vaccination, Chronic, Surveillance, Referrals</h3>
        <div className="grid info-grid">
          <button className="btn-secondary" onClick={() => submitMini("maternal", maternalForm, createChwMaternal, () => setMaternalForm({ motherName: "", trimester: 1, ancVisits: 0, highRiskPregnancy: false }))}>Save Maternal Record</button>
          <button className="btn-secondary" onClick={() => submitMini("child-growth", childForm, createChwChildGrowth, () => setChildForm({ childName: "", ageMonths: 0, weightKg: 0, heightCm: 0, muacCm: 0, nutritionRisk: "LOW" }))}>Save Child Growth</button>
          <button className="btn-secondary" onClick={() => submitMini("vaccinations", vaccForm, createChwVaccination, () => setVaccForm({ memberName: "", vaccine: "", dose: "", batchNumber: "" }))}>Save Vaccination</button>
          <button className="btn-secondary" onClick={() => submitMini("chronic", chronicForm, createChwChronic, () => setChronicForm({ patientName: "", condition: "", medicationCompliance: "GOOD", notes: "" }))}>Save Chronic Follow-up</button>
          <button className="btn-secondary" onClick={() => submitMini("disease-reports", diseaseForm, createChwDiseaseReport, () => setDiseaseForm({ disease: "", suspectedCases: 1, severity: "MEDIUM", location: "", notes: "" }))}>Submit Disease Report</button>
          <button className="btn-secondary" onClick={() => submitMini("referrals", referralForm, createChwReferral, () => setReferralForm({ patientName: "", patientPhone: "", summary: "", urgency: "MEDIUM" }))}>Create Referral</button>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card">
          <h3>Referrals</h3>
          <div className="alert-stack">
            {referrals.slice(0, 8).map((r) => (
              <div key={r._id} className="alert-item">
                {r.patientName} • {r.urgency} • {r.status}
              </div>
            ))}
            {!referrals.length ? <div className="alert-item">No referrals</div> : null}
          </div>
        </div>
        <div className="card">
          <h3>Performance</h3>
          <div className="alert-stack">
            {(performance || []).slice(0, 5).map((p, i) => (
              <div key={`${p.periodDate}-${i}`} className="alert-item">
                Visits: {p.visitsCompleted} • Missed: {p.missedVisits} • Vaccinations: {p.vaccinationsAdministered}
              </div>
            ))}
            {!performance.length ? <div className="alert-item">No performance logs</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
