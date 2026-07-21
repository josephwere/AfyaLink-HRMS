import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppointments } from "./useAppointments";
import * as appointmentsApi from "../services/appointmentsApi";

vi.mock("../services/appointmentsApi", () => ({
  listAppointments: vi.fn(),
  listPatients: vi.fn(),
  listDoctors: vi.fn(),
  createAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
}));

describe("useAppointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads appointments, patients and doctors", async () => {
    appointmentsApi.listAppointments.mockResolvedValueOnce([{ _id: "a-1" }]);
    appointmentsApi.listPatients.mockResolvedValueOnce({ items: [{ _id: "p-1", name: "Ada" }] });
    appointmentsApi.listDoctors.mockResolvedValueOnce([{ _id: "d-1", name: "Grace", role: "DOCTOR" }]);

    const { result } = renderHook(() => useAppointments());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.appointments).toHaveLength(1);
    expect(result.current.patients).toHaveLength(1);
    expect(result.current.doctors).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it("creates a new appointment and preserves form payload", async () => {
    appointmentsApi.listAppointments.mockResolvedValueOnce([]);
    appointmentsApi.listPatients.mockResolvedValueOnce({ items: [] });
    appointmentsApi.listDoctors.mockResolvedValueOnce([]);
    appointmentsApi.createAppointment.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useAppointments());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.createAppointmentEntry({
        patient: "p-1",
        doctor: "d-1",
        scheduledAt: "2024-01-01T09:00",
        reason: "follow-up",
      });
    });

    expect(appointmentsApi.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        patient: "p-1",
        doctor: "d-1",
        scheduledAt: "2024-01-01T09:00",
        reason: "follow-up",
      })
    );
  });
});
