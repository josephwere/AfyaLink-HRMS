import React, { useEffect, useState } from "react";
import {
  createRegisteredPharmacy,
  listRegisteredPharmacies,
  updateRegisteredPharmacy,
} from "../../services/pharmacyNetworkApi";

const EMPTY_FORM = {
  name: "",
  licenseNumber: "",
  governmentRegistryId: "",
  status: "ACTIVE",
  country: "Kenya",
  region: "",
  city: "",
  address: "",
  lat: "",
  lng: "",
  phone: "",
  email: "",
};

export default function SuperAdminPharmacies() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await listRegisteredPharmacies({ q, includeInactive: true, limit: 200 });
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      setItems([]);
      setMsg(err?.message || "Failed to load pharmacies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    const payload = {
      name: form.name,
      licenseNumber: form.licenseNumber,
      governmentRegistryId: form.governmentRegistryId,
      status: form.status,
      contact: {
        phone: form.phone,
        email: form.email,
      },
      location: {
        country: form.country,
        region: form.region,
        city: form.city,
        address: form.address,
        lat: form.lat === "" ? null : Number(form.lat),
        lng: form.lng === "" ? null : Number(form.lng),
      },
    };

    try {
      if (editingId) {
        await updateRegisteredPharmacy(editingId, payload);
        setMsg("Pharmacy updated successfully.");
      } else {
        await createRegisteredPharmacy(payload);
        setMsg("Pharmacy registered successfully.");
      }
      setForm(EMPTY_FORM);
      setEditingId("");
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to save pharmacy");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    setEditingId(String(row._id));
    setForm({
      name: row?.name || "",
      licenseNumber: row?.licenseNumber || "",
      governmentRegistryId: row?.governmentRegistryId || "",
      status: row?.status || "ACTIVE",
      country: row?.location?.country || "",
      region: row?.location?.region || "",
      city: row?.location?.city || "",
      address: row?.location?.address || "",
      lat: row?.location?.lat ?? "",
      lng: row?.location?.lng ?? "",
      phone: row?.contact?.phone || "",
      email: row?.contact?.email || "",
    });
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Registered Pharmacies</h2>
          <p className="muted">System/Super Admin register government-recognized pharmacies and keep them searchable by location.</p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <form className="card premium-card" onSubmit={onSubmit}>
          <h3>{editingId ? "Update Pharmacy" : "Register Pharmacy"}</h3>
          <label>Pharmacy name</label>
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />

          <label>License number</label>
          <input value={form.licenseNumber} onChange={(e) => setForm((p) => ({ ...p, licenseNumber: e.target.value }))} required />

          <label>Government registry ID</label>
          <input value={form.governmentRegistryId} onChange={(e) => setForm((p) => ({ ...p, governmentRegistryId: e.target.value }))} />

          <label>Status</label>
          <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          <label>Country</label>
          <input value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />

          <label>Region</label>
          <input value={form.region} onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))} />

          <label>City</label>
          <input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />

          <label>Address</label>
          <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />

          <label>Latitude</label>
          <input type="number" step="any" value={form.lat} onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))} />

          <label>Longitude</label>
          <input type="number" step="any" value={form.lng} onChange={(e) => setForm((p) => ({ ...p, lng: e.target.value }))} />

          <label>Phone</label>
          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />

          <label>Email</label>
          <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />

          <div className="row-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Pharmacy" : "Register Pharmacy"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingId("");
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="section">
        <div className="card premium-card">
          <h3>Directory</h3>
          <label>Global search</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, license, region, city" />

          {loading ? (
            <p className="muted">Loading pharmacies...</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>License</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row._id}>
                      <td>{row.name}</td>
                      <td>{row.licenseNumber}</td>
                      <td>{[row?.location?.region, row?.location?.city].filter(Boolean).join(", ") || "—"}</td>
                      <td>{row.status}</td>
                      <td>
                        <button type="button" className="btn-secondary" onClick={() => startEdit(row)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">No pharmacies found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
