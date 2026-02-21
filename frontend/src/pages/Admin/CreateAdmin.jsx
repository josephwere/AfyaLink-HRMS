import React, { useState } from "react";
import {
  registerHospitalAdmin,
  registerSystemAdmin,
  registerDeveloper,
  listHospitals,
} from "../../services/superAdminApi";
import { useAuth } from "../../utils/auth";

export default function CreateAdmin() {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "HOSPITAL_ADMIN",
    hospitalId: "",
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  // 🔒 Hard stop — UI level
  if (user?.role !== "SUPER_ADMIN") {
    return <p>🚫 Access denied</p>;
  }

  React.useEffect(() => {
    listHospitals()
      .then((data) => setHospitals(Array.isArray(data) ? data : data.hospitals || []))
      .catch(() => setHospitals([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      if (form.role === "SYSTEM_ADMIN") {
        await registerSystemAdmin({
          name: form.name,
          email: form.email,
          password: form.password,
        });
        setMsg("✅ System admin created");
      } else if (form.role === "DEVELOPER") {
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
        });
        setMsg("✅ Hospital admin created");
      }
      setForm({
        name: "",
        email: "",
        password: "",
        role: "HOSPITAL_ADMIN",
        hospitalId: "",
      });
    } catch (err) {
      setMsg(err.response?.data?.msg || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>👤 Create Admin</h2>

      <form onSubmit={submit} className="form">
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
          <option value="SYSTEM_ADMIN">System Admin</option>
          <option value="DEVELOPER">Developer</option>
        </select>

        {form.role === "HOSPITAL_ADMIN" && (
          <select
            value={form.hospitalId}
            onChange={(e) =>
              setForm({ ...form, hospitalId: e.target.value })
            }
            required
          >
            <option value="">Select hospital</option>
            {hospitals.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name}
              </option>
            ))}
          </select>
        )}

        <button disabled={loading}>
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}
