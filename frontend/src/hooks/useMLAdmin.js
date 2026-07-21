import { useState } from "react";
import { apiFetch } from "../utils/apiFetch";

export function useMLAdmin() {
  const [model, setModel] = useState(null);
  const [msg, setMsg] = useState("");

  const train = async () => {
    try {
      const data = await apiFetch("/api/ml/train", { method: "POST", body: [{ example: 1 }] });
      setModel(data);
      setMsg("Model trained");
    } catch (e) {
      setMsg(e?.message || "Training failed");
    }
  };

  const predict = async () => {
    if (!model) return setMsg("Train first");
    try {
      const data = await apiFetch(`/api/ml/${model.modelId}/predict`, { method: "POST", body: { input: {} } });
      setMsg(JSON.stringify(data));
    } catch (e) {
      setMsg(e?.message || "Prediction failed");
    }
  };

  return { model, msg, setMsg, train, predict };
}

export default useMLAdmin;
