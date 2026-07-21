import { useCallback, useEffect, useMemo, useState } from "react";
import { createClaimRule, listClaimRules, updateClaimRule } from "../services/systemAdminApi";

const RULE_TYPES = [
  "MAX_PER_WINDOW",
  "AGE_LIMIT",
  "GENDER_ONLY",
  "COOLDOWN_DAYS",
];

export function useClaimRules() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ country: "", ruleType: "", enabled: "" });
  const [form, setForm] = useState({
    country: "",
    ruleType: "MAX_PER_WINDOW",
    procedureCode: "",
    procedureCategory: "",
    maxPerWindow: "",
    windowDays: "",
    minAge: "",
    maxAge: "",
    allowedGenders: "",
    cooldownDays: "",
    severity: "MEDIUM",
    enabled: true,
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const rows = await listClaimRules({
        country: filters.country || undefined,
        ruleType: filters.ruleType || undefined,
        enabled: filters.enabled === "" ? undefined : filters.enabled === "true",
      });
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setMsg(err?.message || "Failed to load claim rules.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters.country, filters.ruleType, filters.enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = useCallback(() => {
    setForm({
      country: "",
      ruleType: "MAX_PER_WINDOW",
      procedureCode: "",
      procedureCategory: "",
      maxPerWindow: "",
      windowDays: "",
      minAge: "",
      maxAge: "",
      allowedGenders: "",
      cooldownDays: "",
      severity: "MEDIUM",
      enabled: true,
      notes: "",
    });
  }, []);

  const createRule = useCallback(async (payload) => {
    setLoading(true);
    setMsg("");
    try {
      await createClaimRule({
        ...form,
        ...payload,
        country: (payload?.country ?? form.country) || "",
        procedureCode: (payload?.procedureCode ?? form.procedureCode) || "",
        procedureCategory: (payload?.procedureCategory ?? form.procedureCategory) || "",
        maxPerWindow: payload?.maxPerWindow ?? form.maxPerWindow ? Number(payload?.maxPerWindow ?? form.maxPerWindow) : null,
        windowDays: payload?.windowDays ?? form.windowDays ? Number(payload?.windowDays ?? form.windowDays) : null,
        minAge: payload?.minAge ?? form.minAge ? Number(payload?.minAge ?? form.minAge) : null,
        maxAge: payload?.maxAge ?? form.maxAge ? Number(payload?.maxAge ?? form.maxAge) : null,
        cooldownDays: payload?.cooldownDays ?? form.cooldownDays ? Number(payload?.cooldownDays ?? form.cooldownDays) : null,
        allowedGenders: payload?.allowedGenders ?? form.allowedGenders,
      });
      setMsg("Claim rule saved.");
      resetForm();
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to save claim rule.");
    } finally {
      setLoading(false);
    }
  }, [form, load, resetForm]);

  const toggleRule = useCallback(async (rule) => {
    setLoading(true);
    setMsg("");
    try {
      await updateClaimRule(rule._id, { enabled: !rule.enabled });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to update rule.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  const ruleTypes = useMemo(() => RULE_TYPES, []);

  return {
    items,
    msg,
    loading,
    filters,
    form,
    setFilters,
    setForm,
    createRule,
    toggleRule,
    load,
    resetForm,
    ruleTypes,
  };
}

export default useClaimRules;
