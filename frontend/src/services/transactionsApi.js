import { apiFetch } from "../utils/apiFetch";
import { downloadApiFile } from "../lib/api/client";

export const listTransactions = async (query = "") => apiFetch(`/api/transactions?${query}`);
export const getTransactionSummary = async () => apiFetch("/api/transactions/summary");
export const getRevenueDaily = async () => apiFetch("/api/analytics/revenue/daily");
export const exportTransactionsCsv = async (query = "") => {
  await downloadApiFile(`/api/transactions?${query}`, {
    filename: "transactions.csv",
    headers: { Accept: "text/csv" },
  });
};
