import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateAdmin } from "./useCreateAdmin";
import * as superAdminApi from "../services/superAdminApi";

vi.mock("../services/superAdminApi", () => ({
  registerHospitalAdmin: vi.fn(),
  registerSystemAdmin: vi.fn(),
  registerSuperAssistant: vi.fn(),
  registerDeveloper: vi.fn(),
  registerGovernmentStaff: vi.fn(),
  listHospitals: vi.fn(),
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
});
