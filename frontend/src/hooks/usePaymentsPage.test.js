import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePaymentsPage } from "./usePaymentsPage";
import * as paymentsApi from "../services/paymentsApi";

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams()],
  };
});

vi.mock("../services/paymentsApi", () => ({
  listBillingTransactions: vi.fn(),
  listHospitalMarketplace: vi.fn(),
  routePayment: vi.fn(),
}));

describe("usePaymentsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads transactions and marketplace options", async () => {
    paymentsApi.listBillingTransactions.mockResolvedValueOnce({ items: [{ _id: "tx-1", amount: 100 }] });
    paymentsApi.listHospitalMarketplace.mockResolvedValueOnce({ items: [{ _id: "h-1", name: "A" }] });

    renderHook(() => usePaymentsPage({ user: { role: "PATIENT" } }));

    await waitFor(() => {
      expect(paymentsApi.listBillingTransactions).toHaveBeenCalledWith({ hospitalId: "" });
    });
  }, 10000);
});
