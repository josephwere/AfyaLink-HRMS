import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react-hooks";
import { useClaimRules } from "./useClaimRules";
import { createClaimRule, listClaimRules, updateClaimRule } from "../services/systemAdminApi";

vi.mock("../services/systemAdminApi", () => ({
  createClaimRule: vi.fn(),
  listClaimRules: vi.fn(),
  updateClaimRule: vi.fn(),
}));

describe("useClaimRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads rules and creates a new one", async () => {
    listClaimRules.mockResolvedValueOnce([{ _id: "1", ruleType: "MAX_PER_WINDOW", enabled: true }]);
    listClaimRules.mockResolvedValueOnce([{ _id: "1", ruleType: "MAX_PER_WINDOW", enabled: true }]);
    createClaimRule.mockResolvedValue({ _id: "2", ruleType: "COOLDOWN_DAYS", enabled: true });

    const { result, waitForNextUpdate } = renderHook(() => useClaimRules());
    await waitForNextUpdate();

    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await result.current.createRule({ ruleType: "COOLDOWN_DAYS" });
    });

    expect(createClaimRule).toHaveBeenCalled();
    expect(result.current.msg).toBe("");
  });

  it("toggles an existing rule", async () => {
    listClaimRules.mockResolvedValue([{ _id: "1", ruleType: "MAX_PER_WINDOW", enabled: true }]);
    updateClaimRule.mockResolvedValue({ _id: "1", enabled: false });

    const { result, waitForNextUpdate } = renderHook(() => useClaimRules());
    await waitForNextUpdate();

    await act(async () => {
      await result.current.toggleRule({ _id: "1", enabled: true });
    });

    expect(updateClaimRule).toHaveBeenCalledWith("1", { enabled: false });
  });
});
