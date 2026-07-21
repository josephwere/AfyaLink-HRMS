import { useCallback, useEffect, useState } from "react";
import {
  createPatient,
  createPatientVitals,
  listPatients,
  updatePatient,
} from "../services/patientApi";

export function usePatientManagement() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showVitals, setShowVitals] = useState(false);
  const [patientForm, setPatientForm] = useState({
    name: "",
    age: "",
    gender: "",
    condition: "",
  });
  const [vitalsForm, setVitalsForm] = useState({
    temperature: "",
    bloodPressure: "",
    pulse: "",
  });

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await listPatients();
      setPatients(Array.isArray(data) ? data : []);
    } catch {
      setErr("Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const submitPatient = useCallback(async (e) => {
    e?.preventDefault?.();
    setErr("");

    try {
      if (editing) {
        await updatePatient(editing, patientForm);
      } else {
        await createPatient(patientForm);
      }

      setPatientForm({ name: "", age: "", gender: "", condition: "" });
      setEditing(null);
      await loadPatients();
    } catch {
      setErr("Error saving patient");
    }
  }, [editing, loadPatients, patientForm]);

  const submitVitals = useCallback(async (e) => {
    e?.preventDefault?.();
    setErr("");

    try {
      await createPatientVitals(selected?._id, vitalsForm);
      setVitalsForm({ temperature: "", bloodPressure: "", pulse: "" });
      setShowVitals(false);
      await loadPatients();
    } catch {
      setErr("Error saving vitals");
    }
  }, [loadPatients, selected?._id, vitalsForm]);

  const startEdit = useCallback((p) => {
    setEditing(p._id);
    setPatientForm({ name: p.name || "", age: p.age || "", gender: p.gender || "", condition: p.condition || "" });
  }, []);

  const viewPatient = useCallback((p) => {
    setSelected(p);
    setShowVitals(false);
  }, []);

  return {
    patients,
    loading,
    err,
    selected,
    setSelected,
    editing,
    setEditing,
    showVitals,
    setShowVitals,
    patientForm,
    setPatientForm,
    vitalsForm,
    setVitalsForm,
    loadPatients,
    submitPatient,
    submitVitals,
    startEdit,
    viewPatient,
  };
}

export default usePatientManagement;
