import React, { useMemo, useState } from "react";
import {
  registerHospitalAdmin,
  registerSystemAdmin,
  registerDeveloper,
  listHospitals,
} from "../../services/superAdminApi";
import { useAuth } from "../../utils/auth";
import DismissibleCardSection from "../../components/DismissibleCardSection";

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
  const [msg, setMsg] = useState(null);
  const actorRole = String(user?.role || "").toUpperCase();
  const canCreateAdmins = actorRole === "SUPER_ADMIN" || actorRole === "SYSTEM_ADMIN";
  const canCreateSystemLevel = actorRole === "SUPER_ADMIN";

  // 🔒 Hard stop — UI level
  if (!canCreateAdmins) {
    return <p>🚫 Access denied</p>;
  }

  React.useEffect(() => {
    listHospitals({ page: 1, limit: 1000 })
      .then((data) => {
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.hospitals)
          ? data.hospitals
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setHospitals(rows);
      })
      .catch(() => setHospitals([]));
  }, []);

  const filteredHospitals = useMemo(() => {
    const q = hospitalQuery.trim().toLowerCase();
    if (!q) return hospitals;
    return hospitals.filter((h) => String(h?.name || "").toLowerCase().includes(q));
  }, [hospitals, hospitalQuery]);

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
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
          />

          <input
            placeholder="Email address"
            type="email"
            value={form.email}
            required
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />

          <input
            placeholder="Temporary password"
            type="password"
            value={form.password}
            required
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
          />

          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value })
            }
          >
            <option value="HOSPITAL_ADMIN">Hospital Admin</option>
            {canCreateSystemLevel && <option value="SYSTEM_ADMIN">System Admin</option>}
            {canCreateSystemLevel && <option value="DEVELOPER">Developer</option>}
          </select>
        </DismissibleCardSection>

        {form.role === "HOSPITAL_ADMIN" && (
          <DismissibleCardSection title="Hospital Assignment">
            <input
              list="hospital-options"
              placeholder="Type hospital name"
              value={hospitalQuery}
              onChange={(e) => {
                const value = e.target.value;
                setHospitalQuery(value);
                const match = hospitals.find(
                  (h) => String(h?.name || "").toLowerCase() === value.trim().toLowerCase()
                );
                setForm({ ...form, hospitalId: match?._id || "" });
              }}
              required
            />
            <datalist id="hospital-options">
              {hospitals.map((h) => (
                <option key={h._id} value={h.name} />
              ))}
            </datalist>

            <select
              value={form.hospitalId}
              onChange={(e) => {
                const hospitalId = e.target.value;
                const selected = hospitals.find((h) => String(h._id) === String(hospitalId));
                setForm({
                  ...form,
                  hospitalId,
                });
                if (selected?.name) setHospitalQuery(selected.name);
              }}
              required
            >
              <option value="">
                {hospitals.length ? "Select hospital" : "No hospitals available"}
              </option>
              {filteredHospitals.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}
                </option>
              ))}
            </select>
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
