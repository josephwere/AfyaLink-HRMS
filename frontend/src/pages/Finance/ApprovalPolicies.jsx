import React, { useEffect, useMemo, useState } from "react";
import { listPolicies, createPolicy, updatePolicy, deletePolicy, simulatePolicy } from "../../services/finance/approvalPolicyApi";

const DEFAULT_WORKFLOW = "REFUND";
const DEFAULT_LEVEL = { level: 1, roles: "FINANCE_MANAGER", minAmount: 0, maxAmount: 100000 };
const WORKFLOW_TYPES = ["REFUND", "JOURNAL", "PAYMENT", "PROCUREMENT", "INVENTORY", "PAYROLL", "CONSOLIDATION", "CLAIM", "OTHER"];
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"];

function formatDateInput(dateValue) {
  try {
    return new Date(dateValue).toISOString().slice(0, 10);
  } catch (err) {
    return new Date().toISOString().slice(0, 10);
  }
}

function normalizeLevels(levels = []) {
  return Array.isArray(levels)
    ? levels.map((level) => ({
        level: Number(level.level || 1),
        roles: Array.isArray(level.roles) ? level.roles.join(", ") : String(level.roles || "").trim(),
        minAmount: Number(level.minAmount || 0),
        maxAmount: Number(level.maxAmount || Number.MAX_SAFE_INTEGER),
      }))
    : [DEFAULT_LEVEL];
}

function buildPayload(form) {
  return {
    workflowType: String(form.workflowType || DEFAULT_WORKFLOW).trim(),
    status: String(form.status || "ACTIVE").trim(),
    minimumApprovals: Number(form.minimumApprovals) || 1,
    delegationAllowed: Boolean(form.delegationAllowed),
    escalationHours: Number(form.escalationHours) || 24,
    effectiveDate: form.effectiveDate ? new Date(form.effectiveDate).toISOString() : new Date().toISOString(),
    approvalLevels: (form.approvalLevels || []).map((level) => ({
      level: Number(level.level) || 1,
      roles: String(level.roles || "").split(",").map((role) => role.trim()).filter(Boolean),
      minAmount: Number(level.minAmount) || 0,
      maxAmount: Number(level.maxAmount) || Number.MAX_SAFE_INTEGER,
    })),
  };
}

