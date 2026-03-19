import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createPatientIdentityRegistryEntry,
  importPatientIdentityRegistry,
  listPatientIdentityRegistry,
} from "../../services/systemAdminApi";

export default function PatientIdentityRegistryPage() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [bulk, setBulk] = useState("");
  const highlightedText = (searchParams.get("highlight") || searchParams.get("q") || "").toLowerCase();
  const [form, setForm] = useState({
    country: "",
    idType: "NATIONAL_ID",
    idNumber: "",
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    status: "ACTIVE",
  });

  const load = async () => {
    try {
      const rows = await listPatientIdentityRegistry({
        q: q || undefined,
        country: country || undefined,
        status: status || undefined,
      });
      setItems(rows);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    load();
  }, [q, country, status]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      await createPatientIdentityRegistryEntry(form);
      setMsg("Patient identity entry saved.");
      setForm({
        country: "",
        idType: "NATIONAL_ID",
        idNumber: "",
        firstName: "",
        lastName: "",
        dob: "",
        gender: "",
        status: "ACTIVE",
      });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to save identity entry.");
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await importPatientIdentityRegistry(bulk);
      setMsg(`Imported ${res?.created?.length || 0} entries. Skipped ${res?.skipped?.length || 0}.`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to import identity entries.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Patient Identity Registry</h2>
          <p className="muted">National ID + health ID registry used to verify claims and stop ghost patients.</p>
        </div>
      </div>
      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <h3>Add Identity Entry</h3>
        <form className="card form" onSubmit={submit}>
          <input placeholder="Country (e.g., KE)" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} required />
          <select value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>
            <option value="NATIONAL_ID">National ID</option>
            <option value="HEALTH_ID">Health ID</option>
            <option value="BIOMETRIC">Biometric</option>
          </select>
          <input placeholder="ID number" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} required />
          <input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          <input placeholder="Gender (FEMALE/MALE)" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DECEASED">Deceased</option>
          </select>
          <button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Entry"}</button>
        </form>
      </section>

      <section className="section">
        <h3>Bulk Import</h3>
        <div className="card form">
          <textarea
            rows={8}
            placeholder={"CSV per line: country,idType,idNumber,firstName,lastName,dob,gender,status\nor paste a JSON array"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={runImport} disabled={loading || !bulk.trim()}>
            {loading ? "Importing..." : "Import Identity Entries"}
          </button>
        </div>
      </section>

      <section className="section">
        <h3>Current Registry</h3>
        <div className="card">
          <div className="search-wrap" style={{ marginBottom: 12, display: "grid", gap: 8, gridTemplateColumns: "2fr 1fr 1fr" }}>
            <input className="search-input" placeholder="Search ID or name" value={q} onChange={(e) => setQ(e.target.value)} />
            <input className="search-input" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DECEASED">Deceased</option>
            </select>
          </div>
          <table className="table lite">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Country</th>
                <th>Status</th>
                <th>DOB</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const matchesHighlight = highlightedText
                  && [row.idNumber, row.firstName, row.lastName, row.country]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(highlightedText));
                return (
                <tr key={row._id} className={matchesHighlight ? "query-highlight-row" : ""}>
                  <td>{row.idNumber}</td>
                  <td>{[row.firstName, row.lastName].filter(Boolean).join(" ") || "-"}</td>
                  <td>{row.country}</td>
                  <td>{row.status}</td>
                  <td>{row.dob ? String(row.dob).slice(0, 10) : "-"}</td>
                </tr>
              )})}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>No identity registry entries found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
