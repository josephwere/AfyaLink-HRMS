import { useMemo } from "react";
import { useResource } from "./shared/useResource";
import * as patientApi from "../services/patientApi";
import * as appointmentApi from "../services/appointmentWorkflow";
import * as pharmacyApi from "../services/pharmacyApi";
import * as pharmacyNetworkApi from "../services/pharmacyNetworkApi";
import * as pharmacyPrescriptionService from "../services/pharmacyPrescription";

const EXCLUDED_APPOINTMENT_STATUSES = new Set(["COMPLETED", "CANCELLED", "CANCELED", "NO SHOW", "NO_SHOW", "RESCHEDULED", "CLOSED", "ATTENDED", "DECLINED", "FAILED"]);

export function filterPrescriptionAppointments(appointments = [], now = new Date()) {
  const rows = Array.isArray(appointments) ? appointments : [];
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

  return rows.filter((item) => {
    const status = String(item?.status || "").trim().toUpperCase();
    if (EXCLUDED_APPOINTMENT_STATUSES.has(status)) return false;

    const scheduledAt = item?.scheduledAt || item?.date || item?.startTime;
    if (!scheduledAt) return true;

    const scheduledAtTime = new Date(scheduledAt).getTime();
    if (Number.isNaN(scheduledAtTime)) return true;
    return scheduledAtTime >= nowTime;
  });
}

export function useDoctorPrescriptions(patientId) {
  const patientResource = useResource({
    fetcher: async () => (patientId ? patientApi.getPatient?.(patientId) : null),
    initialData: null,
    cacheKey: patientId ? `doctor-prescriptions-patient:${patientId}` : undefined,
    watchKeys: [patientId],
  });

  const appointmentsResource = useResource({
    fetcher: async () => appointmentApi.listAppointments?.({ limit: 50 }),
    initialData: { items: [] },
    cacheKey: "doctor-prescriptions-appointments",
    watchKeys: [patientId],
  });

  const medicinesResource = useResource({
    fetcher: async () => pharmacyApi.listAvailableMedicines?.({ limit: 300, includeOutOfStock: true }),
    initialData: { items: [] },
    cacheKey: "doctor-prescriptions-medicines",
  });

  const pharmaciesResource = useResource({
    fetcher: async () => pharmacyNetworkApi.listRegisteredPharmacies?.({ limit: 100 }),
    initialData: { items: [] },
    cacheKey: "doctor-prescriptions-pharmacies",
  });

  const referralsResource = useResource({
    fetcher: async () => pharmacyNetworkApi.listPharmacyReferrals?.({ limit: 100 }),
    initialData: { items: [] },
    cacheKey: "doctor-prescriptions-referrals",
  });

  const appointments = useMemo(() => {
    const rows = Array.isArray(appointmentsResource.data?.items) ? appointmentsResource.data.items : [];
    const actionableRows = filterPrescriptionAppointments(rows, new Date());
    const patientRows = patientId ? actionableRows.filter((item) => String(item?.patient?._id || item?.patient) === String(patientId)) : actionableRows;
    return patientRows;
  }, [appointmentsResource.data, patientId]);

  const medicineCatalog = Array.isArray(medicinesResource.data?.items) ? medicinesResource.data.items : [];
  const pharmacies = Array.isArray(pharmaciesResource.data?.items) ? pharmaciesResource.data.items : [];
  const referrals = Array.isArray(referralsResource.data?.items) ? referralsResource.data.items : [];

  const loadExistingPrescription = async (appointmentId) => {
    if (!appointmentId) return null;
    const res = await pharmacyPrescriptionService.listPrescriptions?.({ appointmentId });
    const item = Array.isArray(res?.items) ? res.items[0] : null;
    return item || null;
  };

  const savePrescriptionDraft = async ({ appointmentId, patientId, medications, summary, advice, existingPrescription, selectedAppointment }) => {
    if (!appointmentId) {
      throw new Error("Select an appointment first.");
    }

    const cleanedMeds = (Array.isArray(medications) ? medications : [])
      .filter((item) => [item.name, item.dosage, item.frequency, item.duration].some((value) => String(value || "").trim()))
      .map((item) => ({
        pharmacyItem: item.pharmacyItem || null,
        name: item.name,
        sku: item.sku || "",
        unit: item.unit || "",
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        requestedQuantity: item.requestedQuantity,
      }));

    const payload = {
      appointmentId,
      patientId,
      meds: cleanedMeds,
      summary,
      advice,
    };

    const shouldCreate = !existingPrescription?._id;
    const created = shouldCreate ? await pharmacyPrescriptionService.createPrescription?.(payload) : null;

    await appointmentApi.updateAppointment?.(appointmentId, {
      metadata: {
        ...(selectedAppointment?.metadata || {}),
        prescriptionDraft: {
          medications: cleanedMeds,
          summary,
          advice,
          patientId,
        },
        prescriptionId: created?._id || existingPrescription?._id || selectedAppointment?.metadata?.prescriptionId || null,
        consultationSummary: {
          ...(selectedAppointment?.metadata?.consultationSummary || {}),
          prescriptionSummary: summary,
          carePlan: advice,
        },
      },
    });

    return {
      created,
      prescriptionId: created?._id || existingPrescription?._id || selectedAppointment?.metadata?.prescriptionId || null,
    };
  };

  const sendReferral = async ({ pharmacyId, prescriptionId, patientName, patientPhone, patientUser, patientRecord, reason, medicationNotes, urgent = false }) => {
    const created = await pharmacyNetworkApi.createPharmacyReferral?.({
      pharmacyId,
      prescriptionId,
      patientName,
      patientPhone,
      patientUser,
      patientRecord,
      reason,
      medicationNotes,
      urgent,
    });
    await referralsResource.refresh();
    return created;
  };

  return {
    patient: patientResource.data,
    patientLoading: patientResource.loading,
    patientError: patientResource.error,
    appointments,
    appointmentsLoading: appointmentsResource.loading,
    appointmentsError: appointmentsResource.error,
    medicineCatalog,
    medicineLoading: medicinesResource.loading,
    medicineError: medicinesResource.error,
    pharmacies,
    pharmaciesLoading: pharmaciesResource.loading,
    pharmaciesError: pharmaciesResource.error,
    referrals,
    referralsLoading: referralsResource.loading,
    referralsError: referralsResource.error,
    loadExistingPrescription,
    savePrescriptionDraft,
    sendReferral,
    refresh: async () => {
      await Promise.all([patientResource.refresh(), appointmentsResource.refresh(), medicinesResource.refresh(), pharmaciesResource.refresh(), referralsResource.refresh()]);
    },
  };
}

export default useDoctorPrescriptions;
