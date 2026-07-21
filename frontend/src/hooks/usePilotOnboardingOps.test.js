import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePilotOnboardingOps } from "./usePilotOnboardingOps";
import * as opsApi from "../services/opsApi";

vi.mock("../services/opsApi", () => ({
  listPilotOnboarding: vi.fn(),
  updatePilotOnboardingItem: vi.fn(),
  upsertPilotOnboarding: vi.fn(),
}));

describe("usePilotOnboardingOps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads and saves checklist data through the service layer", async () => {
    opsApi.listPilotOnboarding.mockResolvedValueOnce({ items: [{ _id: "1", items: [] }] });
    opsApi.upsertPilotOnboarding.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => usePilotOnboardingOps());

    await act(async () => {
      await result.current.load();
    });

    expect(opsApi.listPilotOnboarding).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(1);

    act(() => {
      result.current.setHospital("h1");
    });

    await act(async () => {
      await result.current.createChecklist();
    });

    expect(opsApi.upsertPilotOnboarding).toHaveBeenCalled();
  });
});
