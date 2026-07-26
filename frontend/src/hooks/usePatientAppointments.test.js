import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeAppointmentList, usePatientAppointments } from "./usePatientAppointments";
import * as appointmentWorkflow from "../services/appointmentWorkflow";
import * as patientApi from "../services/patientApi";

vi.mock("../services/appointmentWorkflow", () => ({
  createAppointment: vi.fn(),
  createAppointmentCall: vi.fn(),
  listAppointmentCalls: vi.fn(),
  listAppointmentSuggestions: vi.fn(),
  listAppointmentsForHospital: vi.fn(),
  listDoctorAvailability: vi.fn(),
  listHospitalDoctors: vi.fn(),
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

describe("mergeAppointmentList", () => {
  it("prepends a newly created appointment immediately for the patient list", () => {
    const existing = [{ _id: "old-1", status: "Scheduled" }];
    const updated = mergeAppointmentList(existing, { _id: "new-1", status: "Pending" });

    expect(updated).toHaveLength(2);
    expect(updated[0]).toMatchObject({ _id: "new-1", status: "Pending" });
    expect(updated[1]).toMatchObject({ _id: "old-1", status: "Scheduled" });
  });

  it("keeps the existing list when there is no new appointment", () => {
    const existing = [{ _id: "old-1", status: "Scheduled" }];
    expect(mergeAppointmentList(existing, null)).toEqual(existing);
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
    appointmentWorkflow.listHospitalDoctors.mockResolvedValue({ items: [{ _id: "doctor-1", name: "Dr Test" }] });
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

  it("does not retry geolocation repeatedly after an initial failure", async () => {
    const geolocation = {
      getCurrentPosition: vi.fn((success, error) => error?.({ code: 1, message: "denied" })),
    };
    Object.defineProperty(window.navigator, "geolocation", { value: geolocation, configurable: true });

    const { result } = renderHook(() => usePatientAppointments({ hospitalFromQuery: "", savedLocation: {} }));

    await waitFor(() => {
      expect(result.current.msg).toBe("Could not read your current location. You can still search by town, county, or a landmark.");
    });

    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("submits a service-first appointment without a doctor by default", async () => {
    const { result } = renderHook(() => usePatientAppointments({ hospitalFromQuery: "h-1", savedLocation: { lat: 1, lng: 2, radiusKm: 10, mode: "manual" } }));

    await act(async () => {
      result.current.setForm({ scheduledAt: "2026-01-01T10:00:00.000Z", reason: "Checkup", serviceType: "General Consultation", consultationMode: "IN_PERSON", doctor: "doctor-1" });
    });

    await act(async () => {
      await result.current.submit({ preventDefault: vi.fn() });
    });

    expect(appointmentWorkflow.createAppointment).toHaveBeenCalledWith(expect.not.objectContaining({ doctor: expect.any(String) }));
    expect(result.current.bookingSuccess).toMatchObject({ hospitalName: "Test Hospital" });
  });

  it("can submit a preferred doctor only when doctor selection is explicitly enabled", async () => {
    const { result } = renderHook(() => usePatientAppointments({
      hospitalFromQuery: "h-1",
      savedLocation: { lat: 1, lng: 2, radiusKm: 10, mode: "manual" },
      allowDoctorSelection: true,
    }));

    await act(async () => {
      result.current.setForm({ scheduledAt: "2026-01-01T10:00:00.000Z", reason: "Follow-up", serviceType: "General Consultation", consultationMode: "IN_PERSON", doctor: "doctor-1" });
    });

    await act(async () => {
      await result.current.submit({ preventDefault: vi.fn() });
    });

    expect(appointmentWorkflow.createAppointment).toHaveBeenCalledWith(expect.objectContaining({ doctor: "doctor-1" }));
  });
});
