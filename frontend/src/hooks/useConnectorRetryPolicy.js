import { useCallback, useEffect, useState } from "react";
import { listConnectors, saveConnectorRetryPolicy } from "../services/connectorsApi";

export function useConnectorRetryPolicy() {
  const [connectors, setConnectors] = useState([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState("");
  const [policy, setPolicy] = useState({ attempts: 5, backoffDelay: 1000, backoffType: "exponential" });
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const js = await listConnectors();
      setConnectors(Array.isArray(js) ? js : Array.isArray(js?.items) ? js.items : []);
    } catch (e) {
      setMessage(e?.message || "Failed to load connectors");
      setConnectors([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!selectedConnectorId) {
      setMessage("Select connector");
      return;
    }
    try {
      await saveConnectorRetryPolicy(selectedConnectorId, policy);
      setMessage("Policy saved.");
    } catch (e) {
      setMessage(e?.message || "Failed to save policy");
    }
  }, [policy, selectedConnectorId]);

  return {
    connectors,
    selectedConnectorId,
    setSelectedConnectorId,
    policy,
    setPolicy,
    message,
    setMessage,
    load,
    save,
  };
}

export default useConnectorRetryPolicy;
