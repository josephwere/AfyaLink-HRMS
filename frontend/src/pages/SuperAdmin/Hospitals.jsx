import React, { useEffect, useState } from "react";
import { useAuth } from "../../utils/auth";
import { useLocation } from "react-router-dom";
import { createHospital, updateHospital } from "../../services/hospitalApi";
import {
  createBranch,
  listBranches,
  removeBranch,
  updateBranch,
} from "../../services/branchesApi";
import {
  listHospitals,
  listHospitalAdmins,
  registerHospitalAdmin,
  registerSystemAdmin,
  registerDeveloper,
  updateHospitalAdmin as updateHospitalAdminApi,
} from "../../services/superAdminApi";

export default function SuperAdminHospitals() {
  const { user } = useAuth();
  const location = useLocation();
  const [hospitals, setHospitals] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(false);
  const [savingHospitalId, setSavingHospitalId] = useState("");
  const [branchBusy, setBranchBusy] = useState(false);
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
    branch: "",
  });
  const [adminBranches, setAdminBranches] = useState([]);
  const [editHospitalId, setEditHospitalId] = useState("");
  const [editHospitalForm, setEditHospitalForm] = useState({
    name: "",
    code: "",
    address: "",
    contact: "",
    active: true,
  });
  const [branchHospitalId, setBranchHospitalId] = useState("");
  const [branches, setBranches] = useState([]);
  const [branchForm, setBranchForm] = useState({ name: "", location: "" });
  const [editBranchId, setEditBranchId] = useState("");
  const [editBranchForm, setEditBranchForm] = useState({ name: "", location: "", active: true });

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
  const [adminList, setAdminList] = useState([]);
  const [adminListTotal, setAdminListTotal] = useState(0);
  const [adminListPage, setAdminListPage] = useState(1);
  const [adminListLimit] = useState(10);
  const [adminListQuery, setAdminListQuery] = useState("");
  const [adminListHospitalId, setAdminListHospitalId] = useState("");
  const [adminListBranch, setAdminListBranch] = useState("");
  const [adminFilterBranches, setAdminFilterBranches] = useState([]);
  const [editAdminId, setEditAdminId] = useState("");
  const [editAdminForm, setEditAdminForm] = useState({
    name: "",
    email: "",
    branch: "",
    active: true,
  });

  const loadHospitals = async () => {
    try {
      const data = await listHospitals({
        q: query || undefined,
        page: 1,
        limit: 1000,
      });
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.hospitals)
        ? data.hospitals
        : Array.isArray(data?.items)
        ? data.items
        : [];
      setHospitals(items);
    } catch {
      setHospitals([]);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, [query]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const initialQ = qs.get("q") || "";
    if (initialQ) setQuery(initialQ);
  }, [location.search]);

  useEffect(() => {
    if (!branchHospitalId && hospitals.length) {
      setBranchHospitalId(hospitals[0]._id);
    }
  }, [branchHospitalId, hospitals]);

  const loadBranchesForHospital = async (hospitalId) => {
    if (!hospitalId) {
      setBranches([]);
      return;
    }
    try {
      const data = await listBranches(hospitalId);
      setBranches(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setBranches([]);
    }
  };

  useEffect(() => {
    loadBranchesForHospital(branchHospitalId);
  }, [branchHospitalId]);

  useEffect(() => {
    const hospitalId = adminForm.hospitalId;
    if (!hospitalId) {
      setAdminBranches([]);
      return;
    }
    listBranches(hospitalId)
      .then((data) => {
        setAdminBranches(Array.isArray(data?.data) ? data.data : []);
      })
      .catch(() => setAdminBranches([]));
  }, [adminForm.hospitalId]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listHospitalAdmins({
          hospitalId: adminListHospitalId || undefined,
          branch: adminListBranch || undefined,
          q: adminListQuery || undefined,
          page: adminListPage,
          limit: adminListLimit,
        });
        setAdminList(Array.isArray(data?.items) ? data.items : []);
        setAdminListTotal(Number(data?.total || 0));
      } catch {
        setAdminList([]);
        setAdminListTotal(0);
      }
    };
    load();
  }, [
    adminListHospitalId,
    adminListBranch,
    adminListQuery,
    adminListPage,
    adminListLimit,
  ]);

  useEffect(() => {
    if (!adminListHospitalId) {
      setAdminFilterBranches([]);
      return;
    }
    listBranches(adminListHospitalId)
      .then((data) => {
        const rows = Array.isArray(data?.data) ? data.data : [];
        setAdminFilterBranches(rows.filter((b) => b?.active !== false));
      })
      .catch(() => setAdminFilterBranches([]));
  }, [adminListHospitalId]);

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
      setMsg(err?.data?.msg || err?.message || "Failed to create hospital");
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
        branch: "",
      });
      await loadHospitals();
    } catch (err) {
      setMsg(err?.data?.msg || err?.message || "Failed to create hospital admin");
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
      setMsg(err?.data?.msg || err?.message || "Failed to create system admin");
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
      setMsg(err?.data?.msg || err?.message || "Failed to create developer");
    } finally {
      setLoading(false);
    }
  };

  const startEditHospital = (hospital) => {
    setEditHospitalId(hospital._id);
    setEditHospitalForm({
      name: hospital.name || "",
      code: hospital.code || "",
      address: hospital.address || "",
      contact: hospital.contact || "",
      active: hospital.active !== false,
    });
  };

  const cancelEditHospital = () => {
    setEditHospitalId("");
    setEditHospitalForm({
      name: "",
      code: "",
      address: "",
      contact: "",
      active: true,
    });
  };

  const saveHospitalEdit = async (hospitalId) => {
    setSavingHospitalId(hospitalId);
    setMsg(null);
    try {
      await updateHospital(hospitalId, editHospitalForm);
      setMsg("✅ Hospital updated");
      cancelEditHospital();
      await loadHospitals();
    } catch (err) {
      setMsg(err?.data?.msg || err?.message || "Failed to update hospital");
    } finally {
      setSavingHospitalId("");
    }
  };

  const submitBranch = async (e) => {
    e.preventDefault();
    if (!branchHospitalId) {
      setMsg("Select a hospital first");
      return;
    }
    setBranchBusy(true);
    setMsg(null);
    try {
      await createBranch({
        hospitalId: branchHospitalId,
        name: branchForm.name,
        location: branchForm.location,
      });
      setMsg("✅ Branch created");
      setBranchForm({ name: "", location: "" });
      await loadBranchesForHospital(branchHospitalId);
    } catch (err) {
      setMsg(err?.data?.error || err?.message || "Failed to create branch");
    } finally {
      setBranchBusy(false);
    }
  };

  const startEditBranch = (branch) => {
    setEditBranchId(branch._id);
    setEditBranchForm({
      name: branch.name || "",
      location: branch.location || "",
      active: branch.active !== false,
    });
  };

  const cancelEditBranch = () => {
    setEditBranchId("");
    setEditBranchForm({ name: "", location: "", active: true });
  };

  const saveEditBranch = async (id) => {
    setBranchBusy(true);
    setMsg(null);
    try {
      await updateBranch(id, editBranchForm);
      setMsg("✅ Branch updated");
      cancelEditBranch();
      await loadBranchesForHospital(branchHospitalId);
    } catch (err) {
      setMsg(err?.data?.error || err?.message || "Failed to update branch");
    } finally {
      setBranchBusy(false);
    }
  };

  const deactivateBranch = async (id) => {
    setBranchBusy(true);
    setMsg(null);
    try {
      await removeBranch(id);
      setMsg("✅ Branch deactivated");
      await loadBranchesForHospital(branchHospitalId);
    } catch (err) {
      setMsg(err?.data?.error || err?.message || "Failed to deactivate branch");
    } finally {
      setBranchBusy(false);
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
  const adminListTotalPages = Math.max(1, Math.ceil(adminListTotal / adminListLimit));
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const groupedAdminBranches = (admins = []) => {
    const grouped = admins.reduce((acc, a) => {
      const branch = a?.employment?.branch || "Unassigned";
      acc[branch] = (acc[branch] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([branch, count]) => `${branch}: ${count}`)
      .join(" • ");
  };

  const adminBranchOptions = Array.from(
    new Set(
      adminFilterBranches
        .filter((b) => b?.active !== false)
        .map((b) => b.name)
        .filter(Boolean)
    )
  );

  const startEditAdmin = (row) => {
    setEditAdminId(row._id);
    setEditAdminForm({
      name: row.name || "",
      email: row.email || "",
      branch: row?.employment?.branch || "",
      active: row.active !== false,
    });
  };

  const cancelEditAdmin = () => {
    setEditAdminId("");
    setEditAdminForm({
      name: "",
      email: "",
      branch: "",
      active: true,
    });
  };

  const saveEditAdmin = async (id) => {
    setLoading(true);
    setMsg(null);
    try {
      await updateHospitalAdminApi(id, editAdminForm);
      setMsg("✅ Hospital admin updated");
      cancelEditAdmin();
      const data = await listHospitalAdmins({
        hospitalId: adminListHospitalId || undefined,
        branch: adminListBranch || undefined,
        q: adminListQuery || undefined,
        page: adminListPage,
        limit: adminListLimit,
      });
      setAdminList(Array.isArray(data?.items) ? data.items : []);
      setAdminListTotal(Number(data?.total || 0));
    } catch (err) {
      setMsg(err?.data?.msg || err?.message || "Failed to update hospital admin");
    } finally {
      setLoading(false);
    }
  };

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
              setAdminForm({ ...adminForm, hospitalId: e.target.value, branch: "" })
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
          <select
            value={adminForm.branch}
            onChange={(e) =>
              setAdminForm({ ...adminForm, branch: e.target.value })
            }
          >
            <option value="">Select branch (optional)</option>
            {adminBranches.map((b) => (
              <option key={b._id} value={b.name}>
                {b.name} - {b.location}
              </option>
            ))}
          </select>
          <button disabled={loading}>
            {loading ? "Creating..." : "Create Hospital Admin"}
          </button>
        </form>
      </section>

      <section className="section">
        <h3>Manage Branches</h3>
        <div className="card form">
          <label>Hospital</label>
          <select
            value={branchHospitalId}
            onChange={(e) => setBranchHospitalId(e.target.value)}
          >
            <option value="">Select hospital</option>
            {hospitals.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name}
              </option>
            ))}
          </select>

          <form onSubmit={submitBranch} className="form">
            <input
              placeholder="Branch name"
              value={branchForm.name}
              onChange={(e) =>
                setBranchForm({ ...branchForm, name: e.target.value })
              }
              required
            />
            <input
              placeholder="Location"
              value={branchForm.location}
              onChange={(e) =>
                setBranchForm({ ...branchForm, location: e.target.value })
              }
              required
            />
            <button disabled={branchBusy || !branchHospitalId}>
              {branchBusy ? "Saving..." : "Add Branch"}
            </button>
          </form>

          <table className="table lite">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => {
                const isEditing = editBranchId === b._id;
                return (
                  <tr key={b._id}>
                    <td>
                      {isEditing ? (
                        <input
                          value={editBranchForm.name}
                          onChange={(e) =>
                            setEditBranchForm({ ...editBranchForm, name: e.target.value })
                          }
                        />
                      ) : (
                        b.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={editBranchForm.location}
                          onChange={(e) =>
                            setEditBranchForm({
                              ...editBranchForm,
                              location: e.target.value,
                            })
                          }
                        />
                      ) : (
                        b.location
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editBranchForm.active ? "true" : "false"}
                          onChange={(e) =>
                            setEditBranchForm({
                              ...editBranchForm,
                              active: e.target.value === "true",
                            })
                          }
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      ) : b.active === false ? (
                        "Inactive"
                      ) : (
                        "Active"
                      )}
                    </td>
                    <td>
                      {!isEditing ? (
                        <div className="action-list">
                          <button
                            className="btn-secondary"
                            onClick={() => startEditBranch(b)}
                            disabled={branchBusy}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => deactivateBranch(b._id)}
                            disabled={branchBusy}
                          >
                            Deactivate
                          </button>
                        </div>
                      ) : (
                        <div className="action-list">
                          <button
                            className="btn-secondary"
                            onClick={() => saveEditBranch(b._id)}
                            disabled={branchBusy}
                          >
                            Save
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={cancelEditBranch}
                            disabled={branchBusy}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!branches.length && (
                <tr>
                  <td colSpan="4">No branches for selected hospital</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                <th>Address</th>
                <th>Admins</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((h) => {
                const isEditing = editHospitalId === h._id;
                return (
                  <tr key={h._id}>
                    <td>
                      {isEditing ? (
                        <input
                          value={editHospitalForm.name}
                          onChange={(e) =>
                            setEditHospitalForm({
                              ...editHospitalForm,
                              name: e.target.value,
                            })
                          }
                        />
                      ) : (
                        h.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={editHospitalForm.code}
                          onChange={(e) =>
                            setEditHospitalForm({
                              ...editHospitalForm,
                              code: e.target.value,
                            })
                          }
                        />
                      ) : (
                        h.code || "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={editHospitalForm.address}
                          onChange={(e) =>
                            setEditHospitalForm({
                              ...editHospitalForm,
                              address: e.target.value,
                            })
                          }
                        />
                      ) : (
                        h.address || "-"
                      )}
                    </td>
                  <td>
                    {(h.admins || [])
                      .map((a) => `${a.name} (${a.email})`)
                      .join(", ") || "None"}
                    {h.admins?.length > 0 && (
                      <div className="muted" style={{ marginTop: 6 }}>
                        {groupedAdminBranches(h.admins)}
                      </div>
                    )}
                  </td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editHospitalForm.active ? "true" : "false"}
                          onChange={(e) =>
                            setEditHospitalForm({
                              ...editHospitalForm,
                              active: e.target.value === "true",
                            })
                          }
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      ) : h.active === false ? (
                        "Inactive"
                      ) : (
                        "Active"
                      )}
                    </td>
                    <td>
                      {!isEditing ? (
                        <button
                          className="btn-secondary"
                          onClick={() => startEditHospital(h)}
                        >
                          Edit
                        </button>
                      ) : (
                        <div className="action-list">
                          <button
                            className="btn-secondary"
                            onClick={() => saveHospitalEdit(h._id)}
                            disabled={savingHospitalId === h._id}
                          >
                            {savingHospitalId === h._id ? "Saving..." : "Save"}
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={cancelEditHospital}
                            disabled={savingHospitalId === h._id}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan="6">No hospitals yet</td>
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

      <section className="section">
        <h3>Hospital Admins (Filter by Hospital/Branch)</h3>
        <div className="card">
          <div className="profile-row" style={{ marginBottom: 12 }}>
            <select
              value={adminListHospitalId}
              onChange={(e) => {
                setAdminListHospitalId(e.target.value);
                setAdminListBranch("");
                setAdminListPage(1);
              }}
            >
              <option value="">All hospitals</option>
              {hospitals.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}
                </option>
              ))}
            </select>

            <select
              value={adminListBranch}
              onChange={(e) => {
                setAdminListBranch(e.target.value);
                setAdminListPage(1);
              }}
            >
              <option value="">All branches</option>
              {adminBranchOptions.map((branchName) => (
                <option key={branchName} value={branchName}>
                  {branchName}
                </option>
              ))}
            </select>

            <input
              placeholder="Search admin name/email"
              value={adminListQuery}
              onChange={(e) => {
                setAdminListQuery(e.target.value);
                setAdminListPage(1);
              }}
            />
          </div>

          <table className="table lite">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Hospital</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminList.map((row) => {
                const editing = editAdminId === row._id;
                return (
                  <tr key={row._id}>
                    <td>
                      {editing ? (
                        <input
                          value={editAdminForm.name}
                          onChange={(e) =>
                            setEditAdminForm({ ...editAdminForm, name: e.target.value })
                          }
                        />
                      ) : (
                        row.name
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <input
                          value={editAdminForm.email}
                          onChange={(e) =>
                            setEditAdminForm({ ...editAdminForm, email: e.target.value })
                          }
                        />
                      ) : (
                        row.email
                      )}
                    </td>
                    <td>{row?.hospital?.name || "-"}</td>
                    <td>
                      {editing ? (
                        <select
                          value={editAdminForm.branch}
                          onChange={(e) =>
                            setEditAdminForm({ ...editAdminForm, branch: e.target.value })
                          }
                        >
                          <option value="">Unassigned</option>
                          {adminBranchOptions.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      ) : (
                        row?.employment?.branch || "Unassigned"
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <select
                          value={editAdminForm.active ? "true" : "false"}
                          onChange={(e) =>
                            setEditAdminForm({
                              ...editAdminForm,
                              active: e.target.value === "true",
                            })
                          }
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      ) : row.active === false ? (
                        "Inactive"
                      ) : (
                        "Active"
                      )}
                    </td>
                    <td>
                      {!editing ? (
                        <button
                          className="btn-secondary"
                          onClick={() => startEditAdmin(row)}
                          disabled={loading}
                        >
                          Edit
                        </button>
                      ) : (
                        <div className="action-list">
                          <button
                            className="btn-secondary"
                            onClick={() => saveEditAdmin(row._id)}
                            disabled={loading}
                          >
                            Save
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={cancelEditAdmin}
                            disabled={loading}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!adminList.length && (
                <tr>
                  <td colSpan="6">No hospital admins found</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="action-list" style={{ marginTop: 12 }}>
            <button
              className="btn-secondary"
              onClick={() => setAdminListPage((p) => Math.max(1, p - 1))}
              disabled={adminListPage === 1}
            >
              Prev
            </button>
            <span className="muted">
              Page {adminListPage} of {adminListTotalPages}
            </span>
            <button
              className="btn-secondary"
              onClick={() =>
                setAdminListPage((p) => Math.min(adminListTotalPages, p + 1))
              }
              disabled={adminListPage >= adminListTotalPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
