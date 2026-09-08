import React, { useEffect, useState } from "react";
import useFinanceBilling from "../../hooks/finance/useFinanceBilling";
import useFinancePayments from "../../hooks/finance/useFinancePayments";
import useFinanceReceipts from "../../hooks/finance/useFinanceReceipts";
import useCashierShift from "../../hooks/finance/useCashierShift";
import ShiftStatusCard from "./Cashier/ShiftStatusCard";
import CloseShiftDialog from "./Cashier/CloseShiftDialog";

export default function FinanceCashier() {
  const {
    invoices,
    loading,
    error,
    filters,
    setFilters,
    loadInvoices,
    search,
    refreshInvoice,
    updateInvoiceLocally,
  } = useFinanceBilling({ status: "UNPAID", limit: 200 });

  const { receipts, loadReceipts, fetchReceipt } = useFinanceReceipts();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [receiptModal, setReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [dialogShift, setDialogShift] = useState(null);

  const payments = useFinancePayments({
    onSuccess: async (res) => {
      setPaymentResult(res);
      // Try to locate a receipt id in the response
      const receiptId = res?.receiptId || res?.receipt?._id || res?._id || res?.payment?._id;
      if (receiptId) {
        try {
          const r = await fetchReceipt(receiptId);
          setReceiptData(r);
          setReceiptModal(true);
        } catch (e) {
          // If fetching receipt fails, still show raw response
          setReceiptData(res);
          setReceiptModal(true);
        }
      } else {
        setReceiptData(res);
        setReceiptModal(true);
      }
      // Refresh the specific invoice if possible
      try {
        if (res?.invoiceId) await refreshInvoice(res.invoiceId);
        else if (selected?._id) await refreshInvoice(selected._id);
        // refresh shift totals
        try { await shift.refresh(); } catch(e) {}
      } catch (e) {
        // ignore refresh errors
      }
    },
  });

  const shift = useCashierShift();


  const filtered = invoices.filter((inv) => {
    if (!query) return true;
    const q = String(query).toLowerCase();
    return (
      String(inv.billing?.invoiceNumber || "").toLowerCase().includes(q) ||
      String(inv.patient?.firstName || "").toLowerCase().includes(q) ||
      String(inv.patient?.lastName || "").toLowerCase().includes(q) ||
      String(inv.patient?.hospitalNumber || "").toLowerCase().includes(q)
    );
  });

  function handleCollect(invoice) {
    setSelected(invoice);
    setReceiptData(null);
  }

  async function submitPayment(ev) {
    ev.preventDefault();
    if (!selected) return;
    const form = new FormData(ev.target);
    const amount = Number(form.get("amount") || 0);
    const method = String(form.get("method") || "CASH");
    const transactionRef = String(form.get("transactionRef") || "");

    // Re-fetch invoice to validate current state
    let freshInvoice = selected;
    try {
      freshInvoice = await refreshInvoice(selected._id);
    } catch (e) {
      // if refresh fails, continue with local copy but warn
      console.warn("Could not refresh invoice before payment", e);
    }

    // Validation against fresh invoice
    const balance = Number(freshInvoice.billing?.balance ?? freshInvoice.billing?.total ?? 0);
    if (!amount || amount <= 0) return alert("Enter a valid amount");
    if (amount > balance) {
      return alert("Amount exceeds outstanding balance");
    }
    if (["MPESA", "CARD", "BANK"].includes(method) && !transactionRef) {
      return alert("Transaction reference is required for the selected payment method");
    }

    // Prepare payload with an idempotency key to protect against duplicate clicks
    const idempotencyKey = `pay_${selected._id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      invoiceId: selected._id,
      amount,
      method,
      transactionRef: transactionRef || undefined,
      metadata: { cashier: window?.USER?.id || "unknown", idempotencyKey },
    };

    // Save previous invoice state for rollback
    const prevInvoice = { ...freshInvoice };

    // Optimistic update function
    const optimisticUpdate = (p) => {
      const newBalance = Math.max(0, balance - p.amount);
      const updated = {
        ...freshInvoice,
        billing: {
          ...freshInvoice.billing,
          balance: newBalance,
          status: newBalance === 0 ? "PAID" : freshInvoice.billing?.status,
        },
      };
      updateInvoiceLocally(updated);
    };

    try {
      // include shift id in metadata if present
      if (shift.currentShift?.id || shift.currentShift?._id) {
        payload.metadata = { ...(payload.metadata || {}), shiftId: shift.currentShift._id || shift.currentShift.id };
      }
      await payments.createPayment(payload, { optimisticUpdate });
      // success handling is done in onSuccess
      setSelected(null);
    } catch (err) {
      // rollback optimistic update
      try {
        updateInvoiceLocally(prevInvoice);
      } catch (e) {
        console.warn("rollback failed", e);
      }

      // handle idempotent/dedup cases if backend provides existing receipt info
      const msg = err?.message || String(err);
      if (err?.existingReceiptId) {
        try {
          const r = await fetchReceipt(err.existingReceiptId);
          setReceiptData(r);
          setReceiptModal(true);
          return;
        } catch (e) {}
      }
      alert(msg);
    }
  }

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Cashier dashboard</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Cashier</h1>
            <p className="premium-shell-subtitle">Collect payments, manage shifts, print receipts, and handle cashier operations.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <ShiftStatusCard shift={shift.currentShift} />
            </div>
            <div>
              {!shift.currentShift ? (
                <button className="btn-primary" onClick={async () => {
                  const openingFloat = Number(prompt('Opening float amount', '0') || 0);
                  try {
                    await shift.startShift({ openingFloat, cashier: window?.USER?.id || 'unknown' });
                    alert('Shift opened');
                    await shift.refresh();
                  } catch (e) { alert(e?.message || String(e)); }
                }}>Open Shift</button>
              ) : (
                <button className="btn-secondary" onClick={() => {
                  setDialogShift(shift.currentShift ? { ...shift.currentShift } : null);
                  setShowCloseDialog(true);
                }}>Close Shift</button>
              )}
            </div>
          </div>
        </div>
      </section>

      {showCloseDialog && dialogShift ? (
        <CloseShiftDialog
          shift={dialogShift}
          endShift={shift.endShift}
          onCancel={() => setShowCloseDialog(false)}
          onClosed={async () => {
            setShowCloseDialog(false);
            setDialogShift(null);
            try {
              await shift.refresh();
            } catch (e) {
              console.warn("Failed to refresh shift after close", e);
            }
            alert('Shift closed');
          }}
        />
      ) : null}

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Outstanding Invoices</h3>
              <p className="muted">Search and collect payments from the cashier desk.</p>
            </div>
            <div>
              <input
                placeholder="Search by invoice, patient name or hospital number"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ minWidth: 320 }}
              />
            </div>
          </div>

          {loading ? (
            <div className="muted">Loading invoices…</div>
          ) : error ? (
            <div className="card">{error}</div>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Patient</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length ? (
                    filtered.map((inv) => (
                      <tr key={inv._id}>
                        <td>{inv.billing?.invoiceNumber || inv._id}</td>
                        <td>
                          {inv.patient?.firstName
                            ? `${inv.patient.firstName} ${inv.patient.lastName || ""}`.trim()
                            : inv.patient?.name || "Patient"}
                        </td>
                        <td>{inv.billing?.total ?? "—"}</td>
                        <td>{inv.billing?.balance ?? inv.billing?.total ?? "—"}</td>
                        <td>{inv.billing?.status || "—"}</td>
                        <td>
                          <button className="btn-primary" onClick={() => handleCollect(inv)}>Collect</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="muted">No outstanding invoices</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {selected ? (
        <section className="section">
          <div className="card">
            <h3>Collect Payment for {selected.billing?.invoiceNumber || selected._id}</h3>
            <form onSubmit={submitPayment}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                <label style={{ flex: 1 }}>
                  Amount
                  <input name="amount" defaultValue={selected.billing?.balance ?? selected.billing?.total ?? 0} type="number" step="0.01" />
                </label>
                <label>
                  Method
                  <select name="method" defaultValue="CASH" id="payment-method-select">
                    <option value="CASH">Cash</option>
                    <option value="MPESA">M-Pesa</option>
                    <option value="CARD">Card</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="INSURANCE">Insurance</option>
                    <option value="CREDIT">Credit Account</option>
                  </select>
                </label>
                <label>
                  Ref
                  <input name="transactionRef" placeholder="Transaction reference (if required)" />
                </label>
                <div>
                  <button type="submit" className="btn-primary" disabled={payments.isSubmitting}>{payments.isSubmitting ? "Processing…" : "Record Payment"}</button>
                  <button type="button" className="btn-secondary" onClick={() => setSelected(null)} style={{ marginLeft: 8 }}>Cancel</button>
                </div>
              </div>
            </form>

            {paymentResult ? (
              <div style={{ marginTop: 12 }} className="card">
                <strong>Payment recorded</strong>
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{JSON.stringify(paymentResult, null, 2)}</pre>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {receiptModal ? (
        <div className="modal" style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
          <div style={{ background: "#fff", padding: 20, width: 720, maxHeight: "80vh", overflow: "auto" }}>
            <h3>Receipt</h3>
            <div style={{ marginTop: 8 }}>
              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(receiptData || {}, null, 2)}</pre>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn-primary" onClick={() => window.print()}>Print</button>
              <button className="btn-secondary" onClick={() => {
                // simple download as JSON fallback
                const blob = new Blob([JSON.stringify(receiptData || {}, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `receipt-${(receiptData && (receiptData._id || receiptData.id)) || 'receipt'}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ marginLeft: 8 }}>Download</button>
              <button className="btn-secondary" onClick={() => alert('Emailing receipt (stub)')} style={{ marginLeft: 8 }}>Email</button>
              <button className="btn-secondary" onClick={() => { setReceiptModal(false); setReceiptData(null); }} style={{ marginLeft: 8 }}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
