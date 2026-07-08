import { useEffect, useState } from "react";
import { listDlq } from "../services/dlqEditorApi";
import { retryDlqItem } from "../services/dlqApi";

export default function useDLQInspector() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    const js = await listDlq();
    const rows = Array.isArray(js) ? js : Array.isArray(js?.items) ? js.items : [];
    setItems(rows);
  }

  async function retry(id) {
    setMsg("");
    try {
      await retryDlqItem(id);
      setMsg("Queued for reprocessing.");
      await load();
    } catch (e) {
      setMsg(e?.message || "Could not reprocess this item.");
    }
  }

  useEffect(() => { load(); }, []);

  return { items, msg, load, retry };
}
