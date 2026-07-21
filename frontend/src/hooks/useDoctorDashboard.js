import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import * as encounterService from "../services/encounter";
import { getDoctorDashboard, listDoctorDashboardAppointments, listDoctorDashboardNotifications } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

const initialState = {
  dashboard: null,
  appointments: [],
  alerts: [],
  transfers: [],
  encounterByPatient: {},
  loading: false,
  error: null,
};

export function useDoctorDashboard() {
  const [state, setState] = useState(initialState);
  const active = useRef(true);

  const loadEncounterSnapshots = useCallback(async (appointmentRows) => {
    const patientIds = [...new Set(
      (Array.isArray(appointmentRows) ? appointmentRows : [])
        .map((item) => String(item?.patient?._id || item?.patient || ""))
        .filter(Boolean)
    )];

    if (!patientIds.length) {
      return {};
    }

    const pairs = await Promise.all(
      patientIds.map(async (patientId) => {
        try {
          const encounter = await encounterService.getLatestForPatient(patientId);
          return [patientId, encounter];
        } catch {
          return [patientId, null];
        }
      })
    );

    return Object.fromEntries(pairs);
  }, []);

  const loadDashboardData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [dashboard, appointments, alerts, transfersResult] = await Promise.all([
        getDoctorDashboard().catch(() => null),
        listDoctorDashboardAppointments().catch(() => []),
        listDoctorDashboardNotifications().catch(() => []),
        listTransfers({ limit: 6, scope: "facility" }).catch(() => ({ items: [] })),
      ]);

      if (!active.current) return;

      const appointmentRows = Array.isArray(appointments) ? appointments : [];
      const encounterByPatient = await loadEncounterSnapshots(appointmentRows);
      if (!active.current) return;

      setState({
        dashboard,
        appointments: appointmentRows,
        alerts: Array.isArray(alerts) ? alerts.slice(0, 8) : [],
        transfers: Array.isArray(transfersResult?.items) ? transfersResult.items : [],
        encounterByPatient,
        loading: false,
        error: null,
      });
    } catch (error) {
      if (!active.current) return;
      setState((prev) => ({ ...prev, loading: false, error }));
    }
  }, [loadEncounterSnapshots]);

  useEffect(() => {
    active.current = true;
    loadDashboardData();
    return () => {
      active.current = false;
    };
  }, [loadDashboardData]);

  const resolveEscalation = useCallback(
    async (encounterId, payload = {}) => {
      const result = await encounterService.resolveNurseEscalation(encounterId, payload);
      await loadDashboardData();
      return result;
    },
    [loadDashboardData]
  );

  const transferStats = useMemo(() => {
    const pending = state.transfers.filter((t) => t.status === "Pending").length;
    const approved = state.transfers.filter((t) => t.status === "Approved").length;
    const completed = state.transfers.filter((t) => t.status === "Completed").length;
    return { pending, approved, completed, total: state.transfers.length };
  }, [state.transfers]);

  return {
    ...state,
    transferStats,
    resolveEscalation,
    refresh: loadDashboardData,
  };
}
