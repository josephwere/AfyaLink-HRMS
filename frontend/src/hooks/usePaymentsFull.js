import { useCallback, useState } from "react";
import { createMpesaStk, createStripeIntent } from "../services/paymentsApi";

export function usePaymentsFull() {
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");

  const runAction = useCallback(async (kind, request) => {
    setBusy(kind);
    setResult("");
    try {
      const payload = await request();
      setResult(JSON.stringify(payload, null, 2));
    } catch (err) {
      setResult(err?.message || "Payment request failed.");
    } finally {
      setBusy("");
    }
  }, []);

  const runStripePayment = useCallback(async () => {
    await runAction("stripe", async () => createStripeIntent(Number(amount)));
  }, [amount, runAction]);

  const runMpesaPayment = useCallback(async () => {
    await runAction("mpesa", async () => createMpesaStk({ amount: Number(amount), phone: "2547XXXXXXXX" }));
  }, [amount, runAction]);

  return {
    amount,
    setAmount,
    busy,
    result,
    runAction,
    runStripePayment,
    runMpesaPayment,
  };
}

export default usePaymentsFull;
