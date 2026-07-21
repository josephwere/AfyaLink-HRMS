import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import { getSecurityOfficerDashboard } from "../services/dashboardApi";
import {
  bookVisitorAccess,
  checkInAccess,
  checkOutAccess,
  getAccessLogs,
  getLiveOccupancy,
  verifyAccessCode,
} from "../services/securityAccessApi";
import { listTransfers } from "../services/transferApi";

export function useSecurityOfficerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [inside, setInside] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [visitorForm, setVisitorForm] = useState({
    fullName: "",
    phone: "",
    idNumber: "",
    purpose: "",
    expiresAt: "",
  });
  const [code, setCode] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      getSecurityOfficerDashboard().catch(() => null),
      getAccessLogs({ limit: 10 }).catch(() => ({ items: [] })),
      getLiveOccupancy().catch(() => ({ peopleInside: [] })),
    ]).then(([dash, logRes, live]) => {
      if (!active) return;
      setData(dash);
      setLogs(logRes?.items || []);
      setInside(live?.peopleInside || []);
    });

    listTransfers({ limit: 8, scope: "facility" })
      .then((res) => {
        if (!active) return;
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setTransfers(items);
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

  const accessCode = useMemo(() => (verifyResult?.person ? code : ""), [verifyResult, code]);
  const pendingTransfers = useMemo(
    () => transfers.filter((t) => String(t?.status || "").toUpperCase() === "PENDING").length,
    [transfers]
  );

  const refreshPanels = async () => {
    const [logRes, live] = await Promise.all([
      getAccessLogs({ limit: 10 }).catch(() => ({ items: [] })),
      getLiveOccupancy().catch(() => ({ peopleInside: [] })),
    ]);
    setLogs(logRes?.items || []);
    setInside(live?.peopleInside || []);
  };

  const onBookVisitor = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const payload = {
        ...visitorForm,
        expiresAt: new Date(visitorForm.expiresAt).toISOString(),
      };
      const res = await bookVisitorAccess(payload);
      setMsg(`Visitor booked. Access code: ${res.accessCode}`);
      setVisitorForm({ fullName: "", phone: "", idNumber: "", purpose: "", expiresAt: "" });
      await refreshPanels();
    } catch (err) {
      setMsg(err?.message || "Failed to book visitor");
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await verifyAccessCode({ code });
      setVerifyResult(res);
      setMsg(`Verification: ${res.status}${res?.emergency ? " (Emergency override)" : ""}`);
    } catch (err) {
      setVerifyResult(null);
      setMsg(err?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const onCheckIn = async () => {
    setBusy(true);
    setMsg("");
    try {
      await checkInAccess({ code: accessCode });
      setMsg("Check-in successful");
      await refreshPanels();
    } catch (err) {
      setMsg(err?.message || "Check-in failed");
    } finally {
      setBusy(false);
    }
  };

  const onCheckOut = async () => {
    setBusy(true);
    setMsg("");
    try {
      await checkOutAccess({ code: accessCode });
      setMsg("Check-out successful");
      await refreshPanels();
    } catch (err) {
      setMsg(err?.message || "Check-out failed");
    } finally {
      setBusy(false);
    }
  };

  return {
    user,
    data,
    logs,
    inside,
    msg,
    busy,
    visitorForm,
    setVisitorForm,
    code,
    setCode,
    verifyResult,
    transfers,
    transferError,
    accessCode,
    pendingTransfers,
    refreshPanels,
    onBookVisitor,
    onVerify,
    onCheckIn,
    onCheckOut,
  };
}

export default useSecurityOfficerDashboard;
