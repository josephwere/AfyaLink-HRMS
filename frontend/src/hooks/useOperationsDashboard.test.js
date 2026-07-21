import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOperationsDashboard } from "./useOperationsDashboard";

describe("useOperationsDashboard", () => {
  it("loads dashboard data and transfers", async () => {
    const loadDashboard = vi.fn().mockResolvedValue({ sessionsToday: 5 });
    const loadTransfers = vi.fn().mockResolvedValue({ items: [{ status: "PENDING" }] });

    const { result } = renderHook(() => useOperationsDashboard({ loadDashboard, loadTransfers }));

    await act(async () => {
      await result.current.reload();
    });

    expect(loadDashboard).toHaveBeenCalled();
    expect(loadTransfers).toHaveBeenCalled();
    expect(result.current.data?.sessionsToday).toBe(5);
    expect(result.current.pendingTransfers).toBe(1);
  });
});
