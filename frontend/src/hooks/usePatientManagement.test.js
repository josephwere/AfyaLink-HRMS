import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePatientManagement } from "./usePatientManagement";
import * as patientApi from "../services/patientApi";

vi.mock("../services/patientApi", () => ({
  listPatients: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  createPatientVitals: vi.fn(),
}));

describe("usePatientManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    patientApi.listPatients.mockResolvedValue([{ _id: "p-1", name: "Jane" }]);
    patientApi.createPatient.mockResolvedValue({ ok: true });
    patientApi.updatePatient.mockResolvedValue({ ok: true });
    patientApi.createPatientVitals.mockResolvedValue({ ok: true });
  });

  it("loads and saves patient data through the shared hook", async () => {
    const { result } = renderHook(() => usePatientManagement());

    await act(async () => {
      await result.current.loadPatients();
      await result.current.submitPatient({ preventDefault: vi.fn() });
    });

    expect(patientApi.listPatients).toHaveBeenCalled();
    expect(result.current.patients).toHaveLength(1);
  });
});
