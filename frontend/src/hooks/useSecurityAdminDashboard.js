import { useEffect, useMemo, useState } from "react";
import { getSecurityAdminDashboard } from "../services/dashboardApi";
import {
  bookInternalAccess,
  getAccessLogs,
  getOverstays,
  getSecurityAlerts,
  searchUsersForAccess,
} from "../services/securityAccessApi";
import { listTransfers } from "../services/transferApi";

export function useSecurityAdminDashboard() {
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [overstays, setOverstays] = useState([]);
  const [logs, setLogs] = useState([]);
  const [staffQ, setStaffQ] = useState("");
  const [staffOptions, setStaffOptions] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  const [internalForm, setInternalForm] = useState({
    personType: "CONTRACTOR",
    purpose: "",
    expiresAt: "",
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      getSecurityAdminDashboard().catch(() => null),
      getSecurityAlerts().catch(() => ({ alerts: [] })),
      getOverstays().catch(() => ({ overstayed: [] })),
      getAccessLogs({ limit: 12 }).catch(() => ({ items: [] })),
    ]).then(([dash, a, o, l]) => {
      if (!active) return;
      setData(dash);
      setAlerts(a?.alerts || []);
      setOverstays(o?.overstayed || []);
      setLogs(l?.items || []);
    });

    listTransfers({ limit: 8, scope: "facility" })
      .then((res) => {
        if (!active) return;
        setTransfers(Array.isArray(res?.items) ? res.items : []);
        setTransferError("");
      })
      .catch((err) => {
        if (!active) return;
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!staffQ.trim()) {
        setStaffOptions([]);
        return;
      }
      try {
        const out = await searchUsersForAccess({ q: staffQ.trim(), limit: 20 });
        setStaffOptions(out?.items || []);
      } catch {
        setStaffOptions([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [staffQ]);

  const pendingTransfers = useMemo(
    () => transfers.filter((t) => String(t?.status || "").toUpperCase() === "PENDING").length,
    [transfers]
  );

  const selectedStaffLabel = useMemo(
    () => staffOptions.find((u) => u._id === selectedStaff)?.name || "",
    [selectedStaff, staffOptions]
  );

  const onBookInternal = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await bookInternalAccess({
        personRef: selectedStaff,
        personType: internalForm.personType,
        purpose: internalForm.purpose,
        expiresAt: new Date(internalForm.expiresAt).toISOString(),
      });
      setMsg(`Internal access created. Code: ${res.accessCode}`);
      setSelectedStaff("");
      setStaffQ("");
      setInternalForm({ personType: "CONTRACTOR", purpose: "", expiresAt: "" });
    } catch (err) {
      setMsg(err?.message || "Failed to grant internal access");
    } finally {
      setBusy(false);
    }
  };

  return {
    data,
    alerts,
    overstays,
    logs,
    staffQ,
    setStaffQ,
    staffOptions,
    selectedStaff,
    setSelectedStaff,
    msg,
    setMsg,
    busy,
    transfers,
    transferError,
    pendingTransfers,
    internalForm,
    setInternalForm,
    selectedStaffLabel,
    onBookInternal,
  };
}

export default useSecurityAdminDashboard;
