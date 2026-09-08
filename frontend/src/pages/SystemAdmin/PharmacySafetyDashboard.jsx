import { useEffect, useState } from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import pharmacyService from "../../services/pharmacy/service";

const REGULATOR_ROLES = ["GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"];

export default function PharmacySafetyDashboard() {
  const [products, setProducts] = useState([]);
  const [recalls, setRecalls] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([pharmacyService.listRegulatoryProducts(), pharmacyService.listRecalls()])
      .then(([productResult, recallResult]) => {
        if (!active) return;
        setProducts(productResult?.products || []);
        setRecalls(recallResult?.recalls || []);
      })
      .catch((error) => active && setMessage(error?.message || "Unable to load medicine safety data."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const activeProducts = products.filter((product) => product.status === "ACTIVE").length;
  const openRecalls = recalls.filter((recall) => recall.status !== "CLOSED").length;

  return (
    <div className="dashboard">
      <ModuleWorkspace
        title="National Medicine Safety"
        subtitle="Regulatory product identity, recalls, and pharmaceutical trust signals."
        panels={[
          { title: "Registered Products", body: `${activeProducts} active products` },
          { title: "Open Recalls", body: `${openRecalls} recalls requiring action` },
          { title: "Decision Boundary", body: "Regulatory and human review control release." },
        ]}
      />
      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Regulatory Product Registry</h3>
              <p className="muted">Authoritative product identity used during hospital receiving.</p>
            </div>
            <div className="action-pill">{loading ? "Loading" : `${products.length} records`}</div>
          </div>
          {message ? <div className="muted">{message}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead><tr><th>Registration</th><th>Product</th><th>Manufacturer</th><th>Status</th></tr></thead>
              <tbody>
                {products.slice(0, 20).map((product) => (
                  <tr key={product._id}>
                    <td>{product.registrationNumber}</td>
                    <td>{product.tradeName} {product.strength}</td>
                    <td>{product.manufacturer}</td>
                    <td>{product.status}</td>
                  </tr>
                ))}
                {!products.length && !loading ? <tr><td colSpan="4" className="muted">No regulatory products registered.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Recall Control</h3>
          <div className="alert-stack">
            {recalls.slice(0, 8).map((recall) => (
              <div className="alert-item" key={recall._id}>
                {recall.severity}: {recall.batchNumber || recall.registrationNumber} · {recall.status}
              </div>
            ))}
            {!recalls.length ? <div className="alert-item">No active medicine recalls.</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export { REGULATOR_ROLES };