function PolicyForm({ initial = {}, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    workflowType: initial.workflowType || DEFAULT_WORKFLOW,
    status: initial.status || "ACTIVE",
    minimumApprovals: initial.minimumApprovals ?? 1,
    delegationAllowed: initial.delegationAllowed ?? true,
    escalationHours: initial.escalationHours ?? 24,
    effectiveDate: formatDateInput(initial.effectiveDate || new Date()),
    approvalLevels: normalizeLevels(initial.approvalLevels),
  }));
  const [error, setError] = useState("");

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const setLevelValue = (index, key, value) => {
    setForm((current) => {
      const approvalLevels = [...(current.approvalLevels || [])];
      approvalLevels[index] = { ...approvalLevels[index], [key]: value };
      return { ...current, approvalLevels };
    });
  };

  const addLevel = () => setForm((current) => ({ ...current, approvalLevels: [...(current.approvalLevels || []), { ...DEFAULT_LEVEL, level: (current.approvalLevels || []).length + 1 }] }));
  const removeLevel = (index) => setForm((current) => ({ ...current, approvalLevels: (current.approvalLevels || []).filter((_, idx) => idx !== index) }));

  const handleSubmit = async () => {
    setError("");
    if (!form.workflowType?.trim()) {
      return setError("Workflow type is required.");
    }
    if (Number(form.minimumApprovals) < 1) {
      return setError("Minimum approvals must be at least 1.");
    }
    if ((form.approvalLevels || []).some((level) => !level.roles?.trim())) {
      return setError("Each approval level must specify at least one role.");
    }

    await onSave(buildPayload(form));
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div className="card-header-actions" style={{ marginBottom: 16 }}>
        <div>
          <h3>{initial._id ? "Edit approval policy" : "Create approval policy"}</h3>
          <p className="muted">Define workflow rules, approval levels, delegation and escalation for finance approvals.</p>
        </div>
      </div>

      <div className="grid cols-2 gap-16" style={{ marginBottom: 16 }}>
        <div>
          <label>Workflow type</label>
          <select value={form.workflowType} onChange={(e) => setValue("workflowType", e.target.value)}>
            {WORKFLOW_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Status</label>
          <select value={form.status} onChange={(e) => setValue("status", e.target.value)}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Minimum approvals</label>
          <input type="number" min="1" value={form.minimumApprovals} onChange={(e) => setValue("minimumApprovals", Number(e.target.value))} />
        </div>
        <div>
          <label>Escalation hours</label>
          <input type="number" min="0" value={form.escalationHours} onChange={(e) => setValue("escalationHours", Number(e.target.value))} />
        </div>
        <div>
          <label>Delegation allowed</label>
          <select value={form.delegationAllowed ? "true" : "false"} onChange={(e) => setValue("delegationAllowed", e.target.value === "true")}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <label>Effective date</label>
          <input type="date" value={form.effectiveDate} onChange={(e) => setValue("effectiveDate", e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong>Approval levels</strong>
          <button type="button" className="btn-sm" onClick={addLevel}>Add level</button>
        </div>

        <div className="table-wrap">
          <table className="table lite small">
            <thead>
              <tr>
                <th>Level</th>
                <th>Roles</th>
                <th>Min amount</th>
                <th>Max amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(form.approvalLevels || []).map((level, index) => (
                <tr key={`${level.level}-${index}`}>
                  <td>
                    <input type="number" min="1" value={level.level} onChange={(e) => setLevelValue(index, "level", Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="text" value={level.roles} onChange={(e) => setLevelValue(index, "roles", e.target.value)} placeholder="Comma-separated roles" />
                  </td>
                  <td>
                    <input type="number" min="0" value={level.minAmount} onChange={(e) => setLevelValue(index, "minAmount", Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" min="0" value={level.maxAmount === Number.MAX_SAFE_INTEGER ? "" : level.maxAmount} onChange={(e) => setLevelValue(index, "maxAmount", e.target.value ? Number(e.target.value) : Number.MAX_SAFE_INTEGER)} placeholder="No limit" />
                  </td>
                  <td>
                    <button type="button" className="btn-sm btn-danger" onClick={() => removeLevel(index)} disabled={(form.approvalLevels || []).length <= 1}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <div className="card card-error">{error}</div> : null}

      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" className="btn-primary" onClick={handleSubmit}>Save policy</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function ApprovalPolicies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("");
  const [simWorkflowType, setSimWorkflowType] = useState(DEFAULT_WORKFLOW);
  const [simAmount, setSimAmount] = useState(0);
  const [simResult, setSimResult] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listPolicies();
      setPolicies(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err?.message || "Failed to load approval policies.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      const q = String(filter || "").trim().toLowerCase();
      const workflow = String(workflowFilter || "").trim().toLowerCase();
      const status = String(statusFilter || "").trim().toLowerCase();
      if (q && !`${policy.workflowType} ${policy.status} ${policy.approvalLevels?.map((l) => l.roles?.join(", ")).join(" ")}`.toLowerCase().includes(q)) {
        return false;
      }
      if (workflow && policy.workflowType.toLowerCase() !== workflow) return false;
      if (status && policy.status.toLowerCase() !== status) return false;
      return true;
    });
  }, [policies, filter, workflowFilter, statusFilter]);

  const handleDelete = async (policy) => {
    if (!confirm(`Delete policy for ${policy.workflowType}?`)) return;
    setError("");
    try {
      await deletePolicy(policy._id);
      setMessage("Policy deleted successfully.");
      load();
    } catch (err) {
      setError(err?.message || "Failed to delete policy.");
    }
  };

  const handleSimulation = async () => {
    setError("");
    setSimResult(null);
    try {
      const result = await simulatePolicy({ workflowType: simWorkflowType, amount: Number(simAmount) || 0 });
      setSimResult(result.policy || null);
    } catch (err) {
      setError(err?.message || "Simulation failed.");
    }
  };

  return (
    <div className="dashboard premium-shell finance-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Finance policy admin</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Approval Policies</h1>
            <p className="premium-shell-subtitle">Manage policy workflows, approval levels, delegation and escalation for finance approvals.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn-primary" onClick={() => { setCreating(true); setEditing(null); }}>Create policy</button>
            <button type="button" className="btn-secondary" onClick={load} disabled={loading}>Refresh</button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="grid cols-3 gap-16" style={{ alignItems: "flex-end" }}>
            <div>
              <label>Search</label>
              <input placeholder="Search workflow, roles, status" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <div>
              <label>Workflow type</label>
              <select value={workflowFilter} onChange={(e) => setWorkflowFilter(e.target.value)}>
                <option value="">All</option>
                {WORKFLOW_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>
        </div>

        {message && <div className="card card-success" style={{ marginBottom: 16 }}>{message}</div>}
        {error && <div className="card card-error" style={{ marginBottom: 16 }}>{error}</div>}

        {(creating || editing) && (
          <PolicyForm
            initial={editing || {}}
            onCancel={() => { setCreating(false); setEditing(null); setError(""); }}
            onSave={async (payload) => {
              try {
                if (editing) {
                  await updatePolicy(editing._id, payload);
                  setMessage("Policy updated successfully.");
                } else {
                  await createPolicy(payload);
                  setMessage("Policy created successfully.");
                }
                setCreating(false);
                setEditing(null);
                load();
              } catch (err) {
                setError(err?.message || "Unable to save policy.");
              }
            }}
          />
        )}

        {!creating && !editing && (
          <div className="card">
            <div className="table-wrap">
              <table className="table lite">
                <thead>
                  <tr>
                    <th>Workflow type</th>
                    <th>Status</th>
                    <th>Min approvals</th>
                    <th>Delegation</th>
                    <th>Escalation</th>
                    <th>Effective</th>
                    <th>Approval levels</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="muted">Loading policies…</td></tr>
                  ) : filteredPolicies.length ? (
                    filteredPolicies.map((policy) => (
                      <tr key={policy._id}>
                        <td>{policy.workflowType}</td>
                        <td>{policy.status}</td>
                        <td>{policy.minimumApprovals}</td>
                        <td>{policy.delegationAllowed ? "Yes" : "No"}</td>
                        <td>{policy.escalationHours} hrs</td>
                        <td>{policy.effectiveDate ? new Date(policy.effectiveDate).toLocaleDateString() : "—"}</td>
                        <td>{policy.approvalLevels?.length || 0}</td>
                        <td>
                          <button type="button" className="btn-sm" onClick={() => { setEditing(policy); setCreating(false); }}>Edit</button>
                          <button type="button" className="btn-sm btn-danger" onClick={() => handleDelete(policy)} style={{ marginLeft: 8 }}>Delete</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="muted">No approval policies found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div>
              <label>Simulate workflow</label>
              <select value={simWorkflowType} onChange={(e) => setSimWorkflowType(e.target.value)}>
                {WORKFLOW_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label>Amount</label>
              <input type="number" min="0" value={simAmount} onChange={(e) => setSimAmount(e.target.value)} />
            </div>
            <button type="button" className="btn-secondary" onClick={handleSimulation}>Preview approval policy</button>
          </div>
          {simResult ? (
            <div>
              <strong>Simulation result</strong>
              <pre style={{ maxHeight: 320, overflow: "auto", marginTop: 8 }}>{JSON.stringify(simResult, null, 2)}</pre>
            </div>
          ) : (
            <div className="muted">Run a simulation to preview the matching policy and approval levels for a workflow and amount.</div>
          )}
        </div>
      </section>
    </div>
  );
}
