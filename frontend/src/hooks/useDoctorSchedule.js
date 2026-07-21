import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import {
  listAppointments,
  listAppointmentCalls,
  listDoctorAvailability,
  updateAppointmentCall,
} from "../services/appointmentWorkflow";
import encounterService from "../services/encounter/service";

export function useDoctorSchedule() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [calls, setCalls] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [encounterByPatient, setEncounterByPatient] = useState({});
  const [activeCall, setActiveCall] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvingEncounterId, setResolvingEncounterId] = useState("");

  const fetchEncounterSnapshots = useCallback(async (appointmentRows) => {
    const patientIds = [...new Set(
      (Array.isArray(appointmentRows) ? appointmentRows : [])
        .map((item) => String(item?.patient?._id || item?.patient || ""))
        .filter(Boolean)
    )];

    if (!patientIds.length) {
      setEncounterByPatient({});
      return;
    }

    const pairs = await Promise.all(
      patientIds.map(async (patientId) => {
        try {
          const rows = await encounterService.listEncounters?.({ patientId, limit: 1 });
          const items = Array.isArray(rows) ? rows : [];
          return [patientId, items[0] || null];
        } catch {
          return [patientId, null];
        }
      })
    );

    setEncounterByPatient(Object.fromEntries(pairs));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [appointmentsRes, callsRes] = await Promise.all([
        listAppointments({ limit: 25 }),
        listAppointmentCalls(),
      ]);
      const appointmentRows = Array.isArray(appointmentsRes?.items) ? appointmentsRes.items : [];
      setAppointments(appointmentRows);
      setCalls(Array.isArray(callsRes?.items) ? callsRes.items : []);
      await fetchEncounterSnapshots(appointmentRows);

      const doctorId = user?.id || user?._id;
      if (doctorId) {
        const availabilityRes = await listDoctorAvailability(doctorId);
        setAvailability(Array.isArray(availabilityRes?.items) ? availabilityRes.items : []);
      } else {
        setAvailability([]);
      }
    } catch (err) {
      setMsg(err?.message || "Failed to load schedule workspace.");
    } finally {
      setLoading(false);
    }
  }, [fetchEncounterSnapshots, user?.id, user?._id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const todayAppointments = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return appointments.filter((item) => {
      const when = new Date(item.scheduledAt);
      return when >= start && when <= end;
    });
  }, [appointments]);

  const todayAvailability = useMemo(
    () => availability.find((row) => Number(row.dayOfWeek) === new Date().getDay()) || null,
    [availability]
  );
  const requestedCalls = useMemo(
    () => calls.filter((call) => String(call.status || "").toUpperCase() === "REQUESTED"),
    [calls]
  );
  const activeCalls = useMemo(
    () => calls.filter((call) => String(call.status || "").toUpperCase() === "ACTIVE"),
    [calls]
  );

  const runCallAction = useCallback(async (callOrId, action, options = {}) => {
    const callId = typeof callOrId === "string" ? callOrId : callOrId?._id;
    const sourceCall = typeof callOrId === "string" ? calls.find((item) => String(item._id) === String(callId)) : callOrId;
    const keepRoomOpen = Boolean(options.keepRoomOpen);
    if (!callId) return;
    try {
      setMsg("");
      const res = await updateAppointmentCall(callId, action);
      if (action === "activate") {
        setActiveCall({
          ...(sourceCall || {}),
          ...res,
          appointment: sourceCall?.appointment || res?.appointment,
          patient: sourceCall?.patient || res?.patient,
          doctor: sourceCall?.doctor || res?.doctor,
        });
        setMsg("Consultation accepted. Preparing secure consultation room...");
      } else {
        if (!keepRoomOpen) {
          setActiveCall((prev) => (String(prev?._id) === String(callId) ? null : prev));
        }
        setMsg(sourceCall?.status === "REQUESTED" ? "Consultation request declined." : "Consultation completed.");
      }
      window.dispatchEvent(new CustomEvent("afyalink:calls-refresh"));
      await load();
    } catch (err) {
      setMsg(err?.message || "Call action failed.");
    }
  }, [calls, load]);

  const resolveEscalation = useCallback(async (encounter, patientKey) => {
    if (!encounter?._id) return;
    try {
      setResolvingEncounterId(String(encounter._id));
      setMsg("");
      await encounterService.resolveNurseEscalation?.(encounter._id, {
        note: "Clinician reviewed ward escalation and resumed visit workflow.",
      });
      const focus = Array.isArray(encounter?.closeout?.missingRequirements) ? encounter.closeout.missingRequirements[0] || "" : "";
      return `/doctor/opd?patientId=${encodeURIComponent(patientKey)}${focus ? `&focus=${encodeURIComponent(focus)}` : ""}`;
    } finally {
      setResolvingEncounterId("");
    }
  }, []);

  return {
    appointments,
    calls,
    availability,
    encounterByPatient,
    activeCall,
    setActiveCall,
    msg,
    loading,
    resolvingEncounterId,
    todayAppointments,
    todayAvailability,
    requestedCalls,
    activeCalls,
    load,
    runCallAction,
    resolveEscalation,
  };
}

export default useDoctorSchedule;
