import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listMyTransfers,
  patientGrantTransferConsent,
  patientRevokeTransferConsent,
} from "../services/transferApi";

const CONSENT_SCOPES = ["demographics", "encounters", "labs", "prescriptions", "reports"];
const DEFAULT_SCOPES = ["demographics", "encounters", "labs", "prescriptions"];

export function usePatientTransfers() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [consentDraft, setConsentDraft] = useState({ scopes: DEFAULT_SCOPES, expiresInDays: 30 });
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listMyTransfers({ status, limit: 50 });
      const items = Array.isArray(res?.items) ? res.items : [];
      setRows(items);
      if (!selectedId && items[0]?._id) setSelectedId(String(items[0]._id));
    } catch (err) {
      setError(err?.message || "Failed to load transfers.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((row) => String(row._id) === String(selectedId)) || rows[0] || null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (!selected?.consent) return;
    const scopes = Array.isArray(selected.consent.scopes) && selected.consent.scopes.length
      ? selected.consent.scopes
      : DEFAULT_SCOPES;
    const expiresAt = selected.consent.expiresAt ? new Date(selected.consent.expiresAt) : null;
    const expiresInDays = expiresAt ? Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 30;
    setConsentDraft({ scopes, expiresInDays });
  }, [selected?.consent?.updatedAt]);

  const toggleScope = useCallback((scope, value) => {
    setConsentDraft((prev) => {
      const set = new Set(prev.scopes || []);
      if (value) set.add(scope);
      else set.delete(scope);
      return { ...prev, scopes: Array.from(set) };
    });
  }, []);

  const grantConsent = useCallback(async () => {
    let row = selected || rows[0] || null;
    if (!row) {
      const res = await listMyTransfers({ status, limit: 50 });
      const items = Array.isArray(res?.items) ? res.items : [];
      setRows(items);
      if (!selectedId && items[0]?._id) setSelectedId(String(items[0]._id));
      row = items[0] || null;
    }
    if (!row) return;
    setMsg("");
    setError("");
    setBusy("grant");
    try {
      const expiresIn = Number(consentDraft.expiresInDays || 0);
      const expiresAt = expiresIn > 0
        ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      await patientGrantTransferConsent(row._id, {
        scopes: consentDraft.scopes,
        expiresAt,
      });
      setMsg("Consent granted.");
      await load();
    } catch (err) {
      setError(err?.message || "Failed to grant consent.");
    } finally {
      setBusy("");
    }
  }, [consentDraft.expiresInDays, consentDraft.scopes, load, rows, selected, selectedId, status]);

  const revokeConsent = useCallback(async () => {
    let row = selected || rows[0] || null;
    if (!row) {
      const res = await listMyTransfers({ status, limit: 50 });
      const items = Array.isArray(res?.items) ? res.items : [];
      setRows(items);
      if (!selectedId && items[0]?._id) setSelectedId(String(items[0]._id));
      row = items[0] || null;
    }
    if (!row) return;
    setMsg("");
    setError("");
    setBusy("revoke");
    try {
      await patientRevokeTransferConsent(row._id);
      setMsg("Consent revoked.");
      await load();
    } catch (err) {
      setError(err?.message || "Failed to revoke consent.");
    } finally {
      setBusy("");
    }
  }, [load, rows, selected, selectedId, status]);

  return {
    rows,
    setRows,
    status,
    setStatus,
    loading,
    msg,
    setMsg,
    error,
    setError,
    selectedId,
    setSelectedId,
    consentDraft,
    setConsentDraft,
    busy,
    setBusy,
    selected,
    CONSENT_SCOPES,
    DEFAULT_SCOPES,
    load,
    toggleScope,
    grantConsent,
    revokeConsent,
  };
}

export default usePatientTransfers;
