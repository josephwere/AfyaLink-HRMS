import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { getPatient, listAppointments, listEncounters } = vi.hoisted(() => ({
  getPatient: vi.fn(),
  listAppointments: vi.fn(),
  listEncounters: vi.fn(),
}));

vi.mock("../services/patientApi", () => ({
  getPatient,
  getPatientById: getPatient,
}));

vi.mock("../services/appointmentWorkflow", () => ({
  listAppointments,
}));

vi.mock("../services/encounter/service", () => ({
  default: {
    listEncounters,
  },
}));

import { useDoctorMedicalRecords } from "./useDoctorMedicalRecords";

describe("useDoctorMedicalRecords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPatient.mockResolvedValue({ _id: "patient-1", firstName: "Ada" });
    listAppointments.mockResolvedValue({ items: [{ _id: "ap-1", patient: "patient-1" }] });
    listEncounters.mockResolvedValue([{ _id: "enc-1", diagnosis: "Flu" }]);
  });

  it("loads the patient, appointments, and encounters for the selected patient", async () => {
    const { result } = renderHook(() => useDoctorMedicalRecords("patient-1"));

    await waitFor(() => {
      expect(result.current.patient?.firstName).toBe("Ada");
    });

    expect(listAppointments).toHaveBeenCalled();
    expect(listEncounters).toHaveBeenCalledWith({ patientId: "patient-1", limit: 25 });
    expect(result.current.appointments).toHaveLength(1);
    expect(result.current.encounters).toEqual([{ _id: "enc-1", diagnosis: "Flu" }]);
  });
});
