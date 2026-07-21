import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPatientIdentityRegistryEntry,
  importPatientIdentityRegistry,
  listPatientIdentityRegistry,
} from "../services/systemAdminApi";

const defaultForm = {
  country: "",
  idType: "NATIONAL_ID",
  idNumber: "",
  firstName: "",
  lastName: "",
  dob: "",
  gender: "",
  status: "ACTIVE",
};

export function usePatientIdentityRegistry(options = {}) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState(options.initialQ || "");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [bulk, setBulk] = useState("");
  const [form, setForm] = useState(defaultForm);
  const highlightedText = useMemo(() => {
    if (options.highlightText) return String(options.highlightText).toLowerCase();
    return String(q || "").toLowerCase();
  }, [options.highlightText, q]);

  const load = useCallback(async (searchTerm = q, selectedCountry = country, selectedStatus = status) => {
    try {
      const rows = await listPatientIdentityRegistry({
        q: searchTerm || undefined,
        country: selectedCountry || undefined,
        status: selectedStatus || undefined,
      });
      setItems(rows);
    } catch {
      setItems([]);
    }
  }, [country, q, status]);

  useEffect(() => {
    void load(q, country, status);
  }, [country, load, q, status]);

  const submit = useCallback(async (event) => {
    event?.preventDefault?.();
    setLoading(true);
    setMsg("");
    try {
      await createPatientIdentityRegistryEntry(form);
      setMsg("Patient identity entry saved.");
      setForm(defaultForm);
      await load(q, country, status);
    } catch (err) {
      setMsg(err?.message || "Failed to save identity entry.");
    } finally {
      setLoading(false);
    }
  }, [country, form, load, q, status]);

  const runImport = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await importPatientIdentityRegistry(bulk);
      setMsg(`Imported ${res?.created?.length || 0} entries. Skipped ${res?.skipped?.length || 0}.`);
      await load(q, country, status);
    } catch (err) {
      setMsg(err?.message || "Failed to import identity entries.");
    } finally {
      setLoading(false);
    }
  }, [bulk, country, load, q, status]);

  return {
    items,
    q,
    setQ,
    country,
    setCountry,
    status,
    setStatus,
    msg,
    setMsg,
    loading,
    bulk,
    setBulk,
    form,
    setForm,
    highlightedText,
    submit,
    runImport,
    load,
  };
}

export default usePatientIdentityRegistry;
