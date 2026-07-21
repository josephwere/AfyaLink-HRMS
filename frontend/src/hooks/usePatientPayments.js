import { useCallback, useState } from "react";
import {
  initializeStripePaymentIntent,
  initializeMpesaPayment,
  initializeFlutterwavePayment,
} from "../services/patientApi";

export function usePatientPayments() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");

  const run = useCallback(async (key, fn) => {
    setBusy(key);
    setStatus("");
    try {
      const payload = await fn();
      setStatus(JSON.stringify(payload, null, 2));
    } catch (err) {
      setStatus(err?.message || "Payment request failed");
    } finally {
      setBusy("");
    }
  }, []);

  const payWithCard = useCallback(
    () => run("stripe", () => initializeStripePaymentIntent({ amount: 10, currency: "usd" })),
    [run]
  );

  const payWithMpesa = useCallback(
    () => run("mpesa", () => initializeMpesaPayment({ phone: "254700000000", amount: 10 })),
    [run]
  );

  const payWithFlutterwave = useCallback(
    () => run("flutter", () => initializeFlutterwavePayment({ amount: 10, email: "test@example.com" })),
    [run]
  );

  return {
    status,
    busy,
    run,
    payWithCard,
    payWithMpesa,
    payWithFlutterwave,
  };
}

export default usePatientPayments;
