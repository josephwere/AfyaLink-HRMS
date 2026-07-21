import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "../services/chwApi";
import { listTransfers } from "../services/transferApi";
import apiFetch from "../utils/apiFetch";
import {
  enqueueOfflineAction,
  listOfflineActions,
  startOfflineAutoSync,
} from "../utils/offlineQueue";

const CATEGORIES = ["GENERAL", "MATERNAL_CHILD", "VACCINATION", "CHRONIC", "SURVEILLANCE"];

export function useCommunityHealthWorkerDashboard() {
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

  const load = useCallback(async () => {
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
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const runOrQueue = useCallback(async (path, method, body, immediateFn) => {
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
  }, [load]);

  const submitHousehold = useCallback(async (e) => {
    e.preventDefault();
    const payload = { ...householdForm, memberCount: Number(householdForm.memberCount || 0) };
    await runOrQueue("/api/chw/households", "POST", payload, () => createChwHousehold(payload));
    setHouseholdForm({ householdId: "", headOfHousehold: "", phone: "", address: "", ward: "", memberCount: 0, riskLevel: "LOW", nextVisitDate: "" });
  }, [householdForm, runOrQueue]);

  const submitVisit = useCallback(async (e) => {
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
    await runOrQueue(`/api/chw/households/${visitForm.householdId}/visits`, "POST", payload, () => recordChwFieldVisit(visitForm.householdId, payload));
    setVisitForm({ householdId: "", category: "GENERAL", status: "COMPLETED", notes: "", nextActionDate: "" });
  }, [runOrQueue, visitForm]);

  const submitMini = useCallback(async (kind, payload, fn, reset) => {
    await runOrQueue(`/api/chw/${kind}`, "POST", payload, () => fn(payload));
    reset();
  }, [runOrQueue]);

  const submitMaternal = useCallback(async (e) => {
    e.preventDefault();
    const payload = {
      ...maternalForm,
      trimester: Number(maternalForm.trimester || 1),
      ancVisits: Number(maternalForm.ancVisits || 0),
      postnatalVisits: Number(maternalForm.postnatalVisits || 0),
      household: maternalForm.household || undefined,
      expectedDeliveryDate: maternalForm.expectedDeliveryDate || undefined,
    };
    await submitMini("maternal", payload, createChwMaternal, () => setMaternalForm({ household: "", motherName: "", trimester: 1, ancVisits: 0, expectedDeliveryDate: "", postnatalVisits: 0, highRiskPregnancy: false, notes: "" }));
  }, [maternalForm, submitMini]);

  const submitChildGrowth = useCallback(async (e) => {
    e.preventDefault();
    const payload = {
      ...childForm,
      household: childForm.household || undefined,
      ageMonths: Number(childForm.ageMonths || 0),
      weightKg: Number(childForm.weightKg || 0),
      heightCm: Number(childForm.heightCm || 0),
      muacCm: Number(childForm.muacCm || 0),
    };
    await submitMini("child-growth", payload, createChwChildGrowth, () => setChildForm({ household: "", childName: "", ageMonths: 0, weightKg: 0, heightCm: 0, muacCm: 0, nutritionRisk: "LOW", notes: "" }));
  }, [childForm, submitMini]);

  const submitVaccination = useCallback(async (e) => {
    e.preventDefault();
    const payload = {
      ...vaccForm,
      household: vaccForm.household || undefined,
      expiryDate: vaccForm.expiryDate || undefined,
    };
    await submitMini("vaccinations", payload, createChwVaccination, () => setVaccForm({ household: "", memberName: "", vaccine: "", dose: "", batchNumber: "", expiryDate: "", adverseEvent: "", coldChainStatus: "OK" }));
  }, [submitMini, vaccForm]);

  const submitChronic = useCallback(async (e) => {
    e.preventDefault();
    const payload = {
      ...chronicForm,
      household: chronicForm.household || undefined,
      followUpDate: chronicForm.followUpDate || undefined,
    };
    await submitMini("chronic", payload, createChwChronic, () => setChronicForm({ household: "", patientName: "", condition: "", medicationCompliance: "GOOD", followUpDate: "", escalationRequired: false, notes: "" }));
  }, [chronicForm, submitMini]);

  const submitDisease = useCallback(async (e) => {
    e.preventDefault();
    const payload = {
      ...diseaseForm,
      suspectedCases: Number(diseaseForm.suspectedCases || 1),
      symptoms: diseaseForm.symptoms ? diseaseForm.symptoms.split(",").map((item) => item.trim()).filter(Boolean) : [],
    };
    await submitMini("disease-reports", payload, createChwDiseaseReport, () => setDiseaseForm({ disease: "", suspectedCases: 1, severity: "MEDIUM", location: "", ward: "", symptoms: "", notes: "", reportedToPublicHealth: false }));
  }, [diseaseForm, submitMini]);

  const submitReferral = useCallback(async (e) => {
    e.preventDefault();
    const payload = {
      ...referralForm,
      receivingHospital: referralForm.receivingHospital || undefined,
    };
    await submitMini("referrals", payload, createChwReferral, () => setReferralForm({ patientName: "", patientPhone: "", summary: "", urgency: "MEDIUM", receivingHospital: "" }));
  }, [referralForm, submitMini]);

  const captureGeo = useCallback(async () => {
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
  }, [runOrQueue]);

  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const brief = useMemo(() => ({
    kicker: "Sync",
    title: online ? "Online" : "Offline",
    body: `Pending offline actions: ${pendingOffline}`,
    items: [
      { label: "Pending offline actions", value: pendingOffline, tone: pendingOffline > 0 ? "warn" : "good" },
      { label: "Network", value: online ? "Online" : "Offline", tone: online ? "good" : "risk" },
    ],
  }), [online, pendingOffline]);

  return {
    CATEGORIES,
    dash,
    households,
    visits,
    referrals,
    performance,
    transferAlerts,
    transferError,
    q,
    setQ,
    msg,
    busy,
    pendingOffline,
    householdForm,
    setHouseholdForm,
    visitForm,
    setVisitForm,
    maternalForm,
    setMaternalForm,
    childForm,
    setChildForm,
    vaccForm,
    setVaccForm,
    chronicForm,
    setChronicForm,
    diseaseForm,
    setDiseaseForm,
    referralForm,
    setReferralForm,
    kpis,
    load,
    submitHousehold,
    submitVisit,
    submitMaternal,
    submitChildGrowth,
    submitVaccination,
    submitChronic,
    submitDisease,
    submitReferral,
    captureGeo,
    brief,
    online,
  };
}

export default useCommunityHealthWorkerDashboard;
