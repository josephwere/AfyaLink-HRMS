import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePaymentsFull } from "./usePaymentsFull";
import * as paymentsApi from "../services/paymentsApi";

vi.mock("../services/paymentsApi", () => ({
  createStripeIntent: vi.fn(),
  createMpesaStk: vi.fn(),
  listBillingTransactions: vi.fn(),
  listHospitalMarketplace: vi.fn(),
  routePayment: vi.fn(),
}));

describe("usePaymentsFull", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a Stripe intent through the service layer", async () => {
    paymentsApi.createStripeIntent.mockResolvedValueOnce({ id: "pi_123" });

    const { result } = renderHook(() => usePaymentsFull());

    await act(async () => {
      await result.current.runStripePayment();
    });

    expect(paymentsApi.createStripeIntent).toHaveBeenCalledWith(100);
    expect(result.current.result).toContain("pi_123");
  });
});
