import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHospitalKPIDashboard } from "./useHospitalKPIDashboard";
import apiFetch from "../utils/apiFetch";

vi.mock("../utils/apiFetch", () => ({ default: vi.fn() }));

describe("useHospitalKPIDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads KPI data through the API boundary", async () => {
    apiFetch.mockResolvedValueOnce({ encounters: { total: 10 }, insurance: { pending: 2 } });

    const { result } = renderHook(() => useHospitalKPIDashboard());

    await act(async () => {
      await result.current.loadKPIs();
    });

    expect(apiFetch).toHaveBeenCalledWith("/api/admin/kpis");
    expect(result.current.totalEncounters).toBe(10);
  });
});
