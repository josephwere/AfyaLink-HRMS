import { useEffect, useState } from "react";
import { listDlqItems, updateDlqItem, retryDlqItem } from "../services/dlqApi";

export default function useDLQInspectEdit() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editData, setEditData] = useState("");

  const asList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  async function load() {
    const js = await listDlqItems();
    setItems(asList(js));
  }

  async function view(id) {
    const js = await listDlqItems();
    // if API provides single item endpoint, prefer that; fall back
    const found = asList(js).find((it) => String(it.id) === String(id));
    setSelected(found || null);
    setEditData(JSON.stringify(found?.data || {}, null, 2));
  }

  async function save() {
    const payload = JSON.parse(editData);
    await updateDlqItem(selected.id, payload);
    await load();
  }

  async function retry() {
    await retryDlqItem(selected.id);
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return { items, selected, editData, setEditData, load, view, save, retry };
}
