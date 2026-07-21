import { useCallback, useEffect, useState } from "react";
import { downloadHospitalVerificationDocument, getHospitalVerificationReviewQueue, reviewHospitalVerification } from "../services/systemAdminApi";

export function useHospitalVerificationReview() {
  const [queue, setQueue] = useState({ hospitals: [], branches: [] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHospitalVerificationReviewQueue();
      setQueue({
        hospitals: Array.isArray(data?.hospitals) ? data.hospitals : [],
        branches: Array.isArray(data?.branches) ? data.branches : [],
      });
    } catch {
      setQueue({ hospitals: [], branches: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(async (id, decision) => {
    setMsg("");
    try {
      await reviewHospitalVerification(id, {
        decision,
        reviewNotes: notes[id] || "",
      });
      setMsg(`Hospital ${decision === "APPROVE" ? "approved" : "rejected"}.`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to review hospital.");
    }
  }, [load, notes]);

  const openDocument = useCallback(async (id, docKey) => {
    await downloadHospitalVerificationDocument(id, docKey);
  }, []);

  return {
    queue,
    loading,
    msg,
    notes,
    setNotes,
    load,
    decide,
    openDocument,
  };
}

export default useHospitalVerificationReview;
