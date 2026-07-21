import { apiFetch } from "../utils/apiFetch";

export const listBillingTransactions = async ({ hospitalId = "" } = {}) => {
  const qs = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  return apiFetch(`/api/billing/list${qs}`);
};

export const listHospitalMarketplace = async ({ limit = 100 } = {}) =>
  apiFetch(`/api/hospitals/marketplace?limit=${limit}`);

export const createStripeIntent = async (amount) =>
  apiFetch("/api/payments/stripe/create-intent", {
    method: "POST",
    body: { amount: Number(amount) },
  });

export const createMpesaStk = async ({ amount, phone }) =>
  apiFetch("/api/payments/mpesa/stk", {
    method: "POST",
    body: { amount: Number(amount), phone },
  });

export const routePayment = async (payload) =>
  apiFetch("/api/payments/route", {
    method: "POST",
    body: payload,
  });
