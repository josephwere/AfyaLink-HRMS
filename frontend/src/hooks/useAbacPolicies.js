import { useCallback, useEffect, useState } from "react";
import {
  createAbacPolicy,
  createAbacTestCase,
  deleteAbacPolicy,
  deleteAbacTestCase,
  listAbacPolicies,
  listAbacTestCases,
  runAbacTestCase,
  runAllAbacTestCases,
  simulateAbacPolicy,
  updateAbacPolicy,
} from "../services/systemAdminApi";

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

export function useAbacPolicies() {
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [out, tests] = await Promise.all([listAbacPolicies(), listAbacTestCases()]);
      setItems(Array.isArray(out) ? out : []);
      setTestCases(Array.isArray(tests) ? tests : []);
    } catch (err) {
      setMsg(err?.message || "Failed to load ABAC policies");
      setItems([]);
      setTestCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toPayload = useCallback(() => ({
    domain: form.domain,
    resource: form.resource,
    action: form.action,
    effect: form.effect,
    roles: String(form.roles || "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
    priority: Number(form.priority || 100),
    active: Boolean(form.active),
    conditions: {
      requireActiveConsent: Boolean(form.requireActiveConsent),
      requireSameHospitalOrPrivileged: Boolean(form.requireSameHospitalOrPrivileged),
      requiredScopes: String(form.requiredScopes || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    },
  }), [form]);

  const save = useCallback(async () => {
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
    } catch (err) {
      setMsg(err?.message || "Failed to save ABAC policy");
    }
  }, [editingId, load, toPayload]);

  const resetForm = useCallback(() => {
    setForm(EMPTY);
    setEditingId(null);
  }, []);

  const edit = useCallback((row) => {
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
      requireSameHospitalOrPrivileged: row.conditions?.requireSameHospitalOrPrivileged === true,
      requiredScopes: Array.isArray(row.conditions?.requiredScopes)
        ? row.conditions.requiredScopes.join(",")
        : "",
    });
  }, []);

  const remove = useCallback(async (id) => {
    try {
      await deleteAbacPolicy(id);
      setMsg("ABAC policy deleted");
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to delete ABAC policy");
    }
  }, [load]);

  const exportJson = useCallback(() => {
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
    const link = document.createElement("a");
    link.href = url;
    link.download = "abac-policies.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [items]);

  const importJson = useCallback(async (file) => {
    if (!file) return;
    setImporting(true);
    setMsg("");
    try {
      const text = await file.text();
      const rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error("JSON must be an array of policies");

      const existing = await listAbacPolicies();
      const byKey = new Map(existing.map((row) => [keyOf(row), row]));
      let created = 0;
      let updated = 0;

      for (const row of rows) {
        const payload = {
          domain: String(row.domain || "").toUpperCase(),
          resource: String(row.resource || "").toLowerCase(),
          action: String(row.action || "").toLowerCase(),
          effect: String(row.effect || "ALLOW").toUpperCase(),
          roles: Array.isArray(row.roles)
            ? row.roles.map((value) => String(value || "").toUpperCase()).filter(Boolean)
            : [],
          priority: Number(row.priority || 100),
          active: row.active !== false,
          conditions: {
            requireActiveConsent: row?.conditions?.requireActiveConsent === true,
            requireSameHospitalOrPrivileged: row?.conditions?.requireSameHospitalOrPrivileged === true,
            requiredScopes: Array.isArray(row?.conditions?.requiredScopes)
              ? row.conditions.requiredScopes.map((value) => String(value || "").toLowerCase()).filter(Boolean)
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
    } catch (err) {
      setMsg(err?.message || "Failed to import ABAC policies");
    } finally {
      setImporting(false);
    }
  }, [load]);

  const runSimulation = useCallback(async () => {
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
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      };
      const out = await simulateAbacPolicy(payload);
      setSimResult(out);
    } catch (err) {
      setMsg(err?.message || "Failed to run ABAC simulation");
    } finally {
      setSimulating(false);
    }
  }, [simForm]);

  const saveSimulationAsTestCase = useCallback(async () => {
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
            .map((value) => value.trim().toLowerCase())
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
    } catch (err) {
      setMsg(err?.message || "Failed to save test case");
    }
  }, [load, simForm, simResult]);

  const runOneTest = useCallback(async (id) => {
    try {
      const out = await runAbacTestCase(id);
      setMsg(`Test ${out?.name || id}: ${out?.passed ? "PASSED" : "FAILED"} (${out?.decision?.reason || "n/a"})`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to run test case");
    }
  }, [load]);

  const runAllTests = useCallback(async () => {
    setRunningAllTests(true);
    setRunSummary(null);
    setMsg("");
    try {
      const out = await runAllAbacTestCases();
      setRunSummary(out?.totals || null);
      setMsg(`ABAC test run complete: ${out?.totals?.passed || 0} passed, ${out?.totals?.failed || 0} failed.`);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to run all test cases");
    } finally {
      setRunningAllTests(false);
    }
  }, [load]);

  const removeTest = useCallback(async (id) => {
    try {
      await deleteAbacTestCase(id);
      setMsg("Test case deleted.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to delete test case");
    }
  }, [load]);

  return {
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
  };
}

export default useAbacPolicies;
