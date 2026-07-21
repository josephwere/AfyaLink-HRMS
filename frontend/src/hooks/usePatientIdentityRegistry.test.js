import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePatientIdentityRegistry } from "./usePatientIdentityRegistry";
import * as systemAdminApi from "../services/systemAdminApi";

vi.mock("../services/systemAdminApi", () => ({
  listPatientIdentityRegistry: vi.fn(),
  createPatientIdentityRegistryEntry: vi.fn(),
  importPatientIdentityRegistry: vi.fn(),
}));

describe("usePatientIdentityRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and saves identity entries", async () => {
    vi.mocked(systemAdminApi.listPatientIdentityRegistry).mockResolvedValue([{ _id: "i1", idNumber: "123" }]);
    vi.mocked(systemAdminApi.createPatientIdentityRegistryEntry).mockResolvedValue({ success: true });

    const { result } = renderHook(() => usePatientIdentityRegistry());

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.submit({ preventDefault: () => {} });
    });

    expect(systemAdminApi.createPatientIdentityRegistryEntry).toHaveBeenCalled();
  });
});
