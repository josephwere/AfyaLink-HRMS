import { useCallback, useEffect, useMemo, useState } from "react";
import { getHospitalAdminDashboard } from "../services/dashboardApi";
import { listAppointmentCalls, updateAppointmentCall } from "../services/appointmentWorkflow";

export function useConsultationMonitor({ statusFilter = "ALL" } = {}) {
  const [calls, setCalls] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [filter, setFilter] = useState(statusFilter);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [callResponse, dashboardResponse] = await Promise.all([
        listAppointmentCalls(),
        getHospitalAdminDashboard(),
      ]);
      setCalls(Array.isArray(callResponse?.items) ? callResponse.items : []);
      setEscalations(Array.isArray(dashboardResponse?.escalationSummary?.items) ? dashboardResponse.escalationSummary.items : []);
    } catch (err) {
      setMsg(err?.message || "Could not load consultation monitor.");
      setCalls([]);
      setEscalations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setFilter(statusFilter);
  }, [statusFilter]);

  const visibleCalls = useMemo(() => {
    if (filter === "ALL") return calls;
    return calls.filter((call) => String(call.status) === filter);
  }, [calls, filter]);

  const summary = useMemo(
    () => ({
      requested: calls.filter((call) => call.status === "REQUESTED").length,
      active: calls.filter((call) => call.status === "ACTIVE").length,
      ended: calls.filter((call) => call.status === "ENDED").length,
      blocked: calls.filter((call) => call.status === "TERMINATED" || call.isBlocked).length,
      wardEscalations: escalations.filter((item) => !item.resolvedAt).length,
    }),
    [calls, escalations]
  );

  const blockCall = useCallback(async (callId) => {
    try {
      await updateAppointmentCall(callId, "block");
      setMsg("Call blocked.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Could not block call.");
    }
  }, [load]);

  return {
    calls,
    escalations,
    filter,
    setFilter,
    loading,
    msg,
    visibleCalls,
    summary,
    blockCall,
    load,
  };
}

export default useConsultationMonitor;
