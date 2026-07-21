import { useCallback, useEffect, useState } from "react";
import {
  listPilotOnboarding,
  updatePilotOnboardingItem,
  upsertPilotOnboarding,
} from "../services/opsApi";

const DEFAULT_ITEMS = [
  { key: "governance", title: "Governance and legal onboarding complete" },
  { key: "identity", title: "Admin identity and 2FA setup complete" },
  { key: "data_migration", title: "Initial data migration validated" },
  { key: "integrations", title: "FHIR/HL7 integrations smoke-tested" },
  { key: "training", title: "Role-based training completed" },
  { key: "dr_drill", title: "DR and incident drill completed" },
  { key: "go_live", title: "Go-live readiness sign-off" },
];

export function usePilotOnboardingOps() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [hospital, setHospital] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await listPilotOnboarding({ hospital: hospital || undefined });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setMessage(err?.message || "Failed to load onboarding checklists.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [hospital]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(t);
  }, [load]);

  const createChecklist = useCallback(async () => {
    if (!hospital.trim()) {
      setMessage("Hospital ID is required for creating a checklist.");
      return;
    }
    setBusy("create");
    setMessage("");
    try {
      await upsertPilotOnboarding({ hospital, items: DEFAULT_ITEMS });
      await load();
      setMessage("Pilot onboarding checklist created/updated.");
    } catch (err) {
      setMessage(err?.message || "Failed to create checklist.");
    } finally {
      setBusy("");
    }
  }, [hospital, load]);

  const toggleItem = useCallback(async (checklist, key, completed) => {
    setBusy(`${checklist._id}:${key}`);
    setMessage("");
    try {
      await updatePilotOnboardingItem(checklist._id, key, { completed: !completed });
      await load();
    } catch (err) {
      setMessage(err?.message || "Failed to update checklist item.");
    } finally {
      setBusy("");
    }
  }, [load]);

  return {
    items,
    loading,
    busy,
    message,
    hospital,
    setHospital,
    load,
    createChecklist,
    toggleItem,
  };
}

export default usePilotOnboardingOps;
