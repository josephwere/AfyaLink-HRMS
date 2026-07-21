import { useCallback, useState } from "react";
import { extractDocument } from "../services/aiExtractionApi";

export function useNeuroEdgeExtract() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const run = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const out = await extractDocument(file);
      setResult(out || null);
    } catch (e) {
      setError(e?.message || "Failed to extract document");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [file]);

  return {
    file,
    setFile,
    loading,
    error,
    result,
    run,
  };
}

export default useNeuroEdgeExtract;
