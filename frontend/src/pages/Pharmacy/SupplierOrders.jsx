import React, { useEffect, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import pharmacyService from "../../services/pharmacy/service";

export default function SupplierOrders() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [risks, setRisks] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      pharmacyService.listPurchaseOrders(),
      pharmacyService.listSuppliers(),
      pharmacyService.listStockRisks().catch(() => ({ risks: [] })),
      pharmacyService.listSupplierCompliance().catch(() => ({ compliance: [] })),
    ])
      .then(([orderResult, supplierResult, riskResult, complianceResult]) => {
        if (!active) return;
        setOrders(Array.isArray(orderResult?.orders) ? orderResult.orders : []);
        setSuppliers(Array.isArray(supplierResult?.suppliers) ? supplierResult.suppliers : []);
        setRisks(Array.isArray(riskResult?.risks) ? riskResult.risks : []);
        setCompliance(Array.isArray(complianceResult?.compliance) ? complianceResult.compliance : []);
      })
      .catch((err) => active && setError(err?.message || "Unable to load procurement workspace."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="dashboard">
      <ModuleWorkspace
        title="Supplier Orders"
        subtitle="Purchase order workflow, supplier lead times and delivery tracking."
        actions={[
          { label: "Create PO", variant: "primary", path: "/pharmacy/suppliers#new" },
          { label: "Refresh Risk View", path: "/pharmacy/suppliers#risks" },
        ]}
        panels={[
          { title: "Open Orders", body: `${orders.filter((order) => !["RECEIVED", "CANCELLED"].includes(order.status)).length} active purchase orders` },
          { title: "Linked Suppliers", body: `${suppliers.length} supplier relationships` },
          { title: "Stock Risk", body: `${risks.length} items need replenishment attention` },
          { title: "Supplier Trust", body: compliance.length ? `${Math.round(compliance[0].score)}/100 current score` : "No compliance score available" },
        ]}
      />

      <section className="section doctor-main-grid" id="tracking">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Purchase Orders</h3>
              <p className="muted">Hospital replenishment orders and payment state.</p>
            </div>
            <div className="action-pill">Open: {orders.filter((order) => !["RECEIVED", "CANCELLED"].includes(order.status)).length}</div>
          </div>
          {error ? <div className="muted">{error}</div> : null}
          {loading ? <div className="muted">Loading procurement...</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>{order?.supplier?.name || "Linked supplier"}</td>
                    <td>{Number(order.totalAmount || 0).toLocaleString()}</td>
                    <td>{order.status}</td>
                    <td>{order.paymentStatus}</td>
                  </tr>
                ))}
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="muted">No purchase orders yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card doctor-alerts-card" id="risks">
          <h3>AI Stock Risk Feed</h3>
          <div className="alert-stack">
            {risks.slice(0, 5).map((risk) => (
              <div className="alert-item" key={risk._id}>
                {risk.name}: {risk.estimatedDaysUntilStockout === null ? "low stock threshold reached" : `likely to run out in ${risk.estimatedDaysUntilStockout} days`}.
              </div>
            ))}
            {risks.length === 0 ? <div className="alert-item">No replenishment risks detected.</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
