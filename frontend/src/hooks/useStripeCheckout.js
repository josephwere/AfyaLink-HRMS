import { useCallback, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { createStripeIntent } from "../services/paymentsApi";

export function useStripeCheckout() {
  const [status, setStatus] = useState("");

  const stripePromise = useMemo(() => loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE || ""), []);

  const start = useCallback(async () => {
    try {
      setStatus("Preparing Stripe checkout...");
      const js = await createStripeIntent(1000);
      const stripe = await stripePromise;
      const clientSecret = js?.data?.clientSecret || js?.clientSecret;
      if (!stripe || !clientSecret) {
        setStatus("Stripe is not configured correctly.");
        return;
      }
      setStatus("Stripe intent created successfully.");
    } catch (err) {
      setStatus(err?.message || "Failed to start Stripe checkout");
    }
  }, [stripePromise]);

  return { status, start };
}

export default useStripeCheckout;
