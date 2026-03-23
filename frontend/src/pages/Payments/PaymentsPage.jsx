import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";
import { useSearchParams } from "react-router-dom";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import WorkflowBadge from "../../components/workflow/WorkflowBadge";
import { normalizeRole } from "../../utils/normalizeRole";

function formatMoney(amount, currency = "KES") {
  const numeric = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${numeric.toLocaleString()} ${currency}`;
  }
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
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

  const isPrivileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(
    actorRole
  );

  useEffect(() => {
    if (user) loadTransactions();
  }, [user, hospitalId]);

  useEffect(() => {
    if (!user || !isPrivileged) return;
    apiFetch("/api/hospitals/marketplace?limit=200")
      .then((data) => {
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
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
    setLoading(true);
    setMsg("");
    try {
      const qs = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
      const [data, market] = await Promise.all([
        apiFetch(`/api/billing/list${qs}`),
        hospitalId ? apiFetch("/api/hospitals/marketplace?limit=100") : Promise.resolve(null),
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
    } finally {
      setLoading(false);
    }
  }

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
    const isKenya =
      user?.country === "KE" || phone.startsWith("254") || phone.startsWith("+254");
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
        const key = type.includes("mpesa")
          ? "mpesa"
          : type.includes("stripe")
          ? "stripe"
          : type.includes("flutter")
          ? "flutterwave"
          : type.includes("card")
          ? "stripe"
          : type.includes("bank")
          ? "bank"
          : type.includes("paypal")
          ? "paypal"
          : type.includes("crypto")
          ? "crypto"
          : type.includes("airtel")
          ? "airtel"
          : type || "bank";
        return {
          key,
          label: m.label || base.find((b) => b.key === key)?.label || m.type,
          emoji: base.find((b) => b.key === key)?.emoji || "💳",
          details: m,
          recommended: isKenya && ["mpesa", "airtel"].includes(key),
          disabled: base.find((b) => b.key === key)?.disabled,
        };
      });

    return mapped.length ? mapped : base;
  }, [hospitalInfo, user]);

  const paymentSummary = useMemo(() => {
    const ready = transactions.filter((tx) => tx.workflow?.allowedTransitions?.includes("PAID")).length;
    const totalAmount = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const currency = transactions.find((tx) => tx.currency)?.currency || "KES";
    const methodsEnabled = methodOptions.filter((opt) => !opt.disabled).length;
    return {
      totalTransactions: transactions.length,
      ready,
      totalAmountLabel: formatMoney(totalAmount, currency),
      methodsEnabled,
    };
  }, [transactions, methodOptions]);

  if (!user) {
    return (
      <div className="auth-status-shell">
        <div className="auth-status-card premium-card">
          <div className="auth-status-icon">₿</div>
          <h1>Payments are locked</h1>
          <p className="subtitle">Sign in first to review billing, workflow state, and payment channels.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard premium-shell payments-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Revenue command</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Payments</h1>
            <p className="premium-shell-subtitle">
              Route each transaction through the right payment rail without losing workflow control,
              auditability, or hospital context.
            </p>
          </div>
          <div className="premium-shell-meta">
            <div className="premium-shell-stat">
              <span>Transactions</span>
              <strong>{paymentSummary.totalTransactions}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Ready To Pay</span>
              <strong>{paymentSummary.ready}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Total Due</span>
              <strong>{paymentSummary.totalAmountLabel}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Channels</span>
              <strong>{paymentSummary.methodsEnabled}</strong>
            </div>
          </div>
        </div>
        <div className="premium-inline-note">
          {hospitalId
            ? `Hospital context: ${hospitalInfo?.name || hospitalId}`
            : "Global billing view active."}
        </div>
      </section>

      {isPrivileged && (
        <section className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>Hospital scope</h3>
              <p className="muted">Switch context to inspect the enabled payment rails for a specific facility.</p>
            </div>
          </div>
          <label>Hospital</label>
          <select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
            <option value="">All hospitals</option>
            {hospitalOptions.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name || h.code || h._id}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="card premium-card">
        <div className="card-header-actions">
          <div>
            <h3>Pending payment workflow</h3>
            <p className="muted">Every transaction stays pinned to its workflow state until the backend confirms the next move.</p>
          </div>
        </div>

        {hospitalInfo ? (
          <div className="premium-banner">
            Available channels:{" "}
            {(hospitalInfo.patientPaymentMethods || [])
              .map((m) => m.label || m.type)
              .join(", ") || "Not configured"}
          </div>
        ) : null}

        {msg ? <pre className="premium-code">{msg}</pre> : null}

        <div className="table-wrap">
          <table className="table premium-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
                <th>Workflow</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length ? (
                transactions.map((tx) => {
                  const canPay = tx.workflow?.allowedTransitions?.includes("PAID");

                  return (
                    <tr key={tx._id}>
                      <td>{tx.patient?.name || "—"}</td>
                      <td>{formatMoney(tx.amount, tx.currency || "KES")}</td>
                      <td>
                        <WorkflowBadge state={tx.workflow?.state} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={loading || !canPay}
                          onClick={() => setActiveTx(tx)}
                        >
                          Choose Method
                        </button>
                      </td>
                      <td className="payments-timeline-cell">
                        <WorkflowTimeline encounterId={tx.encounter} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5">
                    <div className="premium-empty">
                      <strong>No pending payments</strong>
                      <span>The workflow queue is clear for the current scope.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeTx && (
        <section className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>Choose payment method</h3>
              <p className="muted">
                Route {formatMoney(activeTx.amount, activeTx.currency || "KES")} for{" "}
                {activeTx.patient?.name || "this patient"} through the right channel.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setActiveTx(null);
                setMethodMsg("");
                setBankInvoice(null);
              }}
            >
              Close
            </button>
          </div>

          <div className="premium-method-grid">
            {methodOptions.length === 0 ? (
              <div className="premium-empty">
                <strong>No methods enabled</strong>
                <span>This hospital has not exposed any patient payment methods yet.</span>
              </div>
            ) : (
              methodOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`premium-method-card${opt.recommended ? " recommended" : ""}`}
                  disabled={processing || opt.disabled}
                  onClick={() => routePayment(opt.key, activeTx)}
                >
                  <div className="premium-method-card__top">
                    <span className="premium-method-card__emoji">{opt.emoji}</span>
                    <span className="premium-method-card__label">{opt.label}</span>
                  </div>
                  <div className="premium-method-card__meta">
                    {opt.disabled ? "Coming soon" : opt.recommended ? "Recommended" : "Available"}
                  </div>
                </button>
              ))
            )}
          </div>

          {methodMsg ? <pre className="premium-code">{methodMsg}</pre> : null}

          {bankInvoice?.text ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const blob = new Blob([bankInvoice.text], {
                  type: "text/plain;charset=utf-8",
                });
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
          ) : null}
        </section>
      )}
    </div>
  );
}
