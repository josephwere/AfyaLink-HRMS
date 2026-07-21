import { useCallback, useEffect, useState } from "react";
import localforage from "localforage";
import { uploadOfflineSyncItems } from "../services/offlineOpsApi";

localforage.config({ name: "AfyaLinkOffline" });

export function useOfflineSync() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const keys = await localforage.keys();
      const arr = [];
      for (const key of keys) {
        const value = await localforage.getItem(key);
        arr.push({ key, val: value });
      }
      setItems(arr);
    } catch (e) {
      setMsg(e?.message || "Failed to load offline queue");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener("online", syncAll);
    return () => window.removeEventListener("online", syncAll);
  }, [load]);

  const addSample = useCallback(async () => {
    try {
      const id = `item_${Date.now()}`;
      await localforage.setItem(id, { connectorId: "connector-id", payload: "HL7|..." });
      setMsg("Sample item added");
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to add sample item");
    }
  }, [load]);

  const syncAll = useCallback(async () => {
    try {
      const keys = await localforage.keys();
      const rows = [];
      for (const key of keys) {
        rows.push(await localforage.getItem(key));
      }
      if (rows.length === 0) {
        setMsg("Nothing to sync");
        return;
      }
      await uploadOfflineSyncItems(rows);
      for (const key of keys) {
        await localforage.removeItem(key);
      }
      setMsg("Synced successfully");
      await load();
    } catch (e) {
      setMsg(e?.message || "Sync failed");
    }
  }, [load]);

  return { items, msg, load, addSample, syncAll };
}

export default useOfflineSync;
