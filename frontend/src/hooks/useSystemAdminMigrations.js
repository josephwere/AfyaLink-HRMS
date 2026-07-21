import { useCallback, useEffect, useState } from "react";
import {
  createMigrationProject,
  listMigrationProjects,
  startMigrationDryRun,
} from "../services/systemAdminApi";

const defaultForm = {
  name: "",
  sourceName: "",
  vendor: "",
  type: "OTHER",
  mode: "HYBRID",
  aiEngine: "NEUROEDGE",
};

export function useSystemAdminMigrations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const data = await listMigrationProjects();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setMsg(err?.message || "Failed to load migration projects");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createProject = useCallback(async (e) => {
    e?.preventDefault?.();
    setMsg("");
    try {
      await createMigrationProject({
        name: form.name,
        sourceSystem: {
          name: form.sourceName,
          vendor: form.vendor,
          type: form.type,
          interoperability: ["FHIR", "HL7v2"],
        },
        strategy: {
          mode: form.mode,
          aiEngine: form.aiEngine,
          dualWrite: true,
        },
      });
      setForm(defaultForm);
      setMsg("Migration project created.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to create migration project");
    }
  }, [form.aiEngine, form.mode, form.name, form.sourceName, form.type, form.vendor, load]);

  const startDryRun = useCallback(async (id) => {
    setMsg("");
    try {
      await startMigrationDryRun(id);
      setMsg("Dry run started.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to start dry run");
    }
  }, [load]);

  return {
    items,
    loading,
    msg,
    form,
    setForm,
    load,
    createProject,
    startDryRun,
  };
}

export default useSystemAdminMigrations;
