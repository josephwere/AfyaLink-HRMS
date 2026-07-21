import { useCallback, useState } from "react";
import { createStripeIntent } from "../services/paymentsApi";

async function safeLoadStripe(key) {
  if (typeof window !== "undefined" && typeof window.Stripe === "function") {
    return window.Stripe(key);
  }
  return null;
}

export function useStripeCheckout() {
  const [status, setStatus] = useState("");

  const start = useCallback(async () => {
    try {
      setStatus("Preparing Stripe checkout...");
      const js = await createStripeIntent(1000);
      const stripe = await safeLoadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE || "");
      const clientSecret = js?.data?.clientSecret || js?.clientSecret;
      if (!stripe || !clientSecret) {
        setStatus("Stripe is not configured correctly.");
        return;
      }
      setStatus("Stripe intent created successfully.");
    } catch (err) {
      setStatus(err?.message || "Failed to start Stripe checkout");
    }
  }, []);

  return { status, start };
}

export default useStripeCheckout;
