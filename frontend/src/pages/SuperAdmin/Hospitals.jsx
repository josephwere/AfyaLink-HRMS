import React, { useEffect, useState } from "react";
import { useAuth } from "../../utils/auth";
import { createHospital } from "../../services/hospitalApi";
import {
  listHospitals,
  registerHospitalAdmin,
  registerSystemAdmin,
  registerDeveloper,
} from "../../services/superAdminApi";

export default function SuperAdminHospitals() {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const [hospitalForm, setHospitalForm] = useState({
    name: "",
    address: "",
    contact: "",
    code: "",
  });

  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    password: "",
    hospitalId: "",
  });

  const [systemAdminForm, setSystemAdminForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [developerForm, setDeveloperForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const loadHospitals = async () => {
    try {
      const data = await listHospitals();
      const items = Array.isArray(data) ? data : data.hospitals || [];
      setHospitals(items);
    } catch {
      setHospitals([]);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, []);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isSystemAdmin = user?.role === "SYSTEM_ADMIN";

  if (!isSuperAdmin && !isSystemAdmin) {
    return <p>🚫 Access denied</p>;
  }

  const submitHospital = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await createHospital(hospitalForm);
      setMsg("✅ Hospital created");
      setHospitalForm({
        name: "",
        address: "",
        contact: "",
        code: "",
      });
      await loadHospitals();
    } catch (err) {
      setMsg(err.response?.data?.msg || "Failed to create hospital");
    } finally {
      setLoading(false);
    }
  };

  const submitHospitalAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await registerHospitalAdmin(adminForm);
      setMsg("✅ Hospital admin created");
      setAdminForm({
        name: "",
        email: "",
        password: "",
        hospitalId: "",
      });
      await loadHospitals();
    } catch (err) {
      setMsg(err.response?.data?.msg || "Failed to create hospital admin");
    } finally {
      setLoading(false);
    }
  };

  const submitSystemAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await registerSystemAdmin(systemAdminForm);
      setMsg("✅ System admin created");
      setSystemAdminForm({
        name: "",
        email: "",
        password: "",
      });
    } catch (err) {
      setMsg(err.response?.data?.msg || "Failed to create system admin");
    } finally {
      setLoading(false);
    }
  };

  const submitDeveloper = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await registerDeveloper(developerForm);
      setMsg("✅ Developer created");
      setDeveloperForm({
        name: "",
        email: "",
        password: "",
      });
    } catch (err) {
      setMsg(err.response?.data?.msg || "Failed to create developer");
    } finally {
      setLoading(false);
    }
  };

  const filtered = hospitals.filter((h) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      h.name?.toLowerCase().includes(q) ||
      h.code?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospitals & Admins</h2>
          <p className="muted">
            Create hospitals, assign hospital admins, and delegate system
            admins to scale onboarding.
          </p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Create Hospital</h3>
        <form className="card form" onSubmit={submitHospital}>
          <input
            placeholder="Hospital name"
            value={hospitalForm.name}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, name: e.target.value })
            }
            required
          />
          <input
            placeholder="Address"
            value={hospitalForm.address}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, address: e.target.value })
            }
          />
          <input
            placeholder="Contact"
            value={hospitalForm.contact}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, contact: e.target.value })
            }
          />
          <input
            placeholder="Optional code"
            value={hospitalForm.code}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, code: e.target.value })
            }
          />
          <button disabled={loading}>
            {loading ? "Creating..." : "Create Hospital"}
          </button>
        </form>
      </section>

      <section className="section">
        <h3>Register Hospital Admin</h3>
        <form className="card form" onSubmit={submitHospitalAdmin}>
          <input
            placeholder="Full name"
            value={adminForm.name}
            onChange={(e) =>
              setAdminForm({ ...adminForm, name: e.target.value })
            }
            required
          />
          <input
            placeholder="Email address"
            type="email"
            value={adminForm.email}
            onChange={(e) =>
              setAdminForm({ ...adminForm, email: e.target.value })
            }
            required
          />
          <input
            placeholder="Temporary password"
            type="password"
            value={adminForm.password}
            onChange={(e) =>
              setAdminForm({ ...adminForm, password: e.target.value })
            }
            required
          />
          <select
            value={adminForm.hospitalId}
            onChange={(e) =>
              setAdminForm({ ...adminForm, hospitalId: e.target.value })
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
          <button disabled={loading}>
            {loading ? "Creating..." : "Create Hospital Admin"}
          </button>
        </form>
      </section>

      {isSuperAdmin && (
        <section className="section">
          <h3>Register System Admin</h3>
          <form className="card form" onSubmit={submitSystemAdmin}>
            <input
              placeholder="Full name"
              value={systemAdminForm.name}
              onChange={(e) =>
                setSystemAdminForm({
                  ...systemAdminForm,
                  name: e.target.value,
                })
              }
              required
            />
            <input
              placeholder="Email address"
              type="email"
              value={systemAdminForm.email}
              onChange={(e) =>
                setSystemAdminForm({
                  ...systemAdminForm,
                  email: e.target.value,
                })
              }
              required
            />
            <input
              placeholder="Temporary password"
              type="password"
              value={systemAdminForm.password}
              onChange={(e) =>
                setSystemAdminForm({
                  ...systemAdminForm,
                  password: e.target.value,
                })
              }
              required
            />
            <button disabled={loading}>
              {loading ? "Creating..." : "Create System Admin"}
            </button>
          </form>
        </section>
      )}

      {isSuperAdmin && (
        <section className="section">
          <h3>Register Developer</h3>
          <form className="card form" onSubmit={submitDeveloper}>
            <input
              placeholder="Full name"
              value={developerForm.name}
              onChange={(e) =>
                setDeveloperForm({
                  ...developerForm,
                  name: e.target.value,
                })
              }
              required
            />
            <input
              placeholder="Email address"
              type="email"
              value={developerForm.email}
              onChange={(e) =>
                setDeveloperForm({
                  ...developerForm,
                  email: e.target.value,
                })
              }
              required
            />
            <input
              placeholder="Temporary password"
              type="password"
              value={developerForm.password}
              onChange={(e) =>
                setDeveloperForm({
                  ...developerForm,
                  password: e.target.value,
                })
              }
              required
            />
            <button disabled={loading}>
              {loading ? "Creating..." : "Create Developer"}
            </button>
          </form>
        </section>
      )}

      <section className="section">
        <h3>Hospitals</h3>
        <div className="card">
          <div className="search-wrap" style={{ marginBottom: 12 }}>
            <input
              className="search-input"
              placeholder="Search hospitals"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <table className="table lite">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Admins</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((h) => (
                <tr key={h._id}>
                  <td>{h.name}</td>
                  <td>{h.code || "-"}</td>
                  <td>
                    {(h.admins || [])
                      .map((a) => `${a.name} (${a.email})`)
                      .join(", ") || "None"}
                  </td>
                  <td>{h.active === false ? "Inactive" : "Active"}</td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan="4">No hospitals yet</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="action-list" style={{ marginTop: 12 }}>
            <button
              className="btn-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className="muted">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn-secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
