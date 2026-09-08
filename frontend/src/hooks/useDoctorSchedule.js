import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import { useSocket } from "../utils/socket";
import {
  createAppointmentCall,
  listAppointments,
  listAppointmentCalls,
  listDoctorAvailability,
  updateAppointmentCall,
} from "../services/appointmentWorkflow";
import encounterService from "../services/encounter/service";
import { normalizeRole } from "../utils/normalizeRole";

const CLINICAL_CALENDAR_ROLES = new Set(["DOCTOR", "SURGEON", "NURSE", "RADIOLOGIST", "THERAPIST"]);
const DOCTOR_AVAILABILITY_ROLES = new Set(["DOCTOR", "SURGEON"]);
const CALL_INBOX_ROLES = new Set(["DOCTOR", "SURGEON", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]);

export function useDoctorSchedule() {
  const { user } = useAuth();
  const socket = useSocket();
  const role = normalizeRole(user?.role || "");
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
      const [appointmentsResult, callsResult] = await Promise.allSettled([
        listAppointments({ limit: 25 }),
        CALL_INBOX_ROLES.has(role) ? listAppointmentCalls() : Promise.resolve({ items: [] }),
      ]);
      if (appointmentsResult.status === "rejected") {
        throw appointmentsResult.reason;
      }
      const appointmentsRes = appointmentsResult.value;
      const callsRes = callsResult.status === "fulfilled" ? callsResult.value : { items: [] };
      const appointmentRows = Array.isArray(appointmentsRes?.items) ? appointmentsRes.items : [];
      setAppointments(appointmentRows);
      setCalls(Array.isArray(callsRes?.items) ? callsRes.items : []);
      if (CLINICAL_CALENDAR_ROLES.has(role)) {
        await fetchEncounterSnapshots(appointmentRows);
      } else {
        setEncounterByPatient({});
      }

      const doctorId = user?.id || user?._id;
      if (doctorId && DOCTOR_AVAILABILITY_ROLES.has(role)) {
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
  }, [fetchEncounterSnapshots, role, user?.id, user?._id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleAssignment = (payload) => {
      const appointment = payload?.appointment;
      const patientName = appointment?.patient?.name || appointment?.patient?.firstName || "a patient";
      const service = appointment?.serviceType || "consultation";
      const mode = appointment?.consultationMode === "VIDEO"
        ? "Video"
        : appointment?.consultationMode === "VOICE"
        ? "Voice"
        : "Consultation";
      setMsg(`New patient assigned: ${patientName} • ${service} • ${mode}`);
      void load();
    };

    socket.on("doctorQueueAssignment", handleAssignment);
    return () => {
      socket.off("doctorQueueAssignment", handleAssignment);
    };
  }, [load, socket]);

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

  const startAppointmentConsultation = useCallback(async (appointment) => {
    if (!appointment?._id) return;

    const mode = String(appointment?.consultationMode || "IN_PERSON").toUpperCase();
    if (!["VOICE", "VIDEO"].includes(mode)) {
      setMsg("This appointment is booked as an in-person visit.");
      return;
    }

    const lifecycleState = String(appointment?.status || "Scheduled").trim();
    const canStart = ["CheckedIn", "InConsultation", "WAITING", "READY_FOR_PROVIDER", "OPENING_ENCOUNTER", "IN_ENCOUNTER"].includes(lifecycleState);
    if (!canStart) {
      setMsg("The patient must be checked in before a remote consultation can start.");
      return;
    }

    const existingCall = (calls || []).find((call) => String(call?.appointment?._id || call?.appointment || "") === String(appointment._id));
    if (existingCall) {
      setActiveCall(existingCall);
      setMsg("Remote consultation room is already ready.");
      return;
    }

    try {
      setMsg("");
      const created = await createAppointmentCall({
        appointmentId: appointment._id,
        callType: mode,
        doctorId: appointment?.doctor?._id || appointment?.doctor || undefined,
      });
      const nextCall = created || null;
      if (nextCall) {
        setActiveCall(nextCall);
      }
      setMsg("Remote consultation started.");
      window.dispatchEvent(new CustomEvent("afyalink:calls-refresh"));
      await load();
    } catch (err) {
      setMsg(err?.message || "Could not start the remote consultation.");
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
    startAppointmentConsultation,
    resolveEscalation,
  };
}

export default useDoctorSchedule;
