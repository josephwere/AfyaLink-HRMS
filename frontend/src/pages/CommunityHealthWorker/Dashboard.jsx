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
  const [maternalForm, setMaternalForm] = useState({
    household: "",
    motherName: "",
    trimester: 1,
    ancVisits: 0,
    expectedDeliveryDate: "",
    postnatalVisits: 0,
    highRiskPregnancy: false,
    notes: "",
  });
  const [childForm, setChildForm] = useState({
    household: "",
    childName: "",
    ageMonths: 0,
    weightKg: 0,
    heightCm: 0,
    muacCm: 0,
    nutritionRisk: "LOW",
    notes: "",
  });
  const [vaccForm, setVaccForm] = useState({
    household: "",
    memberName: "",
    vaccine: "",
    dose: "",
    batchNumber: "",
    expiryDate: "",
    adverseEvent: "",
    coldChainStatus: "OK",
  });
  const [chronicForm, setChronicForm] = useState({
    household: "",
    patientName: "",
    condition: "",
    medicationCompliance: "GOOD",
    followUpDate: "",
    escalationRequired: false,
    notes: "",
  });
  const [diseaseForm, setDiseaseForm] = useState({
    disease: "",
    suspectedCases: 1,
    severity: "MEDIUM",
    location: "",
    ward: "",
    symptoms: "",
    notes: "",
    reportedToPublicHealth: false,
  });
  const [referralForm, setReferralForm] = useState({
    patientName: "",
    patientPhone: "",
    summary: "",
    urgency: "MEDIUM",
    receivingHospital: "",
  });

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

  const submitMaternal = async (e) => {
    e.preventDefault();
    const payload = {
      ...maternalForm,
      trimester: Number(maternalForm.trimester || 1),
      ancVisits: Number(maternalForm.ancVisits || 0),
      postnatalVisits: Number(maternalForm.postnatalVisits || 0),
      household: maternalForm.household || undefined,
      expectedDeliveryDate: maternalForm.expectedDeliveryDate || undefined,
    };
    await submitMini("maternal", payload, createChwMaternal, () =>
      setMaternalForm({
        household: "",
        motherName: "",
        trimester: 1,
        ancVisits: 0,
        expectedDeliveryDate: "",
        postnatalVisits: 0,
        highRiskPregnancy: false,
        notes: "",
      })
    );
  };

  const submitChildGrowth = async (e) => {
    e.preventDefault();
    const payload = {
      ...childForm,
      household: childForm.household || undefined,
      ageMonths: Number(childForm.ageMonths || 0),
      weightKg: Number(childForm.weightKg || 0),
      heightCm: Number(childForm.heightCm || 0),
      muacCm: Number(childForm.muacCm || 0),
    };
    await submitMini("child-growth", payload, createChwChildGrowth, () =>
      setChildForm({
        household: "",
        childName: "",
        ageMonths: 0,
        weightKg: 0,
        heightCm: 0,
        muacCm: 0,
        nutritionRisk: "LOW",
        notes: "",
      })
    );
  };

  const submitVaccination = async (e) => {
    e.preventDefault();
    const payload = {
      ...vaccForm,
      household: vaccForm.household || undefined,
      expiryDate: vaccForm.expiryDate || undefined,
    };
    await submitMini("vaccinations", payload, createChwVaccination, () =>
      setVaccForm({
        household: "",
        memberName: "",
        vaccine: "",
        dose: "",
        batchNumber: "",
        expiryDate: "",
        adverseEvent: "",
        coldChainStatus: "OK",
      })
    );
  };

  const submitChronic = async (e) => {
    e.preventDefault();
    const payload = {
      ...chronicForm,
      household: chronicForm.household || undefined,
      followUpDate: chronicForm.followUpDate || undefined,
    };
    await submitMini("chronic", payload, createChwChronic, () =>
      setChronicForm({
        household: "",
        patientName: "",
        condition: "",
        medicationCompliance: "GOOD",
        followUpDate: "",
        escalationRequired: false,
        notes: "",
      })
    );
  };

  const submitDisease = async (e) => {
    e.preventDefault();
    const payload = {
      ...diseaseForm,
      suspectedCases: Number(diseaseForm.suspectedCases || 1),
      symptoms: diseaseForm.symptoms
        ? diseaseForm.symptoms
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    };
    await submitMini("disease-reports", payload, createChwDiseaseReport, () =>
      setDiseaseForm({
        disease: "",
        suspectedCases: 1,
        severity: "MEDIUM",
        location: "",
        ward: "",
        symptoms: "",
        notes: "",
        reportedToPublicHealth: false,
      })
    );
  };

  const submitReferral = async (e) => {
    e.preventDefault();
    const payload = {
      ...referralForm,
      receivingHospital: referralForm.receivingHospital || undefined,
    };
    await submitMini("referrals", payload, createChwReferral, () =>
      setReferralForm({
        patientName: "",
        patientPhone: "",
        summary: "",
        urgency: "MEDIUM",
        receivingHospital: "",
      })
    );
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
          <button type="button" className="btn-secondary" onClick={() => navigate("/communication")}>Communication</button>
          <button type="button" className="btn-secondary" onClick={captureGeo} disabled={busy}>Capture GPS</button>
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
          <form className="form" onSubmit={submitHousehold}>
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
            <button type="submit" className="btn-primary" disabled={busy}>Save Household</button>
          </form>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Record Field Visit</h3>
          <form className="form" onSubmit={submitVisit}>
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
            <div>
              <button type="submit" className="btn-primary" disabled={busy} style={{ width: "auto", minWidth: 120 }}>
                Save Visit
              </button>
            </div>
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
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 12 }}>
          <form className="card form" onSubmit={submitMaternal}>
            <h3>Maternal</h3>
            <select value={maternalForm.household} onChange={(e) => setMaternalForm({ ...maternalForm, household: e.target.value })}>
              <option value="">Select household (optional)</option>
              {households.map((h) => <option key={h._id} value={h._id}>{h.householdId} - {h.headOfHousehold}</option>)}
            </select>
            <input required placeholder="Mother name" value={maternalForm.motherName} onChange={(e) => setMaternalForm({ ...maternalForm, motherName: e.target.value })} />
            <input type="number" min="1" max="3" placeholder="Trimester (1-3)" value={maternalForm.trimester} onChange={(e) => setMaternalForm({ ...maternalForm, trimester: e.target.value })} />
            <input type="number" min="0" placeholder="ANC visits" value={maternalForm.ancVisits} onChange={(e) => setMaternalForm({ ...maternalForm, ancVisits: e.target.value })} />
            <input type="date" value={maternalForm.expectedDeliveryDate} onChange={(e) => setMaternalForm({ ...maternalForm, expectedDeliveryDate: e.target.value })} />
            <input type="number" min="0" placeholder="Postnatal visits" value={maternalForm.postnatalVisits} onChange={(e) => setMaternalForm({ ...maternalForm, postnatalVisits: e.target.value })} />
            <label><input type="checkbox" checked={maternalForm.highRiskPregnancy} onChange={(e) => setMaternalForm({ ...maternalForm, highRiskPregnancy: e.target.checked })} /> High-risk pregnancy</label>
            <textarea placeholder="Notes" value={maternalForm.notes} onChange={(e) => setMaternalForm({ ...maternalForm, notes: e.target.value })} />
            <button className="btn-primary" type="submit" disabled={busy}>Save Maternal Record</button>
          </form>

          <form className="card form" onSubmit={submitChildGrowth}>
            <h3>Child Growth</h3>
            <select value={childForm.household} onChange={(e) => setChildForm({ ...childForm, household: e.target.value })}>
              <option value="">Select household (optional)</option>
              {households.map((h) => <option key={h._id} value={h._id}>{h.householdId} - {h.headOfHousehold}</option>)}
            </select>
            <input required placeholder="Child name" value={childForm.childName} onChange={(e) => setChildForm({ ...childForm, childName: e.target.value })} />
            <input type="number" min="0" placeholder="Age (months)" value={childForm.ageMonths} onChange={(e) => setChildForm({ ...childForm, ageMonths: e.target.value })} />
            <input type="number" step="0.01" min="0" placeholder="Weight (kg)" value={childForm.weightKg} onChange={(e) => setChildForm({ ...childForm, weightKg: e.target.value })} />
            <input type="number" step="0.1" min="0" placeholder="Height (cm)" value={childForm.heightCm} onChange={(e) => setChildForm({ ...childForm, heightCm: e.target.value })} />
            <input type="number" step="0.1" min="0" placeholder="MUAC (cm)" value={childForm.muacCm} onChange={(e) => setChildForm({ ...childForm, muacCm: e.target.value })} />
            <select value={childForm.nutritionRisk} onChange={(e) => setChildForm({ ...childForm, nutritionRisk: e.target.value })}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
            <textarea placeholder="Notes" value={childForm.notes} onChange={(e) => setChildForm({ ...childForm, notes: e.target.value })} />
            <button className="btn-primary" type="submit" disabled={busy}>Save Child Growth</button>
          </form>

          <form className="card form" onSubmit={submitVaccination}>
            <h3>Vaccination</h3>
            <select value={vaccForm.household} onChange={(e) => setVaccForm({ ...vaccForm, household: e.target.value })}>
              <option value="">Select household (optional)</option>
              {households.map((h) => <option key={h._id} value={h._id}>{h.householdId} - {h.headOfHousehold}</option>)}
            </select>
            <input required placeholder="Member name" value={vaccForm.memberName} onChange={(e) => setVaccForm({ ...vaccForm, memberName: e.target.value })} />
            <input required placeholder="Vaccine" value={vaccForm.vaccine} onChange={(e) => setVaccForm({ ...vaccForm, vaccine: e.target.value })} />
            <input required placeholder="Dose" value={vaccForm.dose} onChange={(e) => setVaccForm({ ...vaccForm, dose: e.target.value })} />
            <input placeholder="Batch number" value={vaccForm.batchNumber} onChange={(e) => setVaccForm({ ...vaccForm, batchNumber: e.target.value })} />
            <input type="date" value={vaccForm.expiryDate} onChange={(e) => setVaccForm({ ...vaccForm, expiryDate: e.target.value })} />
            <input placeholder="Adverse event (optional)" value={vaccForm.adverseEvent} onChange={(e) => setVaccForm({ ...vaccForm, adverseEvent: e.target.value })} />
            <select value={vaccForm.coldChainStatus} onChange={(e) => setVaccForm({ ...vaccForm, coldChainStatus: e.target.value })}>
              <option value="OK">OK</option>
              <option value="WARNING">WARNING</option>
              <option value="BREACH">BREACH</option>
            </select>
            <button className="btn-primary" type="submit" disabled={busy}>Save Vaccination</button>
          </form>

          <form className="card form" onSubmit={submitChronic}>
            <h3>Chronic Follow-up</h3>
            <select value={chronicForm.household} onChange={(e) => setChronicForm({ ...chronicForm, household: e.target.value })}>
              <option value="">Select household (optional)</option>
              {households.map((h) => <option key={h._id} value={h._id}>{h.householdId} - {h.headOfHousehold}</option>)}
            </select>
            <input required placeholder="Patient name" value={chronicForm.patientName} onChange={(e) => setChronicForm({ ...chronicForm, patientName: e.target.value })} />
            <input required placeholder="Condition" value={chronicForm.condition} onChange={(e) => setChronicForm({ ...chronicForm, condition: e.target.value })} />
            <select value={chronicForm.medicationCompliance} onChange={(e) => setChronicForm({ ...chronicForm, medicationCompliance: e.target.value })}>
              <option value="GOOD">GOOD</option>
              <option value="FAIR">FAIR</option>
              <option value="POOR">POOR</option>
            </select>
            <input type="date" value={chronicForm.followUpDate} onChange={(e) => setChronicForm({ ...chronicForm, followUpDate: e.target.value })} />
            <label><input type="checkbox" checked={chronicForm.escalationRequired} onChange={(e) => setChronicForm({ ...chronicForm, escalationRequired: e.target.checked })} /> Escalation required</label>
            <textarea placeholder="Follow-up notes" value={chronicForm.notes} onChange={(e) => setChronicForm({ ...chronicForm, notes: e.target.value })} />
            <button className="btn-primary" type="submit" disabled={busy}>Save Chronic Follow-up</button>
          </form>

          <form className="card form" onSubmit={submitDisease}>
            <h3>Surveillance</h3>
            <input required placeholder="Disease" value={diseaseForm.disease} onChange={(e) => setDiseaseForm({ ...diseaseForm, disease: e.target.value })} />
            <input type="number" min="1" placeholder="Suspected cases" value={diseaseForm.suspectedCases} onChange={(e) => setDiseaseForm({ ...diseaseForm, suspectedCases: e.target.value })} />
            <select value={diseaseForm.severity} onChange={(e) => setDiseaseForm({ ...diseaseForm, severity: e.target.value })}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <input placeholder="Location" value={diseaseForm.location} onChange={(e) => setDiseaseForm({ ...diseaseForm, location: e.target.value })} />
            <input placeholder="Ward/Sub-county" value={diseaseForm.ward} onChange={(e) => setDiseaseForm({ ...diseaseForm, ward: e.target.value })} />
            <input placeholder="Symptoms (comma separated)" value={diseaseForm.symptoms} onChange={(e) => setDiseaseForm({ ...diseaseForm, symptoms: e.target.value })} />
            <label><input type="checkbox" checked={diseaseForm.reportedToPublicHealth} onChange={(e) => setDiseaseForm({ ...diseaseForm, reportedToPublicHealth: e.target.checked })} /> Reported to public health</label>
            <textarea placeholder="Disease report notes" value={diseaseForm.notes} onChange={(e) => setDiseaseForm({ ...diseaseForm, notes: e.target.value })} />
            <button className="btn-primary" type="submit" disabled={busy}>Submit Disease Report</button>
          </form>

          <form className="card form" onSubmit={submitReferral}>
            <h3>Referrals</h3>
            <input required placeholder="Patient name" value={referralForm.patientName} onChange={(e) => setReferralForm({ ...referralForm, patientName: e.target.value })} />
            <input placeholder="Patient phone" value={referralForm.patientPhone} onChange={(e) => setReferralForm({ ...referralForm, patientPhone: e.target.value })} />
            <select value={referralForm.urgency} onChange={(e) => setReferralForm({ ...referralForm, urgency: e.target.value })}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <input placeholder="Receiving hospital ID (optional)" value={referralForm.receivingHospital} onChange={(e) => setReferralForm({ ...referralForm, receivingHospital: e.target.value })} />
            <textarea required placeholder="Referral summary" value={referralForm.summary} onChange={(e) => setReferralForm({ ...referralForm, summary: e.target.value })} />
            <button className="btn-primary" type="submit" disabled={busy}>Create Referral</button>
          </form>
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
