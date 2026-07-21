import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePatientAppointments } from "./usePatientAppointments";
import * as appointmentWorkflow from "../services/appointmentWorkflow";
import * as patientApi from "../services/patientApi";

vi.mock("../services/appointmentWorkflow", () => ({
  createAppointment: vi.fn(),
  createAppointmentCall: vi.fn(),
  listAppointmentCalls: vi.fn(),
  listAppointmentSuggestions: vi.fn(),
  listAppointmentsForHospital: vi.fn(),
  listDoctorAvailability: vi.fn(),
}));

vi.mock("../services/patientApi", () => ({
  listMarketplaceHospitals: vi.fn(),
  listVerifiedHospitals: vi.fn(),
}));

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    configurable: true,
  });
});

describe("usePatientAppointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    patientApi.listVerifiedHospitals.mockResolvedValue({ items: [{ _id: "h-1", name: "Test Hospital" }] });
    patientApi.listMarketplaceHospitals.mockResolvedValue({ items: [{ _id: "h-1", name: "Test Hospital" }] });
    appointmentWorkflow.listAppointmentCalls.mockResolvedValue({ items: [] });
    appointmentWorkflow.listAppointmentsForHospital.mockResolvedValue({ items: [] });
    appointmentWorkflow.listDoctorAvailability.mockResolvedValue({ items: [] });
    appointmentWorkflow.listAppointmentSuggestions.mockResolvedValue({ items: [] });
    appointmentWorkflow.createAppointment.mockResolvedValue({ _id: "a-1", serviceType: "General Consultation" });
    appointmentWorkflow.createAppointmentCall.mockResolvedValue({ ok: true });
  });

  it("loads hospitals for the selector even without coordinates", async () => {
    const { result } = renderHook(() => usePatientAppointments({ hospitalFromQuery: "", savedLocation: {} }));

    await waitFor(() => {
      expect(result.current.hospitals).toHaveLength(1);
    });

    expect(result.current.hospitals[0]).toMatchObject({ name: "Test Hospital" });
  });

  it("uses browser geolocation to populate location when available", async () => {
    const geolocation = {
      getCurrentPosition: vi.fn((success) => success({ coords: { latitude: -1.2, longitude: 36.8 } })),
    };
    Object.defineProperty(window.navigator, "geolocation", { value: geolocation, configurable: true });

    const { result } = renderHook(() => usePatientAppointments({ hospitalFromQuery: "", savedLocation: {} }));

    await waitFor(() => {
      expect(result.current.lat).toBe("-1.2");
      expect(result.current.lng).toBe("36.8");
      expect(result.current.locationMode).toBe("gps");
    });
  });

  it("submits an appointment through the shared hook", async () => {
    const { result } = renderHook(() => usePatientAppointments({ hospitalFromQuery: "h-1", savedLocation: { lat: 1, lng: 2, radiusKm: 10, mode: "manual" } }));

    await act(async () => {
      result.current.setForm({ scheduledAt: "2026-01-01T10:00:00.000Z", reason: "Checkup", serviceType: "General Consultation", consultationMode: "IN_PERSON", doctor: "" });
    });

    await act(async () => {
      await result.current.submit({ preventDefault: vi.fn() });
    });

    expect(appointmentWorkflow.createAppointment).toHaveBeenCalled();
    expect(result.current.bookingSuccess).toMatchObject({ hospitalName: "Test Hospital" });
  });
});
