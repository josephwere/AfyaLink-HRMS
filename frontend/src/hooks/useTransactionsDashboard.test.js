import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTransactionsDashboard } from "./useTransactionsDashboard";
import * as transactionsApi from "../services/transactionsApi";

vi.mock("../services/transactionsApi", () => ({
  listTransactions: vi.fn(),
  getTransactionSummary: vi.fn(),
  getRevenueDaily: vi.fn(),
  exportTransactionsCsv: vi.fn(),
}));

describe("useTransactionsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads transactions, summary, and chart data", async () => {
    transactionsApi.listTransactions.mockResolvedValueOnce({ data: [{ _id: "1", reference: "TX-1" }] });
    transactionsApi.getTransactionSummary.mockResolvedValueOnce({ data: [{ _id: "stripe", total: 100 }] });
    transactionsApi.getRevenueDaily.mockResolvedValueOnce([{ _id: "2024-01-01", total: 50 }]);

    const { result } = renderHook(() => useTransactionsDashboard());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.summary).toHaveLength(1);
    expect(result.current.chartData).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it("surfaces errors when loading fails", async () => {
    transactionsApi.listTransactions.mockRejectedValueOnce(new Error("boom"));
    transactionsApi.getTransactionSummary.mockResolvedValueOnce({ data: [] });
    transactionsApi.getRevenueDaily.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useTransactionsDashboard());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe("boom");
    expect(result.current.rows).toEqual([]);
  });
});
