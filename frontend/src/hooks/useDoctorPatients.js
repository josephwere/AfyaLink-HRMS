import { useCallback, useEffect, useMemo, useState } from "react";
import { listPatients } from "../services/patientApi";
import encounterService from "../services/encounter/service";

export function useDoctorPatients({ search = "", status = "ALL", risk = "ALL" } = {}) {
  const [rows, setRows] = useState([]);
  const [encounterByPatient, setEncounterByPatient] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resolvingEncounterId, setResolvingEncounterId] = useState("");

  const load = useCallback(async () => {
    const q = search.trim();
    setLoading(true);
    setError("");
    try {
      const res = await listPatients({ q, limit: 100 });
      const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      setRows(items);
      const pairs = await Promise.all(
        items
          .map((item) => String(item?._id || ""))
          .filter(Boolean)
          .map(async (patientId) => {
            try {
              const encounterRows = await encounterService.listEncounters?.({ patientId, limit: 1 });
              const encounterItems = Array.isArray(encounterRows) ? encounterRows : [];
              return [patientId, encounterItems[0] || null];
            } catch {
              return [patientId, null];
            }
          })
      );
      setEncounterByPatient(Object.fromEntries(pairs));
    } catch (err) {
      setRows([]);
      setEncounterByPatient({});
      setError(err?.message || "Failed to load patients.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const rowStatus = String(row.status || "ACTIVE").toUpperCase();
      const rowRisk = String(row.riskLevel || "MEDIUM").toUpperCase();
      const statusOk = status === "ALL" || rowStatus === status;
      const riskOk = risk === "ALL" || rowRisk === risk;
      return statusOk && riskOk;
    });
  }, [risk, rows, status]);

  const resolveEscalation = useCallback(async (encounter, patientId) => {
    if (!encounter?._id) return;
    try {
      setResolvingEncounterId(String(encounter._id));
      await encounterService.resolveNurseEscalation?.(encounter._id, {
        note: "Clinician acknowledged patient-list escalation and resumed closeout workflow.",
      });
      await load();
      return patientId;
    } finally {
      setResolvingEncounterId("");
    }
  }, [load]);

  return {
    rows,
    filtered,
    encounterByPatient,
    loading,
    error,
    resolvingEncounterId,
    load,
    resolveEscalation,
  };
}

export default useDoctorPatients;
