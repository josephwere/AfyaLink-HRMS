import { useEffect, useState } from "react";
import { getMyFamilyTimeline } from "../services/patientApi";

export function usePatientTimeline() {
  const [data, setData] = useState({ members: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    getMyFamilyTimeline({ limit: 140 })
      .then((res) => {
        setData({
          members: Array.isArray(res?.members) ? res.members : [],
          items: Array.isArray(res?.items) ? res.items : [],
        });
        setMsg("");
      })
      .catch((err) => {
        setData({ members: [], items: [] });
        setMsg(err?.message || "Failed to load family timeline.");
      })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, msg, setMsg };
}

export default usePatientTimeline;
