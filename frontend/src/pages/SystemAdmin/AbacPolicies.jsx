import React from "react";
import { useAbacPolicies } from "../../hooks/useAbacPolicies";

export default function AbacPolicies() {
  const {
    items,
    form,
    setForm,
    editingId,
    loading,
    msg,
    setMsg,
    importing,
    simForm,
    setSimForm,
    simResult,
    simulating,
    testCases,
    runningAllTests,
    runSummary,
    load,
    save,
    resetForm,
    edit,
    remove,
    exportJson,
    importJson,
    runSimulation,
    saveSimulationAsTestCase,
    runOneTest,
    runAllTests,
    removeTest,
  } = useAbacPolicies();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>ABAC Policy Engine</h2>
          <p className="muted">Manage zero-trust attribute-based rules across domains.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="btn-secondary" onClick={exportJson} disabled={loading || importing}>
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
          <div className="welcome-actions mt-10">
            <button type="button" className="btn-primary" onClick={save}>{editingId ? "Update Policy" : "Create Policy"}</button>
            <button type="button" className="btn-secondary" onClick={resetForm}>Reset</button>
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
                    <button type="button" className="btn-secondary" onClick={() => edit(row)}>Edit</button>
                    <button type="button" className="btn-danger" onClick={() => remove(row._id)}>Delete</button>
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
          <div className="welcome-actions mt-10">
            <button type="button" className="btn-primary" onClick={runSimulation} disabled={simulating}>
              {simulating ? "Simulating..." : "Run Simulation"}
            </button>
            <button
              type="button"
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
          <div className="welcome-actions mb-10">
            <button type="button" className="btn-primary" onClick={runAllTests} disabled={runningAllTests}>
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
                    <button type="button" className="btn-secondary" onClick={() => runOneTest(tc._id)}>
                      Run
                    </button>
                    <button type="button" className="btn-danger" onClick={() => removeTest(tc._id)}>
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
