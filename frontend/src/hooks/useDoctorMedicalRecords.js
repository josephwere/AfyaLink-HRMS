import { useMemo } from "react";
import { useResource } from "./shared/useResource";
import * as patientApi from "../services/patientApi";
import * as appointmentApi from "../services/appointmentWorkflow";
import encounterService from "../services/encounter/service";

export function useDoctorMedicalRecords(patientId) {
  const patientResource = useResource({
    fetcher: async () => (patientId ? patientApi.getPatient?.(patientId) : null),
    initialData: null,
    cacheKey: patientId ? `doctor-medical-records-patient:${patientId}` : undefined,
    watchKeys: [patientId],
  });

  const appointmentsResource = useResource({
    fetcher: async () => appointmentApi.listAppointments?.({ limit: 50, cursorMode: 1 }),
    initialData: { items: [] },
    cacheKey: patientId ? `doctor-medical-records-appointments:${patientId}` : "doctor-medical-records-appointments",
    watchKeys: [patientId],
  });

  const encountersResource = useResource({
    fetcher: async () => (patientId ? encounterService.listEncounters?.({ patientId, limit: 25 }) : []),
    initialData: [],
    cacheKey: patientId ? `doctor-medical-records-encounters:${patientId}` : undefined,
    watchKeys: [patientId],
  });

  const appointments = useMemo(() => {
    const rows = Array.isArray(appointmentsResource.data?.items) ? appointmentsResource.data.items : [];
    return patientId ? rows.filter((item) => String(item?.patient?._id || item?.patient) === String(patientId)) : rows;
  }, [appointmentsResource.data, patientId]);

  const encounters = Array.isArray(encountersResource.data) ? encountersResource.data : [];

  return {
    patient: patientResource.data,
    patientLoading: patientResource.loading,
    patientError: patientResource.error,
    appointments,
    appointmentsLoading: appointmentsResource.loading,
    appointmentsError: appointmentsResource.error,
    encounters,
    encountersLoading: encountersResource.loading,
    encountersError: encountersResource.error,
    refresh: async () => {
      await Promise.all([patientResource.refresh(), appointmentsResource.refresh(), encountersResource.refresh()]);
    },
  };
}

export default useDoctorMedicalRecords;
