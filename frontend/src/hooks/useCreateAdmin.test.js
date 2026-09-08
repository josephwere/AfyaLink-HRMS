import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateAdmin } from "./useCreateAdmin";
import * as superAdminApi from "../services/superAdminApi";
import { showActionSuccessGuide } from "../components/ActionSuccessGuide";

vi.mock("../services/superAdminApi", () => ({
  registerHospitalAdmin: vi.fn(),
  registerSystemAdmin: vi.fn(),
  registerSuperAssistant: vi.fn(),
  registerDeveloper: vi.fn(),
  registerGovernmentStaff: vi.fn(),
  listHospitals: vi.fn(),
}));

vi.mock("../components/ActionSuccessGuide", () => ({
  showActionSuccessGuide: vi.fn(),
}));

describe("useCreateAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads hospitals and submits through the service layer", async () => {
    superAdminApi.listHospitals.mockResolvedValueOnce({ items: [{ _id: "h1", name: "Aga Khan" }] });

    const { result } = renderHook(() => useCreateAdmin({ actorRole: "SUPER_ADMIN" }));

    await act(async () => {
      await result.current.loadHospitals();
    });

    expect(superAdminApi.listHospitals).toHaveBeenCalled();
    expect(result.current.hospitals[0].name).toBe("Aga Khan");
  });

  it("surfaces inline field validation before the request is sent", async () => {
    const { result } = renderHook(() => useCreateAdmin({ actorRole: "SUPER_ADMIN" }));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.fieldErrors.name).toBe("This field is required");
    expect(result.current.fieldErrors.email).toBe("This field is required");
    expect(result.current.fieldErrors.password).toBe("This field is required");
    expect(superAdminApi.registerHospitalAdmin).not.toHaveBeenCalled();
  });

  it("dispatches the shared success guide after a successful create", async () => {
    superAdminApi.registerHospitalAdmin.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useCreateAdmin({ actorRole: "SUPER_ADMIN", canCreateGlobalAdmins: true }));

    await act(async () => {
      result.current.setForm({
        name: "Dr. Jane",
        email: "jane@example.com",
        password: "secret123",
        role: "HOSPITAL_ADMIN",
        hospitalId: "h1",
        branch: "Nairobi",
      });
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(showActionSuccessGuide).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Admin created",
        message: expect.stringContaining("Hospital admin created"),
        notificationTitle: "Admin created",
        notificationCategory: "ACCOUNT",
      })
    );
  });
});
