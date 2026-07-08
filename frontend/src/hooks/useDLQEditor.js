import { useEffect, useState } from "react";
import { listDlq, viewDlq, editRetry } from "../services/dlqEditorApi";

export default function useDLQEditor() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [payload, setPayload] = useState("");

  const asList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  async function load() {
    const js = await listDlq();
    setItems(asList(js));
  }

  async function view(id) {
    const js = await viewDlq(id);
    setSelected(js);
    setPayload(JSON.stringify(js.data, null, 2));
  }

  async function saveAndRetry(id) {
    const newData = JSON.parse(payload);
    await editRetry(id, newData);
    await load();
    setSelected(null);
  }

  useEffect(() => {
    load();
  }, []);

  return {
    items,
    selected,
    payload,
    setPayload,
    load,
    view,
    saveAndRetry,
  };
}
