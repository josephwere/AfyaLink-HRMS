import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGovernmentHospitalRegistry } from "./useGovernmentHospitalRegistry";
import * as systemAdminApi from "../services/systemAdminApi";

vi.mock("../services/systemAdminApi", () => ({
  listGovernmentHospitalRegistry: vi.fn(),
  createGovernmentHospitalRegistryEntry: vi.fn(),
  importGovernmentHospitalRegistry: vi.fn(),
}));

describe("useGovernmentHospitalRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and saves registry entries", async () => {
    vi.mocked(systemAdminApi.listGovernmentHospitalRegistry).mockResolvedValue([{ _id: "h1", officialName: "Example" }]);
    vi.mocked(systemAdminApi.createGovernmentHospitalRegistryEntry).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useGovernmentHospitalRegistry());

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.submit({ preventDefault: () => {} });
    });

    expect(systemAdminApi.createGovernmentHospitalRegistryEntry).toHaveBeenCalled();
  });
});
