import { useState } from "react";
import { createAdmin } from "../../services/adminApi";
import { useAuth } from "../../utils/auth";

export default function CreateAdmin() {
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "HOSPITAL_ADMIN",
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  // 🔒 Hard stop — UI level
  if (user?.role !== "SUPER_ADMIN") {
    return <p>🚫 Access denied</p>;
  }

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      await createAdmin(form);
      setMsg("✅ Admin created successfully");
      setForm({ name: "", email: "", role: "HOSPITAL_ADMIN" });
    } catch (err) {
      setMsg(err.response?.data?.msg || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>👤 Create Hospital Admin</h2>

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

        {/* 🔒 Role locked */}
        <select disabled value="HOSPITAL_ADMIN">
          <option value="HOSPITAL_ADMIN">Hospital Admin</option>
        </select>

        <button disabled={loading}>
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}
