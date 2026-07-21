import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react-hooks";
import { useFinancials } from "./useFinancials";
import billingService from "../services/billing";

vi.mock("../services/billing", () => ({
  default: {
    listFinancials: vi.fn(),
    createFinancial: vi.fn(),
    payFinancial: vi.fn(),
    claimFinancial: vi.fn(),
  },
}));

describe("useFinancials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads financials and creates a new invoice", async () => {
    billingService.listFinancials.mockResolvedValueOnce({ items: [{ _id: "1", invoiceNumber: "INV-1", total: 100, status: "PENDING" }], total: 1 });
    billingService.createFinancial.mockResolvedValueOnce({ _id: "2" });

    const { result, waitForNextUpdate } = renderHook(() => useFinancials());
    await waitForNextUpdate();

    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await result.current.createInvoice({ patient: "p1" });
    });

    expect(billingService.createFinancial).toHaveBeenCalled();
    expect(result.current.msg).toBe("");
  });

  it("records payment and claim submission", async () => {
    billingService.listFinancials.mockResolvedValue({ items: [], total: 0 });
    billingService.payFinancial.mockResolvedValue({ ok: true });
    billingService.claimFinancial.mockResolvedValue({ ok: true });

    const { result, waitForNextUpdate } = renderHook(() => useFinancials());
    await waitForNextUpdate();

    await act(async () => {
      await result.current.payInvoice("1", 25);
      await result.current.claimInvoice("1", "NHIF");
    });

    expect(billingService.payFinancial).toHaveBeenCalledWith("1", 25);
    expect(billingService.claimFinancial).toHaveBeenCalledWith("1", "NHIF");
  });
});
