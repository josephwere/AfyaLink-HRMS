import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNlpAnalytics } from "./useNlpAnalytics";
import { queryNlpAnalytics } from "../services/intelligenceApi";

vi.mock("../services/intelligenceApi", () => ({
  queryNlpAnalytics: vi.fn(),
}));

describe("useNlpAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the NLP query and stores the result", async () => {
    queryNlpAnalytics.mockResolvedValueOnce({ interpretation: "ok", metrics: { revenue: 1 }, suggestedFollowUps: ["follow up"] });

    const { result } = renderHook(() => useNlpAnalytics());

    result.current.setQuery("Show revenue this month");

    await act(async () => {
      await result.current.run();
    });

    expect(queryNlpAnalytics).toHaveBeenCalledWith("Show revenue this month");
    expect(result.current.result?.interpretation).toBe("ok");
  });
});
