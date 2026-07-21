import { useCallback, useState } from "react";
import { triage } from "../services/aiClient";

export function useTriage() {
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    if (!symptoms.trim()) return;
    setLoading(true);
    setError("");
    try {
      const out = await triage(symptoms.trim());
      setResult(out);
    } catch (e) {
      setError(e?.message || "Failed to classify triage");
    } finally {
      setLoading(false);
    }
  }, [symptoms]);

  return {
    symptoms,
    setSymptoms,
    result,
    loading,
    error,
    run,
  };
}

export default useTriage;
