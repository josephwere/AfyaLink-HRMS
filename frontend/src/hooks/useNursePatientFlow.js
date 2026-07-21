import { useEffect, useState } from "react";
import { getPatientById, listPatients } from "../services/patientApi";
import { listEncounters } from "../services/encounter/queries";
import { resolveNurseEscalation } from "../services/encounter/mutations";

export function useNursePatientFlow(selectedPatientId = "") {
  const [rows, setRows] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [encounterByPatient, setEncounterByPatient] = useState({});
  const [msg, setMsg] = useState("");
  const [escalatingPatientId, setEscalatingPatientId] = useState("");

  useEffect(() => {
    listPatients({ limit: 50 })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setRows(items);
        return Promise.all(
          items
            .map((item) => String(item?._id || ""))
            .filter(Boolean)
            .map(async (patientId) => {
              try {
                const encounterRows = await listEncounters({ patientId, limit: 1 });
                const encounterItems = Array.isArray(encounterRows) ? encounterRows : [];
                return [patientId, encounterItems[0] || null];
              } catch {
                return [patientId, null];
              }
            })
        );
      })
      .then((pairs) => {
        if (Array.isArray(pairs)) setEncounterByPatient(Object.fromEntries(pairs));
      })
      .catch(() => {
        setRows([]);
        setEncounterByPatient({});
      });
  }, []);

  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatient(null);
      return;
    }
    getPatientById(selectedPatientId)
      .then(setSelectedPatient)
      .catch(() => setSelectedPatient(null));
  }, [selectedPatientId]);

  const escalateEncounter = async (encounter) => {
    if (!encounter?._id) return;
    try {
      setEscalatingPatientId(String(encounter.patient?._id || encounter.patient || ""));
      const res = await resolveNurseEscalation(encounter._id, {
        note: "Ward team requested clinician review before discharge or transfer.",
      });
      setMsg(`Escalation sent to ${res?.recipients || 0} recipient(s).`);
    } catch (e) {
      setMsg(e?.message || "Failed to send escalation.");
    } finally {
      setEscalatingPatientId("");
    }
  };

  return {
    rows,
    selectedPatient,
    encounterByPatient,
    msg,
    setMsg,
    escalatingPatientId,
    escalateEncounter,
  };
}

export default useNursePatientFlow;
