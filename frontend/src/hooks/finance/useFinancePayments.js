import { useCallback, useState } from "react";
import { createPayment as apiCreatePayment } from "../../services/finance/paymentsApi";

const VALID_METHODS = ["CASH", "MPESA", "CARD", "BANK", "INSURANCE"];

export default function useFinancePayments({ onSuccess } = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const createPayment = useCallback(
    async (payload, { optimisticUpdate } = {}) => {
      if (isSubmitting) throw new Error("Payment already in progress");
      if (!payload) throw new Error("Missing payment payload");
      const { invoiceId, amount, method } = payload;
      if (!invoiceId) throw new Error("invoiceId is required");
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Amount must be greater than zero");
      if (method && !VALID_METHODS.includes(method)) throw new Error("Invalid payment method");

      setIsSubmitting(true);
      setError(null);
      try {
        // Call optimistic update before the network call, if provided
        if (typeof optimisticUpdate === "function") {
          try {
            optimisticUpdate(payload);
          } catch (e) {
            // swallow optimistic update errors
            console.warn("optimisticUpdate failed", e);
          }
        }

        const res = await apiCreatePayment(payload);

        if (typeof onSuccess === "function") onSuccess(res);

        return res;
      } catch (err) {
        setError(err?.message || String(err));
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, onSuccess]
  );

  return {
    createPayment,
    isSubmitting,
    error,
  };
}
