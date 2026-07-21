import React from "react";
import { useAuth } from "../../utils/auth";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import WorkflowBadge from "../../components/workflow/WorkflowBadge";
import { useAppLanguage } from "../../utils/appLanguage.jsx";
import { usePaymentsPage } from "../../hooks/usePaymentsPage";

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
  const { translateText } = useAppLanguage();
  const {
    hospitalId,
    setHospitalId,
    hospitalOptions,
    transactions,
    hospitalInfo,
    loading,
    msg,
    activeTx,
    setActiveTx,
    methodMsg,
    setMethodMsg,
    bankInvoice,
    setBankInvoice,
    processing,
    routePaymentMethod,
    methodOptions,
    paymentSummary,
    isPrivileged,
  } = usePaymentsPage({ user });

  const handleRoutePayment = async (method, tx) => {
    await routePaymentMethod(method, tx);
  };

  if (!user) {
    return (
      <div className="auth-status-shell">
        <div className="auth-status-card premium-card">
          <div className="auth-status-icon">₿</div>
          <h1>{translateText("Payments are locked")}</h1>
          <p className="subtitle">{translateText("Sign in first to review billing, workflow state, and payment channels.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard premium-shell payments-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">{translateText("Revenue command")}</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">{translateText("Payments")}</h1>
            <p className="premium-shell-subtitle">
              {translateText("Route each transaction through the right payment rail without losing workflow control, auditability, or hospital context.")}
            </p>
          </div>
          <div className="premium-shell-meta">
            <div className="premium-shell-stat">
              <span>{translateText("Transactions")}</span>
              <strong>{paymentSummary.totalTransactions}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>{translateText("Ready To Pay")}</span>
              <strong>{paymentSummary.ready}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>{translateText("Total Due")}</span>
              <strong>{paymentSummary.totalAmountLabel}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>{translateText("Channels")}</span>
              <strong>{paymentSummary.methodsEnabled}</strong>
            </div>
          </div>
        </div>
        <div className="premium-inline-note">
          {hospitalId
            ? `${translateText("Hospital")}: ${hospitalInfo?.name || hospitalId}`
            : translateText("Global billing view active.")}
        </div>
      </section>

      {isPrivileged && (
        <section className="card premium-card">
          <div className="card-header-actions">
            <div>
              <h3>{translateText("Hospital scope")}</h3>
              <p className="muted">{translateText("Switch context to inspect the enabled payment rails for a specific facility.")}</p>
            </div>
          </div>
          <label>{translateText("Hospital")}</label>
          <select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
            <option value="">{translateText("All hospitals")}</option>
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
            <h3>{translateText("Pending payment workflow")}</h3>
            <p className="muted">{translateText("Every transaction stays pinned to its workflow state until the system confirms the next move.")}</p>
          </div>
        </div>

        {hospitalInfo ? (
          <div className="premium-banner">
            {translateText("Available channels:")}{" "}
            {(hospitalInfo.patientPaymentMethods || [])
              .map((m) => m.label || m.type)
              .join(", ") || translateText("Not configured")}
          </div>
        ) : null}

        {msg ? (
          <div className="subtle-banner" style={{ marginTop: 12 }}>
            {msg}
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="table premium-table">
            <thead>
              <tr>
                <th>{translateText("Patient")}</th>
                <th>{translateText("Amount")}</th>
                <th>{translateText("Status")}</th>
                <th>{translateText("Action")}</th>
                <th>{translateText("Workflow")}</th>
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
                          {translateText("Choose Method")}
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
                      <strong>{translateText("No pending payments")}</strong>
                      <span>{translateText("The workflow queue is clear for the current scope.")}</span>
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
              <h3>{translateText("Choose payment method")}</h3>
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
              {translateText("Close")}
            </button>
          </div>

          <div className="premium-method-grid">
            {methodOptions.length === 0 ? (
              <div className="premium-empty">
                <strong>{translateText("No methods enabled")}</strong>
                <span>{translateText("This hospital has not exposed any patient payment methods yet.")}</span>
              </div>
            ) : (
              methodOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`premium-method-card${opt.recommended ? " recommended" : ""}`}
                  disabled={processing || opt.disabled}
                  onClick={() => handleRoutePayment(opt.key, activeTx)}
                >
                  <div className="premium-method-card__top">
                    <span className="premium-method-card__emoji">{opt.emoji}</span>
                    <span className="premium-method-card__label">{opt.label}</span>
                  </div>
                  <div className="premium-method-card__meta">
                    {opt.disabled ? translateText("Coming soon") : opt.recommended ? translateText("Recommended") : translateText("Available")}
                  </div>
                </button>
              ))
            )}
          </div>

          {methodMsg ? (
            <div className="subtle-banner" style={{ marginTop: 12 }}>
              {methodMsg}
            </div>
          ) : null}

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
              {translateText("Download Bank Invoice")}
            </button>
          ) : null}
        </section>
      )}
    </div>
  );
}
