import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClinicalIntelligence } from "./useClinicalIntelligence";
import { runBurnoutScore, runCausalImpact, runDigitalTwin, runStaffingForecast } from "../services/mlApi";

vi.mock("../services/mlApi", () => ({
  runBurnoutScore: vi.fn(),
  runCausalImpact: vi.fn(),
  runDigitalTwin: vi.fn(),
  runStaffingForecast: vi.fn(),
}));

describe("useClinicalIntelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs staffing forecast and stores the result", async () => {
    runStaffingForecast.mockResolvedValueOnce({ forecast: 42 });

    const { result } = renderHook(() => useClinicalIntelligence());

    await act(async () => {
      await result.current.runForecast();
    });

    expect(runStaffingForecast).toHaveBeenCalledWith(expect.objectContaining({ beds: 220 }));
    expect(result.current.forecastResult).toEqual({ forecast: 42 });
  });
});
