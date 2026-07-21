import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { listBeds, getBedTimeline, updateBed, transferBed, dischargeBed, createBed, searchPatients } from "../services/bedsApi";
import { listHospitals } from "../services/superAdminApi";
import { useAuth } from "../utils/auth";

export function useBeds() {
  const { user } = useAuth();
  const role = String(user?.role || "").toUpperCase();
  const isGlobalRole = role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN";
  const isWardOperator = role === "NURSE";
  const isDoctorViewer = role === "DOCTOR";
  const canCreateBeds = !isWardOperator && !isDoctorViewer;
  const canMovePatients = ["NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(role);
  const actorHospitalId = user?.hospitalId || user?.hospital || "";

  const [beds, setBeds] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(actorHospitalId || "");
  const [ward, setWard] = useState("");
  const [number, setNumber] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [wardFilter, setWardFilter] = useState("ALL");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientOptions, setPatientOptions] = useState([]);
  const [assigningBedId, setAssigningBedId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [transferBedId, setTransferBedId] = useState("");
  const [targetBedId, setTargetBedId] = useState("");
  const [dischargeBedId, setDischargeBedId] = useState("");
  const [dischargeNote, setDischargeNote] = useState("");
  const [timelineBedId, setTimelineBedId] = useState("");
  const [timeline, setTimeline] = useState({ bed: null, logs: [] });
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [encounterByPatient, setEncounterByPatient] = useState({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const tableSectionRef = useRef(null);

  const selectedHospital = useMemo(() => hospitals.find((row) => String(row._id) === String(selectedHospitalId)) || null, [hospitals, selectedHospitalId]);

  const wardOptions = useMemo(() => [...new Set(beds.map((row) => row.ward).filter(Boolean))].sort(), [beds]);

  const filteredBeds = useMemo(() => beds.filter((bed) => {
    if (statusFilter === "OCCUPIED" && !bed.occupied) return false;
    if (statusFilter === "AVAILABLE" && bed.occupied) return false;
    if (wardFilter !== "ALL" && bed.ward !== wardFilter) return false;
    return true;
  }), [beds, statusFilter, wardFilter]);

  const occupancy = useMemo(() => {
    const total = beds.length;
    const occupied = beds.filter((row) => row.occupied).length;
    return {
      total,
      occupied,
      available: Math.max(0, total - occupied),
      occupancyRate: total ? Math.round((occupied / total) * 100) : 0,
    };
  }, [beds]);

  const availableBeds = useMemo(() => beds.filter((row) => !row.occupied), [beds]);

  const wardSummary = useMemo(() => {
    const map = new Map();
    for (const bed of beds) {
      const key = bed.ward || "Unassigned";
      const current = map.get(key) || { ward: key, total: 0, occupied: 0 };
      current.total += 1;
      if (bed.occupied) current.occupied += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).map((row) => ({
      ...row,
      available: Math.max(0, row.total - row.occupied),
      occupancyRate: row.total ? Math.round((row.occupied / row.total) * 100) : 0,
    })).sort((a, b) => a.ward.localeCompare(b.ward));
  }, [beds]);

  const loadHospitals = useCallback(async () => {
    if (!isGlobalRole) return;
    try {
      const data = await listHospitals({ limit: 200, active: true });
      const rows = Array.isArray(data?.items) ? data.items : [];
      setHospitals(rows);
      if (!selectedHospitalId && rows[0]?._id) setSelectedHospitalId(String(rows[0]._id));
    } catch (e) {
      setHospitals([]);
      setMsg(e?.message || "Failed to load hospitals");
    }
  }, [isGlobalRole, selectedHospitalId]);

  const loadBeds = useCallback(async (hospitalId = selectedHospitalId || actorHospitalId) => {
    setLoading(true);
    setMsg("");
    try {
      const js = await listBeds({ hospitalId: isGlobalRole ? hospitalId : undefined });
      const rows = Array.isArray(js) ? js : Array.isArray(js?.data) ? js.data : [];
      setBeds(rows);
      if (isDoctorViewer) {
        const patientIds = [...new Set(rows.map((row) => String(row?.patient?._id || "")).filter(Boolean))];
        if (!patientIds.length) setEncounterByPatient({});
        else {
          const pairs = await Promise.all(patientIds.map(async (patientId) => {
            try {
              const encounterRows = await listBeds({ hospitalId: undefined }); // placeholder to avoid cross-service call
              return [patientId, encounterRows?.[0] || null];
            } catch {
              return [patientId, null];
            }
          }));
          setEncounterByPatient(Object.fromEntries(pairs));
        }
      } else {
        setEncounterByPatient({});
      }
    } catch (e) {
      setMsg(e?.message || "Failed to load beds");
      setBeds([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHospitalId, actorHospitalId, isGlobalRole, isDoctorViewer]);

  useEffect(() => { if (isGlobalRole) loadHospitals(); }, [isGlobalRole, loadHospitals]);
  useEffect(() => { if (isGlobalRole) { if (selectedHospitalId) loadBeds(selectedHospitalId); else setBeds([]); return; } if (actorHospitalId) loadBeds(actorHospitalId); }, [isGlobalRole, selectedHospitalId, actorHospitalId, loadBeds]);

  const toggle = useCallback(async (bed) => {
    try {
      if (bed.occupied) {
        const proceed = window.confirm(`Release ${bed.patient?.firstName || ''} from bed ${bed.number}?`);
        if (!proceed) return;
      }
      const payload = { occupied: !bed.occupied, patient: bed.occupied ? null : bed.patient?._id || null };
      if (isGlobalRole && selectedHospitalId) payload.hospitalId = selectedHospitalId;
      await updateBed(bed._id, payload);
      setMsg(`Bed ${bed.number} updated`);
      loadBeds(selectedHospitalId || actorHospitalId);
    } catch (e) {
      setMsg(e?.message || "Failed to update bed");
    }
  }, [isGlobalRole, selectedHospitalId, actorHospitalId, loadBeds]);

  const searchForPatients = useCallback(async (query) => {
    const targetHospitalId = selectedHospitalId || actorHospitalId;
    if (!targetHospitalId || !query.trim()) { setPatientOptions([]); return; }
    try {
      const rows = await searchPatients({ q: query.trim(), hospitalId: isGlobalRole ? targetHospitalId : undefined });
      setPatientOptions(Array.isArray(rows) ? rows : []);
    } catch {
      setPatientOptions([]);
    }
  }, [selectedHospitalId, actorHospitalId, isGlobalRole]);

  const assignPatientToBed = useCallback(async (bed) => {
    if (!selectedPatientId) { setMsg("Pick a patient first"); return; }
    try {
      const payload = { occupied: true, patient: selectedPatientId };
      if (isGlobalRole && selectedHospitalId) payload.hospitalId = selectedHospitalId;
      await updateBed(bed._id, payload);
      setMsg(`Patient assigned to bed ${bed.number}`);
      setAssigningBedId(""); setSelectedPatientId(""); setPatientQuery(""); setPatientOptions([]);
      loadBeds(selectedHospitalId || actorHospitalId);
    } catch (e) { setMsg(e?.message || "Failed to assign patient"); }
  }, [selectedPatientId, isGlobalRole, selectedHospitalId, actorHospitalId, loadBeds]);

  const transferPatientToBed = useCallback(async (bed) => {
    if (!targetBedId) { setMsg("Pick a target bed first"); return; }
    try {
      const payload = { targetBedId };
      if (isGlobalRole && selectedHospitalId) payload.hospitalId = selectedHospitalId;
      await transferBed(bed._id, payload);
      setMsg(`Patient moved from bed ${bed.number}`);
      setTransferBedId(""); setTargetBedId("");
      loadBeds(selectedHospitalId || actorHospitalId);
    } catch (e) { setMsg(e?.message || "Failed to transfer patient"); }
  }, [targetBedId, isGlobalRole, selectedHospitalId, actorHospitalId, loadBeds]);

  const dischargePatientFromBed = useCallback(async (bed) => {
    try {
      const payload = { note: dischargeNote };
      if (isGlobalRole && selectedHospitalId) payload.hospitalId = selectedHospitalId;
      await dischargeBed(bed._id, payload);
      setMsg(`Patient discharged from bed ${bed.number}`);
      setDischargeBedId(""); setDischargeNote("");
      loadBeds(selectedHospitalId || actorHospitalId);
    } catch (e) { setMsg(e?.message || "Failed to discharge patient"); }
  }, [dischargeNote, isGlobalRole, selectedHospitalId, actorHospitalId, loadBeds]);

  const loadTimeline = useCallback(async (bed) => {
    try {
      setTimelineLoading(true); setTimelineBedId(bed._id);
      const js = await getBedTimeline({ bedId: bed._id, hospitalId: isGlobalRole ? selectedHospitalId : undefined });
      setTimeline(js?.data || { bed: null, logs: [] });
    } catch (e) { setMsg(e?.message || "Failed to load bed timeline"); setTimeline({ bed: null, logs: [] }); setTimelineBedId(""); }
    finally { setTimelineLoading(false); }
  }, [isGlobalRole, selectedHospitalId]);

  const createNewBed = useCallback(async (event) => {
    event.preventDefault();
    if (!ward.trim() || !number.trim()) { setMsg("Ward and bed number are required"); return; }
    setSaving(true); setMsg("");
    try {
      const payload = { ward: ward.trim(), number: number.trim() };
      if (isGlobalRole && selectedHospitalId) payload.hospitalId = selectedHospitalId;
      await createBed(payload);
      setWard(""); setNumber(""); setMsg("Bed created");
      loadBeds(selectedHospitalId || actorHospitalId);
    } catch (e) { setMsg(e?.message || "Failed to create bed"); }
    finally { setSaving(false); }
  }, [ward, number, isGlobalRole, selectedHospitalId, actorHospitalId, loadBeds]);

  return {
    beds,
    hospitals,
    selectedHospitalId,
    setSelectedHospitalId,
    ward,
    setWard,
    number,
    setNumber,
    statusFilter,
    setStatusFilter,
    wardFilter,
    setWardFilter,
    patientQuery,
    setPatientQuery,
    patientOptions,
    assigningBedId,
    setAssigningBedId,
    selectedPatientId,
    setSelectedPatientId,
    transferBedId,
    setTransferBedId,
    targetBedId,
    setTargetBedId,
    dischargeBedId,
    setDischargeBedId,
    dischargeNote,
    setDischargeNote,
    timelineBedId,
    timeline,
    timelineLoading,
    encounterByPatient,
    msg,
    loading,
    saving,
    selectedHospital,
    wardOptions,
    filteredBeds,
    occupancy,
    availableBeds,
    wardSummary,
    tableSectionRef,
    loadHospitals,
    loadBeds,
    toggle,
    searchForPatients,
    assignPatientToBed,
    transferPatientToBed,
    dischargePatientFromBed,
    loadTimeline,
    createNewBed,
  };
}

export default useBeds;
