import React, { useEffect, useState } from "react";
import {
  listAbacPolicies,
  createAbacPolicy,
  updateAbacPolicy,
  deleteAbacPolicy,
  simulateAbacPolicy,
  listAbacTestCases,
  createAbacTestCase,
  deleteAbacTestCase,
  runAbacTestCase,
  runAllAbacTestCases,
} from "../../services/systemAdminApi";

const EMPTY = {
  domain: "INTEROP",
  resource: "transfer_export",
  action: "read",
  effect: "ALLOW",
  roles: "DOCTOR,HOSPITAL_ADMIN,SYSTEM_ADMIN,SUPER_ADMIN,DEVELOPER",
  priority: 100,
  active: true,
  requireActiveConsent: true,
  requireSameHospitalOrPrivileged: true,
  requiredScopes: "",
};

const keyOf = (row) =>
  `${String(row.domain || "").toUpperCase()}::${String(row.resource || "").toLowerCase()}::${String(
    row.action || ""
  ).toLowerCase()}::${String(row.effect || "ALLOW").toUpperCase()}::${Number(row.priority || 100)}`;

export default function AbacPolicies() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [simForm, setSimForm] = useState({
    domain: "INTEROP",
    resource: "transfer_export",
    action: "read",
    role: "DOCTOR",
    sameHospital: false,
    hasActiveConsent: false,
    sourceHospitalBypass: false,
    allowedScopes: "",
  });
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [testCases, setTestCases] = useState([]);
  const [runningAllTests, setRunningAllTests] = useState(false);
  const [runSummary, setRunSummary] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [out, tests] = await Promise.all([listAbacPolicies(), listAbacTestCases()]);
      setItems(Array.isArray(out) ? out : []);
      setTestCases(Array.isArray(tests) ? tests : []);
    } catch (e) {
      setMsg(e?.message || "Failed to load ABAC policies");
      setItems([]);
      setTestCases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toPayload = () => ({
    domain: form.domain,
    resource: form.resource,
    action: form.action,
    effect: form.effect,
    roles: String(form.roles || "")
      .split(",")
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean),
    priority: Number(form.priority || 100),
    active: Boolean(form.active),
    conditions: {
      requireActiveConsent: Boolean(form.requireActiveConsent),
      requireSameHospitalOrPrivileged: Boolean(form.requireSameHospitalOrPrivileged),
      requiredScopes: String(form.requiredScopes || "")
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    },
  });

  const save = async () => {
    setMsg("");
    try {
      const payload = toPayload();
      if (editingId) {
        await updateAbacPolicy(editingId, payload);
        setMsg("ABAC policy updated");
      } else {
        await createAbacPolicy(payload);
        setMsg("ABAC policy created");
      }
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to save ABAC policy");
    }
  };

  const edit = (row) => {
    setEditingId(row._id);
    setForm({
      domain: row.domain || "",
      resource: row.resource || "",
      action: row.action || "",
      effect: row.effect || "ALLOW",
      roles: Array.isArray(row.roles) ? row.roles.join(",") : "",
      priority: row.priority ?? 100,
      active: row.active !== false,
      requireActiveConsent: row.conditions?.requireActiveConsent === true,
      requireSameHospitalOrPrivileged:
        row.conditions?.requireSameHospitalOrPrivileged === true,
      requiredScopes: Array.isArray(row.conditions?.requiredScopes)
        ? row.conditions.requiredScopes.join(",")
        : "",
    });
  };

  const remove = async (id) => {
    try {
      await deleteAbacPolicy(id);
      setMsg("ABAC policy deleted");
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to delete ABAC policy");
    }
  };

  const exportJson = () => {
    const safeRows = items.map((row) => ({
      domain: row.domain,
      resource: row.resource,
      action: row.action,
      effect: row.effect,
      roles: row.roles || [],
      priority: row.priority ?? 100,
      active: row.active !== false,
      conditions: row.conditions || {},
    }));
    const blob = new Blob([JSON.stringify(safeRows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "abac-policies.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file) => {
    if (!file) return;
    setImporting(true);
    setMsg("");
    try {
      const text = await file.text();
      const rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error("JSON must be an array of policies");

      const existing = await listAbacPolicies();
      const byKey = new Map(existing.map((r) => [keyOf(r), r]));
      let created = 0;
      let updated = 0;

      for (const row of rows) {
        const payload = {
          domain: String(row.domain || "").toUpperCase(),
          resource: String(row.resource || "").toLowerCase(),
          action: String(row.action || "").toLowerCase(),
          effect: String(row.effect || "ALLOW").toUpperCase(),
          roles: Array.isArray(row.roles)
            ? row.roles.map((r) => String(r || "").toUpperCase()).filter(Boolean)
            : [],
          priority: Number(row.priority || 100),
          active: row.active !== false,
          conditions: {
            requireActiveConsent: row?.conditions?.requireActiveConsent === true,
            requireSameHospitalOrPrivileged:
              row?.conditions?.requireSameHospitalOrPrivileged === true,
            requiredScopes: Array.isArray(row?.conditions?.requiredScopes)
              ? row.conditions.requiredScopes.map((v) => String(v || "").toLowerCase()).filter(Boolean)
              : [],
          },
        };
        const existingRow = byKey.get(keyOf(payload));
        if (existingRow?._id) {
          await updateAbacPolicy(existingRow._id, payload);
          updated += 1;
        } else {
          await createAbacPolicy(payload);
          created += 1;
        }
      }

      setMsg(`Import complete: ${created} created, ${updated} updated.`);
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to import ABAC policies");
    } finally {
      setImporting(false);
    }
  };

  const runSimulation = async () => {
    setSimulating(true);
    setSimResult(null);
    setMsg("");
    try {
      const payload = {
        domain: simForm.domain,
        resource: simForm.resource,
        action: simForm.action,
        role: simForm.role,
        sameHospital: simForm.sameHospital,
        hasActiveConsent: simForm.hasActiveConsent,
        sourceHospitalBypass: simForm.sourceHospitalBypass,
        allowedScopes: String(simForm.allowedScopes || "")
          .split(",")
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean),
      };
      const out = await simulateAbacPolicy(payload);
      setSimResult(out);
    } catch (e) {
      setMsg(e?.message || "Failed to run ABAC simulation");
    } finally {
      setSimulating(false);
    }
  };

  const saveSimulationAsTestCase = async () => {
    setMsg("");
    try {
      const payload = {
        name: `${simForm.domain}/${simForm.resource}/${simForm.action}/${simForm.role}`,
        input: {
          domain: simForm.domain,
          resource: simForm.resource,
          action: simForm.action,
          role: simForm.role,
          sameHospital: simForm.sameHospital,
          hasActiveConsent: simForm.hasActiveConsent,
          sourceHospitalBypass: simForm.sourceHospitalBypass,
          allowedScopes: String(simForm.allowedScopes || "")
            .split(",")
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean),
        },
        expected: simResult?.decision
          ? {
              allowed: simResult.decision.allowed,
              reason: simResult.decision.reason || "",
            }
          : { allowed: null, reason: "" },
        active: true,
      };
      await createAbacTestCase(payload);
      setMsg("Simulation saved as ABAC test case.");
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to save test case");
    }
  };

  const runOneTest = async (id) => {
    try {
      const out = await runAbacTestCase(id);
      setMsg(
        `Test ${out?.name || id}: ${out?.passed ? "PASSED" : "FAILED"} (${out?.decision?.reason || "n/a"})`
      );
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to run test case");
    }
  };

  const runAllTests = async () => {
    setRunningAllTests(true);
    setRunSummary(null);
    setMsg("");
    try {
      const out = await runAllAbacTestCases();
      setRunSummary(out?.totals || null);
      setMsg(
        `ABAC test run complete: ${out?.totals?.passed || 0} passed, ${out?.totals?.failed || 0} failed.`
      );
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to run all test cases");
    } finally {
      setRunningAllTests(false);
    }
  };

  const removeTest = async (id) => {
    try {
      await deleteAbacTestCase(id);
      setMsg("Test case deleted.");
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to delete test case");
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>ABAC Policy Engine</h2>
          <p className="muted">Manage zero-trust attribute-based rules across domains.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
          <button className="btn-secondary" onClick={exportJson} disabled={loading || importing}>
            Export JSON
          </button>
          <label className="btn-secondary" style={{ cursor: "pointer" }}>
            {importing ? "Importing..." : "Import JSON"}
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => importJson(e.target.files?.[0])}
              disabled={importing}
            />
          </label>
        </div>
      </div>
      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>{editingId ? "Edit Policy" : "Create Policy"}</h3>
        <div className="card">
          <div className="grid info-grid">
            <label>Domain<input value={form.domain} onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value.toUpperCase() }))} /></label>
            <label>Resource<input value={form.resource} onChange={(e) => setForm((p) => ({ ...p, resource: e.target.value }))} /></label>
            <label>Action<input value={form.action} onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))} /></label>
            <label>Effect
              <select value={form.effect} onChange={(e) => setForm((p) => ({ ...p, effect: e.target.value }))}>
                <option value="ALLOW">ALLOW</option>
                <option value="DENY">DENY</option>
              </select>
            </label>
            <label>Roles (comma)<input value={form.roles} onChange={(e) => setForm((p) => ({ ...p, roles: e.target.value }))} /></label>
            <label>Priority<input type="number" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} /></label>
            <label>Required Scopes (comma)<input value={form.requiredScopes} onChange={(e) => setForm((p) => ({ ...p, requiredScopes: e.target.value }))} /></label>
            <label><input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} /> Active</label>
            <label><input type="checkbox" checked={form.requireActiveConsent} onChange={(e) => setForm((p) => ({ ...p, requireActiveConsent: e.target.checked }))} /> Require Active Consent</label>
            <label><input type="checkbox" checked={form.requireSameHospitalOrPrivileged} onChange={(e) => setForm((p) => ({ ...p, requireSameHospitalOrPrivileged: e.target.checked }))} /> Require Same Hospital Or Privileged</label>
          </div>
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-primary" onClick={save}>{editingId ? "Update Policy" : "Create Policy"}</button>
            <button className="btn-secondary" onClick={() => { setForm(EMPTY); setEditingId(null); }}>Reset</button>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Policy List</h3>
        <div className="card">
          <table className="table lite">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Resource</th>
                <th>Action</th>
                <th>Effect</th>
                <th>Priority</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id}>
                  <td>{row.domain}</td>
                  <td>{row.resource}</td>
                  <td>{row.action}</td>
                  <td>{row.effect}</td>
                  <td>{row.priority}</td>
                  <td>{row.active ? "Yes" : "No"}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => edit(row)}>Edit</button>
                    <button className="btn-danger" onClick={() => remove(row._id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="7">No ABAC policies defined</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h3>Policy Simulator</h3>
        <div className="card">
          <div className="grid info-grid">
            <label>
              Domain
              <input
                value={simForm.domain}
                onChange={(e) => setSimForm((p) => ({ ...p, domain: e.target.value.toUpperCase() }))}
              />
            </label>
            <label>
              Resource
              <input
                value={simForm.resource}
                onChange={(e) => setSimForm((p) => ({ ...p, resource: e.target.value }))}
              />
            </label>
            <label>
              Action
              <input
                value={simForm.action}
                onChange={(e) => setSimForm((p) => ({ ...p, action: e.target.value }))}
              />
            </label>
            <label>
              Role
              <input
                value={simForm.role}
                onChange={(e) => setSimForm((p) => ({ ...p, role: e.target.value.toUpperCase() }))}
              />
            </label>
            <label>
              Allowed scopes (comma)
              <input
                value={simForm.allowedScopes}
                onChange={(e) => setSimForm((p) => ({ ...p, allowedScopes: e.target.value }))}
              />
            </label>
            <label><input type="checkbox" checked={simForm.sameHospital} onChange={(e) => setSimForm((p) => ({ ...p, sameHospital: e.target.checked }))} /> Same hospital</label>
            <label><input type="checkbox" checked={simForm.hasActiveConsent} onChange={(e) => setSimForm((p) => ({ ...p, hasActiveConsent: e.target.checked }))} /> Active consent</label>
            <label><input type="checkbox" checked={simForm.sourceHospitalBypass} onChange={(e) => setSimForm((p) => ({ ...p, sourceHospitalBypass: e.target.checked }))} /> Source hospital bypass</label>
          </div>
          <div className="welcome-actions" style={{ marginTop: 10 }}>
            <button className="btn-primary" onClick={runSimulation} disabled={simulating}>
              {simulating ? "Simulating..." : "Run Simulation"}
            </button>
            <button
              className="btn-secondary"
              onClick={saveSimulationAsTestCase}
              disabled={!simForm.domain || !simForm.resource || !simForm.action || !simForm.role}
            >
              Save as Test Case
            </button>
          </div>
          {simResult && (
            <div className="card" style={{ marginTop: 12 }}>
              <p>
                Decision:{" "}
                <strong style={{ color: simResult?.decision?.allowed ? "#127a4b" : "#b42318" }}>
                  {simResult?.decision?.allowed ? "ALLOW" : "DENY"}
                </strong>{" "}
                ({simResult?.decision?.reason || "n/a"})
              </p>
              <p className="muted">Matched Policy: {simResult?.matchedPolicy?._id || "None"}</p>
              <details>
                <summary>Trace ({Array.isArray(simResult?.trace) ? simResult.trace.length : 0})</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(simResult.trace || [], null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h3>ABAC Regression Test Cases</h3>
        <div className="card">
          <div className="welcome-actions" style={{ marginBottom: 10 }}>
            <button className="btn-primary" onClick={runAllTests} disabled={runningAllTests}>
              {runningAllTests ? "Running All..." : "Run All Active Tests"}
            </button>
            {runSummary && (
              <span className="muted">
                Total: {runSummary.active || 0} | Passed: {runSummary.passed || 0} | Failed:{" "}
                {runSummary.failed || 0}
              </span>
            )}
          </div>
          <table className="table lite">
            <thead>
              <tr>
                <th>Name</th>
                <th>Input</th>
                <th>Expected</th>
                <th>Last Run</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {testCases.map((tc) => (
                <tr key={tc._id}>
                  <td>{tc.name}</td>
                  <td>
                    {tc.input?.domain}/{tc.input?.resource}/{tc.input?.action}/{tc.input?.role}
                  </td>
                  <td>
                    {typeof tc.expected?.allowed === "boolean"
                      ? `${tc.expected.allowed ? "ALLOW" : "DENY"}${
                          tc.expected?.reason ? ` (${tc.expected.reason})` : ""
                        }`
                      : "Any"}
                  </td>
                  <td>
                    {tc.lastRunAt
                      ? `${new Date(tc.lastRunAt).toLocaleString()} - ${
                          tc.lastRun?.passed ? "PASS" : "FAIL"
                        }`
                      : "Not run"}
                  </td>
                  <td>
                    <button className="btn-secondary" onClick={() => runOneTest(tc._id)}>
                      Run
                    </button>
                    <button className="btn-danger" onClick={() => removeTest(tc._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {testCases.length === 0 && (
                <tr>
                  <td colSpan="5">No ABAC test cases yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
