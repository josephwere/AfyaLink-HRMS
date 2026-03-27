import React, { useEffect, useMemo, useState } from "react";
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
import { listTransfers } from "../../services/transferApi";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import {
  enqueueOfflineAction,
  listOfflineActions,
  startOfflineAutoSync,
} from "../../utils/offlineQueue";

const CATEGORIES = ["GENERAL", "MATERNAL_CHILD", "VACCINATION", "CHRONIC", "SURVEILLANCE"];

export default function CommunityHealthWorkerDashboard() {
  const { translateText } = useAppLanguage();
  const [dash, setDash] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [visits, setVisits] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [transferAlerts, setTransferAlerts] = useState([]);
  const [transferError, setTransferError] = useState("");
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
    const [d, h, v, r, p, t] = await Promise.all([
      getChwDashboard().catch(() => null),
      listChwHouseholds(q).catch(() => ({ items: [] })),
      listChwFieldVisits().catch(() => ({ items: [] })),
      listChwReferrals().catch(() => ({ items: [] })),
      listChwPerformance().catch(() => ({ items: [] })),
      listTransfers({ limit: 6, scope: "facility" }).catch((err) => ({ items: [], error: err })),
    ]);
    setDash(d);
    setHouseholds(h?.items || []);
    setVisits(v?.items || []);
    setReferrals(r?.items || []);
    setPerformance(p?.items || []);
    const tItems = Array.isArray(t?.items) ? t.items : [];
    setTransferAlerts(tItems);
    setTransferError(t?.error?.message || "");
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

  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const brief = {
    kicker: translateText("Sync"),
    title: online ? translateText("Online") : translateText("Offline"),
    body: translateText("Pending offline actions") + `: ${pendingOffline}`,
    items: [
      {
        label: translateText("Pending offline actions"),
        value: pendingOffline,
        tone: pendingOffline > 0 ? "warn" : "good",
      },
      {
        label: translateText("Network"),
        value: online ? translateText("Online") : translateText("Offline"),
        tone: online ? "good" : "risk",
      },
    ],
  };

  return (
    <DashboardHomeShell
      shellKey="operations_chw"
      kicker={translateText("Operations")}
      title={translateText("Community Health")}
      subtitle={translateText("Offline-first household care, maternal/child follow-up, vaccination, surveillance, and referrals.")}
      actions={[
        { label: translateText("Refresh"), onClick: load, variant: "secondary", disabled: busy },
        { label: translateText("Communication Center"), path: "/app/platform/inbox/communication", variant: "secondary" },
        { label: translateText("Capture GPS"), onClick: captureGeo, variant: "secondary", disabled: busy },
      ]}
      stats={kpis.map((k) => ({ label: translateText(k.label), value: k.value }))}
      brief={brief}
    >

      {msg ? <section className="section"><div className="card"><p className="muted">{msg}</p></div></section> : null}

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>My Households</h3>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search household/patient"
            data-ai-label="Household Search"
            data-ai-aliases="search household|find patient household|chw search"
            data-ai-intent="filter"
            data-ai-priority="low"
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
            <input required placeholder="Household ID" value={householdForm.householdId} onChange={(e) => setHouseholdForm({ ...householdForm, householdId: e.target.value })} data-ai-label="Household ID" data-ai-aliases="chw household id|community household id|home id" data-ai-priority="high" />
            <input required placeholder="Head of household" value={householdForm.headOfHousehold} onChange={(e) => setHouseholdForm({ ...householdForm, headOfHousehold: e.target.value })} data-ai-label="Head of Household" data-ai-aliases="household head|family head|primary household contact" data-ai-priority="high" />
            <input placeholder="Phone" value={householdForm.phone} onChange={(e) => setHouseholdForm({ ...householdForm, phone: e.target.value })} data-ai-label="Household Phone" data-ai-aliases="phone number|household contact|mobile number" />
            <input placeholder="Address" value={householdForm.address} onChange={(e) => setHouseholdForm({ ...householdForm, address: e.target.value })} data-ai-label="Household Address" data-ai-aliases="address|village address|home address" />
            <input placeholder="Ward/Sub-county" value={householdForm.ward} onChange={(e) => setHouseholdForm({ ...householdForm, ward: e.target.value })} data-ai-label="Ward/Sub-county" data-ai-aliases="ward|sub county|location ward" />
            <input type="number" placeholder="Members" value={householdForm.memberCount} onChange={(e) => setHouseholdForm({ ...householdForm, memberCount: e.target.value })} data-ai-label="Household Members" data-ai-aliases="member count|number of members|family size" />
            <select value={householdForm.riskLevel} onChange={(e) => setHouseholdForm({ ...householdForm, riskLevel: e.target.value })} data-ai-label="Household Risk Level" data-ai-aliases="risk level|family risk|household vulnerability" data-ai-priority="high">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
            <input type="date" value={householdForm.nextVisitDate} onChange={(e) => setHouseholdForm({ ...householdForm, nextVisitDate: e.target.value })} data-ai-label="Next Visit Date" data-ai-aliases="planned visit date|follow-up date|next household visit" data-ai-priority="high" />
            <button type="submit" className="btn-primary" disabled={busy}>Save Household</button>
          </form>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Record Field Visit</h3>
          <form className="form" onSubmit={submitVisit}>
            <select value={visitForm.householdId} onChange={(e) => setVisitForm({ ...visitForm, householdId: e.target.value })} required data-ai-label="Visit Household" data-ai-aliases="household|selected household|field visit household" data-ai-widget="household-picker" data-ai-priority="high">
              <option value="">Select household</option>
              {households.map((h) => <option key={h._id} value={h._id}>{h.householdId} - {h.headOfHousehold}</option>)}
            </select>
            <select value={visitForm.category} onChange={(e) => setVisitForm({ ...visitForm, category: e.target.value })} data-ai-label="Visit Category" data-ai-aliases="field visit category|visit type|chw activity category" data-ai-priority="high">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={visitForm.status} onChange={(e) => setVisitForm({ ...visitForm, status: e.target.value })} data-ai-label="Visit Status" data-ai-aliases="visit outcome|field visit status|chw visit status">
              <option value="COMPLETED">COMPLETED</option>
              <option value="MISSED">MISSED</option>
              <option value="PENDING">PENDING</option>
            </select>
            <input type="date" value={visitForm.nextActionDate} onChange={(e) => setVisitForm({ ...visitForm, nextActionDate: e.target.value })} data-ai-label="Next Action Date" data-ai-aliases="next visit date|follow-up action date|next action" data-ai-priority="high" />
            <textarea placeholder="Visit notes" value={visitForm.notes} onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} data-ai-label="Visit Notes" data-ai-aliases="field notes|visit summary|chw notes" data-ai-priority="high" />
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
            {!visits.length ? <div className="alert-item">No visits</div> : null}
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Maternal, Child, Vaccination, Chronic, Surveillance, Referrals</h3>
        <div className="grid info-grid" style={{ gap: 12 }}>
          <form className="card form" onSubmit={submitMaternal}>
            <h3>Maternal</h3>
            <select value={maternalForm.household} onChange={(e) => setMaternalForm({ ...maternalForm, household: e.target.value })} data-ai-label="Maternal Household" data-ai-aliases="household|maternal household|mother household" data-ai-widget="household-picker">
              <option value="">Select household (optional)</option>
              {households.map((h) => <option key={h._id} value={h._id}>{h.householdId} - {h.headOfHousehold}</option>)}
            </select>
            <input required placeholder="Mother name" value={maternalForm.motherName} onChange={(e) => setMaternalForm({ ...maternalForm, motherName: e.target.value })} data-ai-label="Mother Name" data-ai-aliases="pregnant mother|maternal patient|mother full name" data-ai-priority="high" />
            <input type="number" min="1" max="3" placeholder="Trimester (1-3)" value={maternalForm.trimester} onChange={(e) => setMaternalForm({ ...maternalForm, trimester: e.target.value })} data-ai-label="Trimester" data-ai-aliases="pregnancy trimester|maternal trimester" data-ai-priority="high" />
            <input type="number" min="0" placeholder="ANC visits" value={maternalForm.ancVisits} onChange={(e) => setMaternalForm({ ...maternalForm, ancVisits: e.target.value })} data-ai-label="ANC Visits" data-ai-aliases="antenatal visits|anc count|clinic visits" />
            <input type="date" value={maternalForm.expectedDeliveryDate} onChange={(e) => setMaternalForm({ ...maternalForm, expectedDeliveryDate: e.target.value })} data-ai-label="Expected Delivery Date" data-ai-aliases="edd|delivery date|expected birth date" data-ai-priority="high" />
            <input type="number" min="0" placeholder="Postnatal visits" value={maternalForm.postnatalVisits} onChange={(e) => setMaternalForm({ ...maternalForm, postnatalVisits: e.target.value })} data-ai-label="Postnatal Visits" data-ai-aliases="pnc visits|post natal visits" />
            <label><input type="checkbox" checked={maternalForm.highRiskPregnancy} onChange={(e) => setMaternalForm({ ...maternalForm, highRiskPregnancy: e.target.checked })} /> High-risk pregnancy</label>
            <textarea placeholder="Notes" value={maternalForm.notes} onChange={(e) => setMaternalForm({ ...maternalForm, notes: e.target.value })} data-ai-label="Maternal Notes" data-ai-aliases="maternal notes|pregnancy notes|maternal summary" />
            <button className="btn-primary" type="submit" disabled={busy}>Save Maternal Record</button>
          </form>

          <form className="card form" onSubmit={submitChildGrowth}>
            <h3>Child Growth</h3>
            <select value={childForm.household} onChange={(e) => setChildForm({ ...childForm, household: e.target.value })} data-ai-label="Child Household" data-ai-aliases="household|child household|family household" data-ai-widget="household-picker">
              <option value="">Select household (optional)</option>
              {households.map((h) => <option key={h._id} value={h._id}>{h.householdId} - {h.headOfHousehold}</option>)}
            </select>
            <input required placeholder="Child name" value={childForm.childName} onChange={(e) => setChildForm({ ...childForm, childName: e.target.value })} data-ai-label="Child Name" data-ai-aliases="child patient|child full name|baby name" data-ai-priority="high" />
            <input type="number" min="0" placeholder="Age (months)" value={childForm.ageMonths} onChange={(e) => setChildForm({ ...childForm, ageMonths: e.target.value })} data-ai-label="Age (Months)" data-ai-aliases="child age months|infant age" />
            <input type="number" step="0.01" min="0" placeholder="Weight (kg)" value={childForm.weightKg} onChange={(e) => setChildForm({ ...childForm, weightKg: e.target.value })} data-ai-label="Weight (kg)" data-ai-aliases="child weight|weight kilograms" />
            <input type="number" step="0.1" min="0" placeholder="Height (cm)" value={childForm.heightCm} onChange={(e) => setChildForm({ ...childForm, heightCm: e.target.value })} data-ai-label="Height (cm)" data-ai-aliases="child height|height centimeters" />
            <input type="number" step="0.1" min="0" placeholder="MUAC (cm)" value={childForm.muacCm} onChange={(e) => setChildForm({ ...childForm, muacCm: e.target.value })} data-ai-label="MUAC (cm)" data-ai-aliases="muac|mid upper arm circumference" />
            <select value={childForm.nutritionRisk} onChange={(e) => setChildForm({ ...childForm, nutritionRisk: e.target.value })} data-ai-label="Nutrition Risk" data-ai-aliases="nutrition status|malnutrition risk|child nutrition risk" data-ai-priority="high">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
            <textarea placeholder="Notes" value={childForm.notes} onChange={(e) => setChildForm({ ...childForm, notes: e.target.value })} data-ai-label="Child Growth Notes" data-ai-aliases="growth notes|child notes|nutrition notes" />
            <button className="btn-primary" type="submit" disabled={busy}>Save Child Growth</button>
          </form>

          <form className="card form" onSubmit={submitVaccination}>
            <h3>Vaccination</h3>
            <select value={vaccForm.household} onChange={(e) => setVaccForm({ ...vaccForm, household: e.target.value })} data-ai-label="Vaccination Household" data-ai-aliases="household|vaccination household|member household" data-ai-widget="household-picker">
              <option value="">Select household (optional)</option>
              {households.map((h) => <option key={h._id} value={h._id}>{h.householdId} - {h.headOfHousehold}</option>)}
            </select>
            <input required placeholder="Member name" value={vaccForm.memberName} onChange={(e) => setVaccForm({ ...vaccForm, memberName: e.target.value })} data-ai-label="Member Name" data-ai-aliases="patient name|vaccine recipient|member full name" data-ai-priority="high" />
            <input required placeholder="Vaccine" value={vaccForm.vaccine} onChange={(e) => setVaccForm({ ...vaccForm, vaccine: e.target.value })} data-ai-label="Vaccine" data-ai-aliases="vaccine name|immunization vaccine|vaccination type" data-ai-priority="high" />
            <input required placeholder="Dose" value={vaccForm.dose} onChange={(e) => setVaccForm({ ...vaccForm, dose: e.target.value })} data-ai-label="Dose" data-ai-aliases="vaccine dose|dose number|immunization dose" data-ai-priority="high" />
            <input placeholder="Batch number" value={vaccForm.batchNumber} onChange={(e) => setVaccForm({ ...vaccForm, batchNumber: e.target.value })} data-ai-label="Batch Number" data-ai-aliases="lot number|vaccine batch|batch id" />
            <input type="date" value={vaccForm.expiryDate} onChange={(e) => setVaccForm({ ...vaccForm, expiryDate: e.target.value })} data-ai-label="Expiry Date" data-ai-aliases="vaccine expiry|batch expiry|expiration date" />
            <input placeholder="Adverse event (optional)" value={vaccForm.adverseEvent} onChange={(e) => setVaccForm({ ...vaccForm, adverseEvent: e.target.value })} data-ai-label="Adverse Event" data-ai-aliases="reaction|side effect|adverse reaction" />
            <select value={vaccForm.coldChainStatus} onChange={(e) => setVaccForm({ ...vaccForm, coldChainStatus: e.target.value })} data-ai-label="Cold Chain Status" data-ai-aliases="cold chain|storage status|vaccine cold chain" data-ai-priority="high">
              <option value="OK">OK</option>
              <option value="WARNING">WARNING</option>
              <option value="BREACH">BREACH</option>
            </select>
            <button className="btn-primary" type="submit" disabled={busy}>Save Vaccination</button>
          </form>

          <form className="card form" onSubmit={submitChronic}>
            <h3>Chronic Follow-up</h3>
            <select value={chronicForm.household} onChange={(e) => setChronicForm({ ...chronicForm, household: e.target.value })} data-ai-label="Chronic Follow-up Household" data-ai-aliases="household|chronic care household|patient household" data-ai-widget="household-picker">
              <option value="">Select household (optional)</option>
              {households.map((h) => <option key={h._id} value={h._id}>{h.householdId} - {h.headOfHousehold}</option>)}
            </select>
            <input required placeholder="Patient name" value={chronicForm.patientName} onChange={(e) => setChronicForm({ ...chronicForm, patientName: e.target.value })} data-ai-label="Patient Name" data-ai-aliases="chronic patient|patient full name|follow-up patient" data-ai-priority="high" />
            <input required placeholder="Condition" value={chronicForm.condition} onChange={(e) => setChronicForm({ ...chronicForm, condition: e.target.value })} data-ai-label="Condition" data-ai-aliases="diagnosis|chronic condition|medical condition" data-ai-priority="high" />
            <select value={chronicForm.medicationCompliance} onChange={(e) => setChronicForm({ ...chronicForm, medicationCompliance: e.target.value })} data-ai-label="Medication Compliance" data-ai-aliases="adherence|medication adherence|compliance status" data-ai-priority="high">
              <option value="GOOD">GOOD</option>
              <option value="FAIR">FAIR</option>
              <option value="POOR">POOR</option>
            </select>
            <input type="date" value={chronicForm.followUpDate} onChange={(e) => setChronicForm({ ...chronicForm, followUpDate: e.target.value })} data-ai-label="Follow-up Date" data-ai-aliases="review date|next follow-up|return date" data-ai-priority="high" />
            <label><input type="checkbox" checked={chronicForm.escalationRequired} onChange={(e) => setChronicForm({ ...chronicForm, escalationRequired: e.target.checked })} /> Escalation required</label>
            <textarea placeholder="Follow-up notes" value={chronicForm.notes} onChange={(e) => setChronicForm({ ...chronicForm, notes: e.target.value })} data-ai-label="Follow-up Notes" data-ai-aliases="chronic notes|review notes|follow-up summary" />
            <button className="btn-primary" type="submit" disabled={busy}>Save Chronic Follow-up</button>
          </form>

          <form className="card form" onSubmit={submitDisease}>
            <h3>Surveillance</h3>
            <input required placeholder="Disease" value={diseaseForm.disease} onChange={(e) => setDiseaseForm({ ...diseaseForm, disease: e.target.value })} data-ai-label="Disease" data-ai-aliases="suspected disease|condition outbreak|surveillance disease" data-ai-priority="high" />
            <input type="number" min="1" placeholder="Suspected cases" value={diseaseForm.suspectedCases} onChange={(e) => setDiseaseForm({ ...diseaseForm, suspectedCases: e.target.value })} data-ai-label="Suspected Cases" data-ai-aliases="case count|number of suspected cases|cases" data-ai-priority="high" />
            <select value={diseaseForm.severity} onChange={(e) => setDiseaseForm({ ...diseaseForm, severity: e.target.value })} data-ai-label="Severity" data-ai-aliases="outbreak severity|case severity|alert level" data-ai-priority="high">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <input placeholder="Location" value={diseaseForm.location} onChange={(e) => setDiseaseForm({ ...diseaseForm, location: e.target.value })} data-ai-label="Location" data-ai-aliases="outbreak location|case location|community location" />
            <input placeholder="Ward/Sub-county" value={diseaseForm.ward} onChange={(e) => setDiseaseForm({ ...diseaseForm, ward: e.target.value })} data-ai-label="Ward/Sub-county" data-ai-aliases="ward|sub county|surveillance ward" />
            <input placeholder="Symptoms (comma separated)" value={diseaseForm.symptoms} onChange={(e) => setDiseaseForm({ ...diseaseForm, symptoms: e.target.value })} data-ai-label="Symptoms" data-ai-aliases="symptom list|presenting symptoms|signs and symptoms" data-ai-priority="high" />
            <label><input type="checkbox" checked={diseaseForm.reportedToPublicHealth} onChange={(e) => setDiseaseForm({ ...diseaseForm, reportedToPublicHealth: e.target.checked })} /> Reported to public health</label>
            <textarea placeholder="Disease report notes" value={diseaseForm.notes} onChange={(e) => setDiseaseForm({ ...diseaseForm, notes: e.target.value })} data-ai-label="Disease Report Notes" data-ai-aliases="surveillance notes|outbreak notes|disease summary" />
            <button className="btn-primary" type="submit" disabled={busy}>Submit Disease Report</button>
          </form>

          <form className="card form" onSubmit={submitReferral}>
            <h3>Referrals</h3>
            <input required placeholder="Patient name" value={referralForm.patientName} onChange={(e) => setReferralForm({ ...referralForm, patientName: e.target.value })} data-ai-label="Patient Name" data-ai-aliases="referral patient|patient full name|referred patient" data-ai-priority="high" />
            <input placeholder="Patient phone" value={referralForm.patientPhone} onChange={(e) => setReferralForm({ ...referralForm, patientPhone: e.target.value })} data-ai-label="Patient Phone" data-ai-aliases="patient contact|patient mobile|phone number" />
            <select value={referralForm.urgency} onChange={(e) => setReferralForm({ ...referralForm, urgency: e.target.value })} data-ai-label="Referral Urgency" data-ai-aliases="urgency|priority|referral priority" data-ai-priority="high">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <input placeholder="Receiving hospital ID (optional)" value={referralForm.receivingHospital} onChange={(e) => setReferralForm({ ...referralForm, receivingHospital: e.target.value })} data-ai-label="Receiving Hospital" data-ai-aliases="destination hospital|receiving facility|referral hospital" data-ai-widget="hospital-picker" data-ai-priority="high" />
            <textarea required placeholder="Referral summary" value={referralForm.summary} onChange={(e) => setReferralForm({ ...referralForm, summary: e.target.value })} data-ai-label="Referral Summary" data-ai-aliases="referral notes|handover summary|clinical summary" data-ai-priority="high" />
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
            {!performance.length ? <div className="alert-item">No performance data</div> : null}
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">Pending: {transferAlerts.filter((t) => t.status === "Pending").length}</div>
          </div>
          {transferError ? <div className="muted">{transferError}</div> : null}
          <div className="alert-stack" style={{ marginTop: 12 }}>
            {transferAlerts.map((t) => (
              <div key={t._id} className="alert-item">
                {t?.patient?.firstName || ""} {t?.patient?.lastName || ""} • {t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"} • {t.status}
              </div>
            ))}
            {!transferAlerts.length ? <div className="alert-item">No transfer alerts yet.</div> : null}
          </div>
        </div>
        <div className="card">
          <h3>CHW Continuity Checklist</h3>
          <div className="alert-stack">
            <div className="alert-item">Confirm household contact details before referral or transfer.</div>
            <div className="alert-item">Capture GPS location for transfer follow-up visits.</div>
            <div className="alert-item">Log any missed follow-ups during facility change.</div>
          </div>
        </div>
      </section>
    </DashboardHomeShell>
  );
}
