import { useEffect, useState } from "react";
import laboratoryService from "../services/laboratory/service.js";

export function useLabTests() {
  const [items, setItems] = useState([]);

  const loadLabTests = async () => {
    try {
      const data = await laboratoryService.listTests({ limit: 100 });
      setItems(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    void loadLabTests();
  }, []);

  const create = async (form) => {
    if (!form?.patient || !form?.testType) return alert("patient and test required");
    try {
      await laboratoryService.submitSample({ patientId: form.patient, testType: form.testType });
      await loadLabTests();
    } catch (e) {
      alert(e?.message || "Failed to create lab test");
    }
  };

  const upload = async (id) => {
    try {
      const result = { values: { Hb: 10 + Math.round(Math.random() * 5), WBC: 5 + Math.round(Math.random() * 8) } };
      await laboratoryService.submitResult(id, { result, status: "Completed" });
      await loadLabTests();
    } catch (e) {
      alert(e?.message || "Failed to upload result");
    }
  };

  const remove = async (id) => {
    try {
      await laboratoryService.markTestComplete(id);
      await loadLabTests();
    } catch (e) {
      alert(e?.message || "Failed to delete lab test");
    }
  };

  return { items, loadLabTests, create, upload, remove };
}

export default useLabTests;
