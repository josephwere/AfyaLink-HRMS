import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";
import { useSearchParams } from "react-router-dom";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import WorkflowBadge from "../../components/workflow/WorkflowBadge";
import RequireVerified from "../../components/RequireVerified";

/**
 * PAYMENTS PAGE — WORKFLOW ENFORCED
 * - No double payment
 * - Backend is authority
 */

export default function PaymentsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialHospitalId =
    searchParams.get("hospitalId") ||
    localStorage.getItem("afyalink_patient_hospital_id") ||
    "";
  const [hospitalId, setHospitalId] = useState(initialHospitalId);
  const [hospitalOptions, setHospitalOptions] = useState([]);

  const [transactions, setTransactions] = useState([]);
  const [hospitalInfo, setHospitalInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeTx, setActiveTx] = useState(null);
  const [methodMsg, setMethodMsg] = useState("");
  const [bankInvoice, setBankInvoice] = useState(null);
  const [processing, setProcessing] = useState(false);

  const isPrivileged =
    ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(
      String(user?.role || "")
    );

  useEffect(() => {
    if (user) loadTransactions();
  }, [user, hospitalId]);

  useEffect(() => {
    if (!user || !isPrivileged) return;
    apiFetch("/api/hospitals/marketplace?limit=200")
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setHospitalOptions(items);
      })
      .catch(() => setHospitalOptions([]));
  }, [user, isPrivileged]);

  useEffect(() => {
    if (hospitalId) {
      localStorage.setItem("afyalink_patient_hospital_id", hospitalId);
    }
  }, [hospitalId]);

  async function loadTransactions() {
    try {
      const qs = hospitalId
        ? `?hospitalId=${encodeURIComponent(hospitalId)}`
        : "";
      const [data, market] = await Promise.all([
        apiFetch(`/api/billing/list${qs}`),
        hospitalId
          ? apiFetch(`/api/hospitals/marketplace?limit=100`)
          : Promise.resolve(null),
      ]);
      const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setTransactions(rows);
      if (hospitalId && Array.isArray(market?.items)) {
        const byId = market.items.find((h) => String(h._id) === String(hospitalId)) || null;
        setHospitalInfo(byId);
      } else {
        setHospitalInfo(null);
      }
    } catch {
      setMsg("Failed to load transactions");
    }
  }

  /* ===============================
     PAYMENT ROUTER
  =============================== */
  async function routePayment(method, tx) {
    const canPay = tx.workflow?.allowedTransitions?.includes("PAID");
    if (!canPay) {
      setMethodMsg("Payment not allowed at this stage");
      return;
    }
    setProcessing(true);
    setMethodMsg("");
    setBankInvoice(null);
    try {
      const payload = {
        method,
        amount: tx.amount,
        currency: tx.currency || "KES",
        transactionId: tx._id,
        phone: tx.phone || user?.phone || "",
        email: user?.email || "",
        name: user?.name || "",
        hospitalId: hospitalId || undefined,
      };
      const data = await apiFetch("/api/payments/route", {
        method: "POST",
        body: payload,
      });
      if (method === "stripe") {
        setMethodMsg(
          "Stripe Payment Intent created.\nClient Secret:\n" +
            (data?.data?.clientSecret || data?.clientSecret || "")
        );
      } else if (method === "mpesa") {
        setMethodMsg("M-Pesa STK Push sent. Await confirmation.");
      } else if (method === "flutterwave" || method === "airtel") {
        const link = data?.data?.paymentLink || data?.paymentLink;
        setMethodMsg(link ? `Flutterwave checkout link:\n${link}` : "Flutterwave payment initiated.");
      } else if (method === "paypal") {
        const link = data?.data?.approvalLink || data?.approvalLink;
        setMethodMsg(link ? `PayPal approval link:\n${link}` : "PayPal order created.");
      } else if (method === "crypto") {
        const link = data?.data?.hostedUrl || data?.hostedUrl;
        setMethodMsg(link ? `Crypto checkout link:\n${link}` : "Crypto charge created.");
      } else if (method === "bank") {
        const details = data?.data?.details || data?.details || {};
        const invoice = data?.data?.invoice || data?.invoice || null;
        const lines = [
          "Bank transfer instructions:",
          details.bankName ? `Bank: ${details.bankName}` : null,
          details.accountName ? `Account Name: ${details.accountName}` : null,
          details.accountNumber ? `Account No: ${details.accountNumber}` : null,
          details.branch ? `Branch: ${details.branch}` : null,
          details.swiftCode ? `Swift: ${details.swiftCode}` : null,
          details.instructions ? details.instructions : null,
        ].filter(Boolean);
        setMethodMsg(lines.join("\n") || "Bank transfer initiated.");
        if (invoice?.text) {
          setBankInvoice(invoice);
        }
      } else {
        setMethodMsg("Payment initiated.");
      }
      await loadTransactions();
    } catch (err) {
      setMethodMsg(err.message || "Payment failed.");
    } finally {
      setProcessing(false);
    }
  }

  const methodOptions = useMemo(() => {
    const phone = String(user?.phone || "");
    const isKenya = user?.country === "KE" || phone.startsWith("254") || phone.startsWith("+254");
    const base = [
      { key: "mpesa", label: "M-Pesa", emoji: "📱", recommended: isKenya },
      { key: "airtel", label: "Airtel Money", emoji: "📲", recommended: isKenya },
      { key: "stripe", label: "Card (Stripe)", emoji: "💳" },
      { key: "bank", label: "Bank Transfer", emoji: "🏦" },
      { key: "flutterwave", label: "Flutterwave", emoji: "🌍" },
      { key: "paypal", label: "PayPal", emoji: "🌍", disabled: true },
      { key: "crypto", label: "Crypto", emoji: "💰", disabled: true },
    ];

    if (hospitalInfo && !hospitalInfo?.patientPaymentMethods?.length) {
      return [];
    }
    if (!hospitalInfo?.patientPaymentMethods?.length) {
      return base;
    }

    const mapped = hospitalInfo.patientPaymentMethods
      .filter((m) => m.enabled !== false)
      .map((m) => {
        const type = String(m.type || "").toLowerCase();
        const key =
          type.includes("mpesa") ? "mpesa" :
          type.includes("stripe") ? "stripe" :
          type.includes("flutter") ? "flutterwave" :
          type.includes("card") ? "stripe" :
          type.includes("bank") ? "bank" :
          type.includes("paypal") ? "paypal" :
          type.includes("crypto") ? "crypto" :
          type.includes("airtel") ? "airtel" : type || "bank";
        return {
          key,
          label: m.label || base.find((b) => b.key === key)?.label || m.type,
          emoji: base.find((b) => b.key === key)?.emoji || "💳",
          details: m,
          recommended: isKenya && ["mpesa", "airtel"].includes(key),
        };
      });

    return mapped.length ? mapped : base;
  }, [hospitalInfo, user]);

  if (!user) return <div>Please log in</div>;

  /* ===============================
     UI
  =============================== */
  return (
    <div className="card premium-card">
      <h2>Payments</h2>
      {hospitalId && (
        <p className="muted">
          Hospital context: {hospitalInfo?.name || hospitalId}
        </p>
      )}
      {hospitalInfo && (
        <div className="subtle-banner" style={{ marginBottom: 10 }}>
          Available channels: {(hospitalInfo.patientPaymentMethods || []).map((m) => m.label || m.type).join(", ") || "Not configured"}
        </div>
      )}

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

      {isPrivileged && (
        <div className="card" style={{ marginBottom: 16 }}>
          <label>Hospital</label>
          <select
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
          >
            <option value="">All hospitals</option>
            {hospitalOptions.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name || h.code || h._id}
              </option>
            ))}
          </select>
        </div>
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
                      type="button"
                      disabled={loading || !canPay}
                      onClick={() => setActiveTx(tx)}
                    >
                      Choose Method
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

      {activeTx && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header-actions">
            <div>
              <h3>Choose Payment Method</h3>
              <p className="muted">Select how you want to pay for this transaction.</p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setActiveTx(null);
                setMethodMsg("");
              }}
            >
              Close
            </button>
          </div>
          <div className="grid info-grid" style={{ marginTop: 12 }}>
            {methodOptions.length === 0 ? (
              <div className="muted">No payment methods enabled for this hospital.</div>
            ) : (
              methodOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`card ${opt.recommended ? "action-pill" : ""}`}
                  disabled={processing || opt.disabled}
                  onClick={() => routePayment(opt.key, activeTx)}
                  style={{ textAlign: "left" }}
                >
                  <div style={{ fontWeight: 700 }}>{opt.emoji} {opt.label}</div>
                  <div className="muted">
                    {opt.disabled ? "Coming soon" : opt.recommended ? "Recommended" : "Available"}
                  </div>
                </button>
              ))
            )}
          </div>
          {methodMsg && (
            <pre style={{ background: "#f3f4f6", padding: 12, whiteSpace: "pre-wrap", marginTop: 12 }}>
              {methodMsg}
            </pre>
          )}
          {bankInvoice?.text && (
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: 8 }}
              onClick={() => {
                const blob = new Blob([bankInvoice.text], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = bankInvoice.filename || "bank-transfer-invoice.txt";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download Bank Invoice
            </button>
          )}
        </div>
      )}
    </div>
  );
}
