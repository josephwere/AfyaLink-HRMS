import { useCallback, useEffect, useMemo, useState } from "react";
import { listTransfers, verifyTransferProvenance } from "../services/transferApi";

export function useProvenanceVerify() {
  const [transfers, setTransfers] = useState([]);
  const [transferId, setTransferId] = useState("");
  const [payload, setPayload] = useState("{}");
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(null);

  const loadTransfers = useCallback(async () => {
    try {
      const data = await listTransfers({ limit: 50, scope: "global" });
      const items = Array.isArray(data?.items) ? data.items : [];
      setTransfers(items);
      if (!transferId && items[0]?._id) setTransferId(items[0]._id);
    } catch {
      setTransfers([]);
    }
  }, [transferId]);

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  const selectedTransfer = useMemo(
    () => transfers.find((item) => item._id === transferId) || null,
    [transferId, transfers]
  );

  const verify = useCallback(async () => {
    setLoading(true);
    setMsg("");
    setResult(null);
    try {
      const parsed = JSON.parse(payload || "{}");
      const out = await verifyTransferProvenance({
        transferId,
        payload: parsed,
        signature,
      });
      setResult(out);
    } catch (e) {
      setMsg(e?.message || "Failed to verify provenance");
    } finally {
      setLoading(false);
    }
  }, [payload, signature, transferId]);

  return {
    transfers,
    transferId,
    setTransferId,
    payload,
    setPayload,
    signature,
    setSignature,
    loading,
    msg,
    result,
    selectedTransfer,
    loadTransfers,
    verify,
  };
}

export default useProvenanceVerify;
