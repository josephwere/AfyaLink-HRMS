import { useEffect, useState } from "react";
import { listEncounters } from "../services/encounter/queries";

export function usePatientMedicalRecords() {
  const [encounters, setEncounters] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    listEncounters({ limit: 25 })
      .then((rows) => setEncounters(Array.isArray(rows) ? rows : []))
      .catch((e) => {
        setEncounters([]);
        setMsg(e?.message || "Failed to load medical record timeline.");
      });
  }, []);

  return { encounters, msg };
}

export default usePatientMedicalRecords;
