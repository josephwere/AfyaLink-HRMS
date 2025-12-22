import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import WorkflowBadge from "../../components/workflow/WorkflowBadge";

/**
 * PAYMENTS PAGE — WORKFLOW ENFORCED
 * - No double payment
 * - Backend is authority
 */

export default function PaymentsPage() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (user) loadTransactions();
  }, [user]);

  async function loadTransactions() {
    try {
      const res = await apiFetch("/api/billing/transactions");
      if (!res.ok) throw new Error();
      setTransactions(await res.json());
    } catch {
      setMsg("Failed to load transactions");
    }
  }

  /* ===============================
     STRIPE — CREATE INTENT
  =============================== */
  async function payStripe(tx) {
    const canPay =
      tx.workflow?.allowedTransitions?.includes("PAID");

    if (!canPay) {
      setMsg("Payment not allowed at this stage");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const res = await apiFetch(
        "/payments/stripe/create-payment-intent",
        {
          method: "POST",
          body: {
            amount: tx.amount,
            transactionId: tx._id, // 🔒 hard bind
          },
        }
      );

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Stripe failed");

      setMsg(
        "Stripe Payment Intent created.\nClient Secret:\n" +
          data.clientSecret
      );
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* ===============================
     M-PESA — STK PUSH
  =============================== */
  async function payMpesa(tx) {
    const canPay =
      tx.workflow?.allowedTransitions?.includes("PAID");

    if (!canPay) {
      setMsg("Payment not allowed at this stage");
      return;
    }

    if (!tx.phone) {
      setMsg("Missing phone number on transaction");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const res = await apiFetch("/payments/mpesa/stk", {
        method: "POST",
        body: {
          amount: tx.amount,
          phone: tx.phone,
          transactionId: tx._id, // 🔒 hard bind
        },
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "M-Pesa failed");

      setMsg("M-Pesa STK Push sent. Await confirmation.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return <div>Please log in</div>;

  /* ===============================
     UI
  =============================== */
  return (
    <div className="card premium-card">
      <h2>Payments</h2>

      {msg && (
        <pre
          style={{
            background: "#f3f4f6",
            padding: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </pre>
      )}

      <table className="table premium-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
            <th>Workflow</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length ? (
            transactions.map((tx) => {
              const canPay =
                tx.workflow?.allowedTransitions?.includes(
                  "PAID"
                );

              return (
                <tr key={tx._id}>
                  <td>{tx.patient?.name || "—"}</td>
                  <td>
                    {tx.amount} {tx.currency}
                  </td>

                  {/* ✅ VISUAL WORKFLOW BADGE */}
                  <td>
                    <WorkflowBadge
                      state={tx.workflow?.state}
                    />
                  </td>

                  <td>
                    <button
                      disabled={loading || !canPay}
                      onClick={() => payStripe(tx)}
                    >
                      Stripe
                    </button>

                    <button
                      disabled={loading || !canPay}
                      onClick={() => payMpesa(tx)}
                      style={{ marginLeft: 8 }}
                    >
                      M-Pesa
                    </button>
                  </td>

                  <td style={{ minWidth: 280 }}>
                    <WorkflowTimeline
                      encounterId={tx.encounter}
                    />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan="5"
                style={{ textAlign: "center" }}
              >
                No pending payments
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
