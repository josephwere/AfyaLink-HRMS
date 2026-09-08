import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import * as encounterService from "../services/encounter";
import { useSocket } from "../utils/socket";
import { getMyDoctorWorkStatus, updateMyDoctorWorkStatus } from "../services/appointmentWorkflow";
import { getDoctorDashboard, listDoctorDashboardAppointments, listDoctorDashboardNotifications } from "../services/dashboardApi";
import { listTransfers } from "../services/transferApi";

const initialState = {
  dashboard: null,
  appointments: [],
  alerts: [],
  transfers: [],
  encounterByPatient: {},
  workStatus: null,
  statusSaving: false,
  loading: false,
  error: null,
  activityMessage: "",
};

export function useDoctorDashboard() {
  const [state, setState] = useState(initialState);
  const active = useRef(true);
  const socket = useSocket();

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

      setState((prev) => ({
        dashboard,
        appointments: appointmentRows,
        alerts: Array.isArray(alerts) ? alerts.slice(0, 8) : [],
        transfers: Array.isArray(transfersResult?.items) ? transfersResult.items : [],
        workStatus: prev.workStatus,
        statusSaving: false,
        encounterByPatient,
        loading: false,
        error: null,
      }));
    } catch (error) {
      if (!active.current) return;
      setState((prev) => ({ ...prev, loading: false, error }));
    }
  }, [loadEncounterSnapshots]);

  useEffect(() => {
    active.current = true;
    loadDashboardData();
    getMyDoctorWorkStatus()
      .then((workStatus) => {
        if (active.current) setState((prev) => ({ ...prev, workStatus }));
      })
      .catch(() => {});
    return () => {
      active.current = false;
    };
  }, [loadDashboardData]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleStatus = (payload) => {
      setState((prev) => ({
        ...prev,
        workStatus: payload || prev.workStatus,
        activityMessage: payload?.assignedFromQueue
          ? `${payload.assignedFromQueue} waiting patient${payload.assignedFromQueue === 1 ? "" : "s"} assigned to your schedule.`
          : `Status updated to ${payload?.label || "Available"}.`,
      }));
    };

    const handleAssignment = (payload) => {
      const appointment = payload?.appointment;
      const patientName = appointment?.patient?.name || appointment?.patient?.firstName || "A patient";
      const service = appointment?.serviceType || "consultation";
      const mode = appointment?.consultationMode === "VIDEO"
        ? "Video"
        : appointment?.consultationMode === "VOICE"
        ? "Voice"
        : "Consultation";
      setState((prev) => ({
        ...prev,
        activityMessage: `New patient assigned: ${patientName} • ${service} • ${mode}`,
      }));
      void loadDashboardData();
    };

    socket.on("doctorWorkStatusUpdated", handleStatus);
    socket.on("doctorQueueAssignment", handleAssignment);
    return () => {
      socket.off("doctorWorkStatusUpdated", handleStatus);
      socket.off("doctorQueueAssignment", handleAssignment);
    };
  }, [loadDashboardData, socket]);

  const setDoctorWorkStatus = useCallback(async (status) => {
    setState((prev) => ({ ...prev, statusSaving: true, error: null }));
    try {
      const workStatus = await updateMyDoctorWorkStatus(status);
      if (!active.current) return workStatus;
      setState((prev) => ({ ...prev, workStatus, statusSaving: false }));
      if (Number(workStatus?.assignedFromQueue || 0) > 0) {
        await loadDashboardData();
      }
      return workStatus;
    } catch (error) {
      if (active.current) setState((prev) => ({ ...prev, statusSaving: false, error }));
      throw error;
    }
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
    setDoctorWorkStatus,
    refresh: loadDashboardData,
  };
}
