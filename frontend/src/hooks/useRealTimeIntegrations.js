import { useState } from "react";
import { sendWebhook } from "../services/webhooksApi";

export function useRealTimeIntegrations() {
  const [source, setSource] = useState("hospital-a");
  const [hl7, setHl7] = useState("");
  const [fhir, setFhir] = useState("");
  const [res, setRes] = useState(null);

  async function sendHL7() {
    try {
      const j = await sendWebhook(source, { hl7 });
      setRes(j);
    } catch (e) {
      setRes({ error: e?.message || "Failed to send HL7 payload" });
    }
  }

  async function sendFHIR() {
    let obj = {};
    try {
      obj = JSON.parse(fhir);
    } catch (e) {
      return { error: "Invalid JSON" };
    }

    try {
      const j = await sendWebhook(source, { resource: obj });
      setRes(j);
    } catch (e) {
      setRes({ error: e?.message || "Failed to send FHIR payload" });
    }
  }

  return {
    source,
    setSource,
    hl7,
    setHl7,
    fhir,
    setFhir,
    res,
    sendHL7,
    sendFHIR,
  };
}

export default useRealTimeIntegrations;
