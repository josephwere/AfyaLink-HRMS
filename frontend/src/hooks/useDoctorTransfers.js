import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadApiFile } from "../lib/api/client";
import { getTransferConsent, getTransferHandoverPackage, listTransfers } from "../services/transferApi";

export function useDoctorTransfers(status = "") {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState({ consent: null, handover: null });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listTransfers({ status, limit: 50, scope: "mine" });
      const items = Array.isArray(res?.items) ? res.items : [];
      setRows(items);
      if (!selectedId && items[0]?._id) {
        setSelectedId(String(items[0]._id));
      }
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

  const selected = useMemo(() => rows.find((row) => String(row._id) === String(selectedId)) || null, [rows, selectedId]);

  const loadDetail = useCallback(async (transferId) => {
    if (!transferId) {
      setDetail({ consent: null, handover: null });
      return;
    }
    setDetailLoading(true);
    try {
      const [consentData, handoverData] = await Promise.all([
        getTransferConsent(transferId).catch(() => null),
        getTransferHandoverPackage(transferId).catch(() => null),
      ]);
      setDetail({ consent: consentData || null, handover: handoverData || null });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail({ consent: null, handover: null });
    }
  }, [loadDetail, selectedId]);

  const downloadTransferBundle = useCallback(async (transferId, format = "fhir") => {
    if (!transferId) return;
    await downloadApiFile(`/api/transfers/${transferId}/${format}`, {
      method: "GET",
      filename: `${transferId}.${format}`,
    });
  }, []);

  return {
    rows,
    selectedId,
    setSelectedId,
    detail,
    loading,
    detailLoading,
    error,
    selected,
    load,
    downloadTransferBundle,
  };
}

export default useDoctorTransfers;
