import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePatientPayments } from "./usePatientPayments";
import * as patientApi from "../services/patientApi";

vi.mock("../services/patientApi", () => ({
  initializeStripePaymentIntent: vi.fn(),
  initializeMpesaPayment: vi.fn(),
  initializeFlutterwavePayment: vi.fn(),
}));

describe("usePatientPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits a card payment through the shared hook", async () => {
    patientApi.initializeStripePaymentIntent.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => usePatientPayments());

    await act(async () => {
      await result.current.payWithCard();
    });

    expect(patientApi.initializeStripePaymentIntent).toHaveBeenCalledWith({ amount: 10, currency: "usd" });
    expect(result.current.status).toContain("ok");
  });
});
