import { useEffect, useMemo, useState } from "react";
import { getMyFamily, getMyProfile } from "../services/patientApi";
import { listMyReports } from "../services/reportsApi";
import { listEncounters } from "../services/encounter/queries";
import { listMarketplaceHospitals } from "../services/patientApi";
import { selfRegisterMinorPatient } from "../services/patientApi";

export function usePatientFamilyRecords() {
  const [family, setFamily] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [reports, setReports] = useState([]);
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [registerForm, setRegisterForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    nationalId: "",
    contact: "",
    hospitalId: "",
    relationship: "PARENT",
    notes: "",
  });

  const loadFamilyData = async () => {
    const [familyRes, encounterRows, reportRes, profileRes, hospitalRes] = await Promise.all([
      getMyFamily(),
      listEncounters({ limit: 50 }),
      listMyReports({ cursorMode: true, limit: 25 }),
      getMyProfile(),
      listMarketplaceHospitals({ limit: 200 }),
    ]);

    const linked = Array.isArray(familyRes?.items) ? familyRes.items : [];
    const patientIds = new Set(linked.map((item) => String(item.patientId)));
    const encounterItems = Array.isArray(encounterRows) ? encounterRows : [];
    const reportItems = Array.isArray(reportRes?.items) ? reportRes.items : Array.isArray(reportRes) ? reportRes : [];
    const hospitalItems = Array.isArray(hospitalRes?.items) ? hospitalRes.items : Array.isArray(hospitalRes) ? hospitalRes : [];

    setFamily(linked);
    setEncounters(encounterItems.filter((row) => patientIds.has(String(row?.patient?._id || row?.patient || ""))));
    setReports(reportItems.filter((row) => patientIds.has(String(row?.patient?._id || row?.patient || ""))));
    setProfile(profileRes || null);
    setHospitals(hospitalItems);
    setRegisterForm((prev) => ({
      ...prev,
      hospitalId: prev.hospitalId || profileRes?.hospital || hospitalItems?.[0]?._id || "",
    }));
  };

  useEffect(() => {
    loadFamilyData().catch((err) => {
      setFamily([]);
      setEncounters([]);
      setReports([]);
      setMsg(err?.message || "Failed to load family records.");
    });
  }, []);

  const registerMinor = async () => {
    setRegisterBusy(true);
    setMsg("");
    try {
      await selfRegisterMinorPatient(registerForm);
      setRegisterForm((prev) => ({
        ...prev,
        firstName: "",
        lastName: "",
        dob: "",
        gender: "",
        nationalId: "",
        contact: "",
        notes: "",
      }));
      await loadFamilyData();
      setMsg("Child registered successfully and linked under your parent account.");
    } catch (err) {
      setMsg(err?.message || "Failed to register child.");
    } finally {
      setRegisterBusy(false);
    }
  };

  const totals = useMemo(() => ({
    children: family.length,
    appointments: family.reduce((sum, item) => sum + Number(item?.upcomingAppointments || 0), 0),
    encounters: family.reduce((sum, item) => sum + Number(item?.totalEncounters || 0), 0),
    reports: reports.length,
  }), [family, reports]);

  const familyPolicyMap = useMemo(() => new Map(family.map((item) => [String(item.patientId), item.consentPolicy || null])), [family]);

  return { family, encounters, reports, profile, hospitals, registerBusy, msg, setMsg, registerForm, setRegisterForm, registerMinor, totals, familyPolicyMap, loadFamilyData };
}

export default usePatientFamilyRecords;
