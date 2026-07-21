import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react-hooks";
import { useReceptionistBooking } from "./useReceptionistBooking";
import { listPatients } from "../services/patientApi";
import { createAppointment, listAppointmentSuggestions } from "../services/appointmentWorkflow";

vi.mock("../services/patientApi", () => ({
  listPatients: vi.fn(),
}));

vi.mock("../services/appointmentWorkflow", () => ({
  createAppointment: vi.fn(),
  listAppointmentSuggestions: vi.fn(),
}));

describe("useReceptionistBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads patient results and submits a booking", async () => {
    listPatients.mockResolvedValueOnce([{ _id: "p1", firstName: "Jane", lastName: "Doe" }]);
    listAppointmentSuggestions.mockResolvedValueOnce({ items: [{ doctorName: "Dr. Kim", appointmentTime: "2026-07-07T08:00:00.000Z" }] });
    createAppointment.mockResolvedValueOnce({ _id: "a1" });

    const { result } = renderHook(() => useReceptionistBooking());
    await act(async () => {
      result.current.setPatientQuery("Jane");
      await vi.runAllTimersAsync();
    });

    expect(listPatients).toHaveBeenCalled();
    expect(result.current.patients).toHaveLength(1);

    act(() => {
      result.current.setForm((prev) => ({ ...prev, patient: "p1", serviceType: "General Consultation" }));
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(createAppointment).toHaveBeenCalled();
    expect(result.current.msg).toContain("Appointment");
  });
});
