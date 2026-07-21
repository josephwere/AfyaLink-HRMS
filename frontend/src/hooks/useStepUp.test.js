import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStepUp } from "./useStepUp";
import * as stepUpApi from "../services/stepUpApi";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../services/stepUpApi", () => ({
  getSessionRisk: vi.fn(),
  requestStepUpCode: vi.fn(),
  verifyStepUpCode: vi.fn(),
}));

describe("useStepUp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads session risk through the service layer", async () => {
    stepUpApi.getSessionRisk.mockResolvedValueOnce({ risk: { level: "low" } });

    const { result } = renderHook(() => useStepUp());

    await act(async () => {
      await result.current.loadRisk();
    });

    expect(stepUpApi.getSessionRisk).toHaveBeenCalled();
    expect(result.current.sessionRisk?.risk?.level).toBe("low");
  });
});
