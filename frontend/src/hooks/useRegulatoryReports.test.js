import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRegulatoryReports } from "./useRegulatoryReports";
import { getRegulatoryAutoReport } from "../services/intelligenceApi";

vi.mock("../services/intelligenceApi", () => ({
  getRegulatoryAutoReport: vi.fn(),
}));

describe("useRegulatoryReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the regulatory report payload", async () => {
    getRegulatoryAutoReport.mockResolvedValueOnce({ report: { workforce: { staffTotal: 3 } } });

    const { result } = renderHook(() => useRegulatoryReports());

    await act(async () => {
      await result.current.run();
    });

    expect(getRegulatoryAutoReport).toHaveBeenCalled();
    expect(result.current.data?.workforce?.staffTotal).toBe(3);
  });
});
