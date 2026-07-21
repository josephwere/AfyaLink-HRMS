import { useEffect, useState } from "react";
import { listTransfers } from "../services/transferApi";

export function useBranchesPage() {
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    let active = true;
    listTransfers({ limit: 6, scope: "facility" })
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        if (!active) return;
        setTransfers([]);
        setTransferError(err?.message || "Unable to load transfers.");
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    transfers,
    transferError,
    pendingTransfers: transfers.filter((t) => t.status === "Pending").length,
  };
}

export default useBranchesPage;
