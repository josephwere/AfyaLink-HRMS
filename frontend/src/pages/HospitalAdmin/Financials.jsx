import React, { useMemo, useState } from 'react';
import { useSearchParams } from "react-router-dom";
import useFinancials from '../../hooks/useFinancials';

export default function Financials(){
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const highlightedInvoiceId = searchParams.get("invoiceId") || "";
  const {
    items,
    total,
    loading,
    msg,
    form,
    page,
    setForm,
    setPage,
    createInvoice,
    payInvoice,
    claimInvoice,
    prevPage,
    nextPage,
  } = useFinancials();

  const submitCreate = async (e) => {
    e.preventDefault();
    await createInvoice();
  };

  const pay = async (id) => {
    const amount = prompt('Amount to pay', '0');
    if (!amount) return;
    await payInvoice(id, Number(amount));
  };

  const claim = async (id) => {
    const provider = prompt('Provider', 'NHIF');
    if (!provider) return;
    await claimInvoice(id, provider);
  };

  const visibleItems = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    if (!query) return items;
    return items.filter((it) =>
      [
        it.invoiceNumber,
        it.patient?.firstName,
        it.patient?.lastName,
        it.patient?.email,
        it.patient?.phone,
        it.patient,
        it.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [items, q]);

  return (
    <div className="dashboard">
      <h3>Financials</h3>
      {msg ? <div className="card" style={{ marginBottom: 12 }}>{msg}</div> : null}
      <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 12 }}>
        <div>
          <form className="card form" onSubmit={submitCreate}>
            <input
              placeholder="Patient ID"
              value={form.patient}
              onChange={e=>setForm({...form, patient:e.target.value})}
            />
            <div>
              <button className="btn-primary" type="submit" disabled={loading}>{loading ? "Saving..." : "Create Invoice"}</button>
            </div>
          </form>
        </div>
        <div className="card">
          <div className="form-row" style={{ marginBottom: 12 }}>
            <input
              placeholder="Search invoice or patient"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Patient</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map(it=> (
                  <tr key={it._id} className={String(it._id) === String(highlightedInvoiceId) ? "query-highlight-row" : ""}>
                    <td>{it.invoiceNumber}</td>
                    <td>{it.patient?.firstName || it.patient}</td>
                    <td>{it.total}</td>
                    <td>{it.status}</td>
                    <td>
                      <button type="button" className="btn-secondary" onClick={()=>pay(it._id)} disabled={loading}>Pay</button>
                      <button type="button" className="btn-secondary" onClick={()=>claim(it._id)} disabled={loading}>Claim</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="welcome-actions mt-12">
            <button type="button" className="btn-secondary" onClick={prevPage} disabled={loading || page <= 1}>Prev</button>
            <span>Page {page}</span>
            <button type="button" className="btn-secondary" onClick={nextPage} disabled={loading}>Next</button>
            <span>Total {total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
