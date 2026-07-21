import { useEffect, useMemo, useState } from "react";
import { listInventory } from "../services/inventoryApi";
import { listTransfers } from "../services/transferApi";

export function useInventoryPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listInventory({ q, page, limit: 25 })
      .then((res) => {
        if (!active) return;
        setItems(res.items || []);
        setTotal(res.total || 0);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load inventory.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    listTransfers({ limit: 6, scope: "facility" })
      .then((res) => {
        if (!active) return;
        const itemsList = Array.isArray(res?.items) ? res.items : [];
        setTransfers(itemsList);
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
  }, [q, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 25)), [total]);

  return {
    items,
    q,
    setQ,
    page,
    setPage,
    total,
    loading,
    error,
    transfers,
    transferError,
    totalPages,
  };
}

export default useInventoryPage;
