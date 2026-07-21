import { act, renderHook } from "@testing-library/react-hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRevenueIntelligence } from "./useRevenueIntelligence";
import { getRevenueIntelligenceSnapshot } from "../services/revenueIntelligenceApi";
import apiFetch from "../utils/apiFetch";

vi.mock("../services/revenueIntelligenceApi", () => ({
  getRevenueIntelligenceSnapshot: vi.fn(),
}));
vi.mock("../utils/apiFetch", () => ({ default: vi.fn() }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock("../utils/auth", () => ({ useAuth: () => ({ user: { actualRole: "SYSTEM_ADMIN" } }) }));

describe("useRevenueIntelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the revenue intelligence snapshot", async () => {
    getRevenueIntelligenceSnapshot.mockResolvedValueOnce({ payload: { summary: { outstandingAmount: 100 } }, clientMeta: { attempts: 1 } });
    apiFetch.mockResolvedValueOnce({ items: [] });

    const { result } = renderHook(() => useRevenueIntelligence());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getRevenueIntelligenceSnapshot).toHaveBeenCalled();
    expect(result.current.snapshot?.summary?.outstandingAmount).toBe(100);
  });
});
