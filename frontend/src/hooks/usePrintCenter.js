import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import {
  createPrinterProfile,
  getPrintingConnectors,
  listPrinterProfiles,
  listPrintJobs,
  printHtmlDocument,
  queuePrintJob,
  updatePrinterProfile,
  updatePrintJobStatus,
} from "../services/printingApi";

const DEFAULT_FORM = {
  name: "",
  provider: "BROWSER",
  location: "",
  description: "",
  isDefault: false,
  enabled: true,
  config: {
    ippUrl: "",
    queueName: "",
    paperSize: "A4",
    duplex: false,
    color: true,
    copiesDefault: 1,
  },
};

export function usePrintCenter({ user }) {
  const [profiles, setProfiles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [connectors, setConnectors] = useState(null);
  const [profileForm, setProfileForm] = useState(DEFAULT_FORM);
  const [testTitle, setTestTitle] = useState("AfyaLink Test Print");
  const [testBody, setTestBody] = useState("This is a printer connectivity test.");
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const canManageProfiles = useMemo(() => {
    const role = String(user?.actualRole || user?.role || "").toUpperCase();
    return ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(role);
  }, [user]);

  const load = useCallback(async () => {
    const [p, j, c] = await Promise.all([
      Promise.resolve(listPrinterProfiles()).catch(() => ({ items: [] })),
      Promise.resolve(listPrintJobs({ limit: 50 })).catch(() => ({ items: [] })),
      Promise.resolve(getPrintingConnectors()).catch(() => ({ connectors: {} })),
    ]);
    const items = p?.items || [];
    setProfiles(items);
    setJobs(j?.items || []);
    setConnectors(c?.connectors || {});
    setSelectedPrinterId((prev) => prev || items.find((x) => x.isDefault)?._id || items[0]?._id || "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = useCallback(async (e) => {
    e.preventDefault();
    if (!canManageProfiles) return;
    setBusy(true);
    setMsg("");
    try {
      await createPrinterProfile(profileForm);
      setProfileForm(DEFAULT_FORM);
      setMsg("Printer profile saved.");
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to save printer profile");
    } finally {
      setBusy(false);
    }
  }, [canManageProfiles, load, profileForm]);

  const togglePrinter = useCallback(async (item, patch) => {
    setBusy(true);
    setMsg("");
    try {
      await updatePrinterProfile(item._id, patch);
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to update printer");
    } finally {
      setBusy(false);
    }
  }, [load]);

  const queueTestPrint = useCallback(async () => {
    if (!selectedPrinterId) {
      setMsg("Select printer profile first.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await queuePrintJob({
        printerProfileId: selectedPrinterId,
        documentType: "GENERAL",
        title: testTitle,
        payload: {
          text: testBody,
          createdBy: user?.name || user?.email || "Unknown",
          createdAt: new Date().toISOString(),
        },
      });
      setMsg(`Print job queued: ${res?.job?._id || "ok"}`);
      if (res?.printableHtml) {
        printHtmlDocument(res.printableHtml, testTitle);
      }
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to queue print test");
    } finally {
      setBusy(false);
    }
  }, [load, selectedPrinterId, testBody, testTitle, user?.email, user?.name]);

  const updateJob = useCallback(async (id, status) => {
    setBusy(true);
    setMsg("");
    try {
      await updatePrintJobStatus(id, { status });
      await load();
    } catch (err) {
      setMsg(err?.message || "Failed to update job");
    } finally {
      setBusy(false);
    }
  }, [load]);

  return {
    profiles,
    jobs,
    connectors,
    profileForm,
    setProfileForm,
    testTitle,
    setTestTitle,
    testBody,
    setTestBody,
    selectedPrinterId,
    setSelectedPrinterId,
    busy,
    msg,
    setMsg,
    canManageProfiles,
    load,
    saveProfile,
    togglePrinter,
    queueTestPrint,
    updateJob,
  };
}

export default usePrintCenter;
