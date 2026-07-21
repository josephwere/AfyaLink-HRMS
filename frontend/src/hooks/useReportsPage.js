import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import { listReports, listMyReports, createReport, deleteReport } from "../services/reportsApi";
import { listTransfers } from "../services/transferApi";

export function useReportsPage() {
  const { user } = useAuth();
  const role = user?.role || "";
  const canSeeAll = ["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"].includes(role);
  const canCreate = ["DOCTOR"].includes(role);
  const canSeeMine = ["DOCTOR", "PATIENT"].includes(role);

  const [allReports, setAllReports] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [allNextCursor, setAllNextCursor] = useState(null);
  const [myNextCursor, setMyNextCursor] = useState(null);
  const [allHasMore, setAllHasMore] = useState(false);
  const [myHasMore, setMyHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tab, setTab] = useState(canSeeAll ? "all" : "mine");
  const [error, setError] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  const [form, setForm] = useState({ title: "", content: "", patient: "" });

  useEffect(() => {
    if (canSeeAll) {
      listReports({ cursorMode: true, limit: 25 })
        .then((data) => {
          const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          setAllReports(items);
          setAllNextCursor(data?.nextCursor || null);
          setAllHasMore(Boolean(data?.hasMore));
        })
        .catch(() => {
          setAllReports([]);
          setAllNextCursor(null);
          setAllHasMore(false);
        });
    }
    if (canSeeMine) {
      listMyReports({ cursorMode: true, limit: 25 })
        .then((data) => {
          const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          setMyReports(items);
          setMyNextCursor(data?.nextCursor || null);
          setMyHasMore(Boolean(data?.hasMore));
        })
        .catch(() => {
          setMyReports([]);
          setMyNextCursor(null);
          setMyHasMore(false);
        });
    }
  }, [canSeeAll, canSeeMine]);

  useEffect(() => {
    listTransfers({ limit: 6, scope: "facility" })
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Unable to load transfers.");
      });
  }, []);

  const current = useMemo(() => (tab === "all" ? allReports : myReports), [allReports, myReports, tab]);
  const canLoadMore = tab === "all" ? allHasMore : myHasMore;

  const onCreate = useCallback(async () => {
    setError("");
    if (!form.title || !form.content) {
      setError("Title and content are required.");
      return;
    }
    try {
      const payload = {
        title: form.title,
        content: form.content,
        ...(form.patient ? { patient: form.patient } : {}),
      };
      const created = await createReport(payload);
      setForm({ title: "", content: "", patient: "" });
      setMyReports((prev) => [created, ...prev]);
    } catch (e) {
      setError(e?.message || "Failed to create report");
    }
  }, [form]);

  const onDelete = useCallback(async (id) => {
    try {
      await deleteReport(id);
      setAllReports((prev) => prev.filter((r) => r._id !== id));
      setMyReports((prev) => prev.filter((r) => r._id !== id));
    } catch (e) {
      setError(e?.message || "Failed to delete report");
    }
  }, []);

  const onLoadMore = useCallback(async () => {
    setLoadingMore(true);
    setError("");
    try {
      if (tab === "all") {
        const data = await listReports({ cursorMode: true, limit: 25, cursor: allNextCursor });
        const items = Array.isArray(data?.items) ? data.items : [];
        setAllReports((prev) => [...prev, ...items]);
        setAllNextCursor(data?.nextCursor || null);
        setAllHasMore(Boolean(data?.hasMore));
      } else {
        const data = await listMyReports({ cursorMode: true, limit: 25, cursor: myNextCursor });
        const items = Array.isArray(data?.items) ? data.items : [];
        setMyReports((prev) => [...prev, ...items]);
        setMyNextCursor(data?.nextCursor || null);
        setMyHasMore(Boolean(data?.hasMore));
      }
    } catch (e) {
      setError(e?.message || "Failed to load more reports");
    } finally {
      setLoadingMore(false);
    }
  }, [allNextCursor, myNextCursor, tab]);

  return {
    canSeeAll,
    canCreate,
    canSeeMine,
    current,
    canLoadMore,
    loadingMore,
    tab,
    setTab,
    error,
    transfers,
    transferError,
    form,
    setForm,
    onCreate,
    onDelete,
    onLoadMore,
  };
}

export default useReportsPage;
