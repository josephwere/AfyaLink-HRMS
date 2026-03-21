import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createGovernmentHospitalRegistryEntry,
  importGovernmentHospitalRegistry,
  listGovernmentHospitalRegistry,
} from "../../services/systemAdminApi";

export default function GovernmentHospitalRegistryPage() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const highlightedText = (searchParams.get("highlight") || searchParams.get("q") || "").toLowerCase();
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [bulk, setBulk] = useState("");
  const [form, setForm] = useState({
    officialName: "",
    registrationNumber: "",
    hospitalType: "PRIVATE",
    country: "",
    region: "",
    city: "",
    address: "",
    email: "",
    phone: "",
    validUntil: "",
  });

  const load = async () => {
    try {
      const rows = await listGovernmentHospitalRegistry({ q: q || undefined });
      setItems(rows);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    load();
  }, [q]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      await createGovernmentHospitalRegistryEntry(form);
      setMsg("Government registry entry saved.");
      setForm({
        officialName: "",
        registrationNumber: "",
        hospitalType: "PRIVATE",
        country: "",
        region: "",
        city: "",
        address: "",
        email: "",
        phone: "",
        validUntil: "",
      });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to save registry entry.");
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await importGovernmentHospitalRegistry(bulk);
      setMsg(`Imported ${res?.created?.length || 0} entries. Skipped ${res?.skipped?.length || 0}.`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to import registry entries.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Government Hospital Registry</h2>
          <p className="muted">Approved parent hospitals and branch licenses live here. AfyaLink registration only trusts this registry.</p>
        </div>
      </div>
      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <h3>Add Registry Entry</h3>
        <form className="card form" onSubmit={submit}>
          <input placeholder="Official hospital name" value={form.officialName} onChange={(e) => setForm({ ...form, officialName: e.target.value })} required />
          <input placeholder="Registration number" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value.toUpperCase() })} required />
          <select value={form.hospitalType} onChange={(e) => setForm({ ...form, hospitalType: e.target.value })}>
            <option value="PRIVATE">Private</option>
            <option value="PUBLIC">Public</option>
            <option value="NGO">NGO</option>
          </select>
          <input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required />
          <input placeholder="Region / County" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input placeholder="Contact email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Contact phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
          <button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Entry"}</button>
        </form>
      </section>

      <section className="section">
        <h3>Bulk Import</h3>
        <div className="card form">
          <textarea
            rows={8}
            placeholder={"CSV per line: officialName,registrationNumber,hospitalType,country,region,city,validUntil\nor paste a JSON array"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={runImport} disabled={loading || !bulk.trim()}>
            {loading ? "Importing..." : "Import Registry Entries"}
          </button>
        </div>
      </section>

      <section className="section">
        <h3>Current Approved Registry</h3>
        <div className="card">
          <div className="search-wrap" style={{ marginBottom: 12 }}>
            <input className="search-input" placeholder="Search approved registry" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <table className="table lite">
            <thead>
              <tr>
                <th>Name</th>
                <th>Registration</th>
                <th>Type</th>
                <th>Location</th>
                <th>Valid Until</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const matchesHighlight = highlightedText
                  && [row.officialName, row.registrationNumber, row.email, row.phone]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(highlightedText));
                return (
                <tr key={row._id} className={matchesHighlight ? "query-highlight-row" : ""}>
                  <td>{row.officialName}</td>
                  <td>{row.registrationNumber}</td>
                  <td>{row.hospitalType}</td>
                  <td>{[row?.location?.city, row?.location?.region, row?.location?.country].filter(Boolean).join(", ") || "-"}</td>
                  <td>{row.validUntil ? String(row.validUntil).slice(0, 10) : "-"}</td>
                </tr>
              )})}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>No approved registry entries found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
