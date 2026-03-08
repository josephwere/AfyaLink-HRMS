import React, { useMemo, useState } from "react";
import {
  registerHospitalAdmin,
  registerSystemAdmin,
  registerDeveloper,
  listHospitals,
} from "../../services/superAdminApi";
import { useAuth } from "../../utils/auth";
import DismissibleCardSection from "../../components/DismissibleCardSection";
import PasswordInput from "../../components/PasswordInput";

export default function CreateAdmin() {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState([]);
  const [hospitalQuery, setHospitalQuery] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "HOSPITAL_ADMIN",
    hospitalId: "",
    branch: "",
  });

  const [loading, setLoading] = useState(false);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [msg, setMsg] = useState(null);
  const actorRole = String(user?.role || "").toUpperCase();
  const canCreateAdmins = actorRole === "SUPER_ADMIN" || actorRole === "SYSTEM_ADMIN";
  const canCreateSystemLevel = actorRole === "SUPER_ADMIN";

  if (!canCreateAdmins) {
    return <p>🚫 Access denied</p>;
  }

  const loadHospitals = React.useCallback(async (q = "") => {
    setLoadingHospitals(true);
    try {
      const data = await listHospitals({
        page: 1,
        limit: 1000,
        withoutAdmin: true,
        q: q || undefined,
      });
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.hospitals)
        ? data.hospitals
        : Array.isArray(data?.items)
        ? data.items
        : [];
      setHospitals(rows);
    } catch {
      setHospitals([]);
    } finally {
      setLoadingHospitals(false);
    }
  }, []);

  React.useEffect(() => {
    loadHospitals("");
  }, [loadHospitals]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      loadHospitals(hospitalQuery.trim());
    }, 250);
    return () => clearTimeout(t);
  }, [hospitalQuery, loadHospitals]);

  const filteredHospitals = useMemo(() => {
    const q = hospitalQuery.trim().toLowerCase();
    if (!q) return hospitals;
    return hospitals.filter((h) => {
      const name = String(h?.name || "").toLowerCase();
      const code = String(h?.code || "").toLowerCase();
      const address = String(h?.address || "").toLowerCase();
      return name.includes(q) || code.includes(q) || address.includes(q);
    });
  }, [hospitals, hospitalQuery]);

  const selectedHospital = useMemo(
    () => hospitals.find((h) => String(h._id) === String(form.hospitalId)) || null,
    [hospitals, form.hospitalId]
  );

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      if (form.role === "SYSTEM_ADMIN") {
        if (!canCreateSystemLevel) {
          setMsg("Only Super Admin can create System Admin accounts.");
          return;
        }
        await registerSystemAdmin({
          name: form.name,
          email: form.email,
          password: form.password,
        });
        setMsg("✅ System admin created");
      } else if (form.role === "DEVELOPER") {
        if (!canCreateSystemLevel) {
          setMsg("Only Super Admin can create Developer accounts.");
          return;
        }
        await registerDeveloper({
          name: form.name,
          email: form.email,
          password: form.password,
        });
        setMsg("✅ Developer created");
      } else {
        await registerHospitalAdmin({
          name: form.name,
          email: form.email,
          password: form.password,
          hospitalId: form.hospitalId,
          branch: form.branch,
        });
        setMsg("✅ Hospital admin created");
      }
      setForm({
        name: "",
        email: "",
        password: "",
        role: "HOSPITAL_ADMIN",
        hospitalId: "",
        branch: "",
      });
      setHospitalQuery("");
      loadHospitals("");
    } catch (err) {
      setMsg(err?.message || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>👤 Create Admin</h2>

      <form onSubmit={submit} className="form">
        <DismissibleCardSection title="Admin Identity">
          <input
            placeholder="Full name"
            value={form.name}
            required
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            placeholder="Email address"
            type="email"
            value={form.email}
            required
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <PasswordInput
            label=""
            value={form.password}
            required
            placeholder="Temporary password"
            autoComplete="new-password"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="HOSPITAL_ADMIN">Hospital Admin</option>
            {canCreateSystemLevel && <option value="SYSTEM_ADMIN">System Admin</option>}
            {canCreateSystemLevel && <option value="DEVELOPER">Developer</option>}
          </select>
        </DismissibleCardSection>

        {form.role === "HOSPITAL_ADMIN" && (
          <DismissibleCardSection title="Hospital Assignment (No Admin Yet)">
            <input
              placeholder="Global search: hospital name, code, address"
              value={hospitalQuery}
              onChange={(e) => setHospitalQuery(e.target.value)}
            />

            <select
              value={form.hospitalId}
              onChange={(e) => {
                const hospitalId = e.target.value;
                setForm({ ...form, hospitalId });
              }}
              required
            >
              <option value="">
                {loadingHospitals
                  ? "Loading hospitals..."
                  : filteredHospitals.length
                  ? "Select latest hospital without admin"
                  : "No hospitals without admin found"}
              </option>
              {filteredHospitals.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} {h.code ? `(${h.code})` : ""}
                </option>
              ))}
            </select>

            {selectedHospital && (
              <p className="muted" style={{ marginTop: 6 }}>
                Selected: {selectedHospital.name}
                {selectedHospital.address ? ` • ${selectedHospital.address}` : ""}
              </p>
            )}

            <input
              placeholder="Branch (optional, e.g. Kisumu Branch)"
              value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
            />
          </DismissibleCardSection>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}
