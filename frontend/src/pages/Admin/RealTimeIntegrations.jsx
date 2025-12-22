import React, { useState } from "react";
import API_BASE from "../../config/api";


export default function RealTimeIntegrations() {
  const [source, setSource] = useState("hospital-a");
  const [hl7, setHl7] = useState("");
  const [fhir, setFhir] = useState("");
  const [res, setRes] = useState(null);

  async function sendHL7() {
    const r = await fetch(`${API_BASE}/webhooks/${source}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hl7 }),
    });

    const j = await r.json();
    setRes(j);
  }

  async function sendFHIR() {
    let obj = {};
    try {
      obj = JSON.parse(fhir);
    } catch (e) {
      alert("Invalid JSON");
      return;
    }

    const r = await fetch(`${API_BASE}/webhooks/${source}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ resource: obj }),
    });

    const j = await r.json();
    setRes(j);
  }

  return (
    <div>
      <h2>Real-Time Integrations (Webhooks)</h2>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h4>Send HL7 Message</h4>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <textarea
            value={hl7}
            onChange={(e) => setHl7(e.target.value)}
            rows={8}
            style={{ width: "100%" }}
            placeholder="Paste raw HL7 message here (\r delimited)"
          />
          <button onClick={sendHL7}>Send HL7</button>
        </div>

        <div style={{ flex: 1 }}>
          <h4>Send FHIR Patient Resource</h4>
          <textarea
            value={fhir}
            onChange={(e) => setFhir(e.target.value)}
            rows={8}
            style={{ width: "100%" }}
            placeholder="Paste FHIR Patient JSON here"
          />
          <button onClick={sendFHIR}>Send FHIR</button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h4>Response</h4>
        <pre>{JSON.stringify(res, null, 2)}</pre>
      </div>
    </div>
  );
}
