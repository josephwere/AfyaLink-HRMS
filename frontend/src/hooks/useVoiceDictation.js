import { useCallback, useState } from "react";
import { transcribeAudioBase64 } from "../services/aiClient";

export function useVoiceDictation() {
  const [audioBase64, setAudioBase64] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    if (!audioBase64.trim()) return;
    setLoading(true);
    setError("");
    try {
      const out = await transcribeAudioBase64(audioBase64.trim());
      setText(out?.text || JSON.stringify(out, null, 2));
    } catch (e) {
      setError(e?.message || "Failed to transcribe audio");
    } finally {
      setLoading(false);
    }
  }, [audioBase64]);

  return {
    audioBase64,
    setAudioBase64,
    text,
    loading,
    error,
    run,
  };
}

export default useVoiceDictation;
