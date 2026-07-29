import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  saveDoctorAvailability,
  getHospitalSchedulingPolicy,
  saveHospitalSchedulingPolicy,
  listAppointmentCalls,
  updateAppointmentCall,
  listAppointmentOperationsQueue,
  assignAppointmentDoctor,
  deleteAppointmentCall,
} from "../services/appointmentWorkflow";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_POLICY = {
  bookingHorizonDays: 30,
  cancellationCutoffHours: 24,
  dailyDoctorCapacity: 30,
  maximumQueueSize: 50,
  waitlistEnabled: true,
  emergencySlotPercentage: 15,
  autoAssignmentEnabled: true,
  workloadBalancingEnabled: true,
  prioritySchedulingEnabled: false,
  weekendBookingEnabled: true,
  queueAlertThreshold: 10,
};

function defaultAvailabilityRows() {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "08:00",
    endTime: "17:00",
    appointmentSlots: 12,
    isAvailable: true,
    consultationAvailable: true,
    modes: {
      chat: true,
      voice: false,
      video: false,
      inPerson: true,
    },
    notes: "",
  }));
}

export function useHospitalAdminAppointments() {
  const [loading, setLoading] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState({ summary: {}, appointments: [], doctors: [], availability: [], calls: [] });
  const [schedulingPolicy, setSchedulingPolicy] = useState(DEFAULT_POLICY);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [availabilityForm, setAvailabilityForm] = useState(defaultAvailabilityRows());
  const queueSectionRef = useRef(null);
  const availabilitySectionRef = useRef(null);

  const scrollToSection = useCallback((ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [res, calls, policyRes] = await Promise.all([
        listAppointmentOperationsQueue(),
        listAppointmentCalls(),
        getHospitalSchedulingPolicy().catch(() => null),
      ]);
      setData({
        summary: res?.summary || {},
        appointments: Array.isArray(res?.appointments) ? res.appointments : [],
        doctors: Array.isArray(res?.doctors) ? res.doctors : [],
        availability: Array.isArray(res?.availability) ? res.availability : [],
        calls: Array.isArray(calls?.items) ? calls.items : [],
      });
      if (policyRes?.policy) {
        setSchedulingPolicy({ ...DEFAULT_POLICY, ...policyRes.policy });
      }
      if (!selectedDoctor && Array.isArray(res?.doctors) && res.doctors.length) {
        setSelectedDoctor(String(res.doctors[0]._id));
      }
    } catch (err) {
      setMsg(err?.message || "Failed to load appointment operations");
    } finally {
      setLoading(false);
    }
  }, [selectedDoctor]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedDoctorData = useMemo(
    () => data.doctors.find((doc) => String(doc._id) === String(selectedDoctor)) || null,
    [data.doctors, selectedDoctor]
  );

  useEffect(() => {
    if (!selectedDoctor) {
      setAvailabilityForm(defaultAvailabilityRows());
      return;
    }
    const rows = data.availability
      .filter((row) => String(row.doctor) === String(selectedDoctor))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    setAvailabilityForm(rows.length ? rows : defaultAvailabilityRows());
  }, [selectedDoctor, data.availability]);

  const assignDoctor = useCallback(async (appointmentId, doctorId) => {
    try {
      setMsg("");
      await assignAppointmentDoctor(appointmentId, doctorId);
      await load();
      setMsg("Doctor assignment updated.");
    } catch (err) {
      setMsg(err?.message || "Failed to assign doctor");
    }
  }, [load]);

  const blockCall = useCallback(async (callId) => {
    try {
      setMsg("");
      await updateAppointmentCall(callId, "block");
      await load();
      setMsg("Call blocked.");
    } catch (err) {
      setMsg(err?.message || "Failed to block call");
    }
  }, [load]);

  const removeCall = useCallback(async (callId) => {
    try {
      setMsg("");
      await deleteAppointmentCall(callId);
      await load();
      setMsg("Call record archived.");
    } catch (err) {
      setMsg(err?.message || "Failed to archive call");
    }
  }, [load]);

  const saveAvailability = useCallback(async () => {
    if (!selectedDoctor) {
      setMsg("Select a doctor first.");
      return;
    }
    setSavingAvailability(true);
    setMsg("");
    try {
      await saveDoctorAvailability(selectedDoctor, { items: availabilityForm });
      await load();
      setMsg("Doctor availability saved.");
    } catch (err) {
      setMsg(err?.message || "Failed to save availability");
    } finally {
      setSavingAvailability(false);
    }
  }, [availabilityForm, load, selectedDoctor]);

  const saveSchedulingPolicy = useCallback(async () => {
    setSavingPolicy(true);
    setMsg("");
    try {
      const result = await saveHospitalSchedulingPolicy(schedulingPolicy);
      if (result?.policy) {
        setSchedulingPolicy({ ...DEFAULT_POLICY, ...result.policy });
      }
      await load();
      setMsg("Scheduling policy saved.");
    } catch (err) {
      setMsg(err?.message || "Failed to save scheduling policy");
    } finally {
      setSavingPolicy(false);
    }
  }, [load, schedulingPolicy]);

  return {
    loading,
    savingAvailability,
    savingPolicy,
    msg,
    data,
    schedulingPolicy,
    setSchedulingPolicy,
    selectedDoctor,
    setSelectedDoctor,
    availabilityForm,
    setAvailabilityForm,
    queueSectionRef,
    availabilitySectionRef,
    scrollToSection,
    selectedDoctorData,
    load,
    assignDoctor,
    blockCall,
    removeCall,
    saveAvailability,
    saveSchedulingPolicy,
    dayNames: DAY_NAMES,
  };
}

export default useHospitalAdminAppointments;
