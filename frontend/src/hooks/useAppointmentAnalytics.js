import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAppointmentOverview,
  getAppointmentHeatmap,
  getConsultationActivity,
} from "../services/analyticsApi";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function useAppointmentAnalytics() {
  const [overview, setOverview] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewResponse, heatmapResponse, consultationResponse] = await Promise.all([
        getAppointmentOverview(),
        getAppointmentHeatmap(),
        getConsultationActivity(),
      ]);
      setOverview(overviewResponse || null);
      setHeatmap(Array.isArray(heatmapResponse) ? heatmapResponse : []);
      setConsultations(Array.isArray(consultationResponse) ? consultationResponse : []);
    } catch {
      setOverview(null);
      setHeatmap([]);
      setConsultations([]);
      setError("Failed to load appointment analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const topHeat = useMemo(() => [...heatmap].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 12), [heatmap]);

  const dayLabel = useCallback((item) => {
    const dayIndex = Number(item?._id?.dayOfWeek || 1) - 1;
    return DAY_NAMES[dayIndex] || "Day";
  }, []);

  return {
    overview,
    heatmap,
    consultations,
    error,
    loading,
    load,
    topHeat,
    dayLabel,
  };
}

export default useAppointmentAnalytics;
