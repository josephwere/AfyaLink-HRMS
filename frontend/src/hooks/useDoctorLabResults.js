import { useCallback, useEffect, useState } from "react";
import { listLabResults } from "../services/laboratory/queries";

export function useDoctorLabResults() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listLabResults();
      setRows(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setError(err?.message || "Failed to load lab results.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, error, load };
}

export default useDoctorLabResults;
