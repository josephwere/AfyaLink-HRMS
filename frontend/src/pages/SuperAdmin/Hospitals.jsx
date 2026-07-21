import React, { useEffect, useState } from "react";
import { useAuth } from "../../utils/auth";
import { useLocation } from "react-router-dom";
import PasswordInput from "../../components/PasswordInput";
import { normalizeRole } from "../../utils/normalizeRole";
import AccessDeniedCard from "../../components/AccessDeniedCard";
import { useHospitalsPage } from "../../hooks/useHospitalsPage";

const coerceList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.hospitals)) return value.hospitals;
  return [];
};

export default function SuperAdminHospitals() {
  const { user } = useAuth();
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const location = useLocation();
  const {
    createHospital,
    updateHospital,
    searchGovernmentHospitals,
    createBranch,
    listBranches,
    removeBranch,
    updateBranch,
    listHospitals,
    listHospitalAdmins,
    registerHospitalAdmin,
    registerSystemAdmin,
    registerDeveloper,
    updateHospitalAdmin: updateHospitalAdminApi,
  } = useHospitalsPage();
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
    type: "PRIVATE",
    registrationNumber: "",
    registryHospitalId: "",
    address: "",
    email: "",
    phone: "",
    country: "",
    region: "",
    city: "",
    code: "",
  });
  const [hospitalDocs, setHospitalDocs] = useState({
    registrationCertificate: null,
    taxRegistration: null,
    proofOfAddress: null,
    representativeId: null,
  });
  const [registryQuery, setRegistryQuery] = useState("");
  const [registryMatches, setRegistryMatches] = useState([]);
  const [registryLoading, setRegistryLoading] = useState(false);

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
    subscriptionStatus: "TRIAL",
    subscriptionPaid: false,
    trialEndsAt: "",
    premiumPaused: false,
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
      const items = coerceList(data);
      setHospitals(items);
    } catch {
      setHospitals([]);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, [query]);

  useEffect(() => {
    let active = true;
    const trimmed = registryQuery.trim();
    if (!trimmed && !hospitalForm.country && !hospitalForm.region && !hospitalForm.city) {
      setRegistryMatches([]);
      return undefined;
    }
    setRegistryLoading(true);
    searchGovernmentHospitals({
      q: trimmed || undefined,
      country: hospitalForm.country || undefined,
      region: hospitalForm.region || undefined,
      city: hospitalForm.city || undefined,
    })
      .then((data) => {
        if (!active) return;
        setRegistryMatches(coerceList(data));
      })
      .catch(() => {
        if (!active) return;
        setRegistryMatches([]);
      })
      .finally(() => {
        if (active) setRegistryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [registryQuery, hospitalForm.country, hospitalForm.region, hospitalForm.city]);

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
      setBranches(coerceList(data));
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
        setAdminBranches(coerceList(data));
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
        setAdminList(coerceList(data));
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
        const rows = coerceList(data);
        setAdminFilterBranches(rows.filter((b) => b?.active !== false));
      })
      .catch(() => setAdminFilterBranches([]));
  }, [adminListHospitalId]);

  const isSuperAdmin = actorRole === "SUPER_ADMIN";
  const isSystemAdmin = actorRole === "SYSTEM_ADMIN";

  if (!isSuperAdmin && !isSystemAdmin) {
    return <AccessDeniedCard message="Only founder and system-level admin roles can manage the hospital registry." />;
  }

  const submitHospital = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const formData = new FormData();
      Object.entries(hospitalForm).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== "") {
          formData.append(key, value);
        }
      });
      Object.entries(hospitalDocs).forEach(([key, file]) => {
        if (file) formData.append(key, file);
      });
      const created = await createHospital(formData);
      setMsg(
        created?.verification?.status === "VERIFIED"
          ? "✅ Hospital verified and created"
          : "⚠️ Hospital created but sent to manual compliance review"
      );
      setHospitalForm({
        name: "",
        type: "PRIVATE",
        registrationNumber: "",
        registryHospitalId: "",
        address: "",
        email: "",
        phone: "",
        country: "",
        region: "",
        city: "",
        code: "",
      });
      setHospitalDocs({
        registrationCertificate: null,
        taxRegistration: null,
        proofOfAddress: null,
        representativeId: null,
      });
      setRegistryQuery("");
      setRegistryMatches([]);
      await loadHospitals();
    } catch (err) {
      setMsg(err?.message || "Failed to create hospital");
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
      setMsg(err?.message || "Failed to create hospital admin");
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
      setMsg(err?.message || "Failed to create system admin");
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
      setMsg(err?.message || "Failed to create developer");
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
      subscriptionStatus: hospital?.subscriptionState?.status || hospital?.subscription?.status || "TRIAL",
      subscriptionPaid: Boolean(hospital?.subscription?.paid),
      trialEndsAt: hospital?.subscription?.trialEndsAt
        ? String(hospital.subscription.trialEndsAt).slice(0, 10)
        : "",
      premiumPaused: Boolean(hospital?.subscriptionState?.premiumPaused || hospital?.subscription?.premiumPaused),
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
      subscriptionStatus: "TRIAL",
      subscriptionPaid: false,
      trialEndsAt: "",
      premiumPaused: false,
    });
  };

  const saveHospitalEdit = async (hospitalId) => {
    setSavingHospitalId(hospitalId);
    setMsg(null);
    try {
      await updateHospital(hospitalId, {
        name: editHospitalForm.name,
        code: editHospitalForm.code,
        address: editHospitalForm.address,
        contact: editHospitalForm.contact,
        active: editHospitalForm.active,
        subscription: {
          paid: editHospitalForm.subscriptionPaid,
          status: editHospitalForm.subscriptionStatus,
          trialEndsAt: editHospitalForm.trialEndsAt || undefined,
          premiumPaused: editHospitalForm.premiumPaused,
        },
      });
      setMsg("✅ Hospital updated");
      cancelEditHospital();
      await loadHospitals();
    } catch (err) {
      setMsg(err?.message || "Failed to update hospital");
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
      setMsg(err?.message || "Failed to create branch");
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
      setMsg(err?.message || "Failed to update branch");
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
      setMsg(err?.message || "Failed to deactivate branch");
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
      setAdminList(coerceList(data));
      setAdminListTotal(Number(data?.total || 0));
    } catch (err) {
      setMsg(err?.message || "Failed to update hospital admin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    setAdminListPage(1);
  }, [adminListHospitalId, adminListBranch, adminListQuery]);

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
            placeholder="Search approved government registry"
            value={registryQuery}
            onChange={(e) => setRegistryQuery(e.target.value)}
          />
          {registryLoading ? <p className="muted">Checking approved registry...</p> : null}
          {registryMatches.length ? (
            <div className="card" style={{ padding: 12 }}>
              <strong>Approved Registry Matches</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {registryMatches.map((item) => (
                  <button
                    type="button"
                    key={item._id}
                    className="btn-secondary"
                    onClick={() => {
                      setHospitalForm((prev) => ({
                        ...prev,
                        name: item.officialName || prev.name,
                        type: item.hospitalType || prev.type,
                        registrationNumber: item.registrationNumber || prev.registrationNumber,
                        registryHospitalId: item._id,
                        address: item?.location?.address || prev.address,
                        country: item?.location?.country || prev.country,
                        region: item?.location?.region || prev.region,
                        city: item?.location?.city || prev.city,
                        email: item?.contact?.email || prev.email,
                        phone: item?.contact?.phone || prev.phone,
                      }));
                    }}
                  >
                    {item.officialName} • {item.registrationNumber} • {item.hospitalType}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <input
            placeholder="Hospital name"
            value={hospitalForm.name}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, name: e.target.value })
            }
            required
          />
          <select
            value={hospitalForm.type}
            onChange={(e) => setHospitalForm({ ...hospitalForm, type: e.target.value })}
            required
          >
            <option value="PRIVATE">Private</option>
            <option value="PUBLIC">Public</option>
            <option value="NGO">NGO</option>
          </select>
          <input
            placeholder="Government registration number"
            value={hospitalForm.registrationNumber}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, registrationNumber: e.target.value.toUpperCase() })
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
            placeholder="Contact email"
            type="email"
            value={hospitalForm.email}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, email: e.target.value })
            }
          />
          <input
            placeholder="Contact phone"
            value={hospitalForm.phone}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, phone: e.target.value })
            }
          />
          <input
            placeholder="Country"
            value={hospitalForm.country}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, country: e.target.value })
            }
            required
          />
          <input
            placeholder="County / Region"
            value={hospitalForm.region}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, region: e.target.value })
            }
            required
          />
          <input
            placeholder="City"
            value={hospitalForm.city}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, city: e.target.value })
            }
            required
          />
          <input
            placeholder="Optional code"
            value={hospitalForm.code}
            onChange={(e) =>
              setHospitalForm({ ...hospitalForm, code: e.target.value })
            }
          />
          <label>
            Registration Certificate
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) =>
                setHospitalDocs({ ...hospitalDocs, registrationCertificate: e.target.files?.[0] || null })
              }
              required
            />
          </label>
          <label>
            Tax Registration / Business License
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) =>
                setHospitalDocs({ ...hospitalDocs, taxRegistration: e.target.files?.[0] || null })
              }
              required
            />
          </label>
          <label>
            Proof of Address
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) =>
                setHospitalDocs({ ...hospitalDocs, proofOfAddress: e.target.files?.[0] || null })
              }
              required
            />
          </label>
          <label>
            Authorized Representative ID
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) =>
                setHospitalDocs({ ...hospitalDocs, representativeId: e.target.files?.[0] || null })
              }
              required
            />
          </label>
          <p className="muted">
            Only hospitals found in the approved government registry can be created. All four verification documents are mandatory.
          </p>
          <button type="submit" disabled={loading}>
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
          <PasswordInput
            label=""
            value={adminForm.password}
            placeholder="Temporary password"
            autoComplete="new-password"
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
              <option
                key={h._id}
                value={h._id}
                disabled={h?.verificationSummary?.status !== "VERIFIED"}
              >
                {h.name} {h?.verificationSummary?.status === "VERIFIED" ? "• Verified" : "• Not verified"}
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
          <button type="submit" disabled={loading}>
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
            <button type="submit" disabled={branchBusy || !branchHospitalId}>
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
                          <button type="button"
                            className="btn-secondary"
                            onClick={() => startEditBranch(b)}
                            disabled={branchBusy}
                          >
                            Edit
                          </button>
                          <button type="button"
                            className="btn-secondary"
                            onClick={() => deactivateBranch(b._id)}
                            disabled={branchBusy}
                          >
                            Deactivate
                          </button>
                        </div>
                      ) : (
                        <div className="action-list">
                          <button type="button"
                            className="btn-secondary"
                            onClick={() => saveEditBranch(b._id)}
                            disabled={branchBusy}
                          >
                            Save
                          </button>
                          <button type="button"
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
            <PasswordInput
              label=""
              value={systemAdminForm.password}
              placeholder="Temporary password"
              autoComplete="new-password"
              onChange={(e) =>
                setSystemAdminForm({
                  ...systemAdminForm,
                  password: e.target.value,
                })
              }
              required
            />
            <button type="submit" disabled={loading}>
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
            <PasswordInput
              label=""
              value={developerForm.password}
              placeholder="Temporary password"
              autoComplete="new-password"
              onChange={(e) =>
                setDeveloperForm({
                  ...developerForm,
                  password: e.target.value,
                })
              }
              required
            />
            <button type="submit" disabled={loading}>
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
                <th>Verification</th>
                <th>Subscription</th>
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
                      <div>{h?.verificationSummary?.status || "UNVERIFIED"}</div>
                      <div className="muted">
                        {h?.verificationSummary?.registrationNumber || "No registration number"}
                      </div>
                      {h?.verificationSummary?.approvalDate ? (
                        <div className="muted">
                          Approved: {String(h.verificationSummary.approvalDate).slice(0, 10)}
                        </div>
                      ) : null}
                      {h?.verificationSummary?.status === "REVIEW_REQUIRED" ? (
                        <div className="muted" style={{ color: "var(--app-warning)" }}>
                          Manual review required
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="action-list" style={{ flexDirection: "column", alignItems: "stretch" }}>
                          <select
                            value={editHospitalForm.subscriptionStatus}
                            onChange={(e) =>
                              setEditHospitalForm({
                                ...editHospitalForm,
                                subscriptionStatus: e.target.value,
                              })
                            }
                          >
                            <option value="TRIAL">TRIAL</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="PAST_DUE">PAST_DUE</option>
                            <option value="PAUSED">PAUSED</option>
                          </select>
                          <label className="profile-inline-check">
                            <input
                              type="checkbox"
                              checked={Boolean(editHospitalForm.subscriptionPaid)}
                              onChange={(e) =>
                                setEditHospitalForm({
                                  ...editHospitalForm,
                                  subscriptionPaid: e.target.checked,
                                })
                              }
                            />
                            <span>Paid</span>
                          </label>
                          <label>Trial Ends</label>
                          <input
                            type="date"
                            value={editHospitalForm.trialEndsAt}
                            onChange={(e) =>
                              setEditHospitalForm({
                                ...editHospitalForm,
                                trialEndsAt: e.target.value,
                              })
                            }
                          />
                          <label className="profile-inline-check">
                            <input
                              type="checkbox"
                              checked={Boolean(editHospitalForm.premiumPaused)}
                              onChange={(e) =>
                                setEditHospitalForm({
                                  ...editHospitalForm,
                                  premiumPaused: e.target.checked,
                                })
                              }
                            />
                            <span>Premium paused</span>
                          </label>
                        </div>
                      ) : (
                        <>
                          <div>{h?.subscriptionState?.status || "TRIAL"}</div>
                          <div className="muted">
                            Trial days left: {Number(h?.subscriptionState?.daysLeft || 0)}
                          </div>
                          <div className="muted">Paid: {h?.subscription?.paid ? "Yes" : "No"}</div>
                          {h?.subscriptionState?.premiumPaused ? (
                            <div className="muted" style={{ color: "var(--app-danger)" }}>
                              Premium paused
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td>
                      {!isEditing ? (
                        <button type="button"
                          className="btn-secondary"
                          onClick={() => startEditHospital(h)}
                        >
                          Edit
                        </button>
                      ) : (
                        <div className="action-list">
                          <button type="button"
                            className="btn-secondary"
                            onClick={() => saveHospitalEdit(h._id)}
                            disabled={savingHospitalId === h._id}
                          >
                            {savingHospitalId === h._id ? "Saving..." : "Save"}
                          </button>
                          <button type="button"
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
                  <td colSpan="7">No hospitals yet</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="action-list" style={{ marginTop: 12 }}>
            <button type="button"
              className="btn-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className="muted">
              Page {currentPage} of {totalPages}
            </span>
            <button type="button"
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
                        <button type="button"
                          className="btn-secondary"
                          onClick={() => startEditAdmin(row)}
                          disabled={loading}
                        >
                          Edit
                        </button>
                      ) : (
                        <div className="action-list">
                          <button type="button"
                            className="btn-secondary"
                            onClick={() => saveEditAdmin(row._id)}
                            disabled={loading}
                          >
                            Save
                          </button>
                          <button type="button"
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
            <button type="button"
              className="btn-secondary"
              onClick={() => setAdminListPage((p) => Math.max(1, p - 1))}
              disabled={adminListPage === 1}
            >
              Prev
            </button>
            <span className="muted">
              Page {adminListPage} of {adminListTotalPages}
            </span>
            <button type="button"
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
