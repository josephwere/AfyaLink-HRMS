import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createGovernmentHospitalRegistryEntry,
  importGovernmentHospitalRegistry,
  listGovernmentHospitalRegistry,
} from "../services/systemAdminApi";

const defaultForm = {
  officialName: "",
  registrationNumber: "",
  hospitalType: "PRIVATE",
  country: "",
  region: "",
  city: "",
  address: "",
  email: "",
  phone: "",
  validUntil: "",
};

export function useGovernmentHospitalRegistry(options = {}) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState(options.initialQ || "");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [bulk, setBulk] = useState("");
  const [form, setForm] = useState(defaultForm);
  const highlightedText = useMemo(() => {
    if (options.highlightText) return String(options.highlightText).toLowerCase();
    return String(q || "").toLowerCase();
  }, [options.highlightText, q]);

  const load = useCallback(async (searchText = q) => {
    try {
      const rows = await listGovernmentHospitalRegistry({ q: searchText || undefined });
      setItems(rows);
    } catch {
      setItems([]);
    }
  }, [q]);

  useEffect(() => {
    void load(q);
  }, [load, q]);

  const submit = useCallback(async (event) => {
    event?.preventDefault?.();
    setLoading(true);
    setMsg("");
    try {
      await createGovernmentHospitalRegistryEntry(form);
      setMsg("Government registry entry saved.");
      setForm(defaultForm);
      await load(q);
    } catch (err) {
      setMsg(err?.message || "Failed to save registry entry.");
    } finally {
      setLoading(false);
    }
  }, [form, load, q]);

  const runImport = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await importGovernmentHospitalRegistry(bulk);
      setMsg(`Imported ${res?.created?.length || 0} entries. Skipped ${res?.skipped?.length || 0}.`);
      await load(q);
    } catch (err) {
      setMsg(err?.message || "Failed to import registry entries.");
    } finally {
      setLoading(false);
    }
  }, [bulk, load, q]);

  return {
    items,
    q,
    setQ,
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

export default useGovernmentHospitalRegistry;
